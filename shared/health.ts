import packageJson from "../package.json";

export type HealthResponse = {
  status: "ok";
  message: string;
  timestamp: string;
  version: string;
};

export function buildHealthResponse(): HealthResponse {
  return {
    status: "ok",
    message: "Meta Tag Analyzer API is healthy",
    timestamp: new Date().toISOString(),
    version: packageJson.version
  };
}
