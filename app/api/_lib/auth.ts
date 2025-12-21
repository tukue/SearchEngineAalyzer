import { NextRequest, NextResponse } from "next/server";
import { AuthenticatedTenantContext, resolveTenantContextFromHeaders } from "../../../server/context";

export async function getTenantContextOrError(request: NextRequest): Promise<{ context: AuthenticatedTenantContext } | { response: NextResponse }> {
  try {
    const tenantContext = await resolveTenantContextFromHeaders(
      request.headers,
      request.headers.get("x-tenant-role"),
    );

    if (!tenantContext) {
      return { response: NextResponse.json({ message: "Authentication required" }, { status: 401 }) };
    }

    return { context: tenantContext };
  } catch (error) {
    console.error("Failed to resolve tenant context from token:", error);
    return { response: NextResponse.json({ message: "Failed to authenticate request" }, { status: 500 }) };
  }
}
