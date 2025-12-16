import { MemoryPersistenceService } from '../persistence-service';
import type { TenantContext } from '@shared/schema';

describe('PersistenceService', () => {
  let service: MemoryPersistenceService;
  const tenant1: TenantContext = { tenantId: 1, plan: 'free' };
  const tenant2: TenantContext = { tenantId: 2, plan: 'pro' };

  beforeEach(() => {
    service = new MemoryPersistenceService();
  });

  describe('Tenant Isolation', () => {
    it('should isolate projects by tenant', async () => {
      await service.createProject(1, { name: 'T1 Project', url: 'https://t1.com', domain: 't1.com', isActive: true });
      await service.createProject(2, { name: 'T2 Project', url: 'https://t2.com', domain: 't2.com', isActive: true });

      const t1Projects = await service.getProjects(1);
      const t2Projects = await service.getProjects(2);

      expect(t1Projects).toHaveLength(1);
      expect(t2Projects).toHaveLength(1);
      expect(t1Projects[0].name).toBe('T1 Project');
      expect(t2Projects[0].name).toBe('T2 Project');
    });

    it('should isolate runs by tenant', async () => {
      const project1 = await service.createProject(1, { name: 'P1', url: 'https://p1.com', domain: 'p1.com', isActive: true });
      const project2 = await service.createProject(2, { name: 'P2', url: 'https://p2.com', domain: 'p2.com', isActive: true });
      
      const audit1 = await service.createAudit(1, { projectId: project1.id, name: 'A1', type: 'seo', isActive: true });
      const audit2 = await service.createAudit(2, { projectId: project2.id, name: 'A2', type: 'seo', isActive: true });

      await service.createRun(1, {
        projectId: project1.id,
        auditId: audit1.id,
        status: 'completed',
        summary: { scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 }, counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 }, metadata: { url: 'https://p1.com' } },
        startedAt: new Date(),
      });

      await service.createRun(2, {
        projectId: project2.id,
        auditId: audit2.id,
        status: 'completed',
        summary: { scores: { overall: 90, seo: 90, performance: 90, accessibility: 90 }, counts: { total: 3, critical: 0, high: 0, medium: 1, low: 1, info: 1 }, metadata: { url: 'https://p2.com' } },
        startedAt: new Date(),
      });

      const t1Runs = await service.getDashboardRuns(1);
      const t2Runs = await service.getDashboardRuns(2);

      expect(t1Runs).toHaveLength(1);
      expect(t2Runs).toHaveLength(1);
      expect(t1Runs[0].overallScore).toBe(80);
      expect(t2Runs[0].overallScore).toBe(90);
    });

    it('should not allow cross-tenant run access', async () => {
      const project = await service.createProject(1, { name: 'P1', url: 'https://p1.com', domain: 'p1.com', isActive: true });
      const audit = await service.createAudit(1, { projectId: project.id, name: 'A1', type: 'seo', isActive: true });
      
      const run = await service.createRun(1, {
        projectId: project.id,
        auditId: audit.id,
        status: 'completed',
        summary: { scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 }, counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 }, metadata: { url: 'https://p1.com' } },
        startedAt: new Date(),
      });

      const runDetails = await service.getRunDetails(2, run.runId); // Wrong tenant
      expect(runDetails).toBeNull();
    });
  });

  describe('Plan Limits', () => {
    it('should enforce free plan history depth', async () => {
      const project = await service.createProject(1, { name: 'P1', url: 'https://p1.com', domain: 'p1.com', isActive: true });
      const audit = await service.createAudit(1, { projectId: project.id, name: 'A1', type: 'seo', isActive: true });

      // Create 10 runs (more than free plan limit of 5)
      for (let i = 0; i < 10; i++) {
        await service.createRun(1, {
          projectId: project.id,
          auditId: audit.id,
          status: 'completed',
          summary: { scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 }, counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 }, metadata: { url: 'https://p1.com' } },
          startedAt: new Date(Date.now() - i * 1000),
        });
      }

      const deletedCount = await service.cleanupOldRuns(1, 'free');
      expect(deletedCount).toBe(5); // Should delete 5 oldest runs

      const remainingRuns = await service.getDashboardRuns(1, 10);
      expect(remainingRuns).toHaveLength(5);
    });

    it('should enforce pro plan history depth', async () => {
      const project = await service.createProject(2, { name: 'P2', url: 'https://p2.com', domain: 'p2.com', isActive: true });
      const audit = await service.createAudit(2, { projectId: project.id, name: 'A2', type: 'seo', isActive: true });

      // Create 150 runs (more than pro plan limit of 100)
      for (let i = 0; i < 150; i++) {
        await service.createRun(2, {
          projectId: project.id,
          auditId: audit.id,
          status: 'completed',
          summary: { scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 }, counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 }, metadata: { url: 'https://p2.com' } },
          startedAt: new Date(Date.now() - i * 1000),
        });
      }

      const deletedCount = await service.cleanupOldRuns(2, 'pro');
      expect(deletedCount).toBe(50); // Should delete 50 oldest runs

      const remainingRuns = await service.getDashboardRuns(2, 200);
      expect(remainingRuns).toHaveLength(100);
    });
  });

  describe('Pagination', () => {
    it('should handle cursor-based pagination', async () => {
      const project = await service.createProject(1, { name: 'P1', url: 'https://p1.com', domain: 'p1.com', isActive: true });
      const audit = await service.createAudit(1, { projectId: project.id, name: 'A1', type: 'seo', isActive: true });

      // Create 10 runs with different timestamps
      const runs = [];
      for (let i = 0; i < 10; i++) {
        const run = await service.createRun(1, {
          projectId: project.id,
          auditId: audit.id,
          status: 'completed',
          summary: { scores: { overall: 80 + i, seo: 80, performance: 80, accessibility: 80 }, counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 }, metadata: { url: 'https://p1.com' } },
          startedAt: new Date(Date.now() - i * 60000), // 1 minute apart
        });
        runs.push(run);
      }

      // Get first page
      const page1 = await service.getProjectRuns(1, project.id, 3);
      expect(page1.runs).toHaveLength(3);
      expect(page1.nextCursor).toBeDefined();

      // Get second page using cursor
      const page2 = await service.getProjectRuns(1, project.id, 3, page1.nextCursor);
      expect(page2.runs).toHaveLength(3);
      expect(page2.runs[0].runId).not.toBe(page1.runs[0].runId);
    });
  });

  describe('Findings Management', () => {
    it('should create and retrieve findings', async () => {
      const project = await service.createProject(1, { name: 'P1', url: 'https://p1.com', domain: 'p1.com', isActive: true });
      const audit = await service.createAudit(1, { projectId: project.id, name: 'A1', type: 'seo', isActive: true });
      
      const run = await service.createRun(1, {
        projectId: project.id,
        auditId: audit.id,
        status: 'completed',
        summary: { scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 }, counts: { total: 2, critical: 1, high: 1, medium: 0, low: 0, info: 0 }, metadata: { url: 'https://p1.com' } },
        startedAt: new Date(),
      });

      const findings = await service.createFindings(1, run.id, [
        {
          category: 'seo',
          severity: 'critical',
          ruleId: 'missing-title',
          title: 'Missing Title Tag',
          message: 'Page is missing a title tag',
          guidance: 'Add a title tag to the head section',
          impact: 'Critical for SEO ranking',
        },
        {
          category: 'seo',
          severity: 'high',
          ruleId: 'missing-meta-desc',
          title: 'Missing Meta Description',
          message: 'Page is missing meta description',
          guidance: 'Add meta description with 150-160 characters',
          impact: 'Affects click-through rates',
        }
      ]);

      expect(findings).toHaveLength(2);
      expect(findings[0].severity).toBe('critical');
      expect(findings[1].severity).toBe('high');

      const runDetails = await service.getRunDetails(1, run.runId);
      expect(runDetails?.findings).toHaveLength(2);
    });
  });
});