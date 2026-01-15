import { MetaTag, Recommendation } from "@shared/schema";

export interface AnalyzerOptions {
  tenantId?: number;
  userId?: string;
  auditType?: string;
}

export interface TagResult extends Partial<MetaTag> {
  isPresent: boolean;
  tagType: "SEO" | "Social" | "Technical";
}

export interface ParsedData {
  tags: TagResult[];
  seoCount: number;
  socialCount: number;
  technicalCount: number;
  missingCount: number;
}

export interface ScoredData extends ParsedData {
  healthScore: number;
  recommendations: Partial<Recommendation>[];
}
