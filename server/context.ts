import { NextFunction, Request, Response } from "express";
import { TenantContext } from "@shared/schema";
import { storage } from "./storage";

export type TenantRole = "owner" | "member" | "read-only";

export type AuthenticatedTenantContext = TenantContext & {
  userId: string;
  role: TenantRole;
  tokenLabel?: string;
};

type TokenConfig = {
  token: string;
  tenantId: number;
  userId: string;
  role?: TenantRole;
  label?: string;
};

const tokenConfigs: TokenConfig[] = [];

function loadConfiguredTokens(): TokenConfig[] {
  if (tokenConfigs.length) {
    return tokenConfigs;
  }

  // Skip token loading if authentication is disabled (only for test environment)
  if (process.env.API_AUTH_TOKEN === 'disabled' && process.env.NODE_ENV === 'test') {
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

  return tokenConfigs;
}

const tokenLookup = new Map<string, TokenConfig>();

// Only initialize token lookup if authentication is not disabled in test environment
if (process.env.API_AUTH_TOKEN !== 'disabled' || process.env.NODE_ENV !== 'test') {
  for (const token of loadConfiguredTokens()) {
    tokenLookup.set(token.token, token);
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.header("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  const apiToken = req.header("x-api-token");
  return apiToken ? apiToken.trim() : null;
}

const roleHierarchy: TenantRole[] = ["read-only", "member", "owner"];

function applyRoleOverride(baseRole: TenantRole, requestedRole?: string | null): TenantRole {
  if (!requestedRole) return baseRole;

  const normalized = requestedRole as TenantRole;
  if (!roleHierarchy.includes(normalized)) return baseRole;

  const baseRank = roleHierarchy.indexOf(baseRole);
  const requestedRank = roleHierarchy.indexOf(normalized);

  // Only allow equal or lower privileges than the token allows
  return requestedRank <= baseRank ? normalized : baseRole;
}

async function resolveTenantContext(token: string, requestedRole?: string | null): Promise<AuthenticatedTenantContext | null> {
  const config = tokenLookup.get(token);
  if (!config) return null;

  const tenant = await storage.getTenant(config.tenantId);
  if (!tenant) {
    console.error(`Configured auth token references missing tenant ${config.tenantId}`);
    return null;
  }

  return {
    tenantId: tenant.id,
    plan: tenant.plan as AuthenticatedTenantContext["plan"],
    userId: config.userId,
    role: applyRoleOverride(config.role || "member", requestedRole),
    tokenLabel: config.label,
  };
}

export async function requireAuthContext(req: Request, res: Response, next: NextFunction) {
  // Skip authentication if API_AUTH_TOKEN is set to 'disabled' for testing
  if (process.env.API_AUTH_TOKEN === 'disabled' && process.env.NODE_ENV === 'test') {
    // Create a default test tenant context
    const tenant = await storage.getTenant(1);
    if (!tenant) {
      return res.status(500).json({ message: "Test tenant not found" });
    }
    req.tenantContext = {
      tenantId: tenant.id,
      plan: tenant.plan as AuthenticatedTenantContext["plan"],
      userId: "test-user",
      role: "owner",
      tokenLabel: "test-disabled",
    };
    return next();
  }

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const tenantContext = await resolveTenantContext(token, req.header("x-tenant-role"));
    if (!tenantContext) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.authToken = token;
    req.tenantContext = tenantContext;
    next();
  } catch (error) {
    console.error("Failed to resolve tenant context from token:", error);
    res.status(500).json({ message: "Failed to authenticate request" });
  }
}

export function requireRole(allowed: TenantRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = req.tenantContext;
    if (!context) {
      return res.status(401).json({ message: "Missing tenant context" });
    }

    if (!allowed.includes(context.role)) {
      return res.status(403).json({ message: "Insufficient role for this action" });
    }

    next();
  };
}

declare global {
  namespace Express {
    interface Request {
      tenantContext?: AuthenticatedTenantContext;
      authToken?: string;
    }
  }
}
