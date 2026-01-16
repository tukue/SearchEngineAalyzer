import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { AuditRequest } from "@shared/schema";
import { formatZodError } from "@shared/validation";
import { analyzeUrl } from "@server/services/analysis";
import { UsageLimitsService } from "@server/usage-limits";
import { storage } from "@server/storage";
import { buildError, sendError } from "@server/api-errors";
import { resolveAuthContext } from "@server/serverless-auth";
import { checkRateLimit } from "@server/services/rate-limit";
import { saveAuditRecord, type AuditRecord } from "@server/services/audit-store";
import { validatePublicHttpsUrl } from "@server/url-safety";

const REQUEST_TIMEOUT_MS = 9000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const RETRIES = 1;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, 405, "NOT_FOUND", "Endpoint not found");
  }

  const authResult = await resolveAuthContext(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json(authResult.error);
  }

  const tenantContext = authResult.context;

  const rateLimitResult = await checkRateLimit(`audit:${tenantContext.tenantId}`);
  if (!rateLimitResult.allowed) {
    res.setHeader("Retry-After", String(rateLimitResult.retryAfter ?? 60));
    return res
      .status(429)
      .json(buildError("RATE_LIMITED", "Too many audit requests. Try again soon."));
  }

  let requestId: string | null = null;
  let auditUrl: string | null = null;

  try {
    const rawPayload = req.body as Partial<AuditRequest>;
    const providedUrl = typeof rawPayload?.url === "string" ? rawPayload.url.trim() : "";
    const normalizedInput = providedUrl.startsWith("http://") || providedUrl.startsWith("https://")
      ? providedUrl
      : `https://${providedUrl}`;

    const payload = AuditRequest.parse({
      ...rawPayload,
      url: normalizedInput,
    });
    requestId = payload.requestId ?? UsageLimitsService.generateRequestId();

    const normalizedUrl = await validatePublicHttpsUrl(payload.url, `tenant=${tenantContext.tenantId}`);
    auditUrl = normalizedUrl.toString();

    if (tenantContext.role === "read-only") {
      return sendError(res, 403, "FORBIDDEN", "Insufficient role for this action");
    }

    const reservation = await UsageLimitsService.reserveAuditQuota(
      tenantContext.tenantId,
      requestId,
      payload.auditType,
      auditUrl,
      tenantContext.userId,
    );

    if (!reservation.success) {
      return res.status(429).json(
        buildError("QUOTA_EXCEEDED", reservation.error?.message || "Quota exceeded", {
          quota: reservation.quotaStatus,
          details: reservation.error,
        }),
      );
    }

    const auditId = requestId;
    const auditRecord: AuditRecord = {
      id: auditId,
      status: "processing",
      url: auditUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveAuditRecord(auditRecord);

    const analysisResult = await analyzeUrl(auditUrl, {
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      auditType: payload.auditType,
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxBytes: MAX_RESPONSE_BYTES,
      retries: RETRIES,
      retryDelayMs: 250,
    });

    const storedAnalysis = await storage.createAnalysis(tenantContext.tenantId, analysisResult);
    await UsageLimitsService.completeAudit(tenantContext.tenantId, requestId);
    await storage.incrementUsage(tenantContext.tenantId, "audit");

    const completedRecord: AuditRecord = {
      ...auditRecord,
      status: "completed",
      updatedAt: new Date().toISOString(),
      result: storedAnalysis,
    };

    await saveAuditRecord(completedRecord);

    return res.status(200).json({
      status: "completed",
      auditId,
      result: storedAnalysis,
      quota: reservation.quotaStatus,
    });
  } catch (error) {
    if (requestId) {
      try {
        await UsageLimitsService.failAudit(tenantContext.tenantId, requestId, true);
      } catch (failError) {
        console.error("Failed to mark audit as failed:", failError);
      }

      if (auditUrl) {
        try {
          await saveAuditRecord({
            id: requestId,
            status: "failed",
            url: auditUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            error: {
              code: "INTERNAL_ERROR",
              message: error instanceof Error ? error.message : "Audit failed",
            },
          });
        } catch (storeError) {
          console.error("Failed to persist audit failure:", storeError);
        }
      }
    }

    if (error instanceof z.ZodError) {
      const validationError = formatZodError(error);
      return sendError(res, 400, "VALIDATION_ERROR", validationError || "Invalid request format");
    }

    if ((error as any).status) {
      return sendError(res, (error as any).status, "UPSTREAM_ERROR", (error as Error).message);
    }

    console.error("Error analyzing website:", error);
    return sendError(res, 500, "INTERNAL_ERROR", "Failed to analyze website");
  }
}
