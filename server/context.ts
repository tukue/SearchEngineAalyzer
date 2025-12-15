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
  const role = (req.header("x-tenant-role") as TenantRole) || "member";

  if (!tenantId || !userId) {
    return res.status(401).json({ message: "Missing tenant context" });
  }

  req.tenantContext = { tenantId, userId, role };
  next();
}
