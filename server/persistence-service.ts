import { 
  projects, audits, auditRuns, findings, artifacts,
  type Project, type Audit, type AuditRun, type Finding, type Artifact,
  type InsertProject, type InsertAudit, type InsertAuditRun, type InsertFinding,
  type AuditSummary, type DashboardRun, type RunDetails
} from "@shared/persistence-schema";
import { PLAN_CONFIGS } from "@shared/schema";

// Interface for persistence operations
export interface IPersistenceService {
  // Project operations
  createProject(tenantId: number, data: Omit<InsertProject, 'tenantId'>): Promise<Project>;
  getProjects(tenantId: number): Promise<Project[]>;
  
  // Audit operations
  createAudit(tenantId: number, data: Omit<InsertAudit, 'tenantId'>): Promise<Audit>;
  getAudits(tenantId: number, projectId?: number): Promise<Audit[]>;
  
  // Run operations
  createRun(tenantId: number, data: Omit<InsertAuditRun, 'tenantId'>): Promise<AuditRun>;
  updateRunStatus(tenantId: number, runId: string, status: string, summary?: AuditSummary, error?: string): Promise<void>;
  
  // History queries
  getDashboardRuns(tenantId: number, limit?: number): Promise<DashboardRun[]>;
  getProjectRuns(tenantId: number, projectId: number, limit?: number, cursor?: string): Promise<{ runs: DashboardRun[], nextCursor?: string }>;
  getRunDetails(tenantId: number, runId: string): Promise<RunDetails | null>;
  
  // Findings operations
  createFindings(tenantId: number, runId: number, findings: Omit<InsertFinding, 'tenantId' | 'runId'>[]): Promise<Finding[]>;
  
  // Cleanup operations
  cleanupOldRuns(tenantId: number, planType: 'free' | 'pro'): Promise<number>;
}

// Memory implementation for MVP
export class MemoryPersistenceService implements IPersistenceService {
  private projects: Map<number, Project> = new Map();
  private audits: Map<number, Audit> = new Map();
  private auditRuns: Map<number, AuditRun> = new Map();
  private findings: Map<number, Finding[]> = new Map();
  private artifacts: Map<number, Artifact[]> = new Map();
  
  private currentProjectId = 1;
  private currentAuditId = 1;
  private currentRunId = 1;
  private currentFindingId = 1;

  async createProject(tenantId: number, data: Omit<InsertProject, 'tenantId'>): Promise<Project> {
    const project: Project = {
      id: this.currentProjectId++,
      tenantId,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.projects.set(project.id, project);
    return project;
  }

  async getProjects(tenantId: number): Promise<Project[]> {
    return Array.from(this.projects.values())
      .filter(p => p.tenantId === tenantId && p.isActive)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async createAudit(tenantId: number, data: Omit<InsertAudit, 'tenantId'>): Promise<Audit> {
    const audit: Audit = {
      id: this.currentAuditId++,
      tenantId,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.audits.set(audit.id, audit);
    return audit;
  }

  async getAudits(tenantId: number, projectId?: number): Promise<Audit[]> {
    return Array.from(this.audits.values())
      .filter(a => a.tenantId === tenantId && 
                   a.isActive && 
                   (!projectId || a.projectId === projectId))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async createRun(tenantId: number, data: Omit<InsertAuditRun, 'tenantId'>): Promise<AuditRun> {
    const run: AuditRun = {
      id: this.currentRunId++,
      tenantId,
      runId: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
    };
    
    this.auditRuns.set(run.id, run);
    return run;
  }

  async updateRunStatus(tenantId: number, runId: string, status: string, summary?: AuditSummary, error?: string): Promise<void> {
    const run = Array.from(this.auditRuns.values())
      .find(r => r.runId === runId && r.tenantId === tenantId);
    
    if (!run) throw new Error('Run not found');
    
    run.status = status;
    if (summary) run.summary = summary;
    if (error) run.errorMessage = error;
    if (status === 'completed' || status === 'failed') {
      run.completedAt = new Date();
      run.duration = run.completedAt.getTime() - run.startedAt.getTime();
    }
    
    this.auditRuns.set(run.id, run);
  }

  async getDashboardRuns(tenantId: number, limit: number = 10): Promise<DashboardRun[]> {
    const runs = Array.from(this.auditRuns.values())
      .filter(r => r.tenantId === tenantId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);

    return runs.map(run => {
      const project = this.projects.get(run.projectId);
      const audit = this.audits.get(run.auditId);
      const runFindings = this.findings.get(run.id) || [];
      
      return {
        runId: run.runId,
        projectName: project?.name || 'Unknown Project',
        auditName: audit?.name || 'Unknown Audit',
        status: run.status,
        overallScore: (run.summary as any)?.scores?.overall || 0,
        startedAt: run.startedAt.toISOString(),
        duration: run.duration,
        findingsCount: runFindings.length,
      };
    });
  }

  async getProjectRuns(tenantId: number, projectId: number, limit: number = 20, cursor?: string): Promise<{ runs: DashboardRun[], nextCursor?: string }> {
    let runs = Array.from(this.auditRuns.values())
      .filter(r => r.tenantId === tenantId && r.projectId === projectId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    // Simple cursor-based pagination using timestamp
    if (cursor) {
      const cursorDate = new Date(cursor);
      runs = runs.filter(r => r.startedAt < cursorDate);
    }

    const pageRuns = runs.slice(0, limit);
    const nextCursor = pageRuns.length === limit ? pageRuns[pageRuns.length - 1].startedAt.toISOString() : undefined;

    const dashboardRuns = pageRuns.map(run => {
      const project = this.projects.get(run.projectId);
      const audit = this.audits.get(run.auditId);
      const runFindings = this.findings.get(run.id) || [];
      
      return {
        runId: run.runId,
        projectName: project?.name || 'Unknown Project',
        auditName: audit?.name || 'Unknown Audit',
        status: run.status,
        overallScore: (run.summary as any)?.scores?.overall || 0,
        startedAt: run.startedAt.toISOString(),
        duration: run.duration,
        findingsCount: runFindings.length,
      };
    });

    return { runs: dashboardRuns, nextCursor };
  }

  async getRunDetails(tenantId: number, runId: string): Promise<RunDetails | null> {
    const run = Array.from(this.auditRuns.values())
      .find(r => r.runId === runId && r.tenantId === tenantId);
    
    if (!run) return null;

    const project = this.projects.get(run.projectId);
    const audit = this.audits.get(run.auditId);
    const runFindings = this.findings.get(run.id) || [];
    const runArtifacts = this.artifacts.get(run.id) || [];

    return {
      runId: run.runId,
      projectName: project?.name || 'Unknown Project',
      auditName: audit?.name || 'Unknown Audit',
      status: run.status,
      summary: run.summary as AuditSummary,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() || null,
      duration: run.duration,
      findings: runFindings.map(f => ({
        id: f.id,
        category: f.category,
        severity: f.severity,
        ruleId: f.ruleId,
        title: f.title,
        message: f.message,
        guidance: f.guidance,
        impact: f.impact,
        element: f.element,
        metadata: f.metadata,
      })),
      artifacts: runArtifacts.map(a => ({
        id: a.id,
        type: a.type,
        filename: a.filename,
        size: a.size,
        downloadUrl: `/api/artifacts/${a.id}/download`, // Would be signed URL in production
      })),
    };
  }

  async createFindings(tenantId: number, runId: number, findingsData: Omit<InsertFinding, 'tenantId' | 'runId'>[]): Promise<Finding[]> {
    const findings: Finding[] = findingsData.map(data => ({
      id: this.currentFindingId++,
      tenantId,
      runId,
      ...data,
      createdAt: new Date(),
    }));

    this.findings.set(runId, findings);
    return findings;
  }

  async cleanupOldRuns(tenantId: number, planType: 'free' | 'pro'): Promise<number> {
    const historyDepth = PLAN_CONFIGS[planType].historyDepth;
    
    const tenantRuns = Array.from(this.auditRuns.values())
      .filter(r => r.tenantId === tenantId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    const runsToDelete = tenantRuns.slice(historyDepth);
    
    // Hard delete for MVP (Option A)
    runsToDelete.forEach(run => {
      this.auditRuns.delete(run.id);
      this.findings.delete(run.id);
      this.artifacts.delete(run.id);
    });

    return runsToDelete.length;
  }
}

// Export service instance
export const persistenceService = new MemoryPersistenceService();

// Helper function to extract domain from URL
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}