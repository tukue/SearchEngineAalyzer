import dns from "dns/promises";
import type { LookupAddress } from "dns";
import net from "net";
import type { RequestInit, Response } from "node-fetch";

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

type FetchWithNetworkLimitsOptions = RequestInit & {
  timeoutMs?: number;
  maxBytes?: number;
  logContext?: string;
};

function safetyLog(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [url-safety] ${message}`);
}

let cachedFetchPromise: Promise<Fetcher> | null = null;

async function loadFetch(): Promise<Fetcher> {
  if (!cachedFetchPromise) {
    cachedFetchPromise = import("node-fetch").then((mod) => (mod.default ?? mod) as Fetcher);
  }

  return cachedFetchPromise;
}

export function createHttpError(message: string, status = 400): Error {
  const error = new Error(message);
  (error as any).status = status;
  return error;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "::" ||
    normalized.endsWith(".localhost")
  );
}

function isPrivateAddress(address: string, family?: number): boolean {
  const ipFamily = family ?? net.isIP(address);

  if (ipFamily === 0) {
    return true;
  }

  if (ipFamily === 4) {
    const parts = address.split(".");
    if (parts.length !== 4) {
      return true;
    }

    const [first, second, third, fourth] = parts.map((part) => {
      const num = parseInt(part, 10);
      return isNaN(num) || num < 0 || num > 255 ? -1 : num;
    });

    if ([first, second, third, fourth].some((num) => num === -1)) {
      return true;
    }

    return (
      first === 10 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first === 127 ||
      (first === 169 && second === 254) ||
      address === "0.0.0.0"
    );
  }

  if (ipFamily === 6) {
    const normalized = address.toLowerCase();

    // IPv4-mapped IPv6 (e.g., ::ffff:10.0.0.1)
    const mappedMatch = normalized.match(/^::ffff:(.+)$/);
    if (mappedMatch && mappedMatch[1]) {
      return isPrivateAddress(mappedMatch[1], 4);
    }

    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") || // fc00::/7 unique local
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("ff") || // multicast
      normalized.startsWith("::ffff:") // IPv4-mapped (already handled, kept for redundancy)
    );
  }

  return false;
}

function logBlockedAttempt(reason: string, targetUrl: string, logContext?: string) {
  const context = logContext ? ` context=${logContext}` : "";
  safetyLog(`Blocked target URL: ${reason} url=${targetUrl}${context}`);
}

export async function validatePublicHttpsUrl(rawUrl: string, logContext?: string): Promise<URL> {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch (error) {
    throw createHttpError("Invalid URL format");
  }

  if (parsedUrl.protocol !== "https:") {
    logBlockedAttempt("non-HTTPS scheme", rawUrl, logContext);
    throw createHttpError("Only HTTPS URLs are allowed");
  }

  const hostname = parsedUrl.hostname;

  const literalFamily = net.isIP(hostname);
  if (literalFamily) {
    if (isPrivateAddress(hostname, literalFamily)) {
      logBlockedAttempt("literal address is private or reserved", rawUrl, logContext);
      throw createHttpError("Target host is not allowed");
    }
    return parsedUrl;
  }

  if (isBlockedHostname(hostname)) {
    logBlockedAttempt("localhost or reserved hostname", rawUrl, logContext);
    throw createHttpError("Target host is not allowed");
  }

  let lookupResults: LookupAddress[];
  try {
    lookupResults = await dns.lookup(hostname, { all: true });
  } catch (error) {
    throw createHttpError("Could not resolve the target host");
  }

  if (lookupResults.length === 0) {
    throw createHttpError("Could not resolve the target host");
  }

  const blockedResolution = lookupResults.find(({ address, family }) => isPrivateAddress(address, family));
  if (blockedResolution) {
    logBlockedAttempt(`private or loopback address (${blockedResolution.address})`, rawUrl, logContext);
    throw createHttpError("Target resolves to a disallowed address");
  }

  return parsedUrl;
}

export async function fetchWithNetworkLimits(
  targetUrl: string,
  options: FetchWithNetworkLimitsOptions = {},
): Promise<Response> {
  const fetch = await loadFetch();
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_RESPONSE_BYTES, logContext, ...fetchOptions } =
    options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("Fetch timeout exceeded")), timeoutMs);

  try {
    return await fetch(targetUrl, {
      ...fetchOptions,
      signal: controller.signal,
      size: maxBytes,
    });
  } catch (error) {
    if (logContext) {
      safetyLog(
        `Network fetch failed for url=${targetUrl} context=${logContext}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
