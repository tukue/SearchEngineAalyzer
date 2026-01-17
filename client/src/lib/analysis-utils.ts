import { MetaTag } from "@shared/schema";

export type Severity = "Critical" | "High" | "Medium" | "Low";
export type Effort = "Low" | "Medium" | "High";

export interface Issue {
  tagName: string;
  category: string;
  status: string;
  severity: Severity;
  quickWin: boolean;
  priorityScore: number;
  description?: string;
}

export interface HealthSummary {
  score: number | string;
  seo: { pass: number; fail: number };
  social: { pass: number; fail: number };
  technical: { pass: number; fail: number };
}

const TAG_RULES: Record<string, { category: string; severity: Severity; effort: Effort }> = {
  "title": { category: "SEO", severity: "Critical", effort: "Low" },
  "description": { category: "SEO", severity: "Critical", effort: "Low" },
  "canonical": { category: "SEO", severity: "Critical", effort: "Medium" },
  "robots": { category: "Technical", severity: "Critical", effort: "Low" },
  "viewport": { category: "Technical", severity: "High", effort: "Low" },
  "og:title": { category: "Social", severity: "Critical", effort: "Low" },
  "og:description": { category: "Social", severity: "Critical", effort: "Low" },
  "og:image": { category: "Social", severity: "High", effort: "Medium" },
  "twitter:card": { category: "Social", severity: "High", effort: "Low" },
  "charset": { category: "Technical", severity: "High", effort: "Low" },
  "keywords": { category: "SEO", severity: "Low", effort: "Low" },
  "author": { category: "Technical", severity: "Low", effort: "Low" },
};

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  "Critical": 4,
  "High": 3,
  "Medium": 2,
  "Low": 1,
};

export function computeHealthSummary(tags: MetaTag[]): HealthSummary {
  const summary = {
    seo: { pass: 0, fail: 0 },
    social: { pass: 0, fail: 0 },
    technical: { pass: 0, fail: 0 },
  };

  let totalChecked = 0;
  let totalValid = 0;

  tags.forEach(tag => {
    totalChecked++;
    // Assuming "Missing" or empty content means fail/invalid based on context
    // Also checking isPresent flag if available, though backend might set it false for missing tags
    const isValid = tag.isPresent && tag.content !== "Missing" && tag.content !== ""; 
    
    if (isValid) {
      totalValid++;
    }

    const category = tag.tagType || "Technical";
    
    if (category === "SEO") {
      isValid ? summary.seo.pass++ : summary.seo.fail++;
    } else if (category === "Social") {
      isValid ? summary.social.pass++ : summary.social.fail++;
    } else {
      isValid ? summary.technical.pass++ : summary.technical.fail++;
    }
  });

  const score = totalChecked === 0 ? "—" : Math.round((totalValid / totalChecked) * 100);

  return {
    score,
    ...summary
  };
}

export function computeTopIssues(tags: MetaTag[]): Issue[] {
  const issues: Issue[] = [];

  tags.forEach(tag => {
    // Identify missing or invalid tags
    const isMissing = !tag.isPresent || tag.content === "Missing";
    const isInvalid = !isMissing && (!tag.content || tag.content.trim() === ""); // Simple invalid check
    
    if (isMissing || isInvalid) {
      const tagName = tag.name || tag.property || tag.httpEquiv || "unknown";
      // Normalize tag name for lookup (e.g. meta:description -> description if needed, but keeping simple for now)
      // The backend returns names like "title", "description", "og:title"
      const rule = TAG_RULES[tagName] || { category: tag.tagType || "Technical", severity: "Medium", effort: "Medium" };
      
      const severity = rule.severity;
      const effort = rule.effort;
      const quickWin = effort === "Low";
      
      // Priority Score Calculation
      // priorityScore = severityWeight[severity] * 10 + (quickWin ? 3 : 0) + (status == "missing" ? 1 : 0)
      const weight = SEVERITY_WEIGHTS[severity];
      const status = isMissing ? "missing" : "invalid";
      const priorityScore = weight * 10 + (quickWin ? 3 : 0) + (status === "missing" ? 1 : 0);

      issues.push({
        tagName,
        category: rule.category,
        status,
        severity,
        quickWin,
        priorityScore,
        description: isMissing ? `Missing ${tagName}` : `Invalid ${tagName}`
      });
    }
  });

  // Sort by priorityScore desc
  return issues.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 3);
}
