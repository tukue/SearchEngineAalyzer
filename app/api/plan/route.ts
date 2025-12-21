import { NextRequest, NextResponse } from "next/server";
import { PLAN_CONFIGS, TenantContext } from "@shared/schema";
import { UsageLimitsService } from "../../../server/usage-limits";
import { getTenantContextOrError } from "../_lib/auth";
import { ensureNextApiEnabled } from "../_lib/feature-flags";

export async function GET(request: NextRequest) {
  const disabledResponse = ensureNextApiEnabled("plan");
  if (disabledResponse) return disabledResponse;

  const authResult = await getTenantContextOrError(request);
  if ("response" in authResult) return authResult.response;

  try {
    const tenantContext = authResult.context as TenantContext;
    const planConfig = PLAN_CONFIGS[tenantContext.plan];
    const quotaStatus = await UsageLimitsService.getQuotaStatus(tenantContext.tenantId);

    return NextResponse.json({
      currentPlan: tenantContext.plan,
      entitlements: planConfig,
      tenantId: tenantContext.tenantId,
      quota: quotaStatus,
    });
  } catch (error) {
    console.error("Error fetching plan info:", error);
    return NextResponse.json({ message: "Failed to fetch plan information" }, { status: 500 });
  }
}
