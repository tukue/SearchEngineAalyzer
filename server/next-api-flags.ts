export type NextApiEndpoint = "plan" | "quota" | "history" | "analyze" | "export";

function getFlagName(endpoint: NextApiEndpoint): string {
  return `NEXT_API_${endpoint.toUpperCase()}_ENABLED`;
}

export function isNextApiEnabled(endpoint: NextApiEndpoint): boolean {
  const flagName = getFlagName(endpoint);
  return process.env[flagName] === "true";
}
