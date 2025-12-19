import { NextRequest, NextResponse } from "next/server";
import { PlanGatingService } from "../../../server/plan-gating";
import { storage } from "../../../server/storage";
import { getTenantContextOrError } from "../_lib/auth";
import { ensureNextApiEnabled } from "../_lib/feature-flags";

export async function GET(request: NextRequest) {
  const disabledResponse = ensureNextApiEnabled("history");
  if (disabledResponse) return disabledResponse;

  const authResult = await getTenantContextOrError(request);
  if ("response" in authResult) return authResult.response;

  try {
    const tenantContext = authResult.context;
    const historyDepth = PlanGatingService.getQuotaLimit(tenantContext, "historyDepth");
    const history = await storage.getAnalysisHistory(tenantContext.tenantId, historyDepth);

    return NextResponse.json({
      analyses: history,
      limit: historyDepth,
      currentPlan: tenantContext.plan,
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json({ message: "Failed to fetch analysis history" }, { status: 500 });
  }
}
