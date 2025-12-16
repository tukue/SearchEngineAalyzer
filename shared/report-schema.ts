import { z } from "zod";

// Severity levels with weights for scoring
export const SEVERITY_WEIGHTS = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 2,
  info: 1,
} as const;

// Effort levels for prioritization
export const EFFORT_LEVELS = {
  low: 1,
  medium: 2,
  high: 3,
} as const;

// Category relevance weights
export const CATEGORY_WEIGHTS = {
  seo: 1.0,
  social: 0.8,
  technical: 0.6,
} as const;

// Health score grade buckets
export const HEALTH_GRADES = {
  excellent: { min: 90, max: 100, label: "Excellent", color: "#22c55e" },
  good: { min: 75, max: 89, label: "Good", color: "#84cc16" },
  fair: { min: 60, max: 74, label: "Fair", color: "#eab308" },
  poor: { min: 40, max: 59, label: "Poor", color: "#f97316" },
  critical: { min: 0, max: 39, label: "Critical", color: "#ef4444" },
} as const;

// Finding schema with prioritization data
export const reportFindingSchema = z.object({
  id: z.number(),
  category: z.enum(["seo", "social", "technical"]),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  status: z.enum(["fail", "warn", "pass"]).default("fail"),
  ruleId: z.string(),
  title: z.string(),
  message: z.string(),
  guidance: z.string(), // "what to fix"
  impact: z.string(), // "why it matters"
  element: z.string().nullable().optional(),
  line: z.number().nullable().optional(),
  column: z.number().nullable().optional(),
  metadata: z.any().optional(),
  // Prioritization fields
  effortLevel: z.enum(["low", "medium", "high"]).default("medium"),
  priorityScore: z.number().min(0).max(100), // calculated priority score
  guidanceUrl: z.string().url().optional(), // stable guidance reference
});

// Prioritized fix schema
export const prioritizedFixSchema = z.object({
  finding: reportFindingSchema,
  rank: z.number().int().positive(),
  impactScore: z.number().min(0).max(100),
  effortScore: z.number().min(0).max(100),
  categoryRelevance: z.number().min(0).max(1),
});

// Category counts schema
export const categoryCounts = z.object({
  seo: z.object({
    total: z.number().min(0),
    pass: z.number().min(0),
    fail: z.number().min(0),
    warn: z.number().min(0),
  }),
  social: z.object({
    total: z.number().min(0),
    pass: z.number().min(0),
    fail: z.number().min(0),
    warn: z.number().min(0),
  }),
  technical: z.object({
    total: z.number().min(0),
    pass: z.number().min(0),
    fail: z.number().min(0),
    warn: z.number().min(0),
  }),
});

// Severity counts schema
export const severityCounts = z.object({
  critical: z.number().min(0),
  high: z.number().min(0),
  medium: z.number().min(0),
  low: z.number().min(0),
  info: z.number().min(0),
  total: z.number().min(0),
});

// Health score schema
export const healthScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  grade: z.enum(["excellent", "good", "fair", "poor", "critical"]),
  categoryScores: z.object({
    seo: z.number().min(0).max(100),
    social: z.number().min(0).max(100),
    technical: z.number().min(0).max(100),
  }),
});

// Run metadata schema
export const runMetadataSchema = z.object({
  runId: z.string().uuid(),
  url: z.string().url(),
  auditType: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  duration: z.number().nullable(), // milliseconds
  userAgent: z.string().optional(),
  viewport: z.string().optional(),
  loadTime: z.number().optional(),
  pageSize: z.number().optional(),
});

// Filter options schema
export const reportFiltersSchema = z.object({
  categories: z.array(z.enum(["seo", "social", "technical"])).optional(),
  severities: z.array(z.enum(["critical", "high", "medium", "low", "info"])).optional(),
  statuses: z.array(z.enum(["pass", "fail", "warn"])).optional(),
});

// Canonical Report View Model
export const reportViewModelSchema = z.object({
  // Core report data
  healthScore: healthScoreSchema,
  categoryCounts: categoryCounts,
  severityCounts: severityCounts,
  
  // Prioritized fixes (top 3-5)
  topFixes: z.array(prioritizedFixSchema).max(5),
  
  // Full findings list
  findings: z.array(reportFindingSchema),
  
  // Run metadata
  metadata: runMetadataSchema,
  
  // Generation metadata
  generatedAt: z.string().datetime(),
  version: z.string().default("1.0"),
});

// Export request schema
export const exportRequestSchema = z.object({
  runId: z.string().uuid(),
  format: z.enum(["pdf", "html"]),
  filters: reportFiltersSchema.optional(),
  includeGuidance: z.boolean().default(true),
});

// Export response schema
export const exportResponseSchema = z.object({
  success: z.boolean(),
  downloadUrl: z.string().url().optional(),
  filename: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  error: z.string().optional(),
});

// Types
export type ReportFinding = z.infer<typeof reportFindingSchema>;
export type PrioritizedFix = z.infer<typeof prioritizedFixSchema>;
export type CategoryCounts = z.infer<typeof categoryCounts>;
export type SeverityCounts = z.infer<typeof severityCounts>;
export type HealthScore = z.infer<typeof healthScoreSchema>;
export type RunMetadata = z.infer<typeof runMetadataSchema>;
export type ReportFilters = z.infer<typeof reportFiltersSchema>;
export type ReportViewModel = z.infer<typeof reportViewModelSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type ExportResponse = z.infer<typeof exportResponseSchema>;

// Guidance URL builder
export function buildGuidanceUrl(ruleId: string): string {
  return `/docs/rules/${ruleId}`;
}

// Health grade calculator
export function calculateHealthGrade(score: number): keyof typeof HEALTH_GRADES {
  for (const [grade, range] of Object.entries(HEALTH_GRADES)) {
    if (score >= range.min && score <= range.max) {
      return grade as keyof typeof HEALTH_GRADES;
    }
  }
  return "critical";
}