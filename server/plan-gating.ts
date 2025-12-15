import { Request, Response, NextFunction } from "express";
import { PLAN_CONFIGS, PlanType, TenantContext, PlanGatingError } from "@shared/schema";

// Plan gating service
export class PlanGatingService {
  static checkEntitlement(tenantContext: TenantContext, feature: keyof typeof PLAN_CONFIGS.free): boolean {
    const planConfig = PLAN_CONFIGS[tenantContext.plan];
    return planConfig[feature] as boolean;
  }

  static getQuotaLimit(tenantContext: TenantContext, quota: keyof typeof PLAN_CONFIGS.free): number {
    const planConfig = PLAN_CONFIGS[tenantContext.plan];
    return planConfig[quota] as number;
  }

  static createPlanError(feature: string, currentPlan: string, requiredPlan?: string): PlanGatingError {
    return {
      code: "PLAN_UPGRADE_REQUIRED",
      feature,
      currentPlan,
      requiredPlan: requiredPlan || "pro",
      message: `${feature} requires ${requiredPlan || "pro"} plan. Current plan: ${currentPlan}`
    };
  }

  static createQuotaError(feature: string, currentPlan: string): PlanGatingError {
    return {
      code: "QUOTA_EXCEEDED",
      feature,
      currentPlan,
      message: `Monthly ${feature} quota exceeded for ${currentPlan} plan`
    };
  }
}

// Middleware to require specific entitlements
export function requireEntitlement(feature: keyof typeof PLAN_CONFIGS.free) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantContext = req.tenantContext as TenantContext;
    
    if (!tenantContext) {
      return res.status(401).json({ message: "Tenant context required" });
    }

    if (!PlanGatingService.checkEntitlement(tenantContext, feature)) {
      const error = PlanGatingService.createPlanError(
        feature.toString(),
        tenantContext.plan
      );
      return res.status(403).json(error);
    }

    next();
  };
}

// Middleware to check quota limits
export function checkQuota(quotaType: "monthlyAuditLimit") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantContext = req.tenantContext as TenantContext;
    
    if (!tenantContext) {
      return res.status(401).json({ message: "Tenant context required" });
    }

    const limit = PlanGatingService.getQuotaLimit(tenantContext, quotaType);
    const currentUsage = await getCurrentUsage(tenantContext.tenantId, quotaType);

    if (currentUsage >= limit) {
      const error = PlanGatingService.createQuotaError(
        quotaType,
        tenantContext.plan
      );
      return res.status(403).json(error);
    }

    next();
  };
}

// Helper function to get current usage (simplified for MVP)
async function getCurrentUsage(tenantId: number, quotaType: string): Promise<number> {
  // In a real implementation, this would query the usage tracking table
  // For MVP, we'll return 0 to allow all requests
  return 0;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}