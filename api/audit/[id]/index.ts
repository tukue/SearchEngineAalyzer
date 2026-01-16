import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildError, sendError } from "@server/api-errors";
import { resolveAuthContext } from "@server/serverless-auth";
import { getAuditRecord } from "@server/services/audit-store";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendError(res, 405, "NOT_FOUND", "Endpoint not found");
  }

  const authResult = await resolveAuthContext(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json(authResult.error);
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id || typeof id !== "string") {
    return sendError(res, 400, "VALIDATION_ERROR", "Audit id is required");
  }

  const record = await getAuditRecord(id);
  if (!record) {
    return res.status(404).json(buildError("NOT_FOUND", "Audit not found"));
  }

  return res.status(200).json(record);
}
