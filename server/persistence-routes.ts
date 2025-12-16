import type { Express } from "express";
import express from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { persistenceService, extractDomain } from "./persistence-service";
import { requireEntitlement } from "./plan-gating";
import { PLAN_CONFIGS } from "@shared/schema";
import type { TenantContext } from "@shared/schema";

export function registerPersistenceRoutes(app: Express): void {
  const apiRouter = express.Router();

  // Create project
  const createProjectSchema = z.object({
    name: z.string().min(1).max(100),
    url: z.string().url(),
    description: z.string().optional(),
  });

  apiRouter.post("/projects", async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const data = createProjectSchema.parse(req.body);
      
      const project = await persistenceService.createProject(tenantContext.tenantId, {
        ...data,
        domain: extractDomain(data.url),
        isActive: true,
      });

      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // List projects
  apiRouter.get("/projects", async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const projects = await persistenceService.getProjects(tenantContext.tenantId);
      res.json({ projects });
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Create audit
  const createAuditSchema = z.object({
    projectId: z.number().int().positive(),
    name: z.string().min(1).max(100),
    type: z.enum(["seo", "performance", "accessibility"]),
    config: z.any().optional(),
  });

  apiRouter.post("/audits", async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const data = createAuditSchema.parse(req.body);
      
      const audit = await persistenceService.createAudit(tenantContext.tenantId, {
        ...data,
        isActive: true,
      });

      res.status(201).json(audit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating audit:", error);
      res.status(500).json({ message: "Failed to create audit" });
    }
  });

  // List audits
  apiRouter.get("/audits", async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      
      const audits = await persistenceService.getAudits(tenantContext.tenantId, projectId);
      res.json({ audits });
    } catch (error) {
      console.error("Error fetching audits:", error);
      res.status(500).json({ message: "Failed to fetch audits" });
    }
  });

  // Dashboard - recent runs across tenant
  apiRouter.get("/dashboard/runs", async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      
      // Apply plan-based history depth limit
      const planLimit = PLAN_CONFIGS[tenantContext.plan].historyDepth;
      const effectiveLimit = Math.min(limit, planLimit);
      
      const runs = await persistenceService.getDashboardRuns(tenantContext.tenantId, effectiveLimit);
      
      res.json({
        runs,
        limit: effectiveLimit,
        planLimit,
        currentPlan: tenantContext.plan,
      });
    } catch (error) {
      console.error("Error fetching dashboard runs:", error);
      res.status(500).json({ message: "Failed to fetch dashboard runs" });
    }
  });

  // Project runs - paginated history for specific project
  apiRouter.get("/projects/:projectId/runs", async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const projectId = parseInt(req.params.projectId);
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const cursor = req.query.cursor as string;
      
      // Apply plan-based history depth limit
      const planLimit = PLAN_CONFIGS[tenantContext.plan].historyDepth;
      const effectiveLimit = Math.min(limit, planLimit);
      
      const result = await persistenceService.getProjectRuns(
        tenantContext.tenantId, 
        projectId, 
        effectiveLimit, 
        cursor
      );
      
      res.json({
        ...result,
        limit: effectiveLimit,
        planLimit,
        currentPlan: tenantContext.plan,
      });
    } catch (error) {
      console.error("Error fetching project runs:", error);
      res.status(500).json({ message: "Failed to fetch project runs" });
    }
  });

  // Get run details
  apiRouter.get("/runs/:runId", async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const runId = req.params.runId;
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(runId)) {
        return res.status(400).json({ message: "Invalid run ID format" });
      }
      
      const runDetails = await persistenceService.getRunDetails(tenantContext.tenantId, runId);
      
      if (!runDetails) {
        return res.status(404).json({ message: "Run not found" });
      }
      
      res.json(runDetails);
    } catch (error) {
      console.error("Error fetching run details:", error);
      res.status(500).json({ message: "Failed to fetch run details" });
    }
  });

  // Start new audit run
  const startRunSchema = z.object({
    projectId: z.number().int().positive(),
    auditId: z.number().int().positive(),
    summary: z.object({
      scores: z.object({
        overall: z.number().min(0).max(100),
        seo: z.number().min(0).max(100),
        performance: z.number().min(0).max(100),
        accessibility: z.number().min(0).max(100),
      }),
      counts: z.object({
        total: z.number().min(0),
        critical: z.number().min(0),
        high: z.number().min(0),
        medium: z.number().min(0),
        low: z.number().min(0),
        info: z.number().min(0),
      }),
      metadata: z.object({
        url: z.string().url(),
        userAgent: z.string().optional(),
        viewport: z.string().optional(),
        loadTime: z.number().optional(),
        pageSize: z.number().optional(),
      }),
    }),
    findings: z.array(z.object({
      category: z.string(),
      severity: z.enum(["critical", "high", "medium", "low", "info"]),
      ruleId: z.string(),
      title: z.string(),
      message: z.string(),
      guidance: z.string(),
      impact: z.string(),
      element: z.string().optional(),
      line: z.number().optional(),
      column: z.number().optional(),
      metadata: z.any().optional(),
    })).optional(),
  });

  apiRouter.post("/runs", async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const data = startRunSchema.parse(req.body);
      
      // Create the run
      const run = await persistenceService.createRun(tenantContext.tenantId, {
        projectId: data.projectId,
        auditId: data.auditId,
        status: "completed",
        summary: data.summary,
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 1000, // Mock duration
      });

      // Create findings if provided
      if (data.findings && data.findings.length > 0) {
        await persistenceService.createFindings(tenantContext.tenantId, run.id, data.findings);
      }

      // Cleanup old runs based on plan
      await persistenceService.cleanupOldRuns(tenantContext.tenantId, tenantContext.plan);

      res.status(201).json({
        runId: run.runId,
        status: run.status,
        message: "Audit run created successfully",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating run:", error);
      res.status(500).json({ message: "Failed to create audit run" });
    }
  });

  // Download artifact (Pro feature)
  apiRouter.get("/artifacts/:artifactId/download", requireEntitlement('exportsEnabled'), async (req, res) => {
    try {
      const tenantContext = req.tenantContext as TenantContext;
      const artifactId = parseInt(req.params.artifactId);
      
      // In production, this would generate a signed URL for S3
      res.json({
        downloadUrl: `https://storage.example.com/artifacts/${artifactId}`,
        expiresIn: 3600, // 1 hour
        message: "Signed download URL generated",
      });
    } catch (error) {
      console.error("Error generating download URL:", error);
      res.status(500).json({ message: "Failed to generate download URL" });
    }
  });

  // Cleanup endpoint (admin/cron use)
  apiRouter.post("/cleanup/:tenantId", async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const planType = req.body.planType || 'free';
      
      const deletedCount = await persistenceService.cleanupOldRuns(tenantId, planType);
      
      res.json({
        message: "Cleanup completed",
        deletedRuns: deletedCount,
        tenantId,
        planType,
      });
    } catch (error) {
      console.error("Error during cleanup:", error);
      res.status(500).json({ message: "Cleanup failed" });
    }
  });

  app.use("/api", apiRouter);
}