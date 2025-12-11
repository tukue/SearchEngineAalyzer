import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { urlSchema, type PlanFeatureFlags } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "./storage";
import { tenantMiddleware, type TenantScopedRequest } from "./tenant";
import { AuditService, QuotaExceededError, auditQuerySchema } from "./auditService";
import { FetchPageError } from "./auditEngine";
import { JobQueue } from "./jobQueue";

const auditService = new AuditService(storage);
const auditQueue = new JobQueue((job) => auditService.processJob(job));

export async function registerRoutes(app: Express): Promise<Server> {
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
      const run = await auditService.createImmediateRun({ tenantId: req.tenant.tenantId, userId: req.tenant.userId, url });

      try {
        const { audit, summary } = await auditService.runFullAudit(run, run.target);
        return res.json({
          runId: run.id,
          url: audit.url,
          scores: audit.scores,
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

      const { run, jobId } = await auditService.createQueuedRun({
        tenantId: req.tenant.tenantId,
        userId: req.tenant.userId,
        target: url,
      });

      auditQueue.enqueue({
        runId: run.id,
        tenantId: req.tenant.tenantId,
        userId: req.tenant.userId,
        target: url,
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

  app.use("/api", apiRouter);

  const httpServer = createServer(app);
  return httpServer;
}
