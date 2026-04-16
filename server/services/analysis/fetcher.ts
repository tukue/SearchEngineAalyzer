import { createHttpError, fetchWithNetworkLimits, validatePublicHttpsUrl } from "../../url-safety";
import { AnalyzerOptions, CrawlMetrics } from "./types";

type FetchResult = {
  html: string;
  metrics: CrawlMetrics;
};

const MAX_RETRIES = 1;
const REQUEST_TIMEOUT_MS = 7000;

async function fetchTextWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchWithNetworkLimits(url, {
        timeoutMs: REQUEST_TIMEOUT_MS,
        headers,
        redirect: "follow",
      });
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

async function fetchHeadLike(url: string, headers: Record<string, string>): Promise<boolean> {
  try {
    const response = await fetchWithNetworkLimits(url, {
      timeoutMs: 3500,
      method: "GET",
      headers,
      redirect: "follow",
      maxBytes: 8 * 1024,
    });

    return response.ok;
  } catch {
    return false;
  }
}

function readHeader(response: unknown, headerName: string): string | undefined {
  if (!response || typeof response !== "object") return undefined;
  const headers = (response as any).headers;
  if (!headers) return undefined;

  if (typeof headers.get === "function") {
    const value = headers.get(headerName);
    return typeof value === "string" ? value : undefined;
  }

  if (headers instanceof Map) {
    const value = headers.get(headerName);
    return typeof value === "string" ? value : undefined;
  }

  if (typeof headers === "object") {
    const value = headers[headerName] || headers[headerName.toLowerCase()];
    return typeof value === "string" ? value : undefined;
  }

  return undefined;
}

function deriveRedirectCount(response: unknown): number {
  if (!response || typeof response !== "object") return 0;
  const candidate = response as any;

  if (typeof candidate.redirectCount === "number" && Number.isFinite(candidate.redirectCount)) {
    return Math.max(0, Math.trunc(candidate.redirectCount));
  }

  if (Array.isArray(candidate.redirectedUrls)) {
    return Math.max(0, candidate.redirectedUrls.length);
  }

  if (Array.isArray(candidate.urls)) {
    return Math.max(0, candidate.urls.length - 1);
  }

  if (typeof candidate.redirected === "number" && Number.isFinite(candidate.redirected)) {
    return Math.max(0, Math.trunc(candidate.redirected));
  }

  return Boolean(candidate.redirected) ? 1 : 0;
}

export class UrlFetcher {
  static async fetch(url: string, options?: AnalyzerOptions): Promise<FetchResult> {
    if (!url || typeof url !== "string") {
      throw createHttpError("Invalid URL parameter");
    }

    const parsedUrl = await validatePublicHttpsUrl(url, options?.tenantId ? `tenant=${options.tenantId}` : undefined);

    const headers = {
      "User-Agent": "Mozilla/5.0 (compatible; SEOAnalyzerBot/2.0)",
      Accept: "text/html,application/xhtml+xml",
    };

    try {
      const startedAt = Date.now();
      const response = await fetchTextWithRetry(parsedUrl.toString(), headers);
      const responseTimeMs = Date.now() - startedAt;

      if (!response.ok) {
        throw createHttpError(`Failed to fetch website: ${response.status} ${response.statusText}`);
      }

      const html = typeof response.text === "function" ? await response.text() : "";
      const finalUrl =
        typeof (response as any).url === "string" && (response as any).url.length > 0
          ? (response as any).url
          : parsedUrl.toString();
      const final = new URL(finalUrl);
      const robotsTxtFound = await fetchHeadLike(`${final.origin}/robots.txt`, headers);
      const sitemapFound = await fetchHeadLike(`${final.origin}/sitemap.xml`, headers);
      const redirected = Boolean((response as any).redirected);
      const redirectCount = deriveRedirectCount(response);

      return {
        html,
        metrics: {
          requestedUrl: parsedUrl.toString(),
          finalUrl,
          status: typeof response.status === "number" ? response.status : 200,
          redirected,
          redirectCount,
          responseTimeMs,
          contentType: readHeader(response, "content-type"),
          robotsTxtFound,
          sitemapFound,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw createHttpError(`Failed to connect to the website: ${message}`);
    }
  }
}
