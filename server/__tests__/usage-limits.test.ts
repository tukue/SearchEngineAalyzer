import { UsageLimitsService } from "../usage-limits";
import { MemStorage } from "../storage";
import { PLAN_CONFIGS } from "@shared/schema";

// Mock the storage module
jest.mock("../storage", () => {
  const actualStorage = jest.requireActual("../storage");
  return {
    ...actualStorage,
    storage: new actualStorage.MemStorage()
  };
});

describe("UsageLimitsService", () => {
  let tenantId: number;

  beforeEach(async () => {
    const { storage } = require("../storage");
    // Create a test tenant with free plan
    const tenant = await storage.createTenant("Test Tenant", "free");
    tenantId = tenant.id;
  });

  describe("getQuotaStatus", () => {
    it("should return correct quota status for new tenant", async () => {
      const status = await UsageLimitsService.getQuotaStatus(tenantId);
      
      expect(status.quotaLimit).toBe(PLAN_CONFIGS.free.monthlyAuditLimit);
      expect(status.quotaUsed).toBe(0);
      expect(status.quotaRemaining).toBe(PLAN_CONFIGS.free.monthlyAuditLimit);
      expect(status.quotaPercentUsed).toBe(0);
      expect(status.warningLevel).toBe("none");
    });

    it("should show warning at 80% usage", async () => {
      const limit = PLAN_CONFIGS.free.monthlyAuditLimit;
      const usageCount = Math.ceil(limit * 0.8);
      
      // Create usage entries to reach 80%
      for (let i = 0; i < usageCount; i++) {
        await UsageLimitsService.reserveAuditQuota(tenantId, `req-${i}`);
      }
      
      const status = await UsageLimitsService.getQuotaStatus(tenantId);
      expect(status.warningLevel).toBe("warning_80");
      expect(status.quotaPercentUsed).toBeGreaterThanOrEqual(80);
    });

    it("should show warning at 90% usage", async () => {
      const limit = PLAN_CONFIGS.free.monthlyAuditLimit;
      const usageCount = Math.ceil(limit * 0.9);
      
      // Create usage entries to reach 90%
      for (let i = 0; i < usageCount; i++) {
        await UsageLimitsService.reserveAuditQuota(tenantId, `req-${i}`);
      }
      
      const status = await UsageLimitsService.getQuotaStatus(tenantId);
      expect(status.warningLevel).toBe("warning_90");
      expect(status.quotaPercentUsed).toBeGreaterThanOrEqual(90);
    });

    it("should show exceeded when at 100% usage", async () => {
      const limit = PLAN_CONFIGS.free.monthlyAuditLimit;
      
      // Create usage entries to reach 100%
      for (let i = 0; i < limit; i++) {
        await UsageLimitsService.reserveAuditQuota(tenantId, `req-${i}`);
      }
      
      const status = await UsageLimitsService.getQuotaStatus(tenantId);
      expect(status.warningLevel).toBe("exceeded");
      expect(status.quotaRemaining).toBe(0);
    });
  });

  describe("canEnqueueAudit", () => {
    it("should allow audit when under quota", async () => {
      const result = await UsageLimitsService.canEnqueueAudit(tenantId);
      
      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should block audit when quota exceeded", async () => {
      const limit = PLAN_CONFIGS.free.monthlyAuditLimit;
      
      // Fill up the quota
      for (let i = 0; i < limit; i++) {
        await UsageLimitsService.reserveAuditQuota(tenantId, `req-${i}`);
      }
      
      const result = await UsageLimitsService.canEnqueueAudit(tenantId);
      
      expect(result.allowed).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("QUOTA_EXCEEDED");
    });
  });

  describe("reserveAuditQuota", () => {
    it("should successfully reserve quota", async () => {
      const requestId = "test-request-1";
      const result = await UsageLimitsService.reserveAuditQuota(
        tenantId, 
        requestId, 
        "meta_analysis",
        "https://example.com",
        "user123"
      );
      
      expect(result.success).toBe(true);
      expect(result.quotaStatus.quotaUsed).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it("should handle idempotency correctly", async () => {
      const requestId = "test-request-1";
      
      // First request
      const result1 = await UsageLimitsService.reserveAuditQuota(tenantId, requestId);
      expect(result1.success).toBe(true);
      expect(result1.quotaStatus.quotaUsed).toBe(1);
      
      // Duplicate request with same ID
      const result2 = await UsageLimitsService.reserveAuditQuota(tenantId, requestId);
      expect(result2.success).toBe(true);
      expect(result2.quotaStatus.quotaUsed).toBe(1); // Should not increment
    });

    it("should fail when quota exceeded", async () => {
      const limit = PLAN_CONFIGS.free.monthlyAuditLimit;
      
      // Fill up the quota
      for (let i = 0; i < limit; i++) {
        await UsageLimitsService.reserveAuditQuota(tenantId, `req-${i}`);
      }
      
      // Try to reserve one more
      const result = await UsageLimitsService.reserveAuditQuota(tenantId, "overflow-req");
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("QUOTA_EXCEEDED");
    });
  });

  describe("completeAudit and failAudit", () => {
    it("should mark audit as completed", async () => {
      const requestId = "test-request-1";
      
      // Reserve quota
      await UsageLimitsService.reserveAuditQuota(tenantId, requestId);
      
      // Complete audit
      await UsageLimitsService.completeAudit(tenantId, requestId);
      
      // Verify status
      const { storage } = require("../storage");
      const entry = await storage.getUsageLedgerEntry(tenantId, requestId);
      expect(entry).toBeDefined();
      expect(entry!.status).toBe("completed");
      expect(entry!.completedAt).toBeDefined();
    });

    it("should mark audit as failed", async () => {
      const requestId = "test-request-1";
      
      // Reserve quota
      await UsageLimitsService.reserveAuditQuota(tenantId, requestId);
      
      // Fail audit
      await UsageLimitsService.failAudit(tenantId, requestId);
      
      // Verify status
      const { storage } = require("../storage");
      const entry = await storage.getUsageLedgerEntry(tenantId, requestId);
      expect(entry).toBeDefined();
      expect(entry!.status).toBe("failed");
      expect(entry!.failedAt).toBeDefined();
    });
  });

  describe("generateRequestId", () => {
    it("should generate unique request IDs", () => {
      const id1 = UsageLimitsService.generateRequestId();
      const id2 = UsageLimitsService.generateRequestId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe("string");
      expect(typeof id2).toBe("string");
    });
  });

  describe("monthly usage tracking", () => {
    it("should track usage across different months", async () => {
      const currentPeriod = new Date().toISOString().slice(0, 7);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const nextPeriod = nextMonth.toISOString().slice(0, 7);
      
      const { storage } = require("../storage");
      
      // Create entries for current month
      await storage.createUsageLedgerEntry({
        tenantId,
        requestId: "current-1",
        auditType: "meta_analysis",
        status: "enqueued",
        period: currentPeriod,
        url: null,
        userId: null
      });
      
      // Create entries for next month
      await storage.createUsageLedgerEntry({
        tenantId,
        requestId: "next-1",
        auditType: "meta_analysis", 
        status: "enqueued",
        period: nextPeriod,
        url: null,
        userId: null
      });
      
      const currentUsage = await storage.getMonthlyUsage(tenantId, currentPeriod);
      const nextUsage = await storage.getMonthlyUsage(tenantId, nextPeriod);
      
      expect(currentUsage?.enqueuedCount).toBe(1);
      expect(nextUsage?.enqueuedCount).toBe(1);
    });
  });
});