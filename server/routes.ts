import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { urlSchema, type AnalysisResult, type PlanFeatureFlags } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { storage } from "./storage";
import { tenantMiddleware, type TenantScopedRequest } from "./tenant";

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
      const result = await this.runWithTimeout(runAudit(job.target), this.timeoutMs);
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

async function runAudit(url: string): Promise<AnalysisResult> {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MetaTagAnalyzer/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to connect to the website: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const importantSeoTags = ["title", "description", "keywords", "viewport", "canonical"];
  const importantSocialTags = [
    "og:title",
    "og:description",
    "og:image",
    "og:url",
    "og:type",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
  ];
  const importantTechnicalTags = ["robots", "charset", "content-type", "language", "author", "generator"];

  let seoCount = 0;
  let socialCount = 0;
  let technicalCount = 0;
  let missingCount = 0;

  const foundMetaTags: any[] = [];

  const titleTag = $("title").first().text();
  if (titleTag) {
    foundMetaTags.push({
      name: "title",
      content: titleTag,
      tagType: "SEO",
      isPresent: true,
    });
    seoCount++;
  } else {
    foundMetaTags.push({
      name: "title",
      content: "Missing",
      tagType: "SEO",
      isPresent: false,
    });
    missingCount++;
  }

  const canonicalLink = $('link[rel="canonical"]').attr("href");
  if (canonicalLink) {
    foundMetaTags.push({
      rel: "canonical",
      content: canonicalLink,
      tagType: "SEO",
      isPresent: true,
    });
    seoCount++;
  } else {
    foundMetaTags.push({
      rel: "canonical",
      content: "Missing",
      tagType: "SEO",
      isPresent: false,
    });
    missingCount++;
  }

  $("meta").each((_, elem) => {
    const name = $(elem).attr("name");
    const property = $(elem).attr("property");
    const httpEquiv = $(elem).attr("http-equiv");
    const charset = $(elem).attr("charset");
    const content = $(elem).attr("content") || "";

    let tagType = "Technical";

    if (name && importantSeoTags.includes(name)) {
      tagType = "SEO";
      seoCount++;
    } else if ((name && name.startsWith("twitter:")) || (property && property.startsWith("og:"))) {
      tagType = "Social";
      socialCount++;
    } else if (charset || httpEquiv || importantTechnicalTags.includes(name || "")) {
      tagType = "Technical";
      technicalCount++;
    } else if (name || property) {
      tagType = "SEO";
      seoCount++;
    }

    foundMetaTags.push({
      name,
      property,
      httpEquiv,
      charset,
      content,
      tagType,
      isPresent: true,
    });
  });

  const recommendations: any[] = [];

  const tagExists = (tagName: string) => {
    return foundMetaTags.some(
      (tag) => tag.name === tagName || tag.property === tagName || (tag.name === "title" && tagName === "title")
    );
  };

  importantSeoTags.forEach((tag) => {
    if (!tagExists(tag)) {
      foundMetaTags.push({
        name: tag,
        content: "Missing",
        tagType: "SEO",
        isPresent: false,
      });
      missingCount++;

      let example = "";
      let description = "";

      switch (tag) {
        case "title":
          example = "<title>Your Page Title | Your Website Name</title>";
          description = "Title tags are crucial for SEO and user experience. They appear in browser tabs and search results.";
          break;
        case "description":
          example = '<meta name="description" content="A brief description of your page content.">';
          description = "Meta descriptions provide a summary of your page content for search results.";
          break;
        case "keywords":
          example = '<meta name="keywords" content="keyword1, keyword2, keyword3">';
          description = "While less important than before, keywords can still help categorize your content.";
          break;
        case "viewport":
          example = '<meta name="viewport" content="width=device-width, initial-scale=1">';
          description = "Viewport meta tag ensures proper rendering on mobile devices and is a factor in mobile-friendly rankings.";
          break;
        case "canonical":
          example = '<link rel="canonical" href="https://example.com/page">';
          description = "Canonical URLs help prevent duplicate content issues by specifying the preferred version of a page.";
          break;
      }

      recommendations.push({
        tagName: tag,
        description,
        example,
      });
    }
  });

  importantSocialTags.forEach((tag) => {
    if (!tagExists(tag)) {
      foundMetaTags.push({
        property: tag.includes("og:") ? tag : undefined,
        name: tag.includes("twitter:") ? tag : undefined,
        content: "Missing",
        tagType: "Social",
        isPresent: false,
      });
      missingCount++;

      if (["og:title", "og:description", "og:image", "twitter:card", "twitter:image"].includes(tag)) {
        let example = "";
        let description = "";

        switch (tag) {
          case "og:title":
            example = '<meta property="og:title" content="Your Page Title">';
            description = "Open Graph title is used when your content is shared on Facebook and other platforms.";
            break;
          case "og:description":
            example = '<meta property="og:description" content="A description of your page for social sharing.">';
            description = "Open Graph description appears in social media post previews.";
            break;
          case "og:image":
            example = '<meta property="og:image" content="https://example.com/image.jpg">';
            description = "Open Graph image is displayed when your content is shared on social media.";
            break;
          case "twitter:card":
            example = '<meta name="twitter:card" content="summary_large_image">';
            description = "Twitter card type controls how your content appears when shared on Twitter.";
            break;
          case "twitter:image":
            example = '<meta name="twitter:image" content="https://example.com/image.jpg">';
            description = "Twitter image is displayed when your content is shared on Twitter.";
            break;
        }

        recommendations.push({
          tagName: tag,
          description,
          example,
        });
      }
    }
  });

  importantTechnicalTags.forEach((tag) => {
    if (!tagExists(tag) && ["robots", "charset", "content-type"].includes(tag)) {
      foundMetaTags.push({
        name: ["robots", "author", "generator", "language"].includes(tag) ? tag : undefined,
        httpEquiv: ["content-type"].includes(tag) ? tag : undefined,
        charset: tag === "charset" ? "missing" : undefined,
        content: "Missing",
        tagType: "Technical",
        isPresent: false,
      });
      missingCount++;

      if (["robots", "charset"].includes(tag)) {
        let example = "";
        let description = "";

        switch (tag) {
          case "robots":
            example = '<meta name="robots" content="index, follow">';
            description = "Robots meta tag tells search engines how to crawl and index your page.";
            break;
          case "charset":
            example = '<meta charset="UTF-8">';
            description = "Character set declaration ensures proper text encoding.";
            break;
        }

        recommendations.push({
          tagName: tag,
          description,
          example,
        });
      }
    }
  });

  const totalImportantTags =
    importantSeoTags.length +
    importantSocialTags.filter((t) => ["og:title", "og:description", "og:image", "twitter:card"].includes(t)).length +
    importantTechnicalTags.filter((t) => ["robots", "charset"].includes(t)).length;

  const presentImportantTags = totalImportantTags - missingCount;
  const healthScore = Math.round((presentImportantTags / totalImportantTags) * 100);
  const totalTags = foundMetaTags.length;

  return {
    analysis: {
      id: 0,
      url,
      totalCount: totalTags,
      seoCount,
      socialCount,
      technicalCount,
      missingCount,
      healthScore,
      timestamp: new Date().toISOString(),
    },
    tags: foundMetaTags,
    recommendations,
  };
}

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

  apiRouter.post("/analyze", async (req: TenantScopedRequest, res) => {
    try {
      if (!req.tenant) {
        return res.status(401).json({ message: "Missing tenant context" });
      }

      const { url } = urlSchema.parse(req.body);
      let normalizedUrl = url;
      if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = "https://" + normalizedUrl;
      }

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
