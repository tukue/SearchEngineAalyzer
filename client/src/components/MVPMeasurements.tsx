import { Search, TrendingUp, Share2 } from "lucide-react";
import MeasurementCard from "./MeasurementCard";
import { type Analysis } from "@shared/schema";

interface MVPMeasurementsProps {
  analysis: Analysis;
}

export default function MVPMeasurements({ analysis }: MVPMeasurementsProps) {
  // Only show if we have MVP measurements
  if (!analysis.seoVisibleAtFirstByte && !analysis.prioritizedHealthScore && !analysis.sharePreviewConfidence) {
    return null;
  }

  const getMeasurementData = () => {
    const measurements = [];

    if (analysis.seoVisibleAtFirstByte !== null) {
      measurements.push({
        title: "SEO-Visible at First Byte",
        score: analysis.seoVisibleAtFirstByte,
        description: "Critical SEO content available in initial HTML response",
        details: "Measures presence of title, meta description, H1, and structured data that search engines can immediately see.",
        recommendations: [
          "Ensure title tag is present and descriptive",
          "Add meta description (50-160 characters)",
          "Include H1 heading on the page",
          "Consider adding structured data (JSON-LD)"
        ],
        icon: <Search className="h-5 w-5 text-blue-500" />
      });
    }

    if (analysis.prioritizedHealthScore !== null) {
      measurements.push({
        title: "Prioritized Health Score",
        score: analysis.prioritizedHealthScore,
        description: "Weighted score emphasizing high-impact SEO elements",
        details: "Enhanced health score that prioritizes title tags, meta descriptions, and Open Graph data over less critical elements.",
        recommendations: [
          "Focus on title and description optimization first",
          "Add Open Graph tags for social sharing",
          "Ensure canonical URL is set",
          "Include viewport meta tag for mobile"
        ],
        icon: <TrendingUp className="h-5 w-5 text-green-500" />
      });
    }

    if (analysis.sharePreviewConfidence !== null) {
      measurements.push({
        title: "Share Preview Confidence",
        score: analysis.sharePreviewConfidence,
        description: "How well your page displays when shared on social media",
        details: "Evaluates Open Graph tags, Twitter Cards, and fallback meta tags to predict social sharing appearance.",
        recommendations: [
          "Add og:title and og:description tags",
          "Include og:image with proper dimensions",
          "Set up Twitter Card meta tags",
          "Ensure og:url matches canonical URL"
        ],
        icon: <Share2 className="h-5 w-5 text-purple-500" />
      });
    }

    return measurements;
  };

  const measurements = getMeasurementData();

  if (measurements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Advanced Measurements</h3>
        <p className="text-sm text-slate-600">
          Enhanced metrics that provide deeper insights into your page's SEO and social media performance.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {measurements.map((measurement, index) => (
          <MeasurementCard
            key={index}
            title={measurement.title}
            score={measurement.score}
            description={measurement.description}
            details={measurement.details}
            recommendations={measurement.recommendations}
            icon={measurement.icon}
          />
        ))}
      </div>
    </div>
  );
}