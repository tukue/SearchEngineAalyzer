import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Projects table - groups audits by URL/domain
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  domain: text("domain").notNull(), // extracted from URL for grouping
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("projects_tenant_id_idx").on(table.tenantId),
  tenantDomainIdx: index("projects_tenant_domain_idx").on(table.tenantId, table.domain),
  tenantActiveIdx: index("projects_tenant_active_idx").on(table.tenantId, table.isActive),
}));

// Audits table - audit definitions/types per project
export const audits = pgTable("audits", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(), // e.g., "SEO Audit", "Performance Audit"
  type: text("type").notNull(), // "seo", "performance", "accessibility"
  config: jsonb("config"), // audit-specific configuration
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("audits_tenant_id_idx").on(table.tenantId),
  tenantProjectIdx: index("audits_tenant_project_idx").on(table.tenantId, table.projectId),
  tenantTypeIdx: index("audits_tenant_type_idx").on(table.tenantId, table.type),
}));

// Audit runs table - each execution instance
export const auditRuns = pgTable("audit_runs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  projectId: integer("project_id").notNull(),
  auditId: integer("audit_id").notNull(),
  runId: uuid("run_id").defaultRandom().notNull(), // public-facing ID
  status: text("status").notNull().default("running"), // running, completed, failed
  summary: jsonb("summary").notNull(), // scores, counts, metadata
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // milliseconds
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("audit_runs_tenant_id_idx").on(table.tenantId),
  tenantProjectIdx: index("audit_runs_tenant_project_idx").on(table.tenantId, table.projectId),
  tenantAuditIdx: index("audit_runs_tenant_audit_idx").on(table.tenantId, table.auditId),
  tenantStartedIdx: index("audit_runs_tenant_started_idx").on(table.tenantId, table.startedAt),
  runIdIdx: index("audit_runs_run_id_idx").on(table.runId),
  // Composite index for efficient "last N runs" queries
  tenantAuditStartedIdx: index("audit_runs_tenant_audit_started_idx").on(table.tenantId, table.auditId, table.startedAt),
}));

// Findings table - normalized issues per run
export const findings = pgTable("findings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  runId: integer("run_id").notNull(), // references audit_runs.id
  category: text("category").notNull(), // "seo", "performance", "accessibility"
  severity: text("severity").notNull(), // "critical", "high", "medium", "low", "info"
  ruleId: text("rule_id").notNull(), // unique identifier for the rule
  title: text("title").notNull(),
  message: text("message").notNull(),
  guidance: text("guidance").notNull(), // "what to fix"
  impact: text("impact").notNull(), // "why it matters"
  element: text("element"), // CSS selector or element reference
  line: integer("line"), // line number if applicable
  column: integer("column"), // column number if applicable
  metadata: jsonb("metadata"), // additional rule-specific data
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("findings_tenant_id_idx").on(table.tenantId),
  tenantRunIdx: index("findings_tenant_run_idx").on(table.tenantId, table.runId),
  tenantCategoryIdx: index("findings_tenant_category_idx").on(table.tenantId, table.category),
  tenantSeverityIdx: index("findings_tenant_severity_idx").on(table.tenantId, table.severity),
  ruleIdIdx: index("findings_rule_id_idx").on(table.ruleId),
}));

// Artifacts table - pointers to object storage
export const artifacts = pgTable("artifacts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  runId: integer("run_id").notNull(),
  type: text("type").notNull(), // "html_snapshot", "screenshot", "response_dump"
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(), // bytes
  storageKey: text("storage_key").notNull(), // S3 key or storage path
  bucket: text("bucket").notNull(),
  expiresAt: timestamp("expires_at"), // for signed URLs
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("artifacts_tenant_id_idx").on(table.tenantId),
  tenantRunIdx: index("artifacts_tenant_run_idx").on(table.tenantId, table.runId),
  storageKeyIdx: index("artifacts_storage_key_idx").on(table.storageKey),
}));

// Insert schemas
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditSchema = createInsertSchema(audits).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditRunSchema = createInsertSchema(auditRuns).omit({ id: true, runId: true, createdAt: true });
export const insertFindingSchema = createInsertSchema(findings).omit({ id: true, createdAt: true });
export const insertArtifactSchema = createInsertSchema(artifacts).omit({ id: true, createdAt: true });

// Types
export type Project = typeof projects.$inferSelect;
export type Audit = typeof audits.$inferSelect;
export type AuditRun = typeof auditRuns.$inferSelect;
export type Finding = typeof findings.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertAudit = z.infer<typeof insertAuditSchema>;
export type InsertAuditRun = z.infer<typeof insertAuditRunSchema>;
export type InsertFinding = z.infer<typeof insertFindingSchema>;
export type InsertArtifact = z.infer<typeof insertArtifactSchema>;

// Summary JSON schema
export const auditSummarySchema = z.object({
  scores: z.object({
    overall: z.number().min(0).max(100),
    seo: z.number().min(0).max(100),
    performance: z.number().min(0).max(100),
    accessibility: z.number().min(0).max(100),
  }),
  counts: z.object({
    total: z.number().min(0),
    critical: z.number().min(0),
    high: z.number().min(0),
    medium: z.number().min(0),
    low: z.number().min(0),
    info: z.number().min(0),
  }),
  metadata: z.object({
    url: z.string().url(),
    userAgent: z.string().optional(),
    viewport: z.string().optional(),
    loadTime: z.number().optional(),
    pageSize: z.number().optional(),
  }),
  trends: z.object({
    scoreChange: z.number().optional(),
    newIssues: z.number().optional(),
    resolvedIssues: z.number().optional(),
  }).optional(),
});

export type AuditSummary = z.infer<typeof auditSummarySchema>;

// API response types
export const dashboardRunSchema = z.object({
  runId: z.string().uuid(),
  projectName: z.string(),
  auditName: z.string(),
  status: z.string(),
  overallScore: z.number(),
  startedAt: z.string(),
  duration: z.number().nullable(),
  findingsCount: z.number(),
});

export const runDetailsSchema = z.object({
  runId: z.string().uuid(),
  projectName: z.string(),
  auditName: z.string(),
  status: z.string(),
  summary: auditSummarySchema,
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  duration: z.number().nullable(),
  findings: z.array(z.object({
    id: z.number(),
    category: z.string(),
    severity: z.string(),
    ruleId: z.string(),
    title: z.string(),
    message: z.string(),
    guidance: z.string(),
    impact: z.string(),
    element: z.string().nullable(),
    metadata: z.any().optional(),
  })),
  artifacts: z.array(z.object({
    id: z.number(),
    type: z.string(),
    filename: z.string(),
    size: z.number(),
    downloadUrl: z.string().optional(),
  })).optional(),
});

export type DashboardRun = z.infer<typeof dashboardRunSchema>;
export type RunDetails = z.infer<typeof runDetailsSchema>;