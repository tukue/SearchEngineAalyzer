import { AnalysisResult } from "@shared/schema";
import { UrlFetcher } from "./fetcher";
import { HtmlParser } from "./parser";
import { Scorer } from "./scorer";
import { AnalyzerOptions } from "./types";

export async function analyzeUrl(normalizedUrl: string, options?: AnalyzerOptions): Promise<AnalysisResult> {
  if (!options?.tenantId) {
    throw new Error("tenantId is required for analysis");
  }

  const fetched = await UrlFetcher.fetch(normalizedUrl, options);
  const parsedData = HtmlParser.parse(fetched.html, normalizedUrl, fetched.metrics);
  const scoredData = Scorer.score(parsedData);

  const analysis = {
    id: 0,
    tenantId: options.tenantId,
    url: fetched.metrics.finalUrl,
    totalCount: scoredData.tags.length,
    seoCount: scoredData.seoCount,
    socialCount: scoredData.socialCount,
    technicalCount: scoredData.technicalCount,
    missingCount: scoredData.missingCount,
    healthScore: scoredData.healthScore,
    timestamp: new Date().toISOString(),
  };

  return {
    analysis,
    tags: scoredData.tags.map((tag) => ({ ...tag, tenantId: analysis.tenantId } as any)),
    recommendations: scoredData.recommendations.map(
      (rec) =>
        ({
          ...rec,
          tenantId: analysis.tenantId,
          analysisId: analysis.id,
        }) as any,
    ),
    topFixes: scoredData.topFixes,
  };
}
