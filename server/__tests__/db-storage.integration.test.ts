import { createDb } from "../db";
import { DbStorage } from "../storage";
import {
  analyses,
  metaTags,
  recommendations,
  tenants,
  usageLedger,
  monthlyUsage,
  planChanges,
  usageTracking
} from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIf = hasDatabase ? describe : describe.skip;

describeIf("DbStorage integration", () => {
  jest.setTimeout(30000);

  let db: ReturnType<typeof createDb>;
  let storage: DbStorage;
  let tenantId: number;

  beforeAll(async () => {
    db = createDb();
    storage = new DbStorage(db);
    const tenant = await storage.createTenant(`Test Tenant ${Date.now()}`, "free");
    tenantId = tenant.id;
  });

  afterAll(async () => {
    if (!db || !tenantId) return;

    const safeDelete = async (label: string, action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (error) {
        console.error(`Failed to clean up ${label}:`, error);
      }
    };

    const analysisRows = await db.query.analyses.findMany({
      where: eq(analyses.tenantId, tenantId)
    });

    for (const analysis of analysisRows) {
      await safeDelete("recommendations", () =>
        db.delete(recommendations).where(eq(recommendations.analysisId, analysis.id))
      );
    }

    await safeDelete("metaTags", () => db.delete(metaTags).where(eq(metaTags.tenantId, tenantId)));
    await safeDelete("analyses", () => db.delete(analyses).where(eq(analyses.tenantId, tenantId)));
    await safeDelete("usageLedger", () =>
      db.delete(usageLedger).where(eq(usageLedger.tenantId, tenantId))
    );
    await safeDelete("monthlyUsage", () =>
      db.delete(monthlyUsage).where(eq(monthlyUsage.tenantId, tenantId))
    );
    await safeDelete("usageTracking", () =>
      db.delete(usageTracking).where(eq(usageTracking.tenantId, tenantId))
    );
    await safeDelete("planChanges", () =>
      db.delete(planChanges).where(eq(planChanges.tenantId, tenantId))
    );
    await safeDelete("tenants", () => db.delete(tenants).where(eq(tenants.id, tenantId)));
  });

  it("creates and retrieves analysis data", async () => {
    const url = `https://example.com/${Date.now()}`;
    const analysisData = {
      analysis: {
        url,
        totalCount: 4,
        seoCount: 2,
        socialCount: 1,
        technicalCount: 1,
        missingCount: 0,
        healthScore: 92,
        timestamp: new Date().toISOString()
      },
      tags: [
        {
          tagType: "SEO",
          isPresent: true,
          name: "description",
          property: null,
          content: "Test description",
          httpEquiv: null,
          charset: null,
          rel: null
        }
      ],
      recommendations: [
        {
          tagName: "description",
          description: "Add a description tag",
          example: "<meta name=\"description\" content=\"...\" />"
        }
      ]
    };

    const created = await storage.createAnalysis(tenantId, analysisData);
    const byId = await storage.getAnalysis(tenantId, created.analysis.id);
    const byUrl = await storage.getAnalysisByUrl(tenantId, url);

    expect(byId?.analysis.url).toBe(url);
    expect(byId?.tags.length).toBe(1);
    expect(byId?.recommendations.length).toBe(1);
    expect(byUrl?.analysis.id).toBe(created.analysis.id);
  });

  it("tracks usage ledger and monthly usage status changes", async () => {
    const period = new Date().toISOString().slice(0, 7);
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await storage.createUsageLedgerEntry({
      tenantId,
      requestId,
      auditType: "meta_analysis",
      status: "enqueued",
      url: "https://example.com/usage",
      userId: "tester",
      period
    });

    const initialUsage = await storage.getMonthlyUsage(tenantId, period);
    expect(initialUsage?.enqueuedCount).toBe(1);

    await storage.updateUsageLedgerEntry(tenantId, requestId, "completed");

    const updatedUsage = await storage.getMonthlyUsage(tenantId, period);
    expect(updatedUsage?.completedCount).toBe(1);
    expect(updatedUsage?.failedCount).toBe(0);
  });

  it("records plan changes and plan-change ledger entries", async () => {
    const tenant = await storage.getTenant(tenantId);
    const nextPlan = tenant?.plan === "free" ? "pro" : "free";

    await storage.updateTenantPlan(tenantId, nextPlan ?? "pro", "tester");

    const latestPlanChange = await db.query.planChanges.findMany({
      where: eq(planChanges.tenantId, tenantId),
      orderBy: [desc(planChanges.timestamp)],
      limit: 1
    });

    const latestLedger = await db.query.usageLedger.findMany({
      where: and(eq(usageLedger.tenantId, tenantId), eq(usageLedger.auditType, "plan_change")),
      orderBy: [desc(usageLedger.enqueuedAt)],
      limit: 1
    });

    expect(latestPlanChange[0]?.newPlan).toBe(nextPlan ?? "pro");
    expect(latestLedger[0]?.status).toBe("completed");
  });

  it("reserves quota atomically", async () => {
    const period = new Date().toISOString().slice(0, 7);
    const requestId = `quota-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = await storage.atomicQuotaReservation({
      tenantId,
      requestId,
      auditType: "meta_analysis",
      status: "enqueued",
      url: "https://example.com/quota",
      userId: "tester",
      period
    });

    expect(result.success).toBe(true);
    expect(result.quotaStatus.quotaLimit).toBeGreaterThan(0);
  });
});
