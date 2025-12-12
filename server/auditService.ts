import {
  performFullAudit,
  runMetaAudit,
  normalizeUrl,
  FetchPageError,
} from "./auditEngine";
import { type IStorage } from "./storage";
import { type AuditRun, type PlanFeatureFlags } from "@shared/schema";
import { z } from "zod";

export type AuditJobPayload = {
  runId: number;
  tenantId: string;
  userId: string;
  target: string;
  idempotencyKey: string;
};

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export class AuditService {
  constructor(private readonly storage: IStorage) {}

  async enforceQuota(tenantId: string): Promise<{ plan: PlanFeatureFlags; planName: string }> {
    const planName = this.storage.getPlanForTenant(tenantId);
    const plan = this.storage.getPlanFlags(planName);
    const usage = await this.storage.getUsage(tenantId);

    if (usage.runsCount >= plan.maxMonthlyRuns) {
      throw new QuotaExceededError("Monthly quota exceeded. Upgrade plan or wait for next period.");
    }

    return { plan, planName };
  }

  async createQueuedRun(params: {
    tenantId: string;
    userId: string;
    target: string;
    idempotencyKey?: string;
  }): Promise<{ run: AuditRun; jobId: string }> {
    const { planName } = await this.enforceQuota(params.tenantId);

    const normalizedTarget = normalizeUrl(params.target);
    const key = params.idempotencyKey ?? `${normalizedTarget}:${new Date().toISOString().slice(0, 10)}`;

    const existing = await this.storage.findAuditRunByKey(params.tenantId, key);
    if (existing) {
      return { run: existing, jobId: existing.jobId ?? `job_${existing.id}` };
    }

    const run = await this.storage.createAuditRun({
      tenantId: params.tenantId,
      userId: params.userId,
      target: normalizedTarget,
      status: "QUEUED",
      healthScore: null,
      summary: null,
      progress: 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
      jobId: null,
      idempotencyKey: key,
    });

    const jobId = `job_${run.id}`;
    await this.storage.updateAuditRun(run.id, { jobId });
    await this.storage.incrementUsage(params.tenantId, planName.toLowerCase());

    return { run, jobId };
  }

  async createImmediateRun(params: { tenantId: string; userId: string; url: string }) {
    const { planName } = await this.enforceQuota(params.tenantId);

    const normalizedUrl = normalizeUrl(params.url);
    const run = await this.storage.createAuditRun({
      tenantId: params.tenantId,
      userId: params.userId,
      target: normalizedUrl,
      status: "RUNNING",
      healthScore: null,
      summary: null,
      progress: 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
      jobId: null,
      idempotencyKey: `${normalizedUrl}:sync:${new Date().toISOString().slice(0, 10)}`,
    });

    await this.storage.incrementUsage(params.tenantId, planName.toLowerCase());
    return run;
  }

  async processJob(job: AuditJobPayload): Promise<void> {
    await this.storage.updateAuditRun(job.runId, { status: "RUNNING", progress: 20 });

    try {
      // Update progress: Starting fetch
      await this.storage.updateAuditRun(job.runId, { progress: 35 });
      
      const result = await runMetaAudit(job.target, (progress) => {
        // Update progress during analysis
        this.storage.updateAuditRun(job.runId, { progress: 35 + Math.round(progress * 0.5) });
      });
      
      // Update progress: Analysis complete
      await this.storage.updateAuditRun(job.runId, { progress: 90 });
      
      const summary = `Health score ${result.analysis.healthScore}% with ${result.analysis.missingCount} missing tags`;
      
      await this.storage.createAnalysis({
        ...result,
        analysis: { ...result.analysis, id: job.runId },
      });
      
      // Complete
      await this.storage.updateAuditRun(job.runId, {
        status: "SUCCEEDED",
        healthScore: result.analysis.healthScore,
        summary,
        progress: 100,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      const status = error instanceof Error && error.message === "TIMEOUT" ? "TIMED_OUT" : "FAILED";
      const summary =
        error instanceof FetchPageError
          ? "Network error reaching target"
          : status === "TIMED_OUT"
            ? "Audit timed out"
            : "Audit failed";
      await this.storage.updateAuditRun(job.runId, {
        status,
        summary,
        progress: 0,
        completedAt: new Date().toISOString(),
      });
    }
  }

  async runFullAudit(run: AuditRun, url: string) {
    const audit = await performFullAudit(url);
    const combinedHealth = Math.round(
      (audit.scores.seo + audit.scores.performance + audit.scores.accessibility + audit.scores.security) / 4,
    );

    await this.storage.createAnalysis({
      ...audit.meta,
      analysis: { ...audit.meta.analysis, id: run.id, healthScore: combinedHealth },
    });

    const summary = `SEO ${audit.scores.seo}, Performance ${audit.scores.performance}, Accessibility ${audit.scores.accessibility}, Security ${audit.scores.security}`;

    await this.storage.updateAuditRun(run.id, {
      status: "SUCCEEDED",
      healthScore: combinedHealth,
      summary,
      completedAt: new Date().toISOString(),
    });

    return { audit, summary };
  }
}

export const auditQuerySchema = z.object({ url: z.string().url("Please enter a valid URL") });
