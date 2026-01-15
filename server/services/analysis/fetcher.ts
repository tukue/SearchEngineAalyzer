import { createHttpError, fetchWithNetworkLimits, validatePublicHttpsUrl } from "../../url-safety";
import { AnalyzerOptions } from "./types";

export class UrlFetcher {
  static async fetch(url: string, options?: AnalyzerOptions): Promise<string> {
    if (!url || typeof url !== "string") {
      throw createHttpError("Invalid URL parameter");
    }

    const parsedUrl = await validatePublicHttpsUrl(url, options?.tenantId ? `tenant=${options.tenantId}` : undefined);

    try {
      const response = await fetchWithNetworkLimits(parsedUrl.toString(), {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MetaTagAnalyzer/1.0)",
        },
      });

      if (!response.ok) {
        throw createHttpError(`Failed to fetch website: ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw createHttpError(`Failed to connect to the website: ${message}`);
    }
  }
}
