export type MetaTag = {
  id: number;
  tenantId?: number;
  url: string;
  name: string | null;
  property: string | null;
  content: string | null;
  httpEquiv: string | null;
  charset: string | null;
  rel: string | null;
  tagType: "SEO" | "Social" | "Technical" | string;
  isPresent: boolean;
};

export type Analysis = {
  id: number;
  tenantId?: number;
  url: string;
  totalCount: number;
  seoCount: number;
  socialCount: number;
  technicalCount: number;
  missingCount: number;
  healthScore: number;
  timestamp: string;
};

export type Recommendation = {
  id: number;
  analysisId: number;
  tagName: string;
  description: string;
  example: string;
};

export type QuotaStatus = {
  quotaRemaining: number;
  quotaUsed: number;
  quotaLimit: number;
  quotaPercentUsed: number;
  warningLevel: "none" | "warning_80" | "warning_90" | "exceeded";
  period: string;
};

export type AnalysisResult = {
  analysis: Analysis;
  tags: MetaTag[];
  recommendations: Recommendation[];
  quota?: QuotaStatus;
  usage?: {
    count: number;
    limit: number;
    remaining: number;
    warnings: string[];
  };
  plan?: {
    label: string;
    features: {
      historyDepth: number;
      [key: string]: unknown;
    };
  };
  recentAnalyses?: Array<
    Pick<Analysis, "id" | "url" | "healthScore" | "missingCount" | "timestamp">
  >;
};
