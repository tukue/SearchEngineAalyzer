import { persistenceService } from './persistence-service';
import { storage } from './storage';
import { PLAN_CONFIGS } from '@shared/schema';

// Background cleanup job for managing retention policies
export class CleanupJob {
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  // Start the cleanup job with specified interval (default: daily)
  start(intervalMs: number = 24 * 60 * 60 * 1000) {
    if (this.isRunning) {
      console.log('Cleanup job is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting cleanup job with interval:', intervalMs, 'ms');

    // Run immediately on start
    this.runCleanup();

    // Schedule recurring cleanup
    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, intervalMs);
  }

  // Stop the cleanup job
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('Cleanup job stopped');
  }

  // Manual cleanup execution
  async runCleanup(): Promise<void> {
    try {
      console.log('Starting cleanup job at', new Date().toISOString());
      
      const startTime = Date.now();
      let totalDeleted = 0;
      let tenantsProcessed = 0;

      // Get all tenants (in production, this would be paginated)
      const tenants = await this.getAllTenants();

      for (const tenant of tenants) {
        try {
          const deletedCount = await persistenceService.cleanupOldRuns(
            tenant.id,
            tenant.plan as 'free' | 'pro'
          );

          if (deletedCount > 0) {
            console.log(`Cleaned up ${deletedCount} runs for tenant ${tenant.id} (${tenant.plan} plan)`);
            totalDeleted += deletedCount;
          }

          tenantsProcessed++;
        } catch (error) {
          console.error(`Error cleaning up tenant ${tenant.id}:`, error);
          // Continue with other tenants
        }
      }

      const duration = Date.now() - startTime;
      console.log(`Cleanup completed: ${totalDeleted} runs deleted across ${tenantsProcessed} tenants in ${duration}ms`);

      // Emit metrics for monitoring
      this.emitMetrics({
        totalDeleted,
        tenantsProcessed,
        duration,
        success: true,
      });

    } catch (error) {
      console.error('Cleanup job failed:', error);
      this.emitMetrics({
        totalDeleted: 0,
        tenantsProcessed: 0,
        duration: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Get all tenants (simplified for MVP)
  private async getAllTenants(): Promise<Array<{ id: number; plan: string }>> {
    // In production, this would query the database
    // For MVP, we'll get tenants from the storage service
    const tenants = [];
    
    // Get tenant 1 (default tenant)
    const defaultTenant = await storage.getTenant(1);
    if (defaultTenant) {
      tenants.push({ id: defaultTenant.id, plan: defaultTenant.plan });
    }

    return tenants;
  }

  // Emit metrics for monitoring (placeholder)
  private emitMetrics(metrics: {
    totalDeleted: number;
    tenantsProcessed: number;
    duration: number;
    success: boolean;
    error?: string;
  }): void {
    // In production, this would send metrics to monitoring system
    console.log('Cleanup metrics:', JSON.stringify(metrics, null, 2));
    
    // Example: Send to CloudWatch, DataDog, etc.
    // await metricsClient.putMetric('cleanup.runs_deleted', metrics.totalDeleted);
    // await metricsClient.putMetric('cleanup.duration', metrics.duration);
    // await metricsClient.putMetric('cleanup.success', metrics.success ? 1 : 0);
  }

  // Health check for the cleanup job
  getStatus(): {
    isRunning: boolean;
    lastRun?: Date;
    nextRun?: Date;
  } {
    return {
      isRunning: this.isRunning,
      // In production, would track actual run times
      lastRun: this.isRunning ? new Date() : undefined,
      nextRun: this.isRunning ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined,
    };
  }
}

// Singleton instance
export const cleanupJob = new CleanupJob();

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping cleanup job...');
  cleanupJob.stop();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping cleanup job...');
  cleanupJob.stop();
});

// Advanced cleanup strategies for production
export class AdvancedCleanupStrategies {
  
  // Archive old runs instead of deleting (Option B)
  static async archiveOldRuns(tenantId: number, planType: 'free' | 'pro'): Promise<number> {
    const historyDepth = PLAN_CONFIGS[planType].historyDepth;
    
    // In production, this would:
    // 1. Move old runs to archive table
    // 2. Update status to 'archived'
    // 3. Compress findings data
    // 4. Move artifacts to cold storage
    
    console.log(`Would archive runs beyond ${historyDepth} for tenant ${tenantId}`);
    return 0; // Placeholder
  }

  // Intelligent cleanup based on usage patterns
  static async smartCleanup(tenantId: number): Promise<void> {
    // In production, this could:
    // 1. Keep runs with high scores longer
    // 2. Preserve runs with many findings
    // 3. Maintain runs from different time periods for trends
    // 4. Consider user engagement with specific runs
    
    console.log(`Would perform smart cleanup for tenant ${tenantId}`);
  }

  // Cleanup artifacts in object storage
  static async cleanupArtifacts(tenantId: number): Promise<number> {
    // In production, this would:
    // 1. List artifacts for deleted runs
    // 2. Delete from S3/object storage
    // 3. Clean up database references
    // 4. Handle failed deletions gracefully
    
    console.log(`Would cleanup artifacts for tenant ${tenantId}`);
    return 0; // Placeholder
  }
}

// Export for use in server startup
export function startCleanupJob(): void {
  // Start cleanup job in production
  if (process.env.NODE_ENV === 'production') {
    cleanupJob.start();
  } else {
    console.log('Cleanup job disabled in development mode');
  }
}