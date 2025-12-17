import { Plan, PlanId } from "@shared/schema";

const plans: Record<PlanId, Plan> = {
  free: {
    id: "free",
    label: "Free",
    monthlyQuota: 10,
    features: {
      exports: false,
      historyDepth: 3,
      webhooks: false,
    },
  },
  pro: {
    id: "pro",
    label: "Pro",
    monthlyQuota: 250,
    features: {
      exports: true,
      historyDepth: 10,
      webhooks: true,
    },
  },
};

// TODO: Replace with database-driven entitlements in production environments.
// Demo mapping for development/testing only.
const tenantPlans: Record<string, PlanId> = {
  "demo-tenant": "pro",
};

export function getTenantPlan(tenantId: string): Plan {
  const planId = tenantPlans[tenantId] || "free";
  return plans[planId];
}

export function resolvePlan(planId: PlanId): Plan {
  return plans[planId];
}
