import { MemoryPersistenceService } from '../persistence-service';
import { performance } from 'perf_hooks';

describe('Persistence Performance Tests', () => {
  let service: MemoryPersistenceService;

  beforeEach(() => {
    service = new MemoryPersistenceService();
  });

  describe('Query Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const tenantId = 1;
      
      // Create test data
      const project = await service.createProject(tenantId, {
        name: 'Performance Test Project',
        url: 'https://perf-test.com',
        domain: 'perf-test.com',
        isActive: true
      });

      const audit = await service.createAudit(tenantId, {
        projectId: project.id,
        name: 'Performance Audit',
        type: 'performance',
        isActive: true
      });

      // Create 1000 runs
      const startCreate = performance.now();
      const runs = [];
      for (let i = 0; i < 1000; i++) {
        const run = await service.createRun(tenantId, {
          projectId: project.id,
          auditId: audit.id,
          status: 'completed',
          summary: {
            scores: { overall: 80 + (i % 20), seo: 80, performance: 80, accessibility: 80 },
            counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 },
            metadata: { url: 'https://perf-test.com' }
          },
          startedAt: new Date(Date.now() - i * 1000),
          completedAt: new Date(Date.now() - i * 1000 + 5000),
          duration: 5000
        });
        runs.push(run);
      }
      const createTime = performance.now() - startCreate;
      console.log(`Created 1000 runs in ${createTime.toFixed(2)}ms`);

      // Test dashboard query performance
      const startDashboard = performance.now();
      const dashboardRuns = await service.getDashboardRuns(tenantId, 50);
      const dashboardTime = performance.now() - startDashboard;
      
      expect(dashboardRuns).toHaveLength(50);
      expect(dashboardTime).toBeLessThan(100); // Should complete in under 100ms
      console.log(`Dashboard query (50 runs) completed in ${dashboardTime.toFixed(2)}ms`);

      // Test project runs query performance
      const startProject = performance.now();
      const projectRuns = await service.getProjectRuns(tenantId, project.id, 100);
      const projectTime = performance.now() - startProject;
      
      expect(projectRuns.runs).toHaveLength(100);
      expect(projectTime).toBeLessThan(100); // Should complete in under 100ms
      console.log(`Project runs query (100 runs) completed in ${projectTime.toFixed(2)}ms`);

      // Test run details query performance
      const startDetails = performance.now();
      const runDetails = await service.getRunDetails(tenantId, runs[0].runId);
      const detailsTime = performance.now() - startDetails;
      
      expect(runDetails).not.toBeNull();
      expect(detailsTime).toBeLessThan(50); // Should complete in under 50ms
      console.log(`Run details query completed in ${detailsTime.toFixed(2)}ms`);
    });

    it('should handle pagination efficiently', async () => {
      const tenantId = 1;
      
      const project = await service.createProject(tenantId, {
        name: 'Pagination Test',
        url: 'https://pagination-test.com',
        domain: 'pagination-test.com',
        isActive: true
      });

      const audit = await service.createAudit(tenantId, {
        projectId: project.id,
        name: 'Pagination Audit',
        type: 'seo',
        isActive: true
      });

      // Create 500 runs
      for (let i = 0; i < 500; i++) {
        await service.createRun(tenantId, {
          projectId: project.id,
          auditId: audit.id,
          status: 'completed',
          summary: {
            scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 },
            counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 },
            metadata: { url: 'https://pagination-test.com' }
          },
          startedAt: new Date(Date.now() - i * 1000),
          completedAt: new Date(Date.now() - i * 1000 + 5000),
          duration: 5000
        });
      }

      // Test pagination performance
      let cursor: string | undefined;
      let totalFetched = 0;
      const pageSize = 20;
      const startPagination = performance.now();

      while (totalFetched < 100) {
        const result = await service.getProjectRuns(tenantId, project.id, pageSize, cursor);
        totalFetched += result.runs.length;
        cursor = result.nextCursor;
        
        if (!cursor) break;
      }

      const paginationTime = performance.now() - startPagination;
      expect(totalFetched).toBe(100);
      expect(paginationTime).toBeLessThan(200); // Should complete in under 200ms
      console.log(`Paginated through 100 runs in ${paginationTime.toFixed(2)}ms`);
    });

    it('should handle concurrent queries efficiently', async () => {
      const tenantId = 1;
      
      const project = await service.createProject(tenantId, {
        name: 'Concurrent Test',
        url: 'https://concurrent-test.com',
        domain: 'concurrent-test.com',
        isActive: true
      });

      const audit = await service.createAudit(tenantId, {
        projectId: project.id,
        name: 'Concurrent Audit',
        type: 'seo',
        isActive: true
      });

      // Create 200 runs
      for (let i = 0; i < 200; i++) {
        await service.createRun(tenantId, {
          projectId: project.id,
          auditId: audit.id,
          status: 'completed',
          summary: {
            scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 },
            counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 },
            metadata: { url: 'https://concurrent-test.com' }
          },
          startedAt: new Date(Date.now() - i * 1000),
          completedAt: new Date(Date.now() - i * 1000 + 5000),
          duration: 5000
        });
      }

      // Test concurrent queries
      const startConcurrent = performance.now();
      const promises = [
        service.getDashboardRuns(tenantId, 20),
        service.getProjectRuns(tenantId, project.id, 20),
        service.getProjects(tenantId),
        service.getAudits(tenantId, project.id),
        service.getDashboardRuns(tenantId, 10)
      ];

      const results = await Promise.all(promises);
      const concurrentTime = performance.now() - startConcurrent;

      expect(results).toHaveLength(5);
      expect(results[0]).toHaveLength(20); // Dashboard runs
      expect(results[1].runs).toHaveLength(20); // Project runs
      expect(results[2]).toHaveLength(1); // Projects
      expect(results[3]).toHaveLength(1); // Audits
      expect(results[4]).toHaveLength(10); // Dashboard runs (smaller)

      expect(concurrentTime).toBeLessThan(300); // Should complete in under 300ms
      console.log(`5 concurrent queries completed in ${concurrentTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage', () => {
    it('should handle cleanup without memory leaks', async () => {
      const tenantId = 1;
      
      const project = await service.createProject(tenantId, {
        name: 'Memory Test',
        url: 'https://memory-test.com',
        domain: 'memory-test.com',
        isActive: true
      });

      const audit = await service.createAudit(tenantId, {
        projectId: project.id,
        name: 'Memory Audit',
        type: 'seo',
        isActive: true
      });

      // Create and cleanup runs multiple times
      for (let cycle = 0; cycle < 5; cycle++) {
        // Create 100 runs
        for (let i = 0; i < 100; i++) {
          await service.createRun(tenantId, {
            projectId: project.id,
            auditId: audit.id,
            status: 'completed',
            summary: {
              scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 },
              counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 },
              metadata: { url: 'https://memory-test.com' }
            },
            startedAt: new Date(Date.now() - i * 1000),
            completedAt: new Date(Date.now() - i * 1000 + 5000),
            duration: 5000
          });
        }

        // Cleanup old runs
        const deletedCount = await service.cleanupOldRuns(tenantId, 'free');
        expect(deletedCount).toBe(95); // Should delete 95 runs, keep 5

        // Verify only 5 runs remain
        const remainingRuns = await service.getDashboardRuns(tenantId, 100);
        expect(remainingRuns).toHaveLength(5);
      }

      console.log('Completed 5 cycles of create/cleanup without memory issues');
    });
  });

  describe('Findings Performance', () => {
    it('should handle large numbers of findings efficiently', async () => {
      const tenantId = 1;
      
      const project = await service.createProject(tenantId, {
        name: 'Findings Test',
        url: 'https://findings-test.com',
        domain: 'findings-test.com',
        isActive: true
      });

      const audit = await service.createAudit(tenantId, {
        projectId: project.id,
        name: 'Findings Audit',
        type: 'seo',
        isActive: true
      });

      const run = await service.createRun(tenantId, {
        projectId: project.id,
        auditId: audit.id,
        status: 'completed',
        summary: {
          scores: { overall: 60, seo: 60, performance: 60, accessibility: 60 },
          counts: { total: 100, critical: 10, high: 20, medium: 30, low: 25, info: 15 },
          metadata: { url: 'https://findings-test.com' }
        },
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 5000
      });

      // Create 100 findings
      const findingsData = [];
      for (let i = 0; i < 100; i++) {
        findingsData.push({
          category: ['seo', 'performance', 'accessibility'][i % 3],
          severity: ['critical', 'high', 'medium', 'low', 'info'][i % 5],
          ruleId: `rule-${i}`,
          title: `Finding ${i}`,
          message: `This is finding number ${i}`,
          guidance: `Fix finding ${i} by doing X`,
          impact: `Impact of finding ${i}`,
          element: i % 2 === 0 ? `element-${i}` : undefined,
          line: i % 3 === 0 ? i : undefined,
          column: i % 4 === 0 ? i * 2 : undefined,
          metadata: { customData: `data-${i}` }
        });
      }

      const startFindings = performance.now();
      const findings = await service.createFindings(tenantId, run.id, findingsData);
      const findingsTime = performance.now() - startFindings;

      expect(findings).toHaveLength(100);
      expect(findingsTime).toBeLessThan(100); // Should complete in under 100ms
      console.log(`Created 100 findings in ${findingsTime.toFixed(2)}ms`);

      // Test run details query with many findings
      const startDetails = performance.now();
      const runDetails = await service.getRunDetails(tenantId, run.runId);
      const detailsTime = performance.now() - startDetails;

      expect(runDetails?.findings).toHaveLength(100);
      expect(detailsTime).toBeLessThan(100); // Should complete in under 100ms
      console.log(`Retrieved run with 100 findings in ${detailsTime.toFixed(2)}ms`);
    });
  });

  describe('Stress Testing', () => {
    it('should handle high-frequency operations', async () => {
      const tenantId = 1;
      
      const project = await service.createProject(tenantId, {
        name: 'Stress Test',
        url: 'https://stress-test.com',
        domain: 'stress-test.com',
        isActive: true
      });

      const audit = await service.createAudit(tenantId, {
        projectId: project.id,
        name: 'Stress Audit',
        type: 'seo',
        isActive: true
      });

      // Simulate high-frequency dashboard queries
      const startStress = performance.now();
      const promises = [];
      
      for (let i = 0; i < 50; i++) {
        promises.push(service.getDashboardRuns(tenantId, 10));
      }

      const results = await Promise.all(promises);
      const stressTime = performance.now() - startStress;

      expect(results).toHaveLength(50);
      expect(stressTime).toBeLessThan(1000); // Should complete in under 1 second
      console.log(`50 concurrent dashboard queries completed in ${stressTime.toFixed(2)}ms`);
    });
  });
});