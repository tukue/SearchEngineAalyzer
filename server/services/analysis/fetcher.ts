import { createHttpError, fetchWithNetworkLimits, validatePublicHttpsUrl } from "../../url-safety";
import { AnalyzerOptions } from "./types";

export class UrlFetcher {
  static async fetch(url: string, options?: AnalyzerOptions): Promise<string> {
    if (!url || typeof url !== "string") {
      throw createHttpError("Invalid URL parameter");
    }

    const parsedUrl = await validatePublicHttpsUrl(url, options?.tenantId ? `tenant=${options.tenantId}` : undefined);

    const retries = options?.retries ?? 1;
    const retryDelayMs = options?.retryDelayMs ?? 250;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetchWithNetworkLimits(parsedUrl.toString(), {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; MetaTagAnalyzer/1.0)",
          },
          timeoutMs: options?.timeoutMs,
          maxBytes: options?.maxBytes,
          logContext: options?.tenantId ? `tenant=${options.tenantId}` : undefined,
        });

        if (!response.ok) {
          throw createHttpError(`Failed to fetch website: ${response.status} ${response.statusText}`);
        }

        return await response.text();
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }
      }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw createHttpError(`Failed to connect to the website: ${message}`);
  }
}
