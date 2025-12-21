import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function resolveApiToken(): string {
  const fromProcess =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_API_TOKEN ?? process.env.VITE_API_TOKEN
      : undefined;

  if (fromProcess) {
    return fromProcess;
  }

  const fromImportMeta =
    typeof import.meta !== "undefined"
      ? (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_TOKEN
      : undefined;

  if (fromImportMeta) {
    return fromImportMeta;
  }

  throw new Error("NEXT_PUBLIC_API_TOKEN (or VITE_API_TOKEN) environment variable is required");
}

const defaultTenantHeaders: Record<string, string> = {
  get Authorization() {
    return `Bearer ${resolveApiToken()}`;
  },
};

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      ...defaultTenantHeaders,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      headers: defaultTenantHeaders,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
