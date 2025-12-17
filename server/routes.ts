import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, getDefaultTenantContext } from "./storage";
import { requireEntitlement, checkQuota, PlanGatingService } from "./plan-gating";
import express from "express";
import { urlSchema, PLAN_CONFIGS, TenantContext } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { requireRole, requireTenantContext } from "./context";
import { AuditQueue } from "./queue";
import { analyzeUrl } from "./services/analyzer";
import { getTenantPlan } from "./entitlements";
import { usageLedger } from "./services/usage";
import { randomUUID } from "crypto";

type AuditJobPayload = {
  tenantId: string;
  userId: string;
  url: string;
  auditType: string;
  requestId: string;
};

const auditQueue = new AuditQueue<AuditJobPayload, Awaited<ReturnType<typeof storage.createAnalysis>>>(
  (payload) => `${payload.tenantId}|${payload.auditType}|${payload.url}`,
);

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  const apiRouter = express.Router();
  
  // Middleware to add tenant context (simplified for MVP - uses default tenant)
  apiRouter.use(async (req, res, next) => {
    try {
      // In production, extract tenant from JWT token or request headers
      req.tenantContext = await getDefaultTenantContext();
      next();
    } catch (error) {
      console.error('Failed to load tenant context:', error);
      // Differentiate between authentication and system errors
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(401).json({ message: "Authentication required" });
      } else {
        res.status(500).json({ message: "System error occurred" });
      }
    }
  });

  // Health check endpoint for CI/CD
  apiRouter.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      message: "Meta Tag Analyzer API is healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    });
  });
  
  // Get current plan and entitlements
  apiRouter.get("/plan", (req, res) => {
    const tenantContext = req.tenantContext as TenantContext;
    const planConfig = PLAN_CONFIGS[tenantContext.plan];
    
    res.json({
      currentPlan: tenantContext.plan,
      entitlements: planConfig,
      tenantId: tenantContext.tenantId
    });
  });
  
  // Get analysis history with plan-based depth limiting
  apiRouter.get("/history", async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const historyDepth = PlanGatingService.getQuotaLimit(tenantContext, 'historyDepth');
      
      const history = await storage.getAnalysisHistory(tenantContext.tenantId, historyDepth);
      
      res.json({
        analyses: history,
        limit: historyDepth,
        currentPlan: tenantContext.plan
      });
    } catch (error) {
      console.error("Error fetching history:", error);
      res.status(500).json({ message: "Failed to fetch analysis history" });
    }
  });
  
  // Export analysis (gated feature)
  apiRouter.post("/export/:id", requireEntitlement('exportsEnabled'), async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const analysisId = parseInt(req.params.id);
      const format = req.body.format || 'json'; // json, pdf, html
      
      const analysis = await storage.getAnalysis(tenantContext.tenantId, analysisId);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      
      // Increment export usage
      await storage.incrementUsage(tenantContext.tenantId, 'export');
      
      // For MVP, just return the analysis data
      // In production, this would generate PDF/HTML exports
      res.json({
        message: "Export generated successfully",
        format,
        data: analysis
      });
    } catch (error) {
      console.error("Error exporting analysis:", error);
      res.status(500).json({ message: "Failed to export analysis" });
    }
  });

  // Analyze URL endpoint with quota checking
  apiRouter.post("/analyze", checkQuota('monthlyAuditLimit'), async (req, res) => {
  apiRouter.use(requireTenantContext);

  apiRouter.get("/context", (req, res) => {
    res.json({ context: req.tenantContext });
  });

  apiRouter.get("/usage", (req, res) => {
    const context = req.tenantContext;
    if (!context) {
      return res.status(401).json({ message: "Missing tenant context" });
    }
    const plan = getTenantPlan(context.tenantId);
    const usage = usageLedger.getSnapshot(context.tenantId, plan.monthlyQuota, plan.id);
    res.json({ usage, plan });
  });

  // Analyze URL endpoint
  apiRouter.post("/analyze", requireRole(["owner", "member"]), async (req, res) => {
    try {
      const context = req.tenantContext;
      if (!context) {
        return res.status(401).json({ message: "Missing tenant context" });
      }

      const plan = getTenantPlan(context.tenantId);
      // Validate URL
      const { url } = urlSchema.parse(req.body);

      let normalizedUrl = url;
      if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = "https://" + normalizedUrl;
      }

      usageLedger.assertWithinQuota(context.tenantId, plan.monthlyQuota, plan.id);

      const payload: AuditJobPayload = {
        tenantId: context.tenantId,
        userId: context.userId,
        url: normalizedUrl,
        auditType: "meta",
        requestId: randomUUID(),
      };

      usageLedger.increment(context.tenantId);

      const storedAnalysis = await auditQueue.enqueue(payload, async () => {
        const analysisResult = await analyzeUrl(normalizedUrl, {
          tenantId: context.tenantId,
          userId: context.userId,
          auditType: "meta",
        });

        return storage.createAnalysis(analysisResult);
      });

      const recentAnalyses = await storage.getRecentAnalyses(
        context.tenantId,
        normalizedUrl,
        plan.features.historyDepth,
      );
      const usage = usageLedger.getSnapshot(context.tenantId, plan.monthlyQuota, plan.id);

      res.json({
        ...storedAnalysis,
        recentAnalyses,
        usage,
        plan,
        requestId: payload.requestId,
      });
      
      // Calculate health score (simplified algorithm)
      const totalImportantTags = importantSeoTags.length + 
                                 importantSocialTags.filter(t => ['og:title', 'og:description', 'og:image', 'twitter:card'].includes(t)).length + 
                                 importantTechnicalTags.filter(t => ['robots', 'charset'].includes(t)).length;
      
      const presentImportantTags = totalImportantTags - missingCount;
      const healthScore = Math.round((presentImportantTags / totalImportantTags) * 100);
      
      // Create analysis record
      const totalTags = foundMetaTags.length;
      
      const analysisResult = {
        analysis: {
          id: 0, // Will be assigned by storage
          url: normalizedUrl,
          totalCount: totalTags,
          seoCount,
          socialCount,
          technicalCount, 
          missingCount,
          healthScore,
          timestamp: new Date().toISOString()
        },
        tags: foundMetaTags,
        recommendations
      };
      
      // Store the results
      const tenantContext = req.tenantContext as TenantContext;
      const storedAnalysis = await storage.createAnalysis(tenantContext.tenantId, analysisResult);
      
      // Increment audit usage
      await storage.incrementUsage(tenantContext.tenantId, 'audit');
      
      res.json(storedAnalysis);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message || "Invalid URL format" });
      }
      console.error("Error analyzing website:", error);
      res.status((error as any)?.status || 500).json({
        message: error instanceof Error ? error.message : "Failed to analyze website",
      });
    }
  });

  apiRouter.get("/analyses/:id", async (req, res) => {
    const context = req.tenantContext;
    if (!context) {
      return res.status(401).json({ message: "Missing tenant context" });
    }

    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid analysis id" });
    }

    const analysis = await storage.getAnalysis(id, context.tenantId);
    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }

    res.json(analysis);
  });

  app.use("/api", apiRouter);

  const httpServer = createServer(app);
  return httpServer;
}
