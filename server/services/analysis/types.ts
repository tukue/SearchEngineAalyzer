import { MetaTag, Recommendation, TopFix } from "@shared/schema";

export interface AnalyzerOptions {
  tenantId?: number;
  userId?: string;
  auditType?: string;
}

export interface TagResult extends Partial<MetaTag> {
  isPresent: boolean;
  tagType: "SEO" | "Social" | "Technical";
}

export type CheckCategory = "Technical SEO" | "On-page SEO" | "Content quality";
export type CheckSeverity = "Critical" | "Important" | "Minor";

export interface AuditCheck {
  key: string;
  category: CheckCategory;
  severity: CheckSeverity;
  passed: boolean;
  points: number;
  issue?: string;
  whyItMatters?: string;
  recommendation?: string;
}

export interface CrawlMetrics {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  redirected: boolean;
  redirectCount: number;
  responseTimeMs: number;
  contentType?: string;
  robotsTxtFound: boolean;
  sitemapFound: boolean;
}

export interface ParsedData {
  tags: TagResult[];
  checks: AuditCheck[];
  seoCount: number;
  socialCount: number;
  technicalCount: number;
  missingCount: number;
}

export interface ScoredData extends ParsedData {
  healthScore: number;
  recommendations: Partial<Recommendation>[];
  topFixes: TopFix[];
}
