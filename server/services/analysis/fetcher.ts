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

      const html = await response.text();
      const finalUrl = response.url || parsedUrl.toString();
      const final = new URL(finalUrl);
      const robotsTxtFound = await fetchHeadLike(`${final.origin}/robots.txt`, headers);
      const sitemapFound = await fetchHeadLike(`${final.origin}/sitemap.xml`, headers);

      return {
        html,
        metrics: {
          requestedUrl: parsedUrl.toString(),
          finalUrl,
          status: response.status,
          redirected: response.redirected,
          redirectCount: response.redirected ? 1 : 0,
          responseTimeMs,
          contentType: response.headers.get("content-type") || undefined,
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
