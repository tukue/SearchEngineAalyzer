import { CleanupJob, AdvancedCleanupStrategies } from '../cleanup-job';
import { persistenceService } from '../persistence-service';
import { storage } from '../storage';

// Mock console methods to avoid noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('CleanupJob', () => {
  let cleanupJob: CleanupJob;

  beforeEach(() => {
    cleanupJob = new CleanupJob();
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    cleanupJob.stop();
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('Job Lifecycle', () => {
    it('should start and stop cleanup job', () => {
      expect(cleanupJob.getStatus().isRunning).toBe(false);

      cleanupJob.start(1000); // 1 second interval for testing
      expect(cleanupJob.getStatus().isRunning).toBe(true);

      cleanupJob.stop();
      expect(cleanupJob.getStatus().isRunning).toBe(false);
    });

    it('should not start multiple instances', () => {
      cleanupJob.start(1000);
      cleanupJob.start(1000); // Should not start again

      expect(console.log).toHaveBeenCalledWith('Cleanup job is already running');
      cleanupJob.stop();
    });

    it('should provide status information', () => {
      const status = cleanupJob.getStatus();
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('lastRun');
      expect(status).toHaveProperty('nextRun');
    });
  });

  describe('Cleanup Execution', () => {
    beforeEach(async () => {
      // Reset persistence service state
      (persistenceService as any).projects.clear();
      (persistenceService as any).audits.clear();
      (persistenceService as any).auditRuns.clear();
      (persistenceService as any).findings.clear();
      (persistenceService as any).currentProjectId = 1;
      (persistenceService as any).currentAuditId = 1;
      (persistenceService as any).currentRunId = 1;
      (persistenceService as any).currentFindingId = 1;

      // Ensure default tenant exists
      try {
        await storage.getTenant(1);
      } catch {
        await storage.createTenant('Default Tenant', 'free');
      }
    });

    it('should cleanup old runs for free plan', async () => {
      // Create project and audit
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

      // Create 10 runs (more than free plan limit of 5)
      for (let i = 0; i < 10; i++) {
        await persistenceService.createRun(1, {
          projectId: project.id,
          auditId: audit.id,
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

      // Run cleanup
      await cleanupJob.runCleanup();

      // Verify cleanup occurred
      const remainingRuns = await persistenceService.getDashboardRuns(1, 10);
      expect(remainingRuns.length).toBe(5); // Should keep only 5 runs for free plan

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up 5 runs for tenant 1 (free plan)')
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock persistenceService.cleanupOldRuns to throw an error
      const originalCleanup = persistenceService.cleanupOldRuns;
      persistenceService.cleanupOldRuns = jest.fn().mockRejectedValue(new Error('Cleanup failed'));

      await cleanupJob.runCleanup();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error cleaning up tenant 1:'),
        expect.any(Error)
      );

      // Restore original method
      persistenceService.cleanupOldRuns = originalCleanup;
    });

    it('should emit metrics after cleanup', async () => {
      await cleanupJob.runCleanup();

      expect(console.log).toHaveBeenCalledWith(
        'Cleanup metrics:',
        expect.stringContaining('"success":true')
      );
    });

    it('should handle no tenants scenario', async () => {
      // Mock getAllTenants to return empty array
      const originalGetAllTenants = (cleanupJob as any).getAllTenants;
      (cleanupJob as any).getAllTenants = jest.fn().mockResolvedValue([]);

      await cleanupJob.runCleanup();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup completed: 0 runs deleted across 0 tenants')
      );

      // Restore original method
      (cleanupJob as any).getAllTenants = originalGetAllTenants;
    });
  });

  describe('Error Handling', () => {
    it('should handle general cleanup failures', async () => {
      // Mock getAllTenants to throw an error
      const originalGetAllTenants = (cleanupJob as any).getAllTenants;
      (cleanupJob as any).getAllTenants = jest.fn().mockRejectedValue(new Error('Database error'));

      await cleanupJob.runCleanup();

      expect(console.error).toHaveBeenCalledWith(
        'Cleanup job failed:',
        expect.any(Error)
      );

      expect(console.log).toHaveBeenCalledWith(
        'Cleanup metrics:',
        expect.stringContaining('"success":false')
      );

      // Restore original method
      (cleanupJob as any).getAllTenants = originalGetAllTenants;
    });
  });

  describe('Scheduled Execution', () => {
    it('should run cleanup at specified intervals', (done) => {
      let runCount = 0;
      const originalRunCleanup = cleanupJob.runCleanup;
      
      cleanupJob.runCleanup = jest.fn().mockImplementation(async () => {
        runCount++;
        if (runCount === 2) {
          cleanupJob.stop();
          expect(cleanupJob.runCleanup).toHaveBeenCalledTimes(2);
          cleanupJob.runCleanup = originalRunCleanup;
          done();
        }
      });

      cleanupJob.start(100); // 100ms interval for testing
    }, 1000);
  });
});

describe('AdvancedCleanupStrategies', () => {
  beforeEach(() => {
    console.log = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('Archive Strategy', () => {
    it('should log archive operation for tenant', async () => {
      const result = await AdvancedCleanupStrategies.archiveOldRuns(1, 'free');
      
      expect(result).toBe(0); // Placeholder implementation
      expect(console.log).toHaveBeenCalledWith(
        'Would archive runs beyond 5 for tenant 1'
      );
    });

    it('should handle different plan types', async () => {
      await AdvancedCleanupStrategies.archiveOldRuns(2, 'pro');
      
      expect(console.log).toHaveBeenCalledWith(
        'Would archive runs beyond 100 for tenant 2'
      );
    });
  });

  describe('Smart Cleanup', () => {
    it('should log smart cleanup operation', async () => {
      await AdvancedCleanupStrategies.smartCleanup(1);
      
      expect(console.log).toHaveBeenCalledWith(
        'Would perform smart cleanup for tenant 1'
      );
    });
  });

  describe('Artifact Cleanup', () => {
    it('should log artifact cleanup operation', async () => {
      const result = await AdvancedCleanupStrategies.cleanupArtifacts(1);
      
      expect(result).toBe(0); // Placeholder implementation
      expect(console.log).toHaveBeenCalledWith(
        'Would cleanup artifacts for tenant 1'
      );
    });
  });
});

describe('Process Signal Handling', () => {
  let cleanupJob: CleanupJob;

  beforeEach(() => {
    cleanupJob = new CleanupJob();
    console.log = jest.fn();
  });

  afterEach(() => {
    cleanupJob.stop();
    console.log = originalConsoleLog;
  });

  it('should handle SIGTERM gracefully', () => {
    cleanupJob.start(1000);
    expect(cleanupJob.getStatus().isRunning).toBe(true);

    // Simulate SIGTERM
    process.emit('SIGTERM');

    expect(console.log).toHaveBeenCalledWith(
      'Received SIGTERM, stopping cleanup job...'
    );
  });

  it('should handle SIGINT gracefully', () => {
    cleanupJob.start(1000);
    expect(cleanupJob.getStatus().isRunning).toBe(true);

    // Simulate SIGINT
    process.emit('SIGINT');

    expect(console.log).toHaveBeenCalledWith(
      'Received SIGINT, stopping cleanup job...'
    );
  });
});