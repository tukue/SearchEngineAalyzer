import type { Express } from "express";
import express from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { ReportService } from "./report-service";
import { ExportService } from "./export-service";
import { requireEntitlement } from "./plan-gating";
import { exportRequestSchema, reportFiltersSchema } from "@shared/report-schema";
import type { TenantContext } from "@shared/schema";
import fs from "fs/promises";
import path from "path";

export function registerReportRoutes(app: Express): void {
  const apiRouter = express.Router();

  // Get report by run ID
  apiRouter.get("/reports/:runId", async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const runId = req.params.runId;
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(runId)) {
        return res.status(400).json({ message: "Invalid run ID format" });
      }

      // Parse filters from query params
      let filters;
      if (req.query.filters) {
        try {
          const filtersData = JSON.parse(req.query.filters as string);
          filters = reportFiltersSchema.parse(filtersData);
        } catch (error) {
          return res.status(400).json({ message: "Invalid filters format" });
        }
      }

      // Generate report
      const report = await ReportService.generateReport(tenantContext.tenantId, runId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Apply filters if provided
      if (filters) {
        report.findings = ReportService.applyFilters(report.findings, filters);
        
        // Recalculate counts and top fixes with filtered data
        const filteredFindings = report.findings;
        
        // Recalculate category counts
        const categories = ["seo", "social", "technical"] as const;
        for (const category of categories) {
          const categoryFindings = filteredFindings.filter(f => f.category === category);
          report.categoryCounts[category] = {
            total: categoryFindings.length,
            pass: categoryFindings.filter(f => f.status === "pass").length,
            fail: categoryFindings.filter(f => f.status === "fail").length,
            warn: categoryFindings.filter(f => f.status === "warn").length,
          };
        }

        // Recalculate severity counts
        const severities = ["critical", "high", "medium", "low", "info"] as const;
        for (const severity of severities) {
          report.severityCounts[severity] = filteredFindings.filter(f => f.severity === severity).length;
        }
        report.severityCounts.total = filteredFindings.length;

        // Recalculate top fixes
        const failedFindings = filteredFindings.filter(f => f.status === "fail");
        report.topFixes = failedFindings
          .sort((a, b) => b.priorityScore - a.priorityScore)
          .slice(0, 5)
          .map((finding, index) => ({
            finding,
            rank: index + 1,
            impactScore: Math.round((finding.priorityScore * 0.8)),
            effortScore: Math.round((100 - finding.priorityScore * 0.2)),
            categoryRelevance: finding.category === "seo" ? 1.0 : finding.category === "social" ? 0.8 : 0.6,
          }));
      }

      res.json(report);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // Export report (feature-flagged and plan-gated)
  apiRouter.post("/reports/:runId/export", requireEntitlement('exportsEnabled'), async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const runId = req.params.runId;
      
      // Validate request
      const exportRequest = exportRequestSchema.parse({
        runId,
        ...req.body,
      });

      // Check export entitlements
      const canExport = ExportService.canExport(tenantContext);
      if (!canExport.allowed) {
        return res.status(403).json({ 
          message: canExport.reason,
          code: "EXPORT_NOT_ALLOWED",
        });
      }

      // Generate export
      const exportResult = await ExportService.exportReport(tenantContext, exportRequest);
      
      if (!exportResult.success) {
        return res.status(400).json({
          message: exportResult.error,
          code: "EXPORT_FAILED",
        });
      }

      res.json({
        success: true,
        downloadUrl: exportResult.downloadUrl,
        filename: exportResult.filename,
        expiresAt: exportResult.expiresAt,
        format: exportRequest.format,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: fromZodError(error).message,
          code: "VALIDATION_ERROR",
        });
      }
      console.error("Error exporting report:", error);
      res.status(500).json({ 
        message: "Failed to export report",
        code: "EXPORT_ERROR",
      });
    }
  });

  // Download exported file
  apiRouter.get("/exports/download/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      
      // Basic security check - only allow specific file patterns
      if (!/^report-[a-f0-9-]+-\d+\.(html|pdf)$/.test(filename)) {
        return res.status(400).json({ message: "Invalid filename" });
      }

      const filepath = path.join(process.cwd(), "exports", filename);
      
      try {
        await fs.access(filepath);
      } catch {
        return res.status(404).json({ message: "File not found or expired" });
      }

      // Set appropriate headers
      const ext = path.extname(filename);
      const contentType = ext === ".pdf" ? "application/pdf" : "text/html";
      
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      
      // Stream file
      const fileBuffer = await fs.readFile(filepath);
      res.send(fileBuffer);
      
      // Clean up file after download (optional)
      setTimeout(async () => {
        try {
          await fs.unlink(filepath);
        } catch (error) {
          console.warn("Failed to cleanup export file:", error);
        }
      }, 5000);
      
    } catch (error) {
      console.error("Error downloading export:", error);
      res.status(500).json({ message: "Download failed" });
    }
  });

  // Get report summary (lightweight version for dashboards)
  apiRouter.get("/reports/:runId/summary", async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const runId = req.params.runId;
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(runId)) {
        return res.status(400).json({ message: "Invalid run ID format" });
      }

      const report = await ReportService.generateReport(tenantContext.tenantId, runId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Return only summary data
      res.json({
        runId: report.metadata.runId,
        url: report.metadata.url,
        healthScore: report.healthScore,
        categoryCounts: report.categoryCounts,
        severityCounts: report.severityCounts,
        topFixesCount: report.topFixes.length,
        totalFindings: report.findings.length,
        generatedAt: report.generatedAt,
      });
    } catch (error) {
      console.error("Error generating report summary:", error);
      res.status(500).json({ message: "Failed to generate report summary" });
    }
  });

  // Health check for report service
  apiRouter.get("/reports/health", (req, res) => {
    res.json({
      status: "ok",
      service: "report-service",
      timestamp: new Date().toISOString(),
      features: {
        reportsEnabled: true,
        exportsEnabled: process.env.EXPORTS_ENABLED === "true",
        pdfExports: process.env.PDF_EXPORTS === "true",
        htmlExports: process.env.HTML_EXPORTS === "true",
      },
    });
  });

  app.use("/api", apiRouter);
}