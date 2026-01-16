import { kvIncr, isKvConfigured } from "./kv-client";

const DEFAULT_WINDOW_SECONDS = 60;
const DEFAULT_MAX_REQUESTS = 15;

export type RateLimitResult = {
  allowed: boolean;
  limit?: number;
  remaining?: number;
  retryAfter?: number;
  enforced: boolean;
};

export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  const windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? DEFAULT_WINDOW_SECONDS);
  const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? DEFAULT_MAX_REQUESTS);

  if (!isKvConfigured()) {
    return { allowed: true, enforced: false };
  }

  const key = `rate:${identifier}`;
  let count: number | null = null;
  try {
    count = await kvIncr(key, windowSeconds);
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return { allowed: true, enforced: false };
  }

  if (count === null) {
    return { allowed: true, enforced: false };
  }

  const remaining = Math.max(0, maxRequests - count);
  return {
    allowed: count <= maxRequests,
    limit: maxRequests,
    remaining,
    retryAfter: count > maxRequests ? windowSeconds : undefined,
    enforced: true,
  };
}
