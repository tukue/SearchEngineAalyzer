import { 
  ReportViewModel, 
  ReportFinding, 
  PrioritizedFix, 
  HealthScore,
  CategoryCounts,
  SeverityCounts,
  RunMetadata,
  SEVERITY_WEIGHTS,
  EFFORT_LEVELS,
  CATEGORY_WEIGHTS,
  calculateHealthGrade,
  buildGuidanceUrl
} from "@shared/report-schema";
import { persistenceService } from "./persistence-service";
import type { TenantContext } from "@shared/schema";

export class ReportService {
  /**
   * Generate a complete report view model for a given run
   */
  static async generateReport(tenantId: number, runId: string): Promise<ReportViewModel | null> {
    // Get run details
    const runDetails = await persistenceService.getRunDetails(tenantId, runId);
    if (!runDetails) {
      return null;
    }

    // Transform findings to report format
    const reportFindings = runDetails.findings.map(finding => this.transformFinding(finding));
    
    // Calculate health scores
    const healthScore = this.calculateHealthScore(reportFindings);
    
    // Calculate category and severity counts
    const categoryCounts = this.calculateCategoryCounts(reportFindings);
    const severityCounts = this.calculateSeverityCounts(reportFindings);
    
    // Generate prioritized fixes
    const topFixes = this.generateTopFixes(reportFindings);
    
    // Build metadata
    const metadata: RunMetadata = {
      runId: runDetails.runId,
      url: runDetails.summary.metadata.url,
      auditType: runDetails.auditName,
      startedAt: runDetails.startedAt,
      completedAt: runDetails.completedAt,
      duration: runDetails.duration,
      userAgent: runDetails.summary.metadata.userAgent,
      viewport: runDetails.summary.metadata.viewport,
      loadTime: runDetails.summary.metadata.loadTime,
      pageSize: runDetails.summary.metadata.pageSize,
    };

    return {
      healthScore,
      categoryCounts,
      severityCounts,
      topFixes,
      findings: reportFindings,
      metadata,
      generatedAt: new Date().toISOString(),
      version: "1.0",
    };
  }

  /**
   * Transform a finding to report format with prioritization data
   */
  private static transformFinding(finding: any): ReportFinding {
    const effortLevel = this.estimateEffortLevel(finding.ruleId, finding.severity);
    const priorityScore = this.calculatePriorityScore(finding, effortLevel);
    
    return {
      id: finding.id,
      category: finding.category as "seo" | "social" | "technical",
      severity: finding.severity as "critical" | "high" | "medium" | "low" | "info",
      status: this.determineStatus(finding.severity),
      ruleId: finding.ruleId,
      title: finding.title,
      message: finding.message,
      guidance: finding.guidance,
      impact: finding.impact,
      element: finding.element || null,
      line: finding.line || null,
      column: finding.column || null,
      metadata: finding.metadata,
      effortLevel,
      priorityScore,
      guidanceUrl: buildGuidanceUrl(finding.ruleId),
    };
  }

  /**
   * Calculate overall and category-specific health scores
   */
  private static calculateHealthScore(findings: ReportFinding[]): HealthScore {
    const categoryFindings = {
      seo: findings.filter(f => f.category === "seo"),
      social: findings.filter(f => f.category === "social"),
      technical: findings.filter(f => f.category === "technical"),
    };

    // Calculate category scores (0-100, higher is better)
    const categoryScores = {
      seo: this.calculateCategoryScore(categoryFindings.seo),
      social: this.calculateCategoryScore(categoryFindings.social),
      technical: this.calculateCategoryScore(categoryFindings.technical),
    };

    // Calculate weighted overall score
    const totalWeight = Object.values(CATEGORY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    const overall = Math.round(
      (categoryScores.seo * CATEGORY_WEIGHTS.seo +
       categoryScores.social * CATEGORY_WEIGHTS.social +
       categoryScores.technical * CATEGORY_WEIGHTS.technical) / totalWeight
    );

    return {
      overall,
      grade: calculateHealthGrade(overall),
      categoryScores,
    };
  }

  /**
   * Calculate score for a specific category
   */
  private static calculateCategoryScore(findings: ReportFinding[]): number {
    if (findings.length === 0) return 100; // No findings = perfect score

    // Calculate penalty based on severity weights
    const totalPenalty = findings.reduce((sum, finding) => {
      return sum + SEVERITY_WEIGHTS[finding.severity];
    }, 0);

    // Normalize to 0-100 scale (assuming max 10 critical issues = 0 score)
    const maxPenalty = 10 * SEVERITY_WEIGHTS.critical;
    const score = Math.max(0, 100 - (totalPenalty / maxPenalty) * 100);
    
    return Math.round(score);
  }

  /**
   * Calculate category counts
   */
  private static calculateCategoryCounts(findings: ReportFinding[]): CategoryCounts {
    const categories = ["seo", "social", "technical"] as const;
    const result = {} as CategoryCounts;

    for (const category of categories) {
      const categoryFindings = findings.filter(f => f.category === category);
      result[category] = {
        total: categoryFindings.length,
        pass: categoryFindings.filter(f => f.status === "pass").length,
        fail: categoryFindings.filter(f => f.status === "fail").length,
        warn: categoryFindings.filter(f => f.status === "warn").length,
      };
    }

    return result;
  }

  /**
   * Calculate severity counts
   */
  private static calculateSeverityCounts(findings: ReportFinding[]): SeverityCounts {
    const severities = ["critical", "high", "medium", "low", "info"] as const;
    const result = {} as SeverityCounts;

    for (const severity of severities) {
      result[severity] = findings.filter(f => f.severity === severity).length;
    }
    result.total = findings.length;

    return result;
  }

  /**
   * Generate top prioritized fixes
   */
  private static generateTopFixes(findings: ReportFinding[]): PrioritizedFix[] {
    // Only include failed findings for prioritization
    const failedFindings = findings.filter(f => f.status === "fail");
    
    // Sort by priority score (descending)
    const sortedFindings = failedFindings.sort((a, b) => b.priorityScore - a.priorityScore);
    
    // Take top 5 and create prioritized fix objects
    return sortedFindings.slice(0, 5).map((finding, index) => ({
      finding,
      rank: index + 1,
      impactScore: this.calculateImpactScore(finding),
      effortScore: this.calculateEffortScore(finding.effortLevel),
      categoryRelevance: CATEGORY_WEIGHTS[finding.category],
    }));
  }

  /**
   * Calculate priority score for a finding
   */
  private static calculatePriorityScore(finding: any, effortLevel: keyof typeof EFFORT_LEVELS): number {
    const severityWeight = SEVERITY_WEIGHTS[finding.severity as keyof typeof SEVERITY_WEIGHTS];
    const categoryWeight = CATEGORY_WEIGHTS[finding.category as keyof typeof CATEGORY_WEIGHTS];
    const effortWeight = 1 / EFFORT_LEVELS[effortLevel]; // Lower effort = higher priority

    // Normalize to 0-100 scale
    const maxScore = SEVERITY_WEIGHTS.critical * CATEGORY_WEIGHTS.seo * (1 / EFFORT_LEVELS.low);
    const score = (severityWeight * categoryWeight * effortWeight / maxScore) * 100;
    
    return Math.round(Math.min(100, score));
  }

  /**
   * Estimate effort level based on rule ID and severity
   */
  private static estimateEffortLevel(ruleId: string, severity: string): keyof typeof EFFORT_LEVELS {
    // Simple heuristics - in production, this would be rule-specific
    if (ruleId.includes("missing") || ruleId.includes("empty")) {
      return "low"; // Adding missing tags is usually easy
    }
    
    if (severity === "critical" || severity === "high") {
      return "medium"; // Important issues might need more work
    }
    
    if (ruleId.includes("performance") || ruleId.includes("accessibility")) {
      return "high"; // These often require significant changes
    }
    
    return "medium"; // Default
  }

  /**
   * Determine status based on severity
   */
  private static determineStatus(severity: string): "pass" | "fail" | "warn" {
    if (severity === "critical" || severity === "high") return "fail";
    if (severity === "medium") return "warn";
    return "fail"; // Default to fail for low/info to encourage fixes
  }

  /**
   * Calculate impact score for prioritization
   */
  private static calculateImpactScore(finding: ReportFinding): number {
    const severityWeight = SEVERITY_WEIGHTS[finding.severity];
    const categoryWeight = CATEGORY_WEIGHTS[finding.category];
    
    // Normalize to 0-100 scale
    const maxImpact = SEVERITY_WEIGHTS.critical * CATEGORY_WEIGHTS.seo;
    return Math.round((severityWeight * categoryWeight / maxImpact) * 100);
  }

  /**
   * Calculate effort score (inverse of effort level)
   */
  private static calculateEffortScore(effortLevel: keyof typeof EFFORT_LEVELS): number {
    const maxEffort = EFFORT_LEVELS.high;
    const effortValue = EFFORT_LEVELS[effortLevel];
    
    // Invert so lower effort = higher score
    return Math.round(((maxEffort - effortValue + 1) / maxEffort) * 100);
  }

  /**
   * Apply filters to findings
   */
  static applyFilters(findings: ReportFinding[], filters?: {
    categories?: string[];
    severities?: string[];
    statuses?: string[];
  }): ReportFinding[] {
    if (!filters) return findings;

    return findings.filter(finding => {
      if (filters.categories && !filters.categories.includes(finding.category)) {
        return false;
      }
      if (filters.severities && !filters.severities.includes(finding.severity)) {
        return false;
      }
      if (filters.statuses && !filters.statuses.includes(finding.status)) {
        return false;
      }
      return true;
    });
  }
}