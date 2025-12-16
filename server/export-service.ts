import { ReportViewModel, ExportRequest, ExportResponse } from "@shared/report-schema";
import { PLAN_CONFIGS, TenantContext } from "@shared/schema";
import { ReportService } from "./report-service";
import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";

// Feature flags
const FEATURE_FLAGS = {
  EXPORTS_ENABLED: process.env.EXPORTS_ENABLED === "true",
  PDF_EXPORTS: process.env.PDF_EXPORTS === "true",
  HTML_EXPORTS: process.env.HTML_EXPORTS === "true",
} as const;

export class ExportService {
  /**
   * Check if exports are enabled and user has entitlement
   */
  static canExport(tenantContext: TenantContext): { allowed: boolean; reason?: string } {
    if (!FEATURE_FLAGS.EXPORTS_ENABLED) {
      return { allowed: false, reason: "Export feature is currently disabled" };
    }

    const planConfig = PLAN_CONFIGS[tenantContext.plan];
    if (!planConfig.exportsEnabled) {
      return { 
        allowed: false, 
        reason: `Export feature requires Pro plan. Current plan: ${tenantContext.plan}` 
      };
    }

    return { allowed: true };
  }

  /**
   * Export report in requested format
   */
  static async exportReport(
    tenantContext: TenantContext,
    request: ExportRequest
  ): Promise<ExportResponse> {
    // Check entitlements
    const canExport = this.canExport(tenantContext);
    if (!canExport.allowed) {
      return {
        success: false,
        error: canExport.reason,
      };
    }

    // Check format availability
    if (request.format === "pdf" && !FEATURE_FLAGS.PDF_EXPORTS) {
      return {
        success: false,
        error: "PDF export is currently disabled",
      };
    }

    if (request.format === "html" && !FEATURE_FLAGS.HTML_EXPORTS) {
      return {
        success: false,
        error: "HTML export is currently disabled",
      };
    }

    try {
      // Generate report
      const report = await ReportService.generateReport(tenantContext.tenantId, request.runId);
      if (!report) {
        return {
          success: false,
          error: "Report not found",
        };
      }

      // Apply filters if provided
      if (request.filters) {
        report.findings = ReportService.applyFilters(report.findings, request.filters);
        // Recalculate top fixes with filtered findings
        const failedFindings = report.findings.filter(f => f.status === "fail");
        report.topFixes = failedFindings
          .sort((a, b) => b.priorityScore - a.priorityScore)
          .slice(0, 5)
          .map((finding, index) => ({
            finding,
            rank: index + 1,
            impactScore: Math.round((finding.priorityScore * 0.8)), // Simplified
            effortScore: Math.round((100 - finding.priorityScore * 0.2)), // Simplified
            categoryRelevance: finding.category === "seo" ? 1.0 : finding.category === "social" ? 0.8 : 0.6,
          }));
      }

      // Generate export based on format
      if (request.format === "html") {
        return await this.generateHtmlExport(report, request);
      } else if (request.format === "pdf") {
        return await this.generatePdfExport(report, request);
      }

      return {
        success: false,
        error: "Unsupported export format",
      };
    } catch (error) {
      console.error("Export error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Export failed",
      };
    }
  }

  /**
   * Generate HTML export
   */
  private static async generateHtmlExport(
    report: ReportViewModel,
    request: ExportRequest
  ): Promise<ExportResponse> {
    const html = this.generateHtmlTemplate(report, request.includeGuidance);
    
    // In production, save to S3 or similar storage
    const filename = `report-${request.runId}-${Date.now()}.html`;
    const filepath = path.join(process.cwd(), "exports", filename);
    
    // Ensure exports directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, html, "utf-8");

    // Generate signed URL (mock for MVP)
    const downloadUrl = `/api/exports/download/${filename}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    return {
      success: true,
      downloadUrl,
      filename,
      expiresAt,
    };
  }

  /**
   * Generate PDF export using Puppeteer
   */
  private static async generatePdfExport(
    report: ReportViewModel,
    request: ExportRequest
  ): Promise<ExportResponse> {
    const html = this.generateHtmlTemplate(report, request.includeGuidance);
    
    let browser;
    try {
      browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      
      await page.setContent(html, { waitUntil: "networkidle0" });
      
      const filename = `report-${request.runId}-${Date.now()}.pdf`;
      const filepath = path.join(process.cwd(), "exports", filename);
      
      // Ensure exports directory exists
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      
      await page.pdf({
        path: filepath,
        format: "A4",
        printBackground: true,
        margin: {
          top: "20mm",
          right: "15mm",
          bottom: "20mm",
          left: "15mm",
        },
      });

      // Generate signed URL (mock for MVP)
      const downloadUrl = `/api/exports/download/${filename}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      return {
        success: true,
        downloadUrl,
        filename,
        expiresAt,
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Generate HTML template for export
   */
  private static generateHtmlTemplate(report: ReportViewModel, includeGuidance: boolean): string {
    const { healthScore, categoryCounts, severityCounts, topFixes, findings, metadata } = report;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web Audit Report - ${metadata.url}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .header { padding: 30px; border-bottom: 1px solid #e2e8f0; }
        .header h1 { margin: 0 0 10px 0; color: #1e293b; }
        .header .meta { color: #64748b; font-size: 14px; }
        .score-section { padding: 30px; border-bottom: 1px solid #e2e8f0; }
        .score-card { display: inline-block; text-align: center; margin-right: 40px; }
        .score-value { font-size: 48px; font-weight: bold; margin: 0; }
        .score-label { color: #64748b; font-size: 14px; margin: 5px 0 0 0; }
        .grade-excellent { color: #22c55e; }
        .grade-good { color: #84cc16; }
        .grade-fair { color: #eab308; }
        .grade-poor { color: #f97316; }
        .grade-critical { color: #ef4444; }
        .counts-section { padding: 30px; border-bottom: 1px solid #e2e8f0; }
        .counts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .count-card { padding: 20px; border: 1px solid #e2e8f0; border-radius: 6px; }
        .count-card h3 { margin: 0 0 15px 0; color: #1e293b; }
        .count-item { display: flex; justify-content: space-between; margin: 8px 0; }
        .fixes-section { padding: 30px; border-bottom: 1px solid #e2e8f0; }
        .fix-item { padding: 20px; border: 1px solid #e2e8f0; border-radius: 6px; margin: 15px 0; }
        .fix-header { display: flex; justify-content: between; align-items: center; margin-bottom: 10px; }
        .fix-rank { background: #3b82f6; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
        .fix-title { font-weight: 600; color: #1e293b; margin-left: 15px; flex: 1; }
        .severity-critical { color: #ef4444; }
        .severity-high { color: #f97316; }
        .severity-medium { color: #eab308; }
        .severity-low { color: #84cc16; }
        .severity-info { color: #64748b; }
        .findings-section { padding: 30px; }
        .finding-item { padding: 15px; border-left: 4px solid #e2e8f0; margin: 10px 0; background: #f8fafc; }
        .finding-item.critical { border-left-color: #ef4444; }
        .finding-item.high { border-left-color: #f97316; }
        .finding-item.medium { border-left-color: #eab308; }
        .finding-item.low { border-left-color: #84cc16; }
        .finding-item.info { border-left-color: #64748b; }
        .finding-title { font-weight: 600; margin-bottom: 5px; }
        .finding-message { color: #64748b; margin-bottom: 10px; }
        .finding-guidance { background: white; padding: 10px; border-radius: 4px; font-size: 14px; }
        .footer { padding: 20px 30px; background: #f8fafc; color: #64748b; font-size: 12px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Web Audit Report</h1>
            <div class="meta">
                <div><strong>URL:</strong> ${metadata.url}</div>
                <div><strong>Audit Type:</strong> ${metadata.auditType}</div>
                <div><strong>Generated:</strong> ${new Date(report.generatedAt).toLocaleString()}</div>
                <div><strong>Run ID:</strong> ${metadata.runId}</div>
            </div>
        </div>

        <div class="score-section">
            <div class="score-card">
                <div class="score-value grade-${healthScore.grade}">${healthScore.overall}</div>
                <div class="score-label">Overall Score</div>
            </div>
            <div class="score-card">
                <div class="score-value">${healthScore.categoryScores.seo}</div>
                <div class="score-label">SEO Score</div>
            </div>
            <div class="score-card">
                <div class="score-value">${healthScore.categoryScores.social}</div>
                <div class="score-label">Social Score</div>
            </div>
            <div class="score-card">
                <div class="score-value">${healthScore.categoryScores.technical}</div>
                <div class="score-label">Technical Score</div>
            </div>
        </div>

        <div class="counts-section">
            <div class="counts-grid">
                <div class="count-card">
                    <h3>By Category</h3>
                    <div class="count-item"><span>SEO Issues:</span> <span>${categoryCounts.seo.fail}</span></div>
                    <div class="count-item"><span>Social Issues:</span> <span>${categoryCounts.social.fail}</span></div>
                    <div class="count-item"><span>Technical Issues:</span> <span>${categoryCounts.technical.fail}</span></div>
                </div>
                <div class="count-card">
                    <h3>By Severity</h3>
                    <div class="count-item"><span>Critical:</span> <span>${severityCounts.critical}</span></div>
                    <div class="count-item"><span>High:</span> <span>${severityCounts.high}</span></div>
                    <div class="count-item"><span>Medium:</span> <span>${severityCounts.medium}</span></div>
                    <div class="count-item"><span>Low:</span> <span>${severityCounts.low}</span></div>
                </div>
            </div>
        </div>

        <div class="fixes-section">
            <h2>Top Priority Fixes</h2>
            ${topFixes.map(fix => `
                <div class="fix-item">
                    <div class="fix-header">
                        <div class="fix-rank">${fix.rank}</div>
                        <div class="fix-title">${fix.finding.title}</div>
                        <div class="severity-${fix.finding.severity}">${fix.finding.severity.toUpperCase()}</div>
                    </div>
                    <div class="finding-message">${fix.finding.message}</div>
                    ${includeGuidance ? `<div class="finding-guidance"><strong>How to fix:</strong> ${fix.finding.guidance}</div>` : ''}
                </div>
            `).join('')}
        </div>

        <div class="findings-section">
            <h2>All Findings (${findings.length})</h2>
            ${findings.map(finding => `
                <div class="finding-item ${finding.severity}">
                    <div class="finding-title">${finding.title} <span class="severity-${finding.severity}">[${finding.severity.toUpperCase()}]</span></div>
                    <div class="finding-message">${finding.message}</div>
                    ${includeGuidance ? `<div class="finding-guidance"><strong>How to fix:</strong> ${finding.guidance}</div>` : ''}
                </div>
            `).join('')}
        </div>

        <div class="footer">
            Generated by Web Audit SaaS • Report Version ${report.version} • ${new Date(report.generatedAt).toISOString()}
        </div>
    </div>
</body>
</html>`;
  }
}