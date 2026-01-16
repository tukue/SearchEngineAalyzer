import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendError } from "@server/api-errors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return sendError(res, 404, "NOT_FOUND", "API endpoint not found");
}
