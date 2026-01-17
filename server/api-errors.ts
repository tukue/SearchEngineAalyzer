import type { VercelResponse } from "@vercel/node";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR"
  | "QUOTA_EXCEEDED"
  | "PLAN_UPGRADE_REQUIRED";

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
};

export function buildError(code: ApiErrorCode, message: string, details?: unknown): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      details,
    },
  };
}

export function sendError(
  res: VercelResponse,
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) {
  return res.status(status).json(buildError(code, message, details));
}
