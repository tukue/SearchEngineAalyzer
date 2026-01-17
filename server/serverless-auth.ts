import type { VercelRequest } from "@vercel/node";
import { storage } from "./storage";
import type { AuthenticatedTenantContext, TenantRole } from "./context";
import { buildError, type ApiErrorResponse } from "./api-errors";

type TokenConfig = {
  token: string;
  tenantId: number;
  userId: string;
  role?: TenantRole;
  label?: string;
};

const tokenConfigs: TokenConfig[] = [];
const tokenLookup = new Map<string, TokenConfig>();

const isAuthDisabled = () =>
  process.env.API_AUTH_DISABLED === "true" ||
  process.env.API_AUTH_TOKEN === "disabled";

function loadConfiguredTokens(): TokenConfig[] {
  if (tokenConfigs.length) {
    return tokenConfigs;
  }

  if (isAuthDisabled()) {
    return tokenConfigs;
  }

  const configuredList = process.env.API_AUTH_TOKENS;
  if (configuredList) {
    try {
      const parsed = JSON.parse(configuredList);
      if (Array.isArray(parsed)) {
        parsed.forEach((entry, index) => {
          if (entry?.token && entry?.tenantId && entry?.userId) {
            tokenConfigs.push({
              token: String(entry.token),
              tenantId: Number(entry.tenantId),
              userId: String(entry.userId),
              role: (entry.role as TenantRole) || "member",
              label: entry.label || `token-${index + 1}`,
            });
          }
        });
      }
    } catch (error) {
      console.error("Failed to parse API_AUTH_TOKENS:", error);
    }
  }

  const singleToken = process.env.API_AUTH_TOKEN;
  if (singleToken) {
    tokenConfigs.push({
      token: singleToken,
      tenantId: Number(process.env.API_TENANT_ID || 1),
      userId: process.env.API_USER_ID || "dev-user",
      role: (process.env.API_USER_ROLE as TenantRole) || "owner",
      label: "default",
    });
  }

  if (tokenConfigs.length === 0) {
    if (process.env.NODE_ENV === "test") {
      const testToken = process.env.TEST_API_TOKEN || "test-token";
      tokenConfigs.push({
        token: testToken,
        tenantId: Number(process.env.API_TENANT_ID || 1),
        userId: process.env.API_USER_ID || "test-user",
        role: (process.env.API_USER_ROLE as TenantRole) || "owner",
        label: "test-default",
      });
    } else {
      throw new Error("API_AUTH_TOKEN or API_AUTH_TOKENS environment variable is required");
    }
  }

  tokenConfigs.forEach((token) => tokenLookup.set(token.token, token));
  return tokenConfigs;
}

const roleHierarchy: TenantRole[] = ["read-only", "member", "owner"];

function applyRoleOverride(baseRole: TenantRole, requestedRole?: string | null): TenantRole {
  if (!requestedRole) return baseRole;

  const normalized = requestedRole as TenantRole;
  if (!roleHierarchy.includes(normalized)) return baseRole;

  const baseRank = roleHierarchy.indexOf(baseRole);
  const requestedRank = roleHierarchy.indexOf(normalized);

  return requestedRank <= baseRank ? normalized : baseRole;
}

function extractToken(req: VercelRequest): string | null {
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  const apiToken = req.headers?.["x-api-token"];
  if (Array.isArray(apiToken)) {
    return apiToken[0] ?? null;
  }
  return apiToken ? String(apiToken).trim() : null;
}

export type AuthResult =
  | { ok: true; context: AuthenticatedTenantContext }
  | { ok: false; status: number; error: ApiErrorResponse };

export async function resolveAuthContext(req: VercelRequest): Promise<AuthResult> {
  if (isAuthDisabled()) {
    const tenant = await storage.getTenant(1);
    if (!tenant) {
      return {
        ok: false,
        status: 500,
        error: buildError("INTERNAL_ERROR", "Default tenant not found"),
      };
    }

    return {
      ok: true,
      context: {
        tenantId: tenant.id,
        plan: tenant.plan as AuthenticatedTenantContext["plan"],
        userId: "testing-user",
        role: "owner",
        tokenLabel: "auth-disabled",
      },
    };
  }

  loadConfiguredTokens();

  const token = extractToken(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: buildError("UNAUTHORIZED", "Authentication required"),
    };
  }

  const config = tokenLookup.get(token);
  if (!config) {
    return {
      ok: false,
      status: 401,
      error: buildError("UNAUTHORIZED", "Invalid or expired token"),
    };
  }

  const tenant = await storage.getTenant(config.tenantId);
  if (!tenant) {
    return {
      ok: false,
      status: 500,
      error: buildError("INTERNAL_ERROR", "Configured tenant not found"),
    };
  }

  const requestedRoleHeader = req.headers?.["x-tenant-role"];
  const requestedRole = Array.isArray(requestedRoleHeader)
    ? requestedRoleHeader[0]
    : requestedRoleHeader;

  return {
    ok: true,
    context: {
      tenantId: tenant.id,
      plan: tenant.plan as AuthenticatedTenantContext["plan"],
      userId: config.userId,
      role: applyRoleOverride(config.role || "member", requestedRole ?? null),
      tokenLabel: config.label,
    },
  };
}
