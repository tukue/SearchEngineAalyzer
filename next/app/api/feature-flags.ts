const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export function isNextFrameworkEnabled() {
  const rawValue = process.env.NEXT_FRAMEWORK_ENABLED;
  if (!rawValue) {
    return false;
  }

  return ENABLED_VALUES.has(rawValue.trim().toLowerCase());
}

export function isNextEndpointEnabled(endpoint: string) {
  const migratedEndpoints = process.env.NEXT_MIGRATED_API_ENDPOINTS
    ?.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!migratedEndpoints || migratedEndpoints.length === 0) {
    return true;
  }

  return migratedEndpoints.includes(endpoint.toLowerCase());
}
