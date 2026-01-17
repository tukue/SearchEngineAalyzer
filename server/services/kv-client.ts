const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

export const isKvConfigured = () => Boolean(KV_URL && KV_TOKEN);

async function kvCommand<T>(command: string, ...args: string[]): Promise<T | null> {
  if (!KV_URL || !KV_TOKEN) {
    return null;
  }

  const encodedArgs = args.map((arg) => encodeURIComponent(arg));
  const url = `${KV_URL}/${command}/${encodedArgs.join("/")}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`KV request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { result?: T };
  return data.result ?? null;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const result = await kvCommand<T>("get", key);
  if (typeof result === "string") {
    try {
      return JSON.parse(result) as T;
    } catch {
      return result as T;
    }
  }
  return result ?? null;
}

export async function kvSet<T>(key: string, value: T, ttlSeconds: number) {
  const serialized = JSON.stringify(value);
  await kvCommand("set", key, serialized);
  await kvCommand("expire", key, String(ttlSeconds));
}

export async function kvIncr(key: string, ttlSeconds: number): Promise<number | null> {
  const count = await kvCommand<number>("incr", key);
  if (count === 1) {
    await kvCommand("expire", key, String(ttlSeconds));
  }
  return count ?? null;
}
