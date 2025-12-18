import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { 
  TenantContext, 
  QuotaStatus, 
  PlanGatingError,
  PLAN_CONFIGS,
  AuditRequest 
} from "@shared/schema";
import { storage } from "./storage";

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
   * Reserve audit quota (enqueue with idempotency) - Atomic operation
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

    // Atomic quota check and reservation
    try {
      const result = await storage.atomicQuotaReservation({
        tenantId,
        requestId,
        auditType,
        url: url || null,
        userId: userId || null,
        period: new Date().toISOString().slice(0, 7)
      });

      if (!result.success) {
        const tenant = await storage.getTenant(tenantId);
        const error: PlanGatingError = {
          code: "QUOTA_EXCEEDED",
          feature: "monthlyAuditLimit",
          currentPlan: tenant?.plan || "unknown",
          message: `Monthly audit quota exceeded. Used ${result.quotaUsed}/${result.quotaLimit} audits for ${result.period}.`
        };
        
        return { success: false, quotaStatus: result.quotaStatus, error };
      }

      return { success: true, quotaStatus: result.quotaStatus };
    } catch (error) {
      console.error('Atomic quota reservation failed:', error);
      throw error;
    }
  }

  /**
   * Mark audit as completed
   */
  static async completeAudit(tenantId: number, requestId: string): Promise<void> {
    await storage.updateUsageLedgerEntry(tenantId, requestId, "completed");
  }

  /**
   * Mark audit as failed and clean up reserved quota
   */
  static async failAudit(tenantId: number, requestId: string, releaseQuota: boolean = false): Promise<void> {
    try {
      await storage.updateUsageLedgerEntry(tenantId, requestId, "failed");
      
      // Optionally release quota for failed audits to prevent quota leakage
      if (releaseQuota) {
        await storage.releaseQuotaReservation(tenantId, requestId);
      }
    } catch (error) {
      console.error(`Failed to mark audit as failed for tenant ${tenantId}, request ${requestId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up abandoned or expired quota reservations
   */
  static async cleanupExpiredReservations(tenantId: number, olderThanHours: number = 24): Promise<number> {
    try {
      return await storage.cleanupExpiredQuotaReservations(tenantId, olderThanHours);
    } catch (error) {
      console.error(`Failed to cleanup expired reservations for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Generate request ID for idempotency
   */
  static generateRequestId(): string {
    return randomUUID();
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

      // Add error cleanup handler to response
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        // If response failed (5xx) and we have a request ID, mark audit as failed
        if (res.statusCode >= 500 && req.auditRequestId) {
          UsageLimitsService.failAudit(tenantContext.tenantId, req.auditRequestId, true)
            .catch(err => console.error('Failed to cleanup quota on error:', err));
        }
        return originalEnd.call(this, chunk, encoding);
      };

      next();
    } catch (error) {
      console.error("Error checking quota:", error);
      
      // If we had a request ID but failed after reservation, try to clean up
      if (req.auditRequestId) {
        UsageLimitsService.failAudit(tenantContext.tenantId, req.auditRequestId, true)
          .catch(err => console.error('Failed to cleanup quota after error:', err));
      }
      
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
