import { Recommendation, TopFix } from "@shared/schema";
import { ParsedData, ScoredData, CheckCategory } from "./types";

const CATEGORY_WEIGHT: Record<CheckCategory, number> = {
  "Technical SEO": 0.4,
  "On-page SEO": 0.4,
  "Content quality": 0.2,
};

const SEVERITY_TO_TOP_FIX: Record<string, "Critical" | "High" | "Medium" | "Low"> = {
  Critical: "Critical",
  Important: "High",
  Minor: "Medium",
};

export class Scorer {
  static score(parsedData: ParsedData): ScoredData {
    const recommendations: Partial<Recommendation>[] = [];

    const categoryScores = Object.keys(CATEGORY_WEIGHT).reduce(
      (acc, category) => {
        const categoryChecks = parsedData.checks.filter((check) => check.category === category);
        const totalPoints = categoryChecks.reduce((sum, check) => sum + check.points, 0);
        const earnedPoints = categoryChecks.reduce((sum, check) => sum + (check.passed ? check.points : 0), 0);
        acc[category as CheckCategory] = totalPoints === 0 ? 100 : (earnedPoints / totalPoints) * 100;
        return acc;
      },
      {} as Record<CheckCategory, number>,
    );

    const weightedScore = Math.round(
      Object.entries(CATEGORY_WEIGHT).reduce((total, [category, weight]) => {
        return total + categoryScores[category as CheckCategory] * weight;
      }, 0),
    );

    parsedData.checks
      .filter((check) => !check.passed)
      .forEach((check) => {
        recommendations.push({
          tagName: `${check.category}: ${check.key}`,
          description: `${check.issue} ${check.whyItMatters}`.trim(),
          example: check.recommendation || "",
        });
      });

    const topFixes: TopFix[] = parsedData.checks
      .filter((check) => !check.passed)
      .map((check) => ({
        title: check.issue || `Fix ${check.key}`,
        severity: SEVERITY_TO_TOP_FIX[check.severity] || "Medium",
        affected_urls_count: 1,
        why: check.whyItMatters || "",
        how: check.recommendation || "",
      }))
      .sort((a, b) => {
        const ranking = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        return ranking[b.severity] - ranking[a.severity];
      })
      .slice(0, 3);

    return {
      ...parsedData,
      healthScore: weightedScore,
      recommendations,
      topFixes,
    };
  }
}
