import { NextFunction, Request, Response } from "express";

export type TenantRole = "owner" | "member" | "read-only";

export type TenantContext = {
  tenantId: string;
  userId: string;
  role: TenantRole;
};

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

export function requireTenantContext(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.header("x-tenant-id") || "";
  const userId = req.header("x-user-id") || "";
  const roleHeader = req.header("x-tenant-role");
  const validRoles: TenantRole[] = ["owner", "member", "read-only"];
  const role: TenantRole = validRoles.includes(roleHeader as TenantRole)
    ? (roleHeader as TenantRole)
    : "member";

  if (!tenantId || !userId) {
    return res.status(401).json({ message: "Missing tenant context" });
  }

  req.tenantContext = { tenantId, userId, role };
  next();
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
