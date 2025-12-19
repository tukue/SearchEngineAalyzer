import { 
  type MetaTag, 
  type Analysis, 
  type Recommendation, 
  type InsertMetaTag,
  type InsertAnalysis, 
  type InsertRecommendation,
  type AnalysisResult,
  type Tenant,
  type TenantContext,
  type PlanChange,
  type UsageTracking,
  type UsageLedger,
  type MonthlyUsage,
  type InsertUsageLedger,
  type InsertMonthlyUsage,
  PLAN_CONFIGS,
  tenants,
  analyses,
  metaTags,
  recommendations,
  usageTracking,
  usageLedger,
  monthlyUsage,
  planChanges
} from "@shared/schema";
import { db, isDatabaseEnabled, type Database } from "./db";
import { and, desc, eq } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // Tenant operations
  createTenant(name: string, plan?: string): Promise<Tenant>;
  getTenant(id: number): Promise<Tenant | undefined>;
  updateTenantPlan(tenantId: number, newPlan: string, actorUserId?: string): Promise<void>;
  
  // Analysis operations (tenant-scoped)
  createAnalysis(tenantId: number, analysisData: Omit<AnalysisResult, 'analysis'> & { analysis: Omit<Analysis, 'id' | 'tenantId'> }): Promise<AnalysisResult>;
  getAnalysis(tenantId: number, id: number): Promise<AnalysisResult | undefined>;
  getAnalysisByUrl(tenantId: number, url: string): Promise<AnalysisResult | undefined>;
  getAnalysisHistory(tenantId: number, limit?: number): Promise<Analysis[]>;
  
  // Usage tracking (legacy)
  incrementUsage(tenantId: number, type: 'audit' | 'export'): Promise<void>;
  getCurrentUsage(tenantId: number, month: string): Promise<UsageTracking | undefined>;
<<<<<<< HEAD
=======
  
  // Usage ledger (new)
  createUsageLedgerEntry(entry: Omit<InsertUsageLedger, 'id'>): Promise<UsageLedger>;
  getUsageLedgerEntry(tenantId: number, requestId: string): Promise<UsageLedger | undefined>;
  updateUsageLedgerEntry(tenantId: number, requestId: string, status: 'completed' | 'failed'): Promise<void>;
  getMonthlyUsage(tenantId: number, period: string): Promise<MonthlyUsage | undefined>;
  updateMonthlyUsage(tenantId: number, period: string): Promise<void>;
  
  // Atomic operations
  atomicQuotaReservation(entry: Omit<InsertUsageLedger, 'id'>): Promise<{ success: boolean; quotaStatus: any; quotaUsed?: number; quotaLimit?: number; period?: string }>;
  releaseQuotaReservation(tenantId: number, requestId: string): Promise<void>;
  cleanupExpiredQuotaReservations(tenantId: number, olderThanHours: number): Promise<number>;
>>>>>>> origin/main
}

// Memory storage implementation
export class MemStorage implements IStorage {
  private tenants: Map<number, Tenant>;
  private analyses: Map<number, Analysis>;
  private metaTags: Map<number, MetaTag[]>;
  private recommendations: Map<number, Recommendation[]>;
  private planChanges: Map<number, PlanChange[]>;
  private usageTracking: Map<string, UsageTracking>; // key: tenantId-month
  private usageLedger: Map<string, UsageLedger>; // key: tenantId-requestId
  private monthlyUsage: Map<string, MonthlyUsage>; // key: tenantId-period
  private currentTenantId: number;
  private currentAnalysisId: number;
  private currentMetaTagId: number;
  private currentRecommendationId: number;
  private currentPlanChangeId: number;
  private currentUsageId: number;
  private currentLedgerId: number;
  private currentMonthlyUsageId: number;

  constructor() {
    this.tenants = new Map();
    this.analyses = new Map();
    this.metaTags = new Map();
    this.recommendations = new Map();
    this.planChanges = new Map();
    this.usageTracking = new Map();
    this.usageLedger = new Map();
    this.monthlyUsage = new Map();
    this.currentTenantId = 1;
    this.currentAnalysisId = 1;
    this.currentMetaTagId = 1;
    this.currentRecommendationId = 1;
    this.currentPlanChangeId = 1;
    this.currentUsageId = 1;
    this.currentLedgerId = 1;
    this.currentMonthlyUsageId = 1;
    
    // Create default tenant for MVP
    this.createTenant("Default Tenant", "free");
  }

  async createTenant(name: string, plan: string = "free"): Promise<Tenant> {
    const tenantId = this.currentTenantId++;
    const tenant: Tenant = {
      id: tenantId,
      name,
      plan,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.tenants.set(tenantId, tenant);
    this.planChanges.set(tenantId, []);
    
    return tenant;
  }

  async getTenant(id: number): Promise<Tenant | undefined> {
    return this.tenants.get(id);
  }

  async updateTenantPlan(tenantId: number, newPlan: string, actorUserId?: string): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error("Tenant not found");
    
    const previousPlan = tenant.plan;
    tenant.plan = newPlan;
    tenant.updatedAt = new Date();
    
    // Log plan change
    const planChange: PlanChange = {
      id: this.currentPlanChangeId++,
      tenantId,
      previousPlan,
      newPlan,
      actorUserId: actorUserId || null,
      timestamp: new Date()
    };
    
    const changes = this.planChanges.get(tenantId) || [];
    changes.push(planChange);
    this.planChanges.set(tenantId, changes);
    
    console.log(`Plan changed for tenant ${tenantId}: ${previousPlan} -> ${newPlan}`);
  }

  async createAnalysis(tenantId: number, analysisData: Omit<AnalysisResult, 'analysis'> & { analysis: Omit<Analysis, 'id' | 'tenantId'> }): Promise<AnalysisResult> {
    const analysisId = this.currentAnalysisId++;
    
    // Store the analysis
    const analysis: Analysis = {
      ...analysisData.analysis,
      id: analysisId,
      tenantId
    };
    
    this.analyses.set(analysisId, analysis);
    
    // Store the meta tags
    const tags: MetaTag[] = analysisData.tags.map(tag => {
      const metaTagId = this.currentMetaTagId++;
      return {
        id: metaTagId,
        tenantId,
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

  async getAnalysis(tenantId: number, id: number): Promise<AnalysisResult | undefined> {
    const analysis = this.analyses.get(id);
    if (!analysis || analysis.tenantId !== tenantId) return undefined;
    
    const tags = this.metaTags.get(id) || [];
    const recommendations = this.recommendations.get(id) || [];
    
    return {
      analysis,
      tags,
      recommendations
    };
  }

  async getAnalysisByUrl(tenantId: number, url: string): Promise<AnalysisResult | undefined> {
    // Find analysis by URL
    let analysisId: number | undefined;
    let foundAnalysis: Analysis | undefined;
    
    // Use forEach instead of for...of to avoid iterator issues
    this.analyses.forEach((analysis, id) => {
      if (analysis.url === url && analysis.tenantId === tenantId && !foundAnalysis) {
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

  async getAnalysisHistory(tenantId: number, limit?: number): Promise<Analysis[]> {
    const analyses: Analysis[] = [];
    
    this.analyses.forEach(analysis => {
      if (analysis.tenantId === tenantId) {
        analyses.push(analysis);
      }
    });
    
    // Sort by timestamp descending
    analyses.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return limit ? analyses.slice(0, limit) : analyses;
  }

  async incrementUsage(tenantId: number, type: 'audit' | 'export'): Promise<void> {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const key = `${tenantId}-${month}`;
    
    let usage = this.usageTracking.get(key);
    if (!usage) {
      usage = {
        id: this.currentUsageId++,
        tenantId,
        month,
        auditCount: 0,
        exportCount: 0
      };
    }
    
    if (type === 'audit') {
      usage.auditCount++;
    } else if (type === 'export') {
      usage.exportCount++;
    }
    
    this.usageTracking.set(key, usage);
  }

  async getCurrentUsage(tenantId: number, month: string): Promise<UsageTracking | undefined> {
    const key = `${tenantId}-${month}`;
    return this.usageTracking.get(key);
<<<<<<< HEAD
=======
  }

  async createUsageLedgerEntry(entry: Omit<InsertUsageLedger, 'id'>): Promise<UsageLedger> {
    const ledgerEntry: UsageLedger = {
      id: this.currentLedgerId++,
      tenantId: entry.tenantId,
      requestId: entry.requestId,
      auditType: entry.auditType || "meta_analysis",
      status: entry.status || "enqueued",
      url: entry.url || null,
      userId: entry.userId || null,
      period: entry.period,
      enqueuedAt: new Date(),
      completedAt: null,
      failedAt: null
    };
    
    const key = `${entry.tenantId}-${entry.requestId}`;
    this.usageLedger.set(key, ledgerEntry);
    
    // Update monthly usage
    await this.updateMonthlyUsage(entry.tenantId, entry.period);
    
    return ledgerEntry;
  }

  async getUsageLedgerEntry(tenantId: number, requestId: string): Promise<UsageLedger | undefined> {
    const key = `${tenantId}-${requestId}`;
    return this.usageLedger.get(key);
  }

  async updateUsageLedgerEntry(tenantId: number, requestId: string, status: 'completed' | 'failed'): Promise<void> {
    const key = `${tenantId}-${requestId}`;
    const entry = this.usageLedger.get(key);
    
    if (!entry) {
      throw new Error(`Usage ledger entry not found: ${key}`);
    }
    
    entry.status = status;
    if (status === 'completed') {
      entry.completedAt = new Date();
    } else if (status === 'failed') {
      entry.failedAt = new Date();
    }
    
    this.usageLedger.set(key, entry);
    
    // Update monthly usage
    await this.updateMonthlyUsage(tenantId, entry.period);
  }

  async getMonthlyUsage(tenantId: number, period: string): Promise<MonthlyUsage | undefined> {
    const key = `${tenantId}-${period}`;
    return this.monthlyUsage.get(key);
  }

  async updateMonthlyUsage(tenantId: number, period: string): Promise<void> {
    const key = `${tenantId}-${period}`;
    
    // Count entries for this tenant and period
    let enqueuedCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    
    this.usageLedger.forEach(entry => {
      if (entry.tenantId === tenantId && entry.period === period) {
        enqueuedCount++;
        if (entry.status === 'completed') completedCount++;
        if (entry.status === 'failed') failedCount++;
      }
    });
    
    const usage: MonthlyUsage = {
      id: this.currentMonthlyUsageId++,
      tenantId,
      period,
      enqueuedCount,
      completedCount,
      failedCount,
      lastUpdated: new Date()
    };
    
    this.monthlyUsage.set(key, usage);
  }

  async atomicQuotaReservation(entry: Omit<InsertUsageLedger, 'id'>): Promise<{ success: boolean; quotaStatus: any; quotaUsed?: number; quotaLimit?: number; period?: string }> {
    // Get tenant and quota limit
    const tenant = await this.getTenant(entry.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const quotaLimit = PLAN_CONFIGS[tenant.plan as keyof typeof PLAN_CONFIGS].monthlyAuditLimit;
    const currentUsage = await this.getMonthlyUsage(entry.tenantId, entry.period);
    const quotaUsed = currentUsage?.enqueuedCount || 0;

    // Check if quota would be exceeded
    if (quotaUsed >= quotaLimit) {
      const quotaStatus = {
        quotaRemaining: 0,
        quotaUsed,
        quotaLimit,
        quotaPercentUsed: 100,
        warningLevel: "exceeded" as const,
        period: entry.period
      };
      return { success: false, quotaStatus, quotaUsed, quotaLimit, period: entry.period };
    }

    // Reserve quota atomically
    await this.createUsageLedgerEntry(entry);
    
    const updatedUsage = await this.getMonthlyUsage(entry.tenantId, entry.period);
    const newQuotaUsed = updatedUsage?.enqueuedCount || 0;
    const quotaRemaining = Math.max(0, quotaLimit - newQuotaUsed);
    const quotaPercentUsed = quotaLimit > 0 ? (newQuotaUsed / quotaLimit) * 100 : 0;

    let warningLevel: "none" | "warning_80" | "warning_90" | "exceeded" = "none";
    if (quotaPercentUsed >= 100) {
      warningLevel = "exceeded";
    } else if (quotaPercentUsed >= 90) {
      warningLevel = "warning_90";
    } else if (quotaPercentUsed >= 80) {
      warningLevel = "warning_80";
    }

    const quotaStatus = {
      quotaRemaining,
      quotaUsed: newQuotaUsed,
      quotaLimit,
      quotaPercentUsed: Math.round(quotaPercentUsed * 100) / 100,
      warningLevel,
      period: entry.period
    };

    return { success: true, quotaStatus };
  }

  async releaseQuotaReservation(tenantId: number, requestId: string): Promise<void> {
    const key = `${tenantId}-${requestId}`;
    const entry = this.usageLedger.get(key);
    
    if (entry) {
      // Remove the entry to release quota
      this.usageLedger.delete(key);
      // Update monthly usage
      await this.updateMonthlyUsage(tenantId, entry.period);
    }
  }

  async cleanupExpiredQuotaReservations(tenantId: number, olderThanHours: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    let cleanedCount = 0;
    
    const toDelete: string[] = [];
    
    this.usageLedger.forEach((entry, key) => {
      if (entry.tenantId === tenantId && 
          entry.status === 'enqueued' && 
          entry.enqueuedAt < cutoffTime) {
        toDelete.push(key);
        cleanedCount++;
      }
    });
    
    // Delete expired entries
    toDelete.forEach(key => {
      const entry = this.usageLedger.get(key);
      if (entry) {
        this.usageLedger.delete(key);
        // Update monthly usage for each cleaned entry
        this.updateMonthlyUsage(tenantId, entry.period).catch(err => 
          console.error('Failed to update monthly usage during cleanup:', err)
        );
      }
    });
    
    return cleanedCount;
>>>>>>> origin/main
  }
}

// Database-backed storage implementation for durability
export class DbStorage implements IStorage {
  private ready: Promise<void>;

  constructor(private database: Database) {
    this.ready = this.ensureDefaultTenant();
  }

  private async ensureDefaultTenant(): Promise<void> {
    try {
      const existing = await this.database.query.tenants.findFirst({
        where: eq(tenants.id, 1)
      });

      if (!existing) {
        await this.database.insert(tenants).values({
          id: 1,
          name: "Default Tenant",
          plan: "free"
        });
      }
    } catch (error) {
      console.error('Failed to ensure default tenant:', error);
      throw error;
    }
  }

  async createTenant(name: string, plan: string = "free"): Promise<Tenant> {
    await this.ready;

    const [tenant] = await this.database
      .insert(tenants)
      .values({ name, plan })
      .returning();

    return tenant;
  }

  async getTenant(id: number): Promise<Tenant | undefined> {
    await this.ready;
    return this.database.query.tenants.findFirst({ where: eq(tenants.id, id) });
  }

  async updateTenantPlan(tenantId: number, newPlan: string, actorUserId?: string): Promise<void> {
    await this.ready;
    const existing = await this.getTenant(tenantId);
    if (!existing) {
      throw new Error("Tenant not found");
    }

    await this.database.update(tenants).set({
      plan: newPlan,
      updatedAt: new Date()
    }).where(eq(tenants.id, tenantId));

    await this.database.insert(usageLedger).values({
      tenantId,
      requestId: `plan-change-${Date.now()}`,
      auditType: "plan_change",
      status: "completed",
      url: null,
      userId: actorUserId || null,
      period: new Date().toISOString().slice(0, 7)
    });

    await this.database.insert(planChanges).values({
      tenantId,
      previousPlan: existing.plan,
      newPlan,
      actorUserId: actorUserId || null
    });
  }

  async createAnalysis(tenantId: number, analysisData: Omit<AnalysisResult, 'analysis'> & { analysis: Omit<Analysis, 'id' | 'tenantId'> }): Promise<AnalysisResult> {
    await this.ready;

    const [analysis] = await this.database.insert(analyses).values({
      ...analysisData.analysis,
      tenantId
    }).returning();

    const tagsToInsert: InsertMetaTag[] = analysisData.tags.map(tag => ({
      tenantId,
      url: analysis.url,
      name: tag.name || null,
      property: tag.property || null,
      content: tag.content || null,
      httpEquiv: tag.httpEquiv || null,
      charset: tag.charset || null,
      rel: tag.rel || null,
      tagType: tag.tagType,
      isPresent: tag.isPresent
    }));

    const recsToInsert: InsertRecommendation[] = analysisData.recommendations.map(rec => ({
      analysisId: analysis.id,
      tagName: rec.tagName,
      description: rec.description,
      example: rec.example
    }));

    if (tagsToInsert.length) {
      await this.database.insert(metaTags).values(tagsToInsert);
    }

    if (recsToInsert.length) {
      await this.database.insert(recommendations).values(recsToInsert);
    }

    const storedTags = await this.database.query.metaTags.findMany({
      where: and(eq(metaTags.url, analysis.url), eq(metaTags.tenantId, tenantId))
    });

    const storedRecs = await this.database.query.recommendations.findMany({
      where: eq(recommendations.analysisId, analysis.id)
    });

    return {
      analysis,
      tags: storedTags,
      recommendations: storedRecs
    };
  }

  async getAnalysis(tenantId: number, id: number): Promise<AnalysisResult | undefined> {
    await this.ready;
    const analysis = await this.database.query.analyses.findFirst({
      where: and(eq(analyses.id, id), eq(analyses.tenantId, tenantId))
    });

    if (!analysis) return undefined;

    const tags = await this.database.query.metaTags.findMany({
      where: and(eq(metaTags.url, analysis.url), eq(metaTags.tenantId, tenantId))
    });
    const recs = await this.database.query.recommendations.findMany({ where: eq(recommendations.analysisId, id) });

    return { analysis, tags, recommendations: recs };
  }

  async getAnalysisByUrl(tenantId: number, url: string): Promise<AnalysisResult | undefined> {
    await this.ready;
    const analysis = await this.database.query.analyses.findFirst({
      where: and(eq(analyses.url, url), eq(analyses.tenantId, tenantId))
    });

    if (!analysis) return undefined;

    const tags = await this.database.query.metaTags.findMany({
      where: and(eq(metaTags.url, url), eq(metaTags.tenantId, tenantId))
    });
    const recs = await this.database.query.recommendations.findMany({ where: eq(recommendations.analysisId, analysis.id) });

    return { analysis, tags, recommendations: recs };
  }

  async getAnalysisHistory(tenantId: number, limit?: number): Promise<Analysis[]> {
    await this.ready;
    const results = await this.database.query.analyses.findMany({
      where: eq(analyses.tenantId, tenantId),
      orderBy: [desc(analyses.timestamp)],
      limit
    });
    return results;
  }

  async incrementUsage(tenantId: number, type: 'audit' | 'export'): Promise<void> {
    await this.ready;
    const month = new Date().toISOString().slice(0, 7);
    const existing = await this.database.query.usageTracking.findFirst({
      where: and(eq(usageTracking.tenantId, tenantId), eq(usageTracking.month, month))
    });

    if (existing) {
      await this.database.update(usageTracking).set({
        auditCount: type === 'audit' ? existing.auditCount + 1 : existing.auditCount,
        exportCount: type === 'export' ? existing.exportCount + 1 : existing.exportCount
      }).where(eq(usageTracking.id, existing.id));
    } else {
      await this.database.insert(usageTracking).values({
        tenantId,
        month,
        auditCount: type === 'audit' ? 1 : 0,
        exportCount: type === 'export' ? 1 : 0
      });
    }
  }

  async getCurrentUsage(tenantId: number, month: string): Promise<UsageTracking | undefined> {
    await this.ready;
    return this.database.query.usageTracking.findFirst({
      where: and(eq(usageTracking.tenantId, tenantId), eq(usageTracking.month, month))
    });
  }

  async createUsageLedgerEntry(entry: Omit<InsertUsageLedger, 'id'>): Promise<UsageLedger> {
    await this.ready;
    const [inserted] = await this.database.transaction(async (tx) => {
      const created = await tx.insert(usageLedger).values({
        tenantId: entry.tenantId,
        requestId: entry.requestId,
        auditType: entry.auditType || "meta_analysis",
        status: entry.status || "enqueued",
        url: entry.url || null,
        userId: entry.userId || null,
        period: entry.period
      }).returning();

      await this.updateMonthlyUsage(entry.tenantId, entry.period, tx);
      return created;
    });

    return inserted;
  }

  async getUsageLedgerEntry(tenantId: number, requestId: string): Promise<UsageLedger | undefined> {
    await this.ready;
    return this.database.query.usageLedger.findFirst({
      where: and(eq(usageLedger.tenantId, tenantId), eq(usageLedger.requestId, requestId))
    });
  }

  async updateUsageLedgerEntry(tenantId: number, requestId: string, status: 'completed' | 'failed'): Promise<void> {
    await this.ready;
    const existing = await this.getUsageLedgerEntry(tenantId, requestId);
    if (!existing) {
      throw new Error(`Usage ledger entry not found: ${tenantId}-${requestId}`);
    }

    await this.database.transaction(async (tx) => {
      await tx.update(usageLedger).set({
        status,
        completedAt: status === 'completed' ? new Date() : null,
        failedAt: status === 'failed' ? new Date() : null
      }).where(and(eq(usageLedger.tenantId, tenantId), eq(usageLedger.requestId, requestId)));

      await this.updateMonthlyUsage(tenantId, existing.period, tx);
    });
  }

  async getMonthlyUsage(tenantId: number, period: string): Promise<MonthlyUsage | undefined> {
    await this.ready;
    return this.database.query.monthlyUsage.findFirst({
      where: and(eq(monthlyUsage.tenantId, tenantId), eq(monthlyUsage.period, period))
    });
  }

  async updateMonthlyUsage(
    tenantId: number,
    period: string,
    txRef?: Parameters<Database['transaction']>[0] extends (tx: infer T) => any ? T : Database
  ): Promise<void> {
    const executor = txRef || this.database;
    const entries = await executor.query.usageLedger.findMany({
      where: and(eq(usageLedger.tenantId, tenantId), eq(usageLedger.period, period))
    });

    const enqueuedCount = entries.length;
    const completedCount = entries.filter(e => e.status === 'completed').length;
    const failedCount = entries.filter(e => e.status === 'failed').length;

    const existing = await executor.query.monthlyUsage.findFirst({
      where: and(eq(monthlyUsage.tenantId, tenantId), eq(monthlyUsage.period, period))
    });

    if (existing) {
      await executor.update(monthlyUsage).set({
        enqueuedCount,
        completedCount,
        failedCount,
        lastUpdated: new Date()
      }).where(eq(monthlyUsage.id, existing.id));
    } else {
      await executor.insert(monthlyUsage).values({
        tenantId,
        period,
        enqueuedCount,
        completedCount,
        failedCount,
        lastUpdated: new Date()
      });
    }
  }

  async atomicQuotaReservation(entry: Omit<InsertUsageLedger, 'id'>): Promise<{ success: boolean; quotaStatus: any; quotaUsed?: number; quotaLimit?: number; period?: string }> {
    await this.ready;

    const result = await this.database.transaction(async (tx) => {
      const tenant = await tx.query.tenants.findFirst({ where: eq(tenants.id, entry.tenantId) });
      if (!tenant) {
        throw new Error("Tenant not found");
      }

      const quotaLimit = PLAN_CONFIGS[tenant.plan as keyof typeof PLAN_CONFIGS].monthlyAuditLimit;
      const usage = await tx.query.monthlyUsage.findFirst({
        where: and(eq(monthlyUsage.tenantId, entry.tenantId), eq(monthlyUsage.period, entry.period))
      });

      const quotaUsed = usage?.enqueuedCount || 0;
      if (quotaUsed >= quotaLimit) {
        const quotaStatus = {
          quotaRemaining: 0,
          quotaUsed,
          quotaLimit,
          quotaPercentUsed: 100,
          warningLevel: "exceeded" as const,
          period: entry.period
        };
        return { success: false, quotaStatus, quotaUsed, quotaLimit, period: entry.period };
      }

      await tx.insert(usageLedger).values({
        tenantId: entry.tenantId,
        requestId: entry.requestId,
        auditType: entry.auditType || "meta_analysis",
        status: entry.status || "enqueued",
        url: entry.url || null,
        userId: entry.userId || null,
        period: entry.period
      });

      await this.updateMonthlyUsage(entry.tenantId, entry.period, tx);

      const updatedUsage = await tx.query.monthlyUsage.findFirst({
        where: and(eq(monthlyUsage.tenantId, entry.tenantId), eq(monthlyUsage.period, entry.period))
      });

      const newQuotaUsed = updatedUsage?.enqueuedCount || 0;
      const quotaRemaining = Math.max(0, quotaLimit - newQuotaUsed);
      const quotaPercentUsed = quotaLimit > 0 ? (newQuotaUsed / quotaLimit) * 100 : 0;

      let warningLevel: "none" | "warning_80" | "warning_90" | "exceeded" = "none";
      if (quotaPercentUsed >= 100) warningLevel = "exceeded";
      else if (quotaPercentUsed >= 90) warningLevel = "warning_90";
      else if (quotaPercentUsed >= 80) warningLevel = "warning_80";

      const quotaStatus = {
        quotaRemaining,
        quotaUsed: newQuotaUsed,
        quotaLimit,
        quotaPercentUsed: Math.round(quotaPercentUsed * 100) / 100,
        warningLevel,
        period: entry.period
      };

      return { success: true, quotaStatus };
    });

    return result;
  }

  async releaseQuotaReservation(tenantId: number, requestId: string): Promise<void> {
    await this.ready;
    const entry = await this.getUsageLedgerEntry(tenantId, requestId);
    if (!entry) return;

    await this.database.transaction(async (tx) => {
      await tx.delete(usageLedger).where(and(eq(usageLedger.tenantId, tenantId), eq(usageLedger.requestId, requestId)));
      await this.updateMonthlyUsage(tenantId, entry.period, tx);
    });
  }

  async cleanupExpiredQuotaReservations(tenantId: number, olderThanHours: number): Promise<number> {
    await this.ready;
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const staleEntries = await this.database.query.usageLedger.findMany({
      where: and(eq(usageLedger.tenantId, tenantId), eq(usageLedger.status, "enqueued"))
    });

    const toDelete = staleEntries.filter(entry => (entry.enqueuedAt ?? new Date()) < cutoffTime);

    await this.database.transaction(async (tx) => {
      for (const entry of toDelete) {
        await tx.delete(usageLedger).where(and(eq(usageLedger.id, entry.id), eq(usageLedger.tenantId, tenantId)));
        await this.updateMonthlyUsage(tenantId, entry.period, tx);
      }
    });

    return toDelete.length;
  }
}

// Export storage instance (DB when available, otherwise in-memory)
export const storage: IStorage = (() => {
  if (isDatabaseEnabled && db) {
    try {
      return new DbStorage(db);
    } catch (error) {
      console.error('Failed to initialize database storage, falling back to memory storage:', error);
      return new MemStorage();
    }
  }

  return new MemStorage();
})();

// Helper function to get default tenant context for MVP
export async function getDefaultTenantContext(): Promise<TenantContext> {
  const tenant = await storage.getTenant(1); // Default tenant
  if (!tenant) {
    throw new Error("Default tenant not found");
  }
  
  return {
    tenantId: tenant.id,
    plan: tenant.plan as "free" | "pro"
  };
}
