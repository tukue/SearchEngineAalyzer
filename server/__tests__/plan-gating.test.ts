import { PlanGatingService } from '../plan-gating';
import { TenantContext } from '@shared/schema';

describe('PlanGatingService', () => {
  const freeTenantContext: TenantContext = {
    tenantId: 1,
    plan: 'free'
  };

  const proTenantContext: TenantContext = {
    tenantId: 2,
    plan: 'pro'
  };

  describe('checkEntitlement', () => {
    it('should deny exports for free plan', () => {
      const result = PlanGatingService.checkEntitlement(freeTenantContext, 'exportsEnabled');
      expect(result).toBe(false);
    });

    it('should allow exports for pro plan', () => {
      const result = PlanGatingService.checkEntitlement(proTenantContext, 'exportsEnabled');
      expect(result).toBe(true);
    });

    it('should deny webhooks for free plan', () => {
      const result = PlanGatingService.checkEntitlement(freeTenantContext, 'webhooksEnabled');
      expect(result).toBe(false);
    });

    it('should allow webhooks for pro plan', () => {
      const result = PlanGatingService.checkEntitlement(proTenantContext, 'webhooksEnabled');
      expect(result).toBe(true);
    });
  });

  describe('getQuotaLimit', () => {
    it('should return correct audit limit for free plan', () => {
      const limit = PlanGatingService.getQuotaLimit(freeTenantContext, 'monthlyAuditLimit');
      expect(limit).toBe(10);
    });

    it('should return correct audit limit for pro plan', () => {
      const limit = PlanGatingService.getQuotaLimit(proTenantContext, 'monthlyAuditLimit');
      expect(limit).toBe(1000);
    });

    it('should return correct history depth for free plan', () => {
      const limit = PlanGatingService.getQuotaLimit(freeTenantContext, 'historyDepth');
      expect(limit).toBe(5);
    });

    it('should return correct history depth for pro plan', () => {
      const limit = PlanGatingService.getQuotaLimit(proTenantContext, 'historyDepth');
      expect(limit).toBe(100);
    });
  });

  describe('createPlanError', () => {
    it('should create proper plan upgrade error', () => {
      const error = PlanGatingService.createPlanError('exports', 'free', 'pro');
      
      expect(error.code).toBe('PLAN_UPGRADE_REQUIRED');
      expect(error.feature).toBe('exports');
      expect(error.currentPlan).toBe('free');
      expect(error.requiredPlan).toBe('pro');
      expect(error.message).toContain('exports requires pro plan');
    });

    it('should create proper quota exceeded error', () => {
      const error = PlanGatingService.createQuotaError('audits', 'free');
      
      expect(error.code).toBe('QUOTA_EXCEEDED');
      expect(error.feature).toBe('audits');
      expect(error.currentPlan).toBe('free');
      expect(error.message).toContain('Monthly audits quota exceeded');
    });
  });
});