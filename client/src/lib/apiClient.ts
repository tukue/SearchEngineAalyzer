import { AuditRequest, type AnalysisResult } from "@shared/schema";

export type AuditCreateResponse = {
  status: "completed" | "processing";
  auditId: string;
  result?: AnalysisResult;
  quota?: AnalysisResult["quota"];
};

export type AuditStatusResponse = {
  id: string;
  status: "processing" | "completed" | "failed";
  url: string;
  createdAt: string;
  updatedAt: string;
  result?: AnalysisResult;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

function buildHeaders(): Record<string, string> {
  const token =
    typeof import.meta !== "undefined"
      ? (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_TOKEN
      : undefined;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function parseApiError(body: ApiError | { message?: string }): Error {
  if ("error" in body && body.error?.message) {
    return new Error(body.error.message);
  }

  return new Error(body.message || "Request failed");
}

export async function createAudit(payload: AuditRequest): Promise<AuditCreateResponse> {
  const res = await fetch("/api/audit", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as AuditCreateResponse | ApiError | { message?: string };
  if (!res.ok) {
    throw parseApiError(data as ApiError);
  }

  return data as AuditCreateResponse;
}

export async function fetchAuditStatus(auditId: string): Promise<AuditStatusResponse> {
  const res = await fetch(`/api/audit/${auditId}`, {
    headers: buildHeaders(),
  });

  const data = (await res.json()) as AuditStatusResponse | ApiError | { message?: string };
  if (!res.ok) {
    throw parseApiError(data as ApiError);
  }

  return data as AuditStatusResponse;
}
