import { createHmac, timingSafeEqual } from "crypto";

export type SupabaseJwtClaims = {
  sub: string;
  role?: string;
  aud?: string | string[];
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  tenant_id?: string | number;
  exp?: number;
};

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLength), "base64");
}

export async function verifySupabaseJwt(token: string): Promise<SupabaseJwtClaims | null> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return null;
  const audience = process.env.SUPABASE_JWT_AUDIENCE;

  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      return null;
    }

    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createHmac("sha256", secret).update(data).digest();
    const signature = base64UrlDecode(encodedSignature);

    if (signature.length !== expectedSignature.length) {
      return null;
    }

    if (!timingSafeEqual(signature, expectedSignature)) {
      return null;
    }

    const payloadJson = base64UrlDecode(encodedPayload).toString("utf-8");
    const payload = JSON.parse(payloadJson) as SupabaseJwtClaims;

    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    if (audience) {
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audiences.includes(audience)) {
        return null;
      }
    }

    return payload;
  } catch (error) {
    console.warn("Supabase JWT verification failed", error);
    return null;
  }
}
