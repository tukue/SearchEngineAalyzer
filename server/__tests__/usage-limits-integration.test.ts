import request from "supertest";
import express, { Express } from "express";
import { registerRoutes } from "../routes";
import { MemStorage } from "../storage";
import { PLAN_CONFIGS } from "@shared/schema";

// Mock the storage module
jest.mock("../storage", () => {
  const mockStorage = new (jest.requireActual("../storage").MemStorage)();
  return {
    storage: mockStorage,
    getDefaultTenantContext: async () => ({
      tenantId: 1,
      plan: "free"
    })
  };
});

describe("Usage Limits Integration", () => {
  let app: Express;
  let server: any;
  let mockStorage: MemStorage;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    
    // Get the mocked storage instance
    mockStorage = require("../storage").storage;
    
    const result = await registerRoutes(app, { createServer: false });
    app = result.app;
    server = result.server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/quota", () => {
    it("should return quota status for tenant", async () => {
      const response = await request(app)
        .get("/api/quota")
        .expect(200);

      expect(response.body).toMatchObject({
        quotaRemaining: PLAN_CONFIGS.free.monthlyAuditLimit,
        quotaUsed: 0,
        quotaLimit: PLAN_CONFIGS.free.monthlyAuditLimit,
        quotaPercentUsed: 0,
        warningLevel: "none",
        period: expect.any(String)
      });
    });
  });

  describe("GET /api/plan", () => {
    it("should return plan info with quota status", async () => {
      const response = await request(app)
        .get("/api/plan")
        .expect(200);

      expect(response.body).toMatchObject({
        currentPlan: "free",
        entitlements: PLAN_CONFIGS.free,
        tenantId: 1,
        quota: {
          quotaRemaining: PLAN_CONFIGS.free.monthlyAuditLimit,
          quotaUsed: 0,
          quotaLimit: PLAN_CONFIGS.free.monthlyAuditLimit,
          quotaPercentUsed: 0,
          warningLevel: "none",
          period: expect.any(String)
        }
      });
    });
  });

  describe("POST /api/analyze", () => {
    it("should successfully analyze URL and include quota info", async () => {
      const response = await request(app)
        .post("/api/analyze")
        .send({
          url: "https://example.com",
          requestId: "test-request-1"
        })
        .expect(200);

      expect(response.body).toMatchObject({
        analysis: expect.any(Object),
        tags: expect.any(Array),
        recommendations: expect.any(Array),
        quota: {
          quotaUsed: 1,
          quotaRemaining: PLAN_CONFIGS.free.monthlyAuditLimit - 1,
          warningLevel: "none"
        }
      });
    });

    it("should handle idempotent requests", async () => {
      const requestData = {
        url: "https://example.com",
        requestId: "idempotent-request"
      };

      // First request
      const response1 = await request(app)
        .post("/api/analyze")
        .send(requestData)
        .expect(200);

      expect(response1.body.quota.quotaUsed).toBe(1);

      // Second request with same ID
      const response2 = await request(app)
        .post("/api/analyze")
        .send(requestData)
        .expect(200);

      expect(response2.body.quota.quotaUsed).toBe(1); // Should not increment
    });

    it("should block requests when quota exceeded", async () => {
      const limit = PLAN_CONFIGS.free.monthlyAuditLimit;

      // Fill up the quota
      for (let i = 0; i < limit; i++) {
        await request(app)
          .post("/api/analyze")
          .send({
            url: "https://example.com",
            requestId: `req-${i}`
          })
          .expect(200);
      }

      // Try one more request
      const response = await request(app)
        .post("/api/analyze")
        .send({
          url: "https://example.com",
          requestId: "overflow-request"
        })
        .expect(429);

      expect(response.body).toMatchObject({
        code: "QUOTA_EXCEEDED",
        feature: "monthlyAuditLimit",
        currentPlan: "free",
        message: expect.stringContaining("quota exceeded"),
        quota: {
          quotaRemaining: 0,
          warningLevel: "exceeded"
        }
      });
    });

    it("should show warning levels at 80% and 90%", async () => {
      const limit = PLAN_CONFIGS.free.monthlyAuditLimit;
      const eightyPercent = Math.floor(limit * 0.8);
      const ninetyPercent = Math.floor(limit * 0.9);

      // Fill to 80%
      for (let i = 0; i < eightyPercent; i++) {
        await request(app)
          .post("/api/analyze")
          .send({
            url: "https://example.com",
            requestId: `req-80-${i}`
          })
          .expect(200);
      }

      // Check 80% warning
      const response80 = await request(app)
        .post("/api/analyze")
        .send({
          url: "https://example.com",
          requestId: "check-80"
        })
        .expect(200);

      expect(response80.body.quota.warningLevel).toBe("warning_80");

      // Fill to 90%
      const remaining = ninetyPercent - eightyPercent - 1; // -1 for the check-80 request
      for (let i = 0; i < remaining; i++) {
        await request(app)
          .post("/api/analyze")
          .send({
            url: "https://example.com",
            requestId: `req-90-${i}`
          })
          .expect(200);
      }

      // Check 90% warning
      const response90 = await request(app)
        .post("/api/analyze")
        .send({
          url: "https://example.com",
          requestId: "check-90"
        })
        .expect(200);

      expect(response90.body.quota.warningLevel).toBe("warning_90");
    });

    it("should handle invalid URL gracefully", async () => {
      const response = await request(app)
        .post("/api/analyze")
        .send({
          url: "not-a-valid-url",
          requestId: "invalid-url-test"
        })
        .expect(400);

      expect(response.body.message).toContain("Invalid");
    });

    it("should auto-generate request ID if not provided", async () => {
      const response = await request(app)
        .post("/api/analyze")
        .send({
          url: "https://example.com"
        })
        .expect(200);

      expect(response.body.quota.quotaUsed).toBe(1);
    });
  });

  describe("Error handling", () => {
    it("should mark failed audits correctly", async () => {
      // Mock a network error by using an invalid URL that will cause fetch to fail
      const response = await request(app)
        .post("/api/analyze")
        .send({
          url: "https://nonexistent-domain-that-should-fail.invalid",
          requestId: "fail-test"
        })
        .expect(400);

      expect(response.body.message).toContain("Failed to connect");
      
      // Verify the audit was marked as failed in the ledger
      const ledgerEntry = await mockStorage.getUsageLedgerEntry(1, "fail-test");
      expect(ledgerEntry?.status).toBe("failed");
    });
  });

  describe("Tenant isolation", () => {
    it("should isolate usage between tenants", async () => {
      // Create a second tenant
      const tenant2 = await mockStorage.createTenant("Tenant 2", "free");
      
      // Make requests for the default tenant
      await request(app)
        .post("/api/analyze")
        .send({
          url: "https://example.com",
          requestId: "tenant1-req"
        })
        .expect(200);

      // Check that tenant 1 has usage
      const tenant1Usage = await mockStorage.getMonthlyUsage(1, new Date().toISOString().slice(0, 7));
      const tenant2Usage = await mockStorage.getMonthlyUsage(tenant2.id, new Date().toISOString().slice(0, 7));

      expect(tenant1Usage?.enqueuedCount).toBe(1);
      expect(tenant2Usage?.enqueuedCount || 0).toBe(0); // Tenant 2 should have no usage
    });
  });
});