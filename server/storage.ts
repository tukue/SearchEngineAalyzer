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
  PLAN_CONFIGS
} from "@shared/schema";

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
  
  // Usage tracking
  incrementUsage(tenantId: number, type: 'audit' | 'export'): Promise<void>;
  getCurrentUsage(tenantId: number, month: string): Promise<UsageTracking | undefined>;
}

// Memory storage implementation
export class MemStorage implements IStorage {
  private tenants: Map<number, Tenant>;
  private analyses: Map<number, Analysis>;
  private metaTags: Map<number, MetaTag[]>;
  private recommendations: Map<number, Recommendation[]>;
  private planChanges: Map<number, PlanChange[]>;
  private usageTracking: Map<string, UsageTracking>; // key: tenantId-month
  private currentTenantId: number;
  private currentAnalysisId: number;
  private currentMetaTagId: number;
  private currentRecommendationId: number;
  private currentPlanChangeId: number;
  private currentUsageId: number;

  constructor() {
    this.tenants = new Map();
    this.analyses = new Map();
    this.metaTags = new Map();
    this.recommendations = new Map();
    this.planChanges = new Map();
    this.usageTracking = new Map();
    this.currentTenantId = 1;
    this.currentAnalysisId = 1;
    this.currentMetaTagId = 1;
    this.currentRecommendationId = 1;
    this.currentPlanChangeId = 1;
    this.currentUsageId = 1;
    
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
  }
}

// Export storage instance
export const storage = new MemStorage();

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