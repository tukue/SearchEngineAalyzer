import { apiBaseUrl, apiToken } from "@/env";

const buildApiUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) return path;

  const normalizedBase = apiBaseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (normalizedBase === "/api") {
    return normalizedPath.startsWith("/api")
      ? normalizedPath
      : `${normalizedBase}${normalizedPath}`;
  }

  if (normalizedBase.endsWith("/api") && normalizedPath.startsWith("/api")) {
    return `${normalizedBase}${normalizedPath.replace(/^\/api/, "")}`;
  }

  return `${normalizedBase}${normalizedPath}`;
};

const buildHeaders = (headers?: HeadersInit, hasJsonBody?: boolean) => {
  const merged = new Headers(headers);

  if (apiToken) {
    merged.set("Authorization", `Bearer ${apiToken}`);
  }

  if (hasJsonBody && !merged.has("Content-Type")) {
    merged.set("Content-Type", "application/json");
  }

  return merged;
};

export const apiFetch = async (path: string, init?: RequestInit) => {
  const url = buildApiUrl(path);
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: buildHeaders(init?.headers, Boolean(init?.body)),
  });

  return response;
};

const throwIfResNotOk = async (res: Response) => {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const error = new Error(`${res.status}: ${text}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }
};

export const apiRequest = async (
  method: string,
  path: string,
  data?: unknown,
  init?: RequestInit,
) => {
  const body = data !== undefined ? JSON.stringify(data) : undefined;
  const response = await apiFetch(path, {
    ...init,
    method,
    body,
  });

  await throwIfResNotOk(response);
  return response;
};

export const apiJson = async <T>(
  method: string,
  path: string,
  data?: unknown,
  init?: RequestInit,
): Promise<T> => {
  const response = await apiRequest(method, path, data, init);
  return (await response.json()) as T;
};

export { buildApiUrl };
