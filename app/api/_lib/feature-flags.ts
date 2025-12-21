import { NextResponse } from "next/server";
import { isNextApiEnabled, NextApiEndpoint } from "../../../server/next-api-flags";

export function ensureNextApiEnabled(endpoint: NextApiEndpoint): NextResponse | null {
  if (isNextApiEnabled(endpoint)) {
    return null;
  }

  return NextResponse.json(
    {
      message: `Next.js handler for /${endpoint} is disabled. Set NEXT_API_${endpoint.toUpperCase()}_ENABLED=true to enable.`,
    },
    { status: 503 },
  );
}
