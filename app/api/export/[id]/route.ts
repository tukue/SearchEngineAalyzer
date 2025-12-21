import { NextRequest, NextResponse } from "next/server";
import { PlanGatingService } from "../../../../server/plan-gating";
import { storage } from "../../../../server/storage";
import { getTenantContextOrError } from "../../_lib/auth";
import { ensureNextApiEnabled } from "../../_lib/feature-flags";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const disabledResponse = ensureNextApiEnabled("export");
  if (disabledResponse) return disabledResponse;

  const authResult = await getTenantContextOrError(request);
  if ("response" in authResult) return authResult.response;

  try {
    const tenantContext = authResult.context;

    if (!PlanGatingService.checkEntitlement(tenantContext, "exportsEnabled")) {
      const error = PlanGatingService.createPlanError("exportsEnabled", tenantContext.plan);
      return NextResponse.json(error, { status: 403 });
    }

    const analysisId = parseInt(params.id, 10);
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const format = typeof body?.format === "string" ? body.format : "json";

    const analysis = await storage.getAnalysis(tenantContext.tenantId, analysisId);
    if (!analysis) {
      return NextResponse.json({ message: "Analysis not found" }, { status: 404 });
    }

    await storage.incrementUsage(tenantContext.tenantId, "export");

    return NextResponse.json({
      message: "Export generated successfully",
      format,
      data: analysis,
    });
  } catch (error) {
    console.error("Error exporting analysis:", error);
    return NextResponse.json({ message: "Failed to export analysis" }, { status: 500 });
  }
}
