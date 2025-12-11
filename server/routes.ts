import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { urlSchema, type PlanFeatureFlags } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "./storage";
import { tenantMiddleware, type TenantScopedRequest } from "./tenant";
import { normalizeUrl, performFullAudit, runMetaAudit } from "./auditEngine";

type AuditJob = {
  id: string;
  runId: number;
  tenantId: string;
  userId: string;
  target: string;
  idempotencyKey: string;
};

class AuditJobQueue {
  private queue: AuditJob[] = [];
  private processing = false;
  private timeoutMs = 30000;

  enqueue(job: AuditJob) {
    this.queue.push(job);
    this.processNext();
  }

  private async processNext() {
    if (this.processing) return;
    const job = this.queue.shift();
    if (!job) return;
    this.processing = true;

    await storage.updateAuditRun(job.runId, { status: "RUNNING" });

    try {
      const result = await this.runWithTimeout(runMetaAudit(job.target), this.timeoutMs);
      const summary = `Health score ${result.analysis.healthScore}% with ${result.analysis.missingCount} missing tags`;
      await storage.updateAuditRun(job.runId, {
        status: "SUCCEEDED",
        healthScore: result.analysis.healthScore,
        summary,
        completedAt: new Date().toISOString(),
      });
      await storage.createAnalysis({
        ...result,
        analysis: { ...result.analysis, id: job.runId },
      });
    } catch (error) {
      const status = error instanceof Error && error.message === "TIMEOUT" ? "TIMED_OUT" : "FAILED";
      await storage.updateAuditRun(job.runId, {
        status,
        summary: status === "TIMED_OUT" ? "Audit timed out" : "Audit failed",
        completedAt: new Date().toISOString(),
      });
    } finally {
      this.processing = false;
      setImmediate(() => this.processNext());
    }
  }

  private runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
      promise
        .then((result) => resolve(result))
        .catch((err) => reject(err))
        .finally(() => clearTimeout(timer));
    });
  }
}

const auditQueue = new AuditJobQueue();
const auditQuerySchema = z.object({ url: z.string().url("Please enter a valid URL") });

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
      const normalizedUrl = normalizeUrl(url);

      const planName = storage.getPlanForTenant(req.tenant.tenantId);
      const plan = storage.getPlanFlags(planName);
      const usage = await storage.getUsage(req.tenant.tenantId);
      if (usage.runsCount >= plan.maxMonthlyRuns) {
        return res.status(429).json({
          message: "Monthly quota exceeded. Upgrade plan or wait for next period.",
          remaining: 0,
        });
      }

      const idempotencyKey = `${normalizedUrl}:sync:${new Date().toISOString().slice(0, 10)}`;

      const run = await storage.createAuditRun({
        tenantId: req.tenant.tenantId,
        userId: req.tenant.userId,
        target: normalizedUrl,
        status: "RUNNING",
        healthScore: null,
        summary: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
        jobId: undefined,
        idempotencyKey,
      });

      await storage.incrementUsage(req.tenant.tenantId, plan.name.toLowerCase());

      try {
        const audit = await performFullAudit(normalizedUrl);
        const combinedHealth = Math.round(
          (audit.scores.seo + audit.scores.performance + audit.scores.accessibility + audit.scores.security) / 4,
        );

        await storage.createAnalysis({
          ...audit.meta,
          analysis: { ...audit.meta.analysis, id: run.id, healthScore: combinedHealth },
        });

        const summary = `SEO ${audit.scores.seo}, Performance ${audit.scores.performance}, Accessibility ${audit.scores.accessibility}, Security ${audit.scores.security}`;

        await storage.updateAuditRun(run.id, {
          status: "SUCCEEDED",
          healthScore: combinedHealth,
          summary,
          completedAt: new Date().toISOString(),
        });

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
          summary: "Audit failed",
          completedAt: new Date().toISOString(),
        });
        console.error("Error running audit", error);
        return res.status(500).json({ message: "Failed to run audit" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message || "Invalid URL format" });
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
      const normalizedUrl = normalizeUrl(url);

      const plan = storage.getPlanFlags(storage.getPlanForTenant(req.tenant.tenantId));
      const usage = await storage.getUsage(req.tenant.tenantId);
      if (usage.runsCount >= plan.maxMonthlyRuns) {
        return res.status(429).json({
          message: "Monthly quota exceeded. Upgrade plan or wait for next period.",
          remaining: 0,
        });
      }

      const idempotencyKey = `${normalizedUrl}:${new Date().toISOString().slice(0, 10)}`;
      const existing = await storage.findAuditRunByKey(req.tenant.tenantId, idempotencyKey);
      if (existing) {
        return res.status(200).json({
          runId: existing.id,
          status: existing.status,
          jobId: existing.jobId,
          target: existing.target,
        });
      }

      const run = await storage.createAuditRun({
        tenantId: req.tenant.tenantId,
        userId: req.tenant.userId,
        target: normalizedUrl,
        status: "QUEUED",
        healthScore: null,
        summary: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
        jobId: undefined,
        idempotencyKey,
      });

      const jobId = `job_${run.id}`;
      await storage.updateAuditRun(run.id, { jobId });
      await storage.incrementUsage(req.tenant.tenantId, plan.name.toLowerCase());
      auditQueue.enqueue({
        id: jobId,
        runId: run.id,
        tenantId: req.tenant.tenantId,
        userId: req.tenant.userId,
        target: normalizedUrl,
        idempotencyKey,
      });

      res.json({
        jobId,
        runId: run.id,
        status: "QUEUED",
        target: normalizedUrl,
      });
    } catch (error) {
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
