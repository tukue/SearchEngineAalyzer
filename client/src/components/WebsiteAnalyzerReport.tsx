import { Analysis, AnalysisResult, MetaTag } from "@shared/schema";
import { formatWebsiteAnalyzerReport, WebsiteAnalyzerAuditPayload } from "@shared/websiteAnalyzerReport";

type WebsiteAnalyzerReportProps = {
  result: AnalysisResult;
  previousAnalysis?: Analysis | null;
};

type AnalysisWithOptionalCounts = Analysis & {
  invalidCount?: number | null;
  warningCount?: number | null;
};

const findTagValue = (tags: MetaTag[], matcher: (tag: MetaTag) => boolean) => {
  const tag = tags.find(matcher);
  if (!tag || !tag.isPresent) return null;
  const content = tag.content ?? "";
  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getOptionalCount = (analysis: Analysis | null | undefined, key: "invalidCount" | "warningCount") => {
  if (!analysis) return 0;
  const value = (analysis as AnalysisWithOptionalCounts)[key];
  return value ?? 0;
};

const buildAuditPayload = (result: AnalysisResult, previousAnalysis?: Analysis | null): WebsiteAnalyzerAuditPayload => {
  const { analysis, tags, quota } = result;

  return {
    url: analysis.url,
    tags: {
      title: findTagValue(tags, (tag) => tag.name === "title"),
      metaDescription: findTagValue(tags, (tag) => tag.name === "description"),
      canonical: findTagValue(tags, (tag) => tag.rel === "canonical"),
      openGraph: {
        ogTitle: findTagValue(tags, (tag) => tag.property === "og:title"),
        ogDescription: findTagValue(tags, (tag) => tag.property === "og:description"),
        ogUrl: findTagValue(tags, (tag) => tag.property === "og:url"),
        ogImage: findTagValue(tags, (tag) => tag.property === "og:image"),
      },
      twitter: {
        card: findTagValue(tags, (tag) => tag.name === "twitter:card"),
        title: findTagValue(tags, (tag) => tag.name === "twitter:title"),
        description: findTagValue(tags, (tag) => tag.name === "twitter:description"),
        image: findTagValue(tags, (tag) => tag.name === "twitter:image"),
      },
    },
    currentCounts: {
      missing: analysis.missingCount,
      invalid: getOptionalCount(analysis, "invalidCount"),
      warnings: getOptionalCount(analysis, "warningCount"),
    },
    previousRun: previousAnalysis
      ? {
          counts: {
            missing: previousAnalysis.missingCount,
            invalid: getOptionalCount(previousAnalysis, "invalidCount"),
            warnings: getOptionalCount(previousAnalysis, "warningCount"),
          },
        }
      : undefined,
    quota: quota
      ? {
          remaining: quota.quotaRemaining,
          limit: quota.quotaLimit,
          warning: quota.warningLevel !== "none",
        }
      : undefined,
  };
};

export default function WebsiteAnalyzerReport({ result, previousAnalysis }: WebsiteAnalyzerReportProps) {
  const payload = buildAuditPayload(result, previousAnalysis);
  const report = formatWebsiteAnalyzerReport(payload);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-800">Website Analyzer Report</h2>
      </div>
      <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-slate-50 p-4 rounded-md border border-slate-200">
        {report}
      </pre>
    </div>
  );
}
