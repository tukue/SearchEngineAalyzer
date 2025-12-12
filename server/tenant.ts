import { Request, Response, NextFunction } from "express";

export type TenantContext = {
  tenantId: string;
  userId: string;
};

export interface TenantScopedRequest extends Request {
  tenant?: TenantContext;
}

export function tenantMiddleware(req: TenantScopedRequest, res: Response, next: NextFunction) {
  const tenantId = req.headers["x-tenant-id"] as string;
  const userId = req.headers["x-user-id"] as string;

  // Require tenant context for API routes (except health check)
  if (req.path !== '/health' && (!tenantId || !userId)) {
    return res.status(401).json({ message: "Missing tenant authentication" });
  }

  if (tenantId && userId) {
    req.tenant = { tenantId, userId };
  }
  
  next();
}
