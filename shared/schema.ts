import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const auditStatuses = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "SUCCEEDED",
  "FAILED",
  "TIMED_OUT",
] as const;

export type AuditStatus = (typeof auditStatuses)[number];

// Meta tag model
export const metaTags = pgTable("meta_tags", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  name: text("name"),
  property: text("property"),
  content: text("content"),
  httpEquiv: text("http_equiv"),
  charset: text("charset"),
  rel: text("rel"),
  tagType: text("tag_type").notNull(), // SEO, Social, Technical
  isPresent: boolean("is_present").notNull().default(true),
});

// Analysis results model
export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  totalCount: integer("total_count").notNull(),
  seoCount: integer("seo_count").notNull(),
  socialCount: integer("social_count").notNull(),
  technicalCount: integer("technical_count").notNull(),
  missingCount: integer("missing_count").notNull(),
  healthScore: integer("health_score").notNull(),
  timestamp: text("timestamp").notNull(),
  // MVP measurements
  seoVisibleAtFirstByte: integer("seo_visible_at_first_byte"),
  prioritizedHealthScore: integer("prioritized_health_score"),
  sharePreviewConfidence: integer("share_preview_confidence"),
});

export const auditRuns = pgTable("audit_runs", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  userId: text("user_id").notNull(),
  target: text("target").notNull(),
  status: text("status").notNull(),
  healthScore: integer("health_score"),
  summary: text("summary"),
  progress: integer("progress").default(0),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
  jobId: text("job_id"),
  idempotencyKey: text("idempotency_key"),
});

export const tenantUsage = pgTable("tenant_usage", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  plan: text("plan").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  runsCount: integer("runs_count").notNull().default(0),
});

// Recommendation model
export const recommendations = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").notNull(),
  tagName: text("tag_name").notNull(),
  description: text("description").notNull(),
  example: text("example").notNull(),
});

// Insert schemas
export const insertMetaTagSchema = createInsertSchema(metaTags).omit({ id: true });
export const insertAnalysisSchema = createInsertSchema(analyses).omit({ id: true });
export const insertRecommendationSchema = createInsertSchema(recommendations).omit({ id: true });
export const insertAuditRunSchema = createInsertSchema(auditRuns).omit({ id: true });
export const insertTenantUsageSchema = createInsertSchema(tenantUsage).omit({ id: true });

// Types
export type InsertMetaTag = z.infer<typeof insertMetaTagSchema>;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type InsertAuditRun = z.infer<typeof insertAuditRunSchema>;
export type InsertTenantUsage = z.infer<typeof insertTenantUsageSchema>;
export type MetaTag = typeof metaTags.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;
export type Recommendation = typeof recommendations.$inferSelect;
export type AuditRun = typeof auditRuns.$inferSelect;
export type TenantUsage = typeof tenantUsage.$inferSelect;

// Request and response type for analysis
export const urlSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

export type UrlRequest = z.infer<typeof urlSchema>;

export type AnalysisResult = {
  analysis: Analysis;
  tags: MetaTag[];
  recommendations: Recommendation[];
};

export type PlanFeatureFlags = {
  name: string;
  canExportReports: boolean;
  maxHistoryLength: number;
  maxMonthlyRuns: number;
};
