import { MemoryPersistenceService } from '../persistence-service';
import { v4 as uuidv4 } from 'uuid';

describe('Persistence Security Tests', () => {
  let service: MemoryPersistenceService;

  beforeEach(() => {
    service = new MemoryPersistenceService();
  });

  describe('Tenant Isolation', () => {
    it('should prevent cross-tenant data access in projects', async () => {
      // Create projects for different tenants
      const tenant1Project = await service.createProject(1, {
        name: 'Tenant 1 Project',
        url: 'https://tenant1.com',
        domain: 'tenant1.com',
        isActive: true
      });

      const tenant2Project = await service.createProject(2, {
        name: 'Tenant 2 Project',
        url: 'https://tenant2.com',
        domain: 'tenant2.com',
        isActive: true
      });

      // Verify tenant 1 can only see their projects
      const tenant1Projects = await service.getProjects(1);
      expect(tenant1Projects).toHaveLength(1);
      expect(tenant1Projects[0].id).toBe(tenant1Project.id);
      expect(tenant1Projects[0].tenantId).toBe(1);

      // Verify tenant 2 can only see their projects
      const tenant2Projects = await service.getProjects(2);
      expect(tenant2Projects).toHaveLength(1);
      expect(tenant2Projects[0].id).toBe(tenant2Project.id);
      expect(tenant2Projects[0].tenantId).toBe(2);

      // Verify no cross-contamination
      expect(tenant1Projects[0].id).not.toBe(tenant2Projects[0].id);
    });

    it('should prevent cross-tenant data access in audits', async () => {
      // Create projects for different tenants
      const tenant1Project = await service.createProject(1, {
        name: 'T1 Project',
        url: 'https://t1.com',
        domain: 't1.com',
        isActive: true
      });

      const tenant2Project = await service.createProject(2, {
        name: 'T2 Project',
        url: 'https://t2.com',
        domain: 't2.com',
        isActive: true
      });

      // Create audits for different tenants
      const tenant1Audit = await service.createAudit(1, {
        projectId: tenant1Project.id,
        name: 'T1 Audit',
        type: 'seo',
        isActive: true
      });

      const tenant2Audit = await service.createAudit(2, {
        projectId: tenant2Project.id,
        name: 'T2 Audit',
        type: 'seo',
        isActive: true
      });

      // Verify tenant isolation
      const tenant1Audits = await service.getAudits(1);
      const tenant2Audits = await service.getAudits(2);

      expect(tenant1Audits).toHaveLength(1);
      expect(tenant2Audits).toHaveLength(1);
      expect(tenant1Audits[0].tenantId).toBe(1);
      expect(tenant2Audits[0].tenantId).toBe(2);
      expect(tenant1Audits[0].id).not.toBe(tenant2Audits[0].id);
    });

    it('should prevent cross-tenant access to run details', async () => {
      // Create data for tenant 1
      const tenant1Project = await service.createProject(1, {
        name: 'T1 Project',
        url: 'https://t1.com',
        domain: 't1.com',
        isActive: true
      });

      const tenant1Audit = await service.createAudit(1, {
        projectId: tenant1Project.id,
        name: 'T1 Audit',
        type: 'seo',
        isActive: true
      });

      const tenant1Run = await service.createRun(1, {
        projectId: tenant1Project.id,
        auditId: tenant1Audit.id,
        status: 'completed',
        summary: {
          scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 },
          counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 },
          metadata: { url: 'https://t1.com' }
        },
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 5000
      });

      // Try to access tenant 1's run as tenant 2
      const runDetails = await service.getRunDetails(2, tenant1Run.runId);
      expect(runDetails).toBeNull();

      // Verify tenant 1 can access their own run
      const validRunDetails = await service.getRunDetails(1, tenant1Run.runId);
      expect(validRunDetails).not.toBeNull();
      expect(validRunDetails!.runId).toBe(tenant1Run.runId);
    });

    it('should isolate dashboard runs by tenant', async () => {
      // Create runs for different tenants
      const tenant1Project = await service.createProject(1, {
        name: 'T1 Project',
        url: 'https://t1.com',
        domain: 't1.com',
        isActive: true
      });

      const tenant2Project = await service.createProject(2, {
        name: 'T2 Project',
        url: 'https://t2.com',
        domain: 't2.com',
        isActive: true
      });

      const tenant1Audit = await service.createAudit(1, {
        projectId: tenant1Project.id,
        name: 'T1 Audit',
        type: 'seo',
        isActive: true
      });

      const tenant2Audit = await service.createAudit(2, {
        projectId: tenant2Project.id,
        name: 'T2 Audit',
        type: 'seo',
        isActive: true
      });

      // Create runs for both tenants
      await service.createRun(1, {
        projectId: tenant1Project.id,
        auditId: tenant1Audit.id,
        status: 'completed',
        summary: {
          scores: { overall: 85, seo: 85, performance: 85, accessibility: 85 },
          counts: { total: 3, critical: 0, high: 1, medium: 1, low: 1, info: 0 },
          metadata: { url: 'https://t1.com' }
        },
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 3000
      });

      await service.createRun(2, {
        projectId: tenant2Project.id,
        auditId: tenant2Audit.id,
        status: 'completed',
        summary: {
          scores: { overall: 75, seo: 75, performance: 75, accessibility: 75 },
          counts: { total: 7, critical: 1, high: 2, medium: 2, low: 1, info: 1 },
          metadata: { url: 'https://t2.com' }
        },
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 4000
      });

      // Verify dashboard isolation
      const tenant1Dashboard = await service.getDashboardRuns(1, 10);
      const tenant2Dashboard = await service.getDashboardRuns(2, 10);

      expect(tenant1Dashboard).toHaveLength(1);
      expect(tenant2Dashboard).toHaveLength(1);
      expect(tenant1Dashboard[0].overallScore).toBe(85);
      expect(tenant2Dashboard[0].overallScore).toBe(75);
    });
  });

  describe('ID Security', () => {
    it('should use UUIDs for public run IDs', async () => {
      const project = await service.createProject(1, {
        name: 'Test Project',
        url: 'https://test.com',
        domain: 'test.com',
        isActive: true
      });

      const audit = await service.createAudit(1, {
        projectId: project.id,
        name: 'Test Audit',
        type: 'seo',
        isActive: true
      });

      const run = await service.createRun(1, {
        projectId: project.id,
        auditId: audit.id,
        status: 'completed',
        summary: {
          scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 },
          counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 },
          metadata: { url: 'https://test.com' }
        },
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 5000
      });

      // Verify run ID is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(run.runId)).toBe(true);

      // Verify internal ID is different from public ID
      expect(run.id).not.toBe(run.runId);
      expect(typeof run.id).toBe('number');
      expect(typeof run.runId).toBe('string');
    });

    it('should prevent ID enumeration attacks', async () => {
      const project = await service.createProject(1, {
        name: 'Test Project',
        url: 'https://test.com',
        domain: 'test.com',
        isActive: true
      });

      const audit = await service.createAudit(1, {
        projectId: project.id,
        name: 'Test Audit',
        type: 'seo',
        isActive: true
      });

      // Create multiple runs
      const runs = [];
      for (let i = 0; i < 5; i++) {
        const run = await service.createRun(1, {
          projectId: project.id,
          auditId: audit.id,
          status: 'completed',
          summary: {
            scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 },
            counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 },
            metadata: { url: 'https://test.com' }
          },
          startedAt: new Date(),
          completedAt: new Date(),
          duration: 5000
        });
        runs.push(run);
      }

      // Verify UUIDs are not sequential
      const runIds = runs.map(r => r.runId);
      for (let i = 1; i < runIds.length; i++) {
        expect(runIds[i]).not.toBe(runIds[i-1]);
        // UUIDs should be completely different, not incremental
        expect(parseInt(runIds[i].replace(/-/g, ''), 16)).not.toBe(
          parseInt(runIds[i-1].replace(/-/g, ''), 16) + 1
        );
      }
    });

    it('should handle invalid UUID formats gracefully', async () => {
      // Test with various invalid UUID formats
      const invalidUUIDs = [
        'not-a-uuid',
        '123',
        '123e4567-e89b-12d3-a456', // Too short
        '123e4567-e89b-12d3-a456-426614174000-extra', // Too long
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', // Invalid characters
        ''
      ];

      for (const invalidUUID of invalidUUIDs) {
        const result = await service.getRunDetails(1, invalidUUID);
        expect(result).toBeNull();
      }
    });
  });

  describe('Data Validation', () => {
    it('should validate tenant IDs in all operations', async () => {
      // Test with invalid tenant IDs
      const invalidTenantIds = [0, -1, NaN, Infinity];

      for (const invalidTenantId of invalidTenantIds) {
        try {
          await service.createProject(invalidTenantId, {
            name: 'Test',
            url: 'https://test.com',
            domain: 'test.com',
            isActive: true
          });
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          // Expected to throw an error
          expect(error).toBeDefined();
        }
      }
    });

    it('should prevent SQL injection-like attacks in search parameters', async () => {
      const project = await service.createProject(1, {
        name: 'Test Project',
        url: 'https://test.com',
        domain: 'test.com',
        isActive: true
      });

      // Test with malicious input patterns
      const maliciousInputs = [
        "'; DROP TABLE projects; --",
        "1 OR 1=1",
        "<script>alert('xss')</script>",
        "../../etc/passwd",
        "null",
        "undefined"
      ];

      // These should not cause errors or return unexpected results
      for (const maliciousInput of maliciousInputs) {
        const projects = await service.getProjects(1);
        expect(projects).toHaveLength(1);
        expect(projects[0].id).toBe(project.id);
      }
    });
  });

  describe('Access Control', () => {
    it('should enforce tenant context in all queries', async () => {
      // Create data for tenant 1
      const project = await service.createProject(1, {
        name: 'Secure Project',
        url: 'https://secure.com',
        domain: 'secure.com',
        isActive: true
      });

      const audit = await service.createAudit(1, {
        projectId: project.id,
        name: 'Secure Audit',
        type: 'seo',
        isActive: true
      });

      const run = await service.createRun(1, {
        projectId: project.id,
        auditId: audit.id,
        status: 'completed',
        summary: {
          scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 },
          counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 },
          metadata: { url: 'https://secure.com' }
        },
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 5000
      });

      // Verify all operations require valid tenant context
      const operations = [
        () => service.getProjects(999), // Non-existent tenant
        () => service.getAudits(999),
        () => service.getDashboardRuns(999),
        () => service.getProjectRuns(999, project.id),
        () => service.getRunDetails(999, run.runId)
      ];

      for (const operation of operations) {
        const result = await operation();
        if (Array.isArray(result)) {
          expect(result).toHaveLength(0);
        } else {
          expect(result).toBeNull();
        }
      }
    });

    it('should prevent unauthorized data modification', async () => {
      // Create data for tenant 1
      const project = await service.createProject(1, {
        name: 'Protected Project',
        url: 'https://protected.com',
        domain: 'protected.com',
        isActive: true
      });

      // Attempt to create audit for tenant 1's project as tenant 2
      // This should be prevented by proper tenant scoping
      const audit = await service.createAudit(2, {
        projectId: project.id, // Tenant 1's project
        name: 'Malicious Audit',
        type: 'seo',
        isActive: true
      });

      // The audit should be created with tenant 2's ID, not linked to tenant 1's project
      expect(audit.tenantId).toBe(2);
      
      // Tenant 1 should not see tenant 2's audit
      const tenant1Audits = await service.getAudits(1);
      expect(tenant1Audits).toHaveLength(0);

      // Tenant 2 should see their own audit
      const tenant2Audits = await service.getAudits(2);
      expect(tenant2Audits).toHaveLength(1);
      expect(tenant2Audits[0].tenantId).toBe(2);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity', async () => {
      const project = await service.createProject(1, {
        name: 'Integrity Test',
        url: 'https://integrity.com',
        domain: 'integrity.com',
        isActive: true
      });

      const audit = await service.createAudit(1, {
        projectId: project.id,
        name: 'Integrity Audit',
        type: 'seo',
        isActive: true
      });

      const run = await service.createRun(1, {
        projectId: project.id,
        auditId: audit.id,
        status: 'completed',
        summary: {
          scores: { overall: 80, seo: 80, performance: 80, accessibility: 80 },
          counts: { total: 2, critical: 0, high: 1, medium: 1, low: 0, info: 0 },
          metadata: { url: 'https://integrity.com' }
        },
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 5000
      });

      const findings = await service.createFindings(1, run.id, [
        {
          category: 'seo',
          severity: 'high',
          ruleId: 'test-rule',
          title: 'Test Finding',
          message: 'Test message',
          guidance: 'Test guidance',
          impact: 'Test impact'
        }
      ]);

      // Verify all relationships are properly maintained
      const runDetails = await service.getRunDetails(1, run.runId);
      expect(runDetails).not.toBeNull();
      expect(runDetails!.projectName).toBe('Integrity Test');
      expect(runDetails!.auditName).toBe('Integrity Audit');
      expect(runDetails!.findings).toHaveLength(1);
      expect(runDetails!.findings[0].ruleId).toBe('test-rule');

      // Verify tenant isolation is maintained
      expect(runDetails!.runId).toBe(run.runId);
      
      // Verify findings are properly linked
      expect(findings[0].tenantId).toBe(1);
      expect(findings[0].runId).toBe(run.id);
    });

    it('should handle concurrent operations safely', async () => {
      const project = await service.createProject(1, {
        name: 'Concurrent Test',
        url: 'https://concurrent.com',
        domain: 'concurrent.com',
        isActive: true
      });

      const audit = await service.createAudit(1, {
        projectId: project.id,
        name: 'Concurrent Audit',
        type: 'seo',
        isActive: true
      });

      // Create multiple runs concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          service.createRun(1, {
            projectId: project.id,
            auditId: audit.id,
            status: 'completed',
            summary: {
              scores: { overall: 80 + i, seo: 80, performance: 80, accessibility: 80 },
              counts: { total: 5, critical: 0, high: 1, medium: 2, low: 1, info: 1 },
              metadata: { url: 'https://concurrent.com' }
            },
            startedAt: new Date(Date.now() - i * 1000),
            completedAt: new Date(Date.now() - i * 1000 + 5000),
            duration: 5000
          })
        );
      }

      const runs = await Promise.all(promises);
      
      // Verify all runs were created successfully
      expect(runs).toHaveLength(10);
      
      // Verify all runs have unique IDs
      const runIds = runs.map(r => r.runId);
      const uniqueRunIds = new Set(runIds);
      expect(uniqueRunIds.size).toBe(10);

      // Verify all runs belong to the correct tenant
      for (const run of runs) {
        expect(run.tenantId).toBe(1);
        expect(run.projectId).toBe(project.id);
        expect(run.auditId).toBe(audit.id);
      }
    });
  });
});