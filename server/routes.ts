import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from "express";
import { urlSchema } from "@shared/schema";
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

  // Health check endpoint for CI/CD
  apiRouter.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      message: "Meta Tag Analyzer API is healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    });
  });

  apiRouter.use(requireTenantContext);

  apiRouter.get("/context", (req, res) => {
    res.json({ context: req.tenantContext });
  });

  apiRouter.get("/usage", (req, res) => {
    const context = req.tenantContext!;
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
