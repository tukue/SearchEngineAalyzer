import { AnalysisResult } from "@shared/schema";
import { UrlFetcher } from "./fetcher";
import { HtmlParser } from "./parser";
import { Scorer } from "./scorer";
import { AnalyzerOptions } from "./types";

export async function analyzeUrl(normalizedUrl: string, options?: AnalyzerOptions): Promise<AnalysisResult> {
  const html = await UrlFetcher.fetch(normalizedUrl, options);
  const parsedData = HtmlParser.parse(html);
  const scoredData = Scorer.score(parsedData);

  const tenantId = options?.tenantId ?? (() => {
    throw new Error("tenantId is required for analysis");
  })();

  const analysis = {
    id: 0, // Placeholder, will be set by storage
    tenantId,
    url: normalizedUrl,
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
    recommendations: scoredData.recommendations.map((rec) => ({
      ...rec,
      tenantId: analysis.tenantId,
      analysisId: analysis.id,
    } as any)),
  };
}
