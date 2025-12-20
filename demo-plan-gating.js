// Demo script to showcase plan gating functionality
import { PlanGatingService } from './server/plan-gating.js';
import { PLAN_CONFIGS } from './shared/schema.js';

console.log('🚀 Plan Gating System Demo\n');

// Demo tenant contexts
const freeTenant = { tenantId: 1, plan: 'free' };
const proTenant = { tenantId: 2, plan: 'pro' };

console.log('📋 Plan Configurations:');
console.log('Free Plan:', JSON.stringify(PLAN_CONFIGS.free, null, 2));
console.log('Pro Plan:', JSON.stringify(PLAN_CONFIGS.pro, null, 2));
console.log();

console.log('🔒 Entitlement Checks:');

// Test export entitlements
console.log('Export Feature:');
console.log(`  Free Plan: ${PlanGatingService.checkEntitlement(freeTenant, 'exportsEnabled') ? '✅ Allowed' : '❌ Blocked'}`);
console.log(`  Pro Plan: ${PlanGatingService.checkEntitlement(proTenant, 'exportsEnabled') ? '✅ Allowed' : '❌ Blocked'}`);

// Test webhook entitlements
console.log('Webhook Feature:');
console.log(`  Free Plan: ${PlanGatingService.checkEntitlement(freeTenant, 'webhooksEnabled') ? '✅ Allowed' : '❌ Blocked'}`);
console.log(`  Pro Plan: ${PlanGatingService.checkEntitlement(proTenant, 'webhooksEnabled') ? '✅ Allowed' : '❌ Blocked'}`);

console.log();
console.log('📊 Quota Limits:');

// Test quota limits
console.log('Monthly Audit Limit:');
console.log(`  Free Plan: ${PlanGatingService.getQuotaLimit(freeTenant, 'monthlyAuditLimit')} audits`);
console.log(`  Pro Plan: ${PlanGatingService.getQuotaLimit(proTenant, 'monthlyAuditLimit')} audits`);

console.log('History Depth:');
console.log(`  Free Plan: ${PlanGatingService.getQuotaLimit(freeTenant, 'historyDepth')} analyses`);
console.log(`  Pro Plan: ${PlanGatingService.getQuotaLimit(proTenant, 'historyDepth')} analyses`);

console.log();
console.log('⚠️  Error Responses:');

// Test error generation
const exportError = PlanGatingService.createPlanError('exports', 'free', 'pro');
console.log('Export Blocked Error:', JSON.stringify(exportError, null, 2));

const quotaError = PlanGatingService.createQuotaError('audits', 'free');
console.log('Quota Exceeded Error:', JSON.stringify(quotaError, null, 2));

console.log();
console.log('✅ Plan Gating System Demo Complete!');
console.log();
console.log('🎯 Key Features Implemented:');
console.log('  • Multi-tenant plan configuration');
console.log('  • Backend entitlement enforcement');
console.log('  • Frontend feature gating components');
console.log('  • Structured error responses');
console.log('  • Usage tracking and quotas');
console.log('  • Plan change audit logging');
console.log('  • Comprehensive test coverage');
console.log();
console.log('🚀 Ready for production deployment!');