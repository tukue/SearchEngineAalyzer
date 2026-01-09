import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildHealthResponse } from "../../../../shared/health";
import { isNextEndpointEnabled, isNextFrameworkEnabled } from "../feature-flags";

const HEALTH_ENDPOINT_NAME = "health";

export function GET(_req: NextRequest) {
  if (!isNextFrameworkEnabled()) {
    return NextResponse.json(
      { message: "Next.js handlers disabled via NEXT_FRAMEWORK_ENABLED" },
      { status: 503 }
    );
  }

  if (!isNextEndpointEnabled(HEALTH_ENDPOINT_NAME)) {
    return NextResponse.json(
      { message: "Next.js health handler disabled via NEXT_MIGRATED_API_ENDPOINTS" },
      { status: 503 }
    );
  }

  return NextResponse.json(buildHealthResponse());
}
