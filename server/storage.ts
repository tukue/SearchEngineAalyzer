import { 
  type MetaTag, 
  type Analysis, 
  type Recommendation, 
  type InsertMetaTag,
  type InsertAnalysis, 
  type InsertRecommendation,
  type AnalysisResult
} from "@shared/schema";

// Interface for storage operations
export interface IStorage {
  createAnalysis(analysisData: AnalysisResult): Promise<AnalysisResult>;
  getAnalysis(id: number, tenantId: string): Promise<AnalysisResult | undefined>;
  getAnalysisByUrl(url: string, tenantId: string): Promise<AnalysisResult | undefined>;
  getRecentAnalyses(tenantId: string, url?: string, limit?: number): Promise<Analysis[]>;
}

// Memory storage implementation
export class MemStorage implements IStorage {
  private analyses: Map<number, Analysis>;
  private metaTags: Map<number, MetaTag[]>;
  private recommendations: Map<number, Recommendation[]>;
  private currentAnalysisId: number;
  private currentMetaTagId: number;
  private currentRecommendationId: number;

  constructor() {
    this.analyses = new Map();
    this.metaTags = new Map();
    this.recommendations = new Map();
    this.currentAnalysisId = 1;
    this.currentMetaTagId = 1;
    this.currentRecommendationId = 1;
  }

  async createAnalysis(analysisData: AnalysisResult): Promise<AnalysisResult> {
    const analysisId = this.currentAnalysisId++;
    
    // Store the analysis
    const analysis: Analysis = {
      ...analysisData.analysis,
      id: analysisId,
    };
    
    this.analyses.set(analysisId, analysis);
    
    // Store the meta tags
    const tags: MetaTag[] = analysisData.tags.map((tag) => {
      const metaTagId = this.currentMetaTagId++;
      return {
        id: metaTagId,
        url: analysis.url,
        tenantId: analysis.tenantId,
        name: tag.name || null,
        property: tag.property || null,
        content: tag.content || null,
        httpEquiv: tag.httpEquiv || null,
        charset: tag.charset || null,
        rel: tag.rel || null,
        tagType: tag.tagType,
        isPresent: tag.isPresent,
      };
    });
    
    this.metaTags.set(analysisId, tags);
    
    // Store the recommendations
    const recs: Recommendation[] = analysisData.recommendations.map((rec) => {
      const recId = this.currentRecommendationId++;
      return {
        id: recId,
        tenantId: analysis.tenantId,
        analysisId,
        tagName: rec.tagName,
        description: rec.description,
        example: rec.example,
      };
    });
    
    this.recommendations.set(analysisId, recs);
    
    // Return the complete analysis result
    return {
      analysis,
      tags,
      recommendations: recs,
    };
  }

  async getAnalysis(id: number, tenantId: string): Promise<AnalysisResult | undefined> {
    const analysis = this.analyses.get(id);
    if (!analysis || analysis.tenantId !== tenantId) return undefined;
    
    const tags = this.metaTags.get(id) || [];
    const recommendations = this.recommendations.get(id) || [];
    
    return {
      analysis,
      tags,
      recommendations,
    };
  }

  async getAnalysisByUrl(url: string, tenantId: string): Promise<AnalysisResult | undefined> {
    // Find analysis by URL
    let analysisId: number | undefined;
    let foundAnalysis: Analysis | undefined;

    // Use forEach instead of for...of to avoid iterator issues
    this.analyses.forEach((analysis, id) => {
      const matchesTenant = analysis.tenantId === tenantId;
      if (analysis.url === url && matchesTenant && !foundAnalysis) {
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
      recommendations,
    };
  }

  async getRecentAnalyses(tenantId: string, url?: string, limit = 5): Promise<Analysis[]> {
    const items = Array.from(this.analyses.values()).filter((analysis) => {
      const matchesTenant = analysis.tenantId === tenantId;
      const matchesUrl = url ? analysis.url === url : true;
      return matchesTenant && matchesUrl;
    });

    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}

// Export storage instance
export const storage = new MemStorage();
