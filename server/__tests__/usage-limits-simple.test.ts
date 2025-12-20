import { UsageLimitsService } from "../usage-limits";
import { MemStorage } from "../storage";
import { PLAN_CONFIGS } from "@shared/schema";

describe("Usage Limits Simple Integration", () => {
  let storage: MemStorage;
  let tenantId: number;

  beforeEach(async () => {
    storage = new MemStorage();
    const tenant = await storage.createTenant("Test Tenant", "free");
    tenantId = tenant.id;
    
    // Replace the storage instance in the module
    const usageLimitsModule = require("../usage-limits");
    const storageModule = require("../storage");
    storageModule.storage = storage;
  });

  describe("End-to-End Quota Flow", () => {
    it("should enforce quota limits correctly", async () => {
      const limit = PLAN_CONFIGS.free.monthlyAuditLimit;
      
      // Fill up quota to the limit
      for (let i = 0; i < limit; i++) {
        const result = await UsageLimitsService.reserveAuditQuota(tenantId, `req-${i}`);
        expect(result.success).toBe(true);
      }
      
      // Next request should fail
      const overflowResult = await UsageLimitsService.reserveAuditQuota(tenantId, "overflow");
      expect(overflowResult.success).toBe(false);
      expect(overflowResult.error?.code).toBe("QUOTA_EXCEEDED");
    });

    it("should show correct warning levels", async () => {
      const limit = PLAN_CONFIGS.free.monthlyAuditLimit;
      const eightyPercent = Math.floor(limit * 0.8);
      const ninetyPercent = Math.floor(limit * 0.9);

      // Fill to 80%
      for (let i = 0; i < eightyPercent; i++) {
        await UsageLimitsService.reserveAuditQuota(tenantId, `req-80-${i}`);
      }

      let status = await UsageLimitsService.getQuotaStatus(tenantId);
      expect(status.warningLevel).toBe("warning_80");

      // Fill to 90%
      for (let i = eightyPercent; i < ninetyPercent; i++) {
        await UsageLimitsService.reserveAuditQuota(tenantId, `req-90-${i}`);
      }

      status = await UsageLimitsService.getQuotaStatus(tenantId);
      expect(status.warningLevel).toBe("warning_90");

      // Fill to 100%
      for (let i = ninetyPercent; i < limit; i++) {
        await UsageLimitsService.reserveAuditQuota(tenantId, `req-100-${i}`);
      }

      status = await UsageLimitsService.getQuotaStatus(tenantId);
      expect(status.warningLevel).toBe("exceeded");
    });

    it("should handle audit completion and failure", async () => {
      const requestId = "test-completion";
      
      // Reserve quota
      const reserveResult = await UsageLimitsService.reserveAuditQuota(tenantId, requestId);
      expect(reserveResult.success).toBe(true);
      
      // Complete audit
      await UsageLimitsService.completeAudit(tenantId, requestId);
      
      // Verify status
      const entry = await storage.getUsageLedgerEntry(tenantId, requestId);
      expect(entry?.status).toBe("completed");
      expect(entry?.completedAt).toBeDefined();
    });

    it("should maintain idempotency", async () => {
      const requestId = "idempotent-test";
      
      // First request
      const result1 = await UsageLimitsService.reserveAuditQuota(tenantId, requestId);
      expect(result1.success).toBe(true);
      expect(result1.quotaStatus.quotaUsed).toBe(1);
      
      // Second request with same ID
      const result2 = await UsageLimitsService.reserveAuditQuota(tenantId, requestId);
      expect(result2.success).toBe(true);
      expect(result2.quotaStatus.quotaUsed).toBe(1); // Should not increment
    });

    it("should track monthly usage correctly", async () => {
      const currentPeriod = new Date().toISOString().slice(0, 7);
      
      // Create some usage
      await UsageLimitsService.reserveAuditQuota(tenantId, "monthly-1");
      await UsageLimitsService.reserveAuditQuota(tenantId, "monthly-2");
      await UsageLimitsService.completeAudit(tenantId, "monthly-1");
      await UsageLimitsService.failAudit(tenantId, "monthly-2");
      
      // Check monthly summary
      const usage = await storage.getMonthlyUsage(tenantId, currentPeriod);
      expect(usage?.enqueuedCount).toBe(2);
      expect(usage?.completedCount).toBe(1);
      expect(usage?.failedCount).toBe(1);
    });
  });
});