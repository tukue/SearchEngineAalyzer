import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { urlSchema, type PlanFeatureFlags } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { sanitizeUrl } from "./sanitizer";
import { storage } from "./storage";
import { tenantMiddleware, type TenantScopedRequest } from "./tenant";
import { AuditService, QuotaExceededError, auditQuerySchema, type AuditJobPayload } from "./auditService";
import { FetchPageError } from "./auditEngine";
import { JobQueue } from "./jobQueue";

const auditService = new AuditService(storage);
const auditQueue = new JobQueue((job: AuditJobPayload) => auditService.processJob(job));

export function createApiRouter(): express.Router {
  const apiRouter = express.Router();
  apiRouter.use(tenantMiddleware);

  apiRouter.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      message: "Meta Tag Analyzer API is healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    });
  });

  apiRouter.get("/audit", async (req: TenantScopedRequest, res) => {
    try {
      if (!req.tenant) {
        return res.status(401).json({ message: "Missing tenant context" });
      }

      const { url } = auditQuerySchema.parse({ url: req.query.url });
      const sanitizedUrl = sanitizeUrl(url);
      const run = await auditService.createImmediateRun({ tenantId: req.tenant.tenantId, userId: req.tenant.userId, url: sanitizedUrl });

      try {
        const { audit, summary } = await auditService.runFullAudit(run, run.target);
        const overallScore = Math.round((audit.scores.seo + audit.scores.performance + audit.scores.accessibility + audit.scores.security) / 4);
        
        return res.json({
          runId: run.id,
          url: audit.url,
          scores: {
            overall: overallScore,
            seo: audit.scores.seo,
            social: audit.scores.performance, // Using performance as social proxy
            technical: audit.scores.accessibility
          },
          issues: audit.issues,
          recommendations: audit.recommendations,
          summary,
          htmlSizeKb: audit.htmlSizeKb,
        });
      } catch (error) {
        await storage.updateAuditRun(run.id, {
          status: "FAILED",
          summary: error instanceof FetchPageError ? "Network error reaching target" : "Audit failed",
          completedAt: new Date().toISOString(),
        });
        console.error("Error running audit", error);
        if (error instanceof FetchPageError) {
          return res.status(502).json({ message: error.message });
        }
        return res.status(500).json({ message: "Failed to run audit" });
      }
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return res.status(429).json({ message: error.message, remaining: 0 });
      }
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message || "Invalid URL format" });
      }
      if (error instanceof FetchPageError) {
        return res.status(502).json({ message: error.message });
      }
      console.error("Audit error", error);
      return res.status(500).json({ message: "Failed to run audit" });
    }
  });

  apiRouter.post("/analyze", async (req: TenantScopedRequest, res) => {
    try {
      if (!req.tenant) {
        return res.status(401).json({ message: "Missing tenant context" });
      }

      const { url } = urlSchema.parse(req.body);
      const sanitizedUrl = sanitizeUrl(url);

      const { run, jobId } = await auditService.createQueuedRun({
        tenantId: req.tenant.tenantId,
        userId: req.tenant.userId,
        target: sanitizedUrl,
      });

      auditQueue.enqueue({
        runId: run.id,
        tenantId: req.tenant.tenantId,
        userId: req.tenant.userId,
        target: sanitizedUrl,
        idempotencyKey: run.idempotencyKey || `${sanitizedUrl}:${Date.now()}`,
      });

      res.json({
        jobId,
        runId: run.id,
        status: run.status,
        target: run.target,
      });
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return res.status(429).json({ message: error.message, remaining: 0 });
      }
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message || "Invalid URL format" });
      }
      console.error("Error queuing website analysis:", error);
      res.status(500).json({ message: "Failed to queue website analysis" });
    }
  });

  apiRouter.get("/audits/:id", async (req: TenantScopedRequest, res) => {
    if (!req.tenant) {
      return res.status(401).json({ message: "Missing tenant context" });
    }

    const runId = Number(req.params.id);
    const run = await storage.findAuditRun(runId, req.tenant.tenantId);
    if (!run) {
      return res.status(404).json({ message: "Audit run not found" });
    }

    const analysis = await storage.getAnalysis(runId);
    res.json({ run, analysis });
  });

  apiRouter.get("/recent-runs", async (req: TenantScopedRequest, res) => {
    if (!req.tenant) {
      return res.status(401).json({ message: "Missing tenant context" });
    }

    const plan = storage.getPlanFlags(storage.getPlanForTenant(req.tenant.tenantId));
    const runs = await storage.listRecentRuns(req.tenant.tenantId, plan.maxHistoryLength);
    res.json({ runs });
  });

  apiRouter.get("/plan", async (req: TenantScopedRequest, res) => {
    if (!req.tenant) {
      return res.status(401).json({ message: "Missing tenant context" });
    }

    const planName = storage.getPlanForTenant(req.tenant.tenantId);
    const flags = storage.getPlanFlags(planName);
    const usage = await storage.getUsage(req.tenant.tenantId);
    const remaining = Math.max(flags.maxMonthlyRuns - usage.runsCount, 0);

    const planDetails: PlanFeatureFlags & { plan: string; remainingRuns: number } = {
      ...flags,
      plan: planName,
      remainingRuns: remaining,
    };

    res.json(planDetails);
  });

  // Dashboard stats endpoint
  apiRouter.get("/dashboard/stats", async (req: TenantScopedRequest, res) => {
    if (!req.tenant) {
      return res.status(401).json({ message: "Missing tenant context" });
    }

    try {
      const stats = await storage.getDashboardStats(req.tenant.tenantId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Export audit report
  apiRouter.post("/audits/:id/export", async (req: TenantScopedRequest, res) => {
    if (!req.tenant) {
      return res.status(401).json({ message: "Missing tenant context" });
    }

    const runId = Number(req.params.id);
    const { format = 'pdf', includeRecommendations = true, includeRawData = false, customTitle } = req.body;

    // Check if user has export permissions
    const planName = storage.getPlanForTenant(req.tenant.tenantId);
    const flags = storage.getPlanFlags(planName);
    
    if (!flags.canExportReports) {
      return res.status(403).json({ message: "Export feature not available in your plan" });
    }

    try {
      const run = await storage.findAuditRun(runId, req.tenant.tenantId);
      if (!run) {
        return res.status(404).json({ message: "Audit run not found" });
      }

      if (run.status !== "COMPLETED") {
        return res.status(400).json({ message: "Can only export completed audits" });
      }

      const analysis = await storage.getAnalysis(runId);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis data not found" });
      }

      // Generate export (this would typically use a service like Puppeteer for PDF or template engine for HTML)
      const exportData = {
        title: customTitle || `Meta Tag Audit - ${new URL(run.target).hostname}`,
        run,
        analysis,
        includeRecommendations,
        includeRawData,
        generatedAt: new Date().toISOString(),
      };

      // For now, return a mock download URL
      // In production, this would generate the actual file and return a signed URL
      const downloadUrl = `/api/exports/${runId}.${format}?token=mock-token`;
      
      res.json({
        downloadUrl,
        shareUrl: flags.canExportReports ? `/shared/audit/${runId}` : undefined,
      });
    } catch (error) {
      console.error("Error exporting audit:", error);
      res.status(500).json({ message: "Failed to export audit" });
    }
  });

  // Delete audit run
  apiRouter.delete("/audits/:id", async (req: TenantScopedRequest, res) => {
    if (!req.tenant) {
      return res.status(401).json({ message: "Missing tenant context" });
    }

    const runId = Number(req.params.id);
    
    try {
      const run = await storage.findAuditRun(runId, req.tenant.tenantId);
      if (!run) {
        return res.status(404).json({ message: "Audit run not found" });
      }

      await storage.deleteAuditRun(runId, req.tenant.tenantId);
      res.json({ message: "Audit run deleted successfully" });
    } catch (error) {
      console.error("Error deleting audit run:", error);
      res.status(500).json({ message: "Failed to delete audit run" });
    }
  });

  // Add debug endpoint for development
  if (process.env.NODE_ENV === "development") {
    apiRouter.get("/debug/context", (req: TenantScopedRequest, res) => {
      res.json({
        tenant: req.tenant,
        headers: req.headers,
        timestamp: new Date().toISOString(),
      });
    });
  }

  return apiRouter;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use("/api", createApiRouter());
  const httpServer = createServer(app);
  return httpServer;
}
