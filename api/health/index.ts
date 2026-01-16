import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildHealthResponse } from "@shared/health";
import { sendError } from "@server/api-errors";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendError(res, 405, "NOT_FOUND", "Endpoint not found");
  }

  return res.status(200).json(buildHealthResponse());
}
