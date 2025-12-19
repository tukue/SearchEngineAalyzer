import { Request, Response, NextFunction } from "express";
import { PLAN_CONFIGS, PlanType, TenantContext, PlanGatingError } from "@shared/schema";
import { UsageLimitsService } from "./usage-limits";
import { storage } from "./storage";

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

// Middleware to check quota limits (legacy - use checkAndReserveQuota from usage-limits instead)
export function checkQuota(quotaType: "monthlyAuditLimit") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantContext = req.tenantContext as TenantContext;
    
    if (!tenantContext) {
      return res.status(401).json({ message: "Tenant context required" });
    }

    try {
      const quotaCheck = await UsageLimitsService.canEnqueueAudit(tenantContext.tenantId);
      
      if (!quotaCheck.allowed) {
        return res.status(429).json({
          ...quotaCheck.error,
          quota: quotaCheck.quotaStatus
        });
      }

      // Add quota status to request for downstream use
      req.quotaStatus = quotaCheck.quotaStatus;
      next();
    } catch (error) {
      console.error("Error checking quota:", error);
      res.status(500).json({ message: "Failed to check quota" });
    }
  };
}

// Helper function to get current usage
async function getCurrentUsage(tenantId: number, quotaType: string): Promise<number> {
  const period = new Date().toISOString().slice(0, 7);
  const usage = await storage.getMonthlyUsage(tenantId, period);
  return usage?.enqueuedCount || 0;
}
