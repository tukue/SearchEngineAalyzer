import { NextRequest, NextResponse } from "next/server";
import { UsageLimitsService } from "../../../server/usage-limits";
import { getTenantContextOrError } from "../_lib/auth";
import { ensureNextApiEnabled } from "../_lib/feature-flags";

export async function GET(request: NextRequest) {
  const disabledResponse = ensureNextApiEnabled("quota");
  if (disabledResponse) return disabledResponse;

  const authResult = await getTenantContextOrError(request);
  if ("response" in authResult) return authResult.response;

  try {
    const quotaStatus = await UsageLimitsService.getQuotaStatus(authResult.context.tenantId);
    return NextResponse.json(quotaStatus);
  } catch (error) {
    console.error("Error fetching quota status:", error);
    return NextResponse.json({ message: "Failed to fetch quota status" }, { status: 500 });
  }
}
