import {
  type MetaTag,
  type Analysis,
  type Recommendation,
  type InsertMetaTag,
  type InsertAnalysis,
  type InsertRecommendation,
  type AnalysisResult,
} from "@shared/schema";

export interface IStorage {
  createAnalysis(analysisData: AnalysisResult): Promise<AnalysisResult>;
  getAnalysis(id: number): Promise<AnalysisResult | undefined>;
  getAnalysisByUrl(url: string): Promise<AnalysisResult | undefined>;
}

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

    const analysis: Analysis = {
      ...analysisData.analysis,
      id: analysisId,
    };

    this.analyses.set(analysisId, analysis);

    const tags: MetaTag[] = analysisData.tags.map((tag) => {
      const metaTagId = this.currentMetaTagId++;
      return {
        id: metaTagId,
        tenantId: analysis.tenantId,
        url: analysis.url,
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

    const recs: Recommendation[] = analysisData.recommendations.map((rec) => {
      const recId = this.currentRecommendationId++;
      return {
        id: recId,
        analysisId,
        tagName: rec.tagName,
        description: rec.description,
        example: rec.example,
      };
    });

    this.recommendations.set(analysisId, recs);

    return {
      analysis,
      tags,
      recommendations: recs,
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
      recommendations,
    };
  }

  async getAnalysisByUrl(url: string): Promise<AnalysisResult | undefined> {
    let analysisId: number | undefined;
    let foundAnalysis: Analysis | undefined;

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
      recommendations,
    };
  }
}

export const storage = new MemStorage();
