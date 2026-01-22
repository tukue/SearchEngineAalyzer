import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Plan entitlements configuration
export const PLAN_CONFIGS = {
  free: {
    monthlyAuditLimit: 10,
    historyDepth: 5,
    exportsEnabled: false,
    webhooksEnabled: false,
    apiAccessEnabled: false
  },
  pro: {
    monthlyAuditLimit: 1000,
    historyDepth: 100,
    exportsEnabled: true,
    webhooksEnabled: true,
    apiAccessEnabled: true
  }
} as const;

export type PlanType = keyof typeof PLAN_CONFIGS;
export type PlanConfig = typeof PLAN_CONFIGS[PlanType];

// Tenants model
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("free"), // 'free' | 'pro'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Plan change audit log
export const planChanges = pgTable("plan_changes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  previousPlan: text("previous_plan").notNull(),
  newPlan: text("new_plan").notNull(),
  actorUserId: text("actor_user_id"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Usage tracking for quotas
export const usageTracking = pgTable("usage_tracking", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  month: text("month").notNull(), // YYYY-MM format
  auditCount: integer("audit_count").notNull().default(0),
  exportCount: integer("export_count").notNull().default(0),
});

// Usage ledger for audit tracking with idempotency
export const usageLedger = pgTable("usage_ledger", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  requestId: text("request_id").notNull(), // for idempotency
  auditType: text("audit_type").notNull().default("meta_analysis"),
  status: text("status").notNull().default("enqueued"), // enqueued, completed, failed
  url: text("url"),
  userId: text("user_id"),
  enqueuedAt: timestamp("enqueued_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  period: text("period").notNull(), // YYYY-MM format
});

// Monthly usage summary for fast quota checks
export const monthlyUsage = pgTable("monthly_usage", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  period: text("period").notNull(), // YYYY-MM format
  enqueuedCount: integer("enqueued_count").notNull().default(0),
  completedCount: integer("completed_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

// Meta tag model
export const metaTags = pgTable("meta_tags", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
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
  tenantId: integer("tenant_id").notNull(),
  url: text("url").notNull(),
  totalCount: integer("total_count").notNull(),
  seoCount: integer("seo_count").notNull(),
  socialCount: integer("social_count").notNull(),
  technicalCount: integer("technical_count").notNull(),
  missingCount: integer("missing_count").notNull(),
  healthScore: integer("health_score").notNull(),
  timestamp: text("timestamp").notNull(),
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
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlanChangeSchema = createInsertSchema(planChanges).omit({ id: true, timestamp: true });
export const insertUsageTrackingSchema = createInsertSchema(usageTracking).omit({ id: true });
export const insertUsageLedgerSchema = createInsertSchema(usageLedger).omit({ id: true, enqueuedAt: true, completedAt: true, failedAt: true });
export const insertMonthlyUsageSchema = createInsertSchema(monthlyUsage).omit({ id: true, lastUpdated: true });
export const insertMetaTagSchema = createInsertSchema(metaTags).omit({ id: true });
export const insertAnalysisSchema = createInsertSchema(analyses).omit({ id: true });
export const insertRecommendationSchema = createInsertSchema(recommendations).omit({ id: true });

// Types
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type InsertPlanChange = z.infer<typeof insertPlanChangeSchema>;
export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
export type InsertUsageLedger = z.infer<typeof insertUsageLedgerSchema>;
export type InsertMonthlyUsage = z.infer<typeof insertMonthlyUsageSchema>;
export type InsertMetaTag = z.infer<typeof insertMetaTagSchema>;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type PlanChange = typeof planChanges.$inferSelect;
export type UsageTracking = typeof usageTracking.$inferSelect;
export type UsageLedger = typeof usageLedger.$inferSelect;
export type MonthlyUsage = typeof monthlyUsage.$inferSelect;
export type MetaTag = typeof metaTags.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;
export type Recommendation = typeof recommendations.$inferSelect;

// Request and response type for analysis
export const urlSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

export type UrlRequest = z.infer<typeof urlSchema>;

export type TopFix = {
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  affected_urls_count: number;
  why: string;
  how: string;
};

export type AnalysisResult = {
  analysis: Analysis;
  tags: MetaTag[];
  recommendations: Recommendation[];
  topFixes?: TopFix[];
  quota?: QuotaStatus;
};

// Plan gating error types
export const PlanGatingError = z.object({
  code: z.enum(["PLAN_UPGRADE_REQUIRED", "QUOTA_EXCEEDED", "FEATURE_NOT_AVAILABLE"]),
  feature: z.string(),
  currentPlan: z.string(),
  requiredPlan: z.string().optional(),
  message: z.string(),
});

export type PlanGatingError = z.infer<typeof PlanGatingError>;

// Quota status response
export const QuotaStatus = z.object({
  quotaRemaining: z.number(),
  quotaUsed: z.number(),
  quotaLimit: z.number(),
  quotaPercentUsed: z.number(),
  warningLevel: z.enum(["none", "warning_80", "warning_90", "exceeded"]),
  period: z.string(),
});

export type QuotaStatus = z.infer<typeof QuotaStatus>;

// Audit request with idempotency
export const AuditRequest = z.object({
  url: z.string().url(),
  requestId: z.string().optional(), // for idempotency
  auditType: z.string().default("meta_analysis"),
  userId: z.string().optional(),
});

export type AuditRequest = z.infer<typeof AuditRequest>;

// Tenant context for requests
export const tenantContextSchema = z.object({
  tenantId: z.number(),
  plan: z.enum(["free", "pro"]),
});

export type TenantContext = z.infer<typeof tenantContextSchema>;