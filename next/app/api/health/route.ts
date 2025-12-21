import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import packageJson from "../../../../package.json";

const HEALTH_ENDPOINT_NAME = "health";

function isNextEndpointEnabled(endpoint: string) {
  const migratedEndpoints = process.env.NEXT_MIGRATED_API_ENDPOINTS
    ?.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!migratedEndpoints || migratedEndpoints.length === 0) {
    return true;
  }

  return migratedEndpoints.includes(endpoint.toLowerCase());
}

export function GET(_req: NextRequest) {
  if (!isNextEndpointEnabled(HEALTH_ENDPOINT_NAME)) {
    return NextResponse.json(
      { message: "Next.js health handler disabled via NEXT_MIGRATED_API_ENDPOINTS" },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: "ok",
    message: "Meta Tag Analyzer API is healthy",
    timestamp: new Date().toISOString(),
    version: packageJson.version
  });
}
