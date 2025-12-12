import { Request, Response, NextFunction } from "express";

export type TenantContext = {
  tenantId: string;
  userId: string;
};

export interface TenantScopedRequest extends Request {
  tenant?: TenantContext;
}

export function tenantMiddleware(req: TenantScopedRequest, _res: Response, next: NextFunction) {
  const tenantId = (req.headers["x-tenant-id"] as string) || "demo-tenant";
  const userId = (req.headers["x-user-id"] as string) || "demo-user";

  req.tenant = { tenantId, userId };
  next();
}
