import {
  type MetaTag,
  type Analysis,
  type Recommendation,
  type InsertMetaTag,
  type InsertAnalysis,
  type InsertRecommendation,
  type AnalysisResult,
  type AuditRun,
  type PlanFeatureFlags,
  type TenantUsage,
  auditStatuses,
} from "@shared/schema";

// Interface for storage operations
export interface IStorage {
  createAnalysis(analysisData: AnalysisResult): Promise<AnalysisResult>;
  getAnalysis(id: number): Promise<AnalysisResult | undefined>;
  getAnalysisByUrl(url: string): Promise<AnalysisResult | undefined>;
  createAuditRun(run: Omit<AuditRun, "id">): Promise<AuditRun>;
  updateAuditRun(id: number, updates: Partial<AuditRun>): Promise<AuditRun | undefined>;
  findAuditRun(id: number, tenantId: string): Promise<AuditRun | undefined>;
  findAuditRunByKey(tenantId: string, key: string): Promise<AuditRun | undefined>;
  listRecentRuns(tenantId: string, limit: number): Promise<AuditRun[]>;
  incrementUsage(tenantId: string, plan: string): Promise<TenantUsage>;
  getUsage(tenantId: string): Promise<TenantUsage>;
  setTenantPlan(tenantId: string, plan: string): void;
  getPlanForTenant(tenantId: string): string;
  getPlanFlags(plan: string): PlanFeatureFlags;
}

// Memory storage implementation
export class MemStorage implements IStorage {
  private analyses: Map<number, Analysis>;
  private metaTags: Map<number, MetaTag[]>;
  private recommendations: Map<number, Recommendation[]>;
  private currentAnalysisId: number;
  private currentMetaTagId: number;
  private currentRecommendationId: number;
  private auditRuns: Map<number, AuditRun>;
  private currentAuditRunId: number;
  private idempotencyKeys: Map<string, number>;
  private tenantPlans: Map<string, string>;
  private usage: Map<string, TenantUsage>;

  constructor() {
    this.analyses = new Map();
    this.metaTags = new Map();
    this.recommendations = new Map();
    this.currentAnalysisId = 1;
    this.currentMetaTagId = 1;
    this.currentRecommendationId = 1;
    this.auditRuns = new Map();
    this.currentAuditRunId = 1;
    this.idempotencyKeys = new Map();
    this.tenantPlans = new Map();
    this.usage = new Map();
  }

  async createAnalysis(analysisData: AnalysisResult & { mvpMeasurements?: any }): Promise<AnalysisResult> {
    const analysisId = analysisData.analysis.id && analysisData.analysis.id > 0
      ? analysisData.analysis.id
      : this.currentAnalysisId++;

    // Store the analysis with MVP measurements
    const analysis: Analysis = {
      ...analysisData.analysis,
      id: analysisId,
      seoVisibleAtFirstByte: analysisData.mvpMeasurements?.seoVisibleAtFirstByte || null,
      prioritizedHealthScore: analysisData.mvpMeasurements?.prioritizedHealthScore || null,
      sharePreviewConfidence: analysisData.mvpMeasurements?.sharePreviewConfidence || null,
    };
    
    this.analyses.set(analysisId, analysis);
    
    // Store the meta tags
    const tags: MetaTag[] = analysisData.tags.map(tag => {
      const metaTagId = this.currentMetaTagId++;
      return {
        id: metaTagId,
        url: analysis.url,
        name: tag.name || null,
        property: tag.property || null,
        content: tag.content || null,
        httpEquiv: tag.httpEquiv || null,
        charset: tag.charset || null,
        rel: tag.rel || null,
        tagType: tag.tagType,
        isPresent: tag.isPresent
      };
    });
    
    this.metaTags.set(analysisId, tags);
    
    // Store the recommendations
    const recs: Recommendation[] = analysisData.recommendations.map(rec => {
      const recId = this.currentRecommendationId++;
      return {
        id: recId,
        analysisId,
        tagName: rec.tagName,
        description: rec.description,
        example: rec.example
      };
    });
    
    this.recommendations.set(analysisId, recs);
    
    // Return the complete analysis result
    return {
      analysis,
      tags,
      recommendations: recs
    };
  }

  async getAnalysis(id: number): Promise<AnalysisResult | undefined> {
    const analysis = this.analyses.get(id);
    if (!analysis) return undefined;
    
    const tags = this.metaTags.get(id) || [];
    const recommendations = this.recommendations.get(id) || [];
    
    return {
      analysis,
      tags,
      recommendations
    };
  }

  async getAnalysisByUrl(url: string): Promise<AnalysisResult | undefined> {
    // Find analysis by URL
    let analysisId: number | undefined;
    let foundAnalysis: Analysis | undefined;
    
    // Use forEach instead of for...of to avoid iterator issues
    this.analyses.forEach((analysis, id) => {
      if (analysis.url === url && !foundAnalysis) {
        analysisId = id;
        foundAnalysis = analysis;
      }
    });
    
    if (!analysisId || !foundAnalysis) return undefined;
    
    const tags = this.metaTags.get(analysisId) || [];
    const recommendations = this.recommendations.get(analysisId) || [];
    
    return {
      analysis: foundAnalysis,
      tags,
      recommendations
    };
  }

  async createAuditRun(run: Omit<AuditRun, "id">): Promise<AuditRun> {
    const runWithId: AuditRun = {
      ...run,
      id: this.currentAuditRunId++,
    };

    this.auditRuns.set(runWithId.id, runWithId);

    if (runWithId.idempotencyKey) {
      this.idempotencyKeys.set(`${runWithId.tenantId}:${runWithId.idempotencyKey}`, runWithId.id);
    }

    return runWithId;
  }

  async updateAuditRun(id: number, updates: Partial<AuditRun>): Promise<AuditRun | undefined> {
    const existing = this.auditRuns.get(id);
    if (!existing) return undefined;

    const updated: AuditRun = { ...existing, ...updates };
    this.auditRuns.set(id, updated);
    return updated;
  }

  async findAuditRun(id: number, tenantId: string): Promise<AuditRun | undefined> {
    const run = this.auditRuns.get(id);
    if (!run || run.tenantId !== tenantId) return undefined;
    return run;
  }

  async findAuditRunByKey(tenantId: string, key: string): Promise<AuditRun | undefined> {
    const id = this.idempotencyKeys.get(`${tenantId}:${key}`);
    if (!id) return undefined;
    return this.auditRuns.get(id);
  }

  async listRecentRuns(tenantId: string, limit: number): Promise<AuditRun[]> {
    const runs = Array.from(this.auditRuns.values()).filter(r => r.tenantId === tenantId);
    runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return runs.slice(0, limit);
  }

  setTenantPlan(tenantId: string, plan: string) {
    this.tenantPlans.set(tenantId, plan);
  }

  getPlanForTenant(tenantId: string): string {
    return this.tenantPlans.get(tenantId) || "free";
  }

  getPlanFlags(plan: string): PlanFeatureFlags {
    const normalized = plan.toLowerCase();
    const plans: Record<string, PlanFeatureFlags> = {
      free: {
        name: "Free",
        canExportReports: false,
        maxHistoryLength: 5,
        maxMonthlyRuns: 20,
      },
      pro: {
        name: "Pro",
        canExportReports: true,
        maxHistoryLength: 50,
        maxMonthlyRuns: 200,
      },
    };

    return plans[normalized] || plans.free;
  }

  private computePeriod(): { start: string; end: string } {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  async getUsage(tenantId: string): Promise<TenantUsage> {
    const existing = this.usage.get(tenantId);
    if (existing) {
      const { start, end } = this.computePeriod();
      if (existing.periodStart !== start || existing.periodEnd !== end) {
        const refreshed: TenantUsage = {
          ...existing,
          periodStart: start,
          periodEnd: end,
          runsCount: 0,
        };
        this.usage.set(tenantId, refreshed);
        return refreshed;
      }
      return existing;
    }

    const { start, end } = this.computePeriod();
    const usage: TenantUsage = {
      id: this.usage.size + 1,
      tenantId,
      plan: this.getPlanForTenant(tenantId),
      periodStart: start,
      periodEnd: end,
      runsCount: 0,
    };
    this.usage.set(tenantId, usage);
    return usage;
  }

  async incrementUsage(tenantId: string, plan: string): Promise<TenantUsage> {
    const current = await this.getUsage(tenantId);
    const updated: TenantUsage = {
      ...current,
      plan,
      runsCount: current.runsCount + 1,
    };
    this.usage.set(tenantId, updated);
    return updated;
  }

  async getDashboardStats(tenantId: string): Promise<{
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    averageScore: number;
    trendsData: Array<{ date: string; score: number; runs: number }>;
    recentRuns: Array<{
      id: number;
      url: string;
      status: string;
      score?: number;
      createdAt: string;
    }>;
  }> {
    const runs = Array.from(this.auditRuns.values())
      .filter(r => r.tenantId === tenantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalRuns = runs.length;
    const successfulRuns = runs.filter(r => r.status === "COMPLETED" || r.status === "SUCCEEDED").length;
    const failedRuns = runs.filter(r => r.status === "FAILED").length;

    // Calculate average score from completed runs with analysis data
    const completedRuns = runs.filter(r => r.status === "COMPLETED" || r.status === "SUCCEEDED");
    let totalScore = 0;
    let scoredRuns = 0;

    for (const run of completedRuns) {
      const analysis = this.analyses.get(run.id);
      if (analysis && analysis.healthScore) {
        totalScore += analysis.healthScore;
        scoredRuns++;
      }
    }

    const averageScore = scoredRuns > 0 ? totalScore / scoredRuns : 0;

    // Generate trends data (last 7 days)
    const trendsData = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayRuns = runs.filter(r => {
        const runDate = new Date(r.createdAt).toISOString().split('T')[0];
        return runDate === dateStr;
      });
      
      const dayScores = dayRuns
        .map(r => this.analyses.get(r.id)?.healthScore)
        .filter(s => s !== undefined) as number[];
      
      const avgScore = dayScores.length > 0 ? dayScores.reduce((a, b) => a + b, 0) / dayScores.length : 0;
      
      trendsData.push({
        date: dateStr,
        score: Math.round(avgScore),
        runs: dayRuns.length
      });
    }

    // Recent runs with scores
    const recentRuns = runs.slice(0, 10).map(run => {
      const analysis = this.analyses.get(run.id);
      return {
        id: run.id,
        url: run.target,
        status: run.status,
        score: analysis?.healthScore,
        createdAt: run.createdAt
      };
    });

    return {
      totalRuns,
      successfulRuns,
      failedRuns,
      averageScore: Math.round(averageScore),
      trendsData,
      recentRuns
    };
  }

  async deleteAuditRun(id: number, tenantId: string): Promise<boolean> {
    const run = this.auditRuns.get(id);
    if (!run || run.tenantId !== tenantId) {
      return false;
    }

    // Remove audit run
    this.auditRuns.delete(id);
    
    // Remove associated analysis data
    this.analyses.delete(id);
    this.metaTags.delete(id);
    this.recommendations.delete(id);
    
    // Remove idempotency key if exists
    if (run.idempotencyKey) {
      this.idempotencyKeys.delete(`${tenantId}:${run.idempotencyKey}`);
    }

    return true;
  }
}

// Export storage instance
export const storage = new MemStorage();
