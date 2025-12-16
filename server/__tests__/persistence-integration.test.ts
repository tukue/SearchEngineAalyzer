import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../routes';
import { registerPersistenceRoutes } from '../persistence-routes';
import { persistenceService } from '../persistence-service';
import { storage, getDefaultTenantContext } from '../storage';

describe('Persistence Integration Tests', () => {
  let app: express.Express;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    
    // Add tenant context middleware
    app.use(async (req, res, next) => {
      try {
        req.tenantContext = await getDefaultTenantContext();
        next();
      } catch (error) {
        res.status(500).json({ message: "Failed to load tenant context" });
      }
    });

    server = await registerRoutes(app);
    registerPersistenceRoutes(app);
  });

  beforeEach(async () => {
    // Reset persistence service state
    (persistenceService as any).projects.clear();
    (persistenceService as any).audits.clear();
    (persistenceService as any).auditRuns.clear();
    (persistenceService as any).findings.clear();
    (persistenceService as any).artifacts.clear();
    (persistenceService as any).currentProjectId = 1;
    (persistenceService as any).currentAuditId = 1;
    (persistenceService as any).currentRunId = 1;
    (persistenceService as any).currentFindingId = 1;
  });

  describe('Project Management', () => {
    it('should create a new project', async () => {
      const projectData = {
        name: 'Test Website',
        url: 'https://test.example.com',
        description: 'Test project for integration tests'
      };

      const response = await request(app)
        .post('/api/projects')
        .send(projectData);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(projectData.name);
      expect(response.body.url).toBe(projectData.url);
      expect(response.body.domain).toBe('test.example.com');
      expect(response.body.tenantId).toBe(1);
    });

    it('should list projects for tenant', async () => {
      // Create test projects
      await persistenceService.createProject(1, {
        name: 'Project 1',
        url: 'https://project1.com',
        domain: 'project1.com',
        isActive: true
      });

      await persistenceService.createProject(1, {
        name: 'Project 2',
        url: 'https://project2.com',
        domain: 'project2.com',
        isActive: true
      });

      const response = await request(app)
        .get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body.projects).toHaveLength(2);
      expect(response.body.projects[0].name).toBe('Project 2'); // Most recent first
      expect(response.body.projects[1].name).toBe('Project 1');
    });

    it('should validate project creation data', async () => {
      const invalidData = {
        name: '', // Empty name
        url: 'not-a-url' // Invalid URL
      };

      const response = await request(app)
        .post('/api/projects')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('validation');
    });
  });

  describe('Audit Management', () => {
    let projectId: number;

    beforeEach(async () => {
      const project = await persistenceService.createProject(1, {
        name: 'Test Project',
        url: 'https://test.com',
        domain: 'test.com',
        isActive: true
      });
      projectId = project.id;
    });

    it('should create a new audit', async () => {
      const auditData = {
        projectId,
        name: 'SEO Audit',
        type: 'seo',
        config: { checkImages: true, checkLinks: true }
      };

      const response = await request(app)
        .post('/api/audits')
        .send(auditData);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(auditData.name);
      expect(response.body.type).toBe(auditData.type);
      expect(response.body.projectId).toBe(projectId);
      expect(response.body.tenantId).toBe(1);
    });

    it('should list audits for project', async () => {
      await persistenceService.createAudit(1, {
        projectId,
        name: 'SEO Audit',
        type: 'seo',
        isActive: true
      });

      await persistenceService.createAudit(1, {
        projectId,
        name: 'Performance Audit',
        type: 'performance',
        isActive: true
      });

      const response = await request(app)
        .get(`/api/audits?projectId=${projectId}`);

      expect(response.status).toBe(200);
      expect(response.body.audits).toHaveLength(2);
    });
  });

  describe('Audit Runs', () => {
    let projectId: number;
    let auditId: number;

    beforeEach(async () => {
      const project = await persistenceService.createProject(1, {
        name: 'Test Project',
        url: 'https://test.com',
        domain: 'test.com',
        isActive: true
      });
      projectId = project.id;

      const audit = await persistenceService.createAudit(1, {
        projectId,
        name: 'SEO Audit',
        type: 'seo',
        isActive: true
      });
      auditId = audit.id;
    });

    it('should create a new audit run', async () => {
      const runData = {
        projectId,
        auditId,
        summary: {
          scores: {
            overall: 85,
            seo: 90,
            performance: 80,
            accessibility: 85
          },
          counts: {
            total: 12,
            critical: 1,
            high: 3,
            medium: 5,
            low: 2,
            info: 1
          },
          metadata: {
            url: 'https://test.com',
            loadTime: 1200,
            pageSize: 2048000
          }
        },
        findings: [
          {
            category: 'seo',
            severity: 'high',
            ruleId: 'missing-meta-description',
            title: 'Missing Meta Description',
            message: 'Page is missing a meta description',
            guidance: 'Add a meta description tag with 150-160 characters',
            impact: 'Reduces click-through rates from search results'
          },
          {
            category: 'performance',
            severity: 'medium',
            ruleId: 'large-images',
            title: 'Large Images',
            message: 'Some images are larger than necessary',
            guidance: 'Optimize images for web delivery',
            impact: 'Increases page load time'
          }
        ]
      };

      const response = await request(app)
        .post('/api/runs')
        .send(runData);

      expect(response.status).toBe(201);
      expect(response.body.runId).toBeDefined();
      expect(response.body.status).toBe('completed');
      expect(response.body.message).toContain('created successfully');
    });

    it('should get dashboard runs', async () => {
      // Create multiple runs
      for (let i = 0; i < 3; i++) {
        await persistenceService.createRun(1, {
          projectId,
          auditId,
          status: 'completed',
          summary: {
            scores: { overall: 80 + i, seo: 80, performance: 80, accessibility: 80 },
            counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 },
            metadata: { url: 'https://test.com' }
          },
          startedAt: new Date(Date.now() - i * 60000),
          completedAt: new Date(Date.now() - i * 60000 + 5000),
          duration: 5000
        });
      }

      const response = await request(app)
        .get('/api/dashboard/runs?limit=5');

      expect(response.status).toBe(200);
      expect(response.body.runs).toHaveLength(3);
      expect(response.body.runs[0].overallScore).toBe(80); // Most recent first
      expect(response.body.limit).toBe(5);
      expect(response.body.planLimit).toBe(5); // Free plan limit
      expect(response.body.currentPlan).toBe('free');
    });

    it('should get project runs with pagination', async () => {
      // Create multiple runs
      const runs = [];
      for (let i = 0; i < 5; i++) {
        const run = await persistenceService.createRun(1, {
          projectId,
          auditId,
          status: 'completed',
          summary: {
            scores: { overall: 80 + i, seo: 80, performance: 80, accessibility: 80 },
            counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 },
            metadata: { url: 'https://test.com' }
          },
          startedAt: new Date(Date.now() - i * 60000),
          completedAt: new Date(Date.now() - i * 60000 + 5000),
          duration: 5000
        });
        runs.push(run);
      }

      // Get first page
      const page1Response = await request(app)
        .get(`/api/projects/${projectId}/runs?limit=2`);

      expect(page1Response.status).toBe(200);
      expect(page1Response.body.runs).toHaveLength(2);
      expect(page1Response.body.nextCursor).toBeDefined();

      // Get second page
      const page2Response = await request(app)
        .get(`/api/projects/${projectId}/runs?limit=2&cursor=${page1Response.body.nextCursor}`);

      expect(page2Response.status).toBe(200);
      expect(page2Response.body.runs).toHaveLength(2);
      expect(page2Response.body.runs[0].runId).not.toBe(page1Response.body.runs[0].runId);
    });

    it('should get run details', async () => {
      const run = await persistenceService.createRun(1, {
        projectId,
        auditId,
        status: 'completed',
        summary: {
          scores: { overall: 85, seo: 90, performance: 80, accessibility: 85 },
          counts: { total: 2, critical: 1, high: 1, medium: 0, low: 0, info: 0 },
          metadata: { url: 'https://test.com' }
        },
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 5000
      });

      await persistenceService.createFindings(1, run.id, [
        {
          category: 'seo',
          severity: 'critical',
          ruleId: 'missing-title',
          title: 'Missing Title Tag',
          message: 'Page is missing a title tag',
          guidance: 'Add a title tag to the head section',
          impact: 'Critical for SEO ranking'
        }
      ]);

      const response = await request(app)
        .get(`/api/runs/${run.runId}`);

      expect(response.status).toBe(200);
      expect(response.body.runId).toBe(run.runId);
      expect(response.body.status).toBe('completed');
      expect(response.body.summary.scores.overall).toBe(85);
      expect(response.body.findings).toHaveLength(1);
      expect(response.body.findings[0].severity).toBe('critical');
    });

    it('should not allow access to other tenant runs', async () => {
      const run = await persistenceService.createRun(2, { // Different tenant
        projectId,
        auditId,
        status: 'completed',
        summary: {
          scores: { overall: 85, seo: 90, performance: 80, accessibility: 85 },
          counts: { total: 1, critical: 0, high: 0, medium: 1, low: 0, info: 0 },
          metadata: { url: 'https://test.com' }
        },
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 5000
      });

      const response = await request(app)
        .get(`/api/runs/${run.runId}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Run not found');
    });
  });

  describe('Plan Enforcement', () => {
    let projectId: number;
    let auditId: number;

    beforeEach(async () => {
      const project = await persistenceService.createProject(1, {
        name: 'Test Project',
        url: 'https://test.com',
        domain: 'test.com',
        isActive: true
      });
      projectId = project.id;

      const audit = await persistenceService.createAudit(1, {
        projectId,
        name: 'SEO Audit',
        type: 'seo',
        isActive: true
      });
      auditId = audit.id;
    });

    it('should enforce free plan history depth limit', async () => {
      // Create more runs than free plan allows (5)
      for (let i = 0; i < 8; i++) {
        await persistenceService.createRun(1, {
          projectId,
          auditId,
          status: 'completed',
          summary: {
            scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 },
            counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 },
            metadata: { url: 'https://test.com' }
          },
          startedAt: new Date(Date.now() - i * 60000),
          completedAt: new Date(Date.now() - i * 60000 + 5000),
          duration: 5000
        });
      }

      const response = await request(app)
        .get('/api/dashboard/runs?limit=10');

      expect(response.status).toBe(200);
      expect(response.body.runs.length).toBeLessThanOrEqual(5); // Free plan limit
      expect(response.body.planLimit).toBe(5);
    });

    it('should respect plan limits in project runs', async () => {
      // Create more runs than plan allows
      for (let i = 0; i < 8; i++) {
        await persistenceService.createRun(1, {
          projectId,
          auditId,
          status: 'completed',
          summary: {
            scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 },
            counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 },
            metadata: { url: 'https://test.com' }
          },
          startedAt: new Date(Date.now() - i * 60000),
          completedAt: new Date(Date.now() - i * 60000 + 5000),
          duration: 5000
        });
      }

      const response = await request(app)
        .get(`/api/projects/${projectId}/runs?limit=10`);

      expect(response.status).toBe(200);
      expect(response.body.runs.length).toBeLessThanOrEqual(5); // Free plan limit
      expect(response.body.planLimit).toBe(5);
    });
  });

  describe('Artifacts (Pro Feature)', () => {
    it('should block artifact download for free plan', async () => {
      const response = await request(app)
        .get('/api/artifacts/123/download');

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('PLAN_UPGRADE_REQUIRED');
      expect(response.body.feature).toBe('exportsEnabled');
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup old runs beyond plan limit', async () => {
      // Create runs beyond free plan limit
      for (let i = 0; i < 10; i++) {
        await persistenceService.createRun(1, {
          projectId: 1,
          auditId: 1,
          status: 'completed',
          summary: {
            scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 },
            counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 },
            metadata: { url: 'https://test.com' }
          },
          startedAt: new Date(Date.now() - i * 60000),
          completedAt: new Date(Date.now() - i * 60000 + 5000),
          duration: 5000
        });
      }

      const response = await request(app)
        .post('/api/cleanup/1')
        .send({ planType: 'free' });

      expect(response.status).toBe(200);
      expect(response.body.deletedRuns).toBe(5); // Should delete 5 oldest runs
      expect(response.body.tenantId).toBe(1);
      expect(response.body.planType).toBe('free');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid run ID format', async () => {
      const response = await request(app)
        .get('/api/runs/invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid run ID format');
    });

    it('should handle non-existent run', async () => {
      const response = await request(app)
        .get('/api/runs/123e4567-e89b-12d3-a456-426614174000');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Run not found');
    });

    it('should validate run creation data', async () => {
      const invalidData = {
        projectId: 'not-a-number',
        auditId: 999,
        summary: {} // Invalid summary structure
      };

      const response = await request(app)
        .post('/api/runs')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('validation');
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity', async () => {
      const project = await persistenceService.createProject(1, {
        name: 'Test Project',
        url: 'https://test.com',
        domain: 'test.com',
        isActive: true
      });

      const audit = await persistenceService.createAudit(1, {
        projectId: project.id,
        name: 'SEO Audit',
        type: 'seo',
        isActive: true
      });

      const run = await persistenceService.createRun(1, {
        projectId: project.id,
        auditId: audit.id,
        status: 'completed',
        summary: {
          scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 },
          counts: { total: 1, critical: 0, high: 0, medium: 1, low: 0, info: 0 },
          metadata: { url: 'https://test.com' }
        },
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 5000
      });

      const findings = await persistenceService.createFindings(1, run.id, [
        {
          category: 'seo',
          severity: 'medium',
          ruleId: 'test-rule',
          title: 'Test Finding',
          message: 'Test message',
          guidance: 'Test guidance',
          impact: 'Test impact'
        }
      ]);

      // Verify all data is properly linked
      const runDetails = await persistenceService.getRunDetails(1, run.runId);
      expect(runDetails).not.toBeNull();
      expect(runDetails!.projectName).toBe('Test Project');
      expect(runDetails!.auditName).toBe('SEO Audit');
      expect(runDetails!.findings).toHaveLength(1);
      expect(runDetails!.findings[0].ruleId).toBe('test-rule');
    });
  });
});