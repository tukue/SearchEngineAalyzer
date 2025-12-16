import { Request, Response, NextFunction } from "express";
import { 
  TenantContext, 
  QuotaStatus, 
  PlanGatingError,
  PLAN_CONFIGS,
  AuditRequest 
} from "@shared/schema";
import { storage } from "./storage";
// Simple UUID generator to avoid Jest module issues
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export class UsageLimitsService {
  /**
   * Get current quota status for a tenant
   */
  static async getQuotaStatus(tenantId: number, period?: string): Promise<QuotaStatus> {
    const currentPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM
    const tenant = await storage.getTenant(tenantId);
    
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const quotaLimit = PLAN_CONFIGS[tenant.plan as keyof typeof PLAN_CONFIGS].monthlyAuditLimit;
    const usage = await storage.getMonthlyUsage(tenantId, currentPeriod);
    const quotaUsed = usage?.enqueuedCount || 0;
    const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
    const quotaPercentUsed = quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0;

    let warningLevel: "none" | "warning_80" | "warning_90" | "exceeded" = "none";
    if (quotaPercentUsed >= 100) {
      warningLevel = "exceeded";
    } else if (quotaPercentUsed >= 90) {
      warningLevel = "warning_90";
    } else if (quotaPercentUsed >= 80) {
      warningLevel = "warning_80";
    }

    return {
      quotaRemaining,
      quotaUsed,
      quotaLimit,
      quotaPercentUsed: Math.round(quotaPercentUsed * 100) / 100,
      warningLevel,
      period: currentPeriod,
    };
  }

  /**
   * Check if tenant can enqueue a new audit
   */
  static async canEnqueueAudit(tenantId: number): Promise<{ allowed: boolean; quotaStatus: QuotaStatus; error?: PlanGatingError }> {
    const quotaStatus = await this.getQuotaStatus(tenantId);
    
    if (quotaStatus.quotaRemaining <= 0) {
      const tenant = await storage.getTenant(tenantId);
      const error: PlanGatingError = {
        code: "QUOTA_EXCEEDED",
        feature: "monthlyAuditLimit",
        currentPlan: tenant?.plan || "unknown",
        message: `Monthly audit quota exceeded. Used ${quotaStatus.quotaUsed}/${quotaStatus.quotaLimit} audits for ${quotaStatus.period}.`
      };
      
      return { allowed: false, quotaStatus, error };
    }

    return { allowed: true, quotaStatus };
  }

  /**
   * Reserve audit quota (enqueue with idempotency)
   */
  static async reserveAuditQuota(
    tenantId: number, 
    requestId: string, 
    auditType: string = "meta_analysis",
    url?: string,
    userId?: string
  ): Promise<{ success: boolean; quotaStatus: QuotaStatus; error?: PlanGatingError }> {
    // Check for existing request (idempotency)
    const existing = await storage.getUsageLedgerEntry(tenantId, requestId);
    if (existing) {
      const quotaStatus = await this.getQuotaStatus(tenantId);
      return { success: true, quotaStatus };
    }

    // Check quota
    const quotaCheck = await this.canEnqueueAudit(tenantId);
    if (!quotaCheck.allowed) {
      return { success: false, quotaStatus: quotaCheck.quotaStatus, error: quotaCheck.error };
    }

    // Reserve quota
    await storage.createUsageLedgerEntry({
      tenantId,
      requestId,
      auditType,
      status: "enqueued",
      url: url || null,
      userId: userId || null,
      period: new Date().toISOString().slice(0, 7)
    });

    const updatedQuotaStatus = await this.getQuotaStatus(tenantId);
    return { success: true, quotaStatus: updatedQuotaStatus };
  }

  /**
   * Mark audit as completed
   */
  static async completeAudit(tenantId: number, requestId: string): Promise<void> {
    await storage.updateUsageLedgerEntry(tenantId, requestId, "completed");
  }

  /**
   * Mark audit as failed
   */
  static async failAudit(tenantId: number, requestId: string): Promise<void> {
    await storage.updateUsageLedgerEntry(tenantId, requestId, "failed");
  }

  /**
   * Generate request ID for idempotency
   */
  static generateRequestId(): string {
    return generateUUID();
  }
}

/**
 * Middleware to check and reserve audit quota
 */
export function checkAndReserveQuota() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantContext = req.tenantContext as TenantContext;
    
    if (!tenantContext) {
      return res.status(401).json({ message: "Tenant context required" });
    }

    // Generate or use provided request ID for idempotency
    const requestId = req.body.requestId || UsageLimitsService.generateRequestId();
    const auditType = req.body.auditType || "meta_analysis";
    const url = req.body.url;
    const userId = req.body.userId;

    try {
      const result = await UsageLimitsService.reserveAuditQuota(
        tenantContext.tenantId,
        requestId,
        auditType,
        url,
        userId
      );

      if (!result.success) {
        return res.status(429).json({
          ...result.error,
          quota: result.quotaStatus
        });
      }

      // Add quota info and request ID to request for downstream use
      req.quotaStatus = result.quotaStatus;
      req.auditRequestId = requestId;

      next();
    } catch (error) {
      console.error("Error checking quota:", error);
      res.status(500).json({ message: "Failed to check quota" });
    }
  };
}

/**
 * Middleware to add quota status to responses
 */
export function addQuotaToResponse() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    
    res.json = function(body: any) {
      if (req.quotaStatus && typeof body === 'object' && body !== null) {
        body.quota = req.quotaStatus;
      }
      return originalJson.call(this, body);
    };

    next();
  };
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      quotaStatus?: QuotaStatus;
      auditRequestId?: string;
    }
  }
}