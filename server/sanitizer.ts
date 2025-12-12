import { z } from "zod";

/**
 * URL Sanitization - KISS principle: Simple, focused validation
 */
export const urlSchema = z.string()
  .trim()
  .min(1, "URL is required")
  .max(2048, "URL too long")
  .refine((url) => {
    const normalizedUrl = url.startsWith('http://') || url.startsWith('https://') 
      ? url 
      : `https://${url}`;
    
    try {
      const parsed = new URL(normalizedUrl);
      
      // Block localhost and private IPs (SSRF protection)
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === 'localhost' || 
          hostname === '127.0.0.1' || 
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.16.') ||
          hostname.includes('::1')) {
        return false;
      }
      
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, "Invalid or blocked URL");

export function sanitizeUrl(input: string): string {
  const validated = urlSchema.parse(input);
  const normalizedUrl = validated.startsWith('http://') || validated.startsWith('https://') 
    ? validated 
    : `https://${validated}`;
  return new URL(normalizedUrl).toString();
}