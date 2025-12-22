import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const metaTags = pgTable("meta_tags", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  name: text("name"),
  property: text("property"),
  content: text("content"),
  httpEquiv: text("http_equiv"),
  charset: text("charset"),
  rel: text("rel"),
  tagType: text("tag_type").notNull(),
  isPresent: boolean("is_present").notNull().default(true),
});

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
});

export const recommendations = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").notNull(),
  tagName: text("tag_name").notNull(),
  description: text("description").notNull(),
  example: text("example").notNull(),
});

export const insertMetaTagSchema = createInsertSchema(metaTags).omit({ id: true });
export const insertAnalysisSchema = createInsertSchema(analyses).omit({ id: true });
export const insertRecommendationSchema = createInsertSchema(recommendations).omit({ id: true });

export type InsertMetaTag = z.infer<typeof insertMetaTagSchema>;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type MetaTag = typeof metaTags.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;
export type Recommendation = typeof recommendations.$inferSelect;

export const urlSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

export type UrlRequest = z.infer<typeof urlSchema>;

export type AnalysisResult = {
  analysis: Analysis;
  tags: MetaTag[];
  recommendations: Recommendation[];
};
