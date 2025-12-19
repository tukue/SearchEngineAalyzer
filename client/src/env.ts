export type ClientEnv = {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TOKEN?: string;
};

const env: ClientEnv = {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_API_TOKEN: import.meta.env.VITE_API_TOKEN,
};

const normalizeBaseUrl = (value?: string) => {
  if (!value) return "/api";
  const trimmed = value.trim();
  if (!trimmed) return "/api";
  const withoutTrailing = trimmed.replace(/\/+$/, "");
  return withoutTrailing.startsWith("http") || withoutTrailing.startsWith("/")
    ? withoutTrailing
    : `https://${withoutTrailing}`;
};

export const apiBaseUrl = normalizeBaseUrl(env.VITE_API_BASE_URL);
export const apiToken = env.VITE_API_TOKEN?.trim() || undefined;
export { env };
