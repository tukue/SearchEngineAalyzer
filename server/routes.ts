import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, getDefaultTenantContext } from "./storage";
import { requireEntitlement, PlanGatingService } from "./plan-gating";
import { checkAndReserveQuota, addQuotaToResponse, UsageLimitsService } from "./usage-limits";
import express from "express";
import { urlSchema, AuditRequest, PLAN_CONFIGS, TenantContext } from "@shared/schema";
import { z } from "zod";
import { formatZodError } from "@shared/validation";
import { createHttpError } from "./url-safety";
import { requireAuthContext } from "./context";
import { buildHealthResponse } from "../shared/health";
import { analyzeUrl } from "./services/analysis";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  const apiRouter = express.Router();
  const isAuthDisabled =
    process.env.API_AUTH_DISABLED === "true" ||
    process.env.API_AUTH_TOKEN === "disabled";
  
  // Middleware to add tenant context (simplified for MVP - uses default tenant)
  apiRouter.use(async (req, res, next) => {
    try {
      // Skip tenant context setup if authentication is disabled for testing
      if (isAuthDisabled) {
        return next();
      }
      
      // In production, extract tenant from JWT token or request headers
      // For now, just proceed without setting tenant context here
      // as it will be set by requireAuthContext middleware
      next();
    } catch (error) {
      console.error('Failed to load tenant context:', error);
      res.status(500).json({ message: "System error occurred" });
    }
  });

  // Health check endpoint for CI/CD
  apiRouter.get("/health", (req, res) => {
    res.status(200).json(buildHealthResponse());
  });

  apiRouter.use(requireAuthContext);

  // Get current plan and entitlements with quota status
  apiRouter.get("/plan", async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const planConfig = PLAN_CONFIGS[tenantContext.plan];
      const quotaStatus = await UsageLimitsService.getQuotaStatus(tenantContext.tenantId);
      
      res.json({
        currentPlan: tenantContext.plan,
        entitlements: planConfig,
        tenantId: tenantContext.tenantId,
        quota: quotaStatus
      });
    } catch (error) {
      console.error("Error fetching plan info:", error);
      res.status(500).json({ message: "Failed to fetch plan information" });
    }
  });
  
  // Get current quota status
  apiRouter.get("/quota", async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const quotaStatus = await UsageLimitsService.getQuotaStatus(tenantContext.tenantId);
      
      res.json(quotaStatus);
    } catch (error) {
      console.error("Error fetching quota status:", error);
      res.status(500).json({ message: "Failed to fetch quota status" });
    }
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
  
  // Analyze URL endpoint with quota checking and reservation
  apiRouter.post("/analyze", checkAndReserveQuota(), addQuotaToResponse(), async (req, res) => {
    const tenantContext = req.tenantContext!;
    const requestId = req.auditRequestId!;
    
    try {
      // Validate request
      const auditRequest = AuditRequest.parse({
        ...req.body,
        userId: req.tenantContext?.userId,
      });
      const { url } = auditRequest;

      if (tenantContext.role === "read-only") {
        throw createHttpError("Insufficient role for this action", 403);
      }

      // Use the service
      const analysisResult = await analyzeUrl(url, { 
        tenantId: tenantContext.tenantId,
        userId: tenantContext.userId
      });
      
      // Store the results
      const storedAnalysis = await storage.createAnalysis(tenantContext.tenantId, analysisResult);
      
      // Mark audit as completed
      await UsageLimitsService.completeAudit(tenantContext.tenantId, requestId);
      
      // Increment legacy usage tracking
      await storage.incrementUsage(tenantContext.tenantId, 'audit');
      
      res.json(storedAnalysis);
    } catch (error) {
      // Mark audit as failed
      try {
        await UsageLimitsService.failAudit(tenantContext.tenantId, requestId);
      } catch (failError) {
        console.error("Error marking audit as failed:", failError);
      }

      if (error instanceof z.ZodError) {
        const validationError = formatZodError(error);
        return res.status(400).json({ message: validationError || "Invalid request format" });
      }

      if ((error as any).status) {
        return res.status((error as any).status).json({ message: (error as Error).message });
      }

      console.error("Error analyzing website:", error);
      res.status(500).json({ message: "Failed to analyze website" });
    }
  });
  
  app.use("/api", apiRouter);
  
  const httpServer = createServer(app);
  return httpServer;
}
