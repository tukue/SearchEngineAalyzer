import { UsageSnapshot } from "@shared/schema";
import { startOfMonth } from "date-fns";

function getMonthKey(date: Date): string {
  const monthStart = startOfMonth(date);
  return monthStart.toISOString().slice(0, 7);
}

export class UsageLedger {
  private ledger: Map<string, number> = new Map();

  private getKey(tenantId: string, date = new Date()): string {
    return `${tenantId}:${getMonthKey(date)}`;
  }

  getSnapshot(tenantId: string, limit: number, planId: UsageSnapshot["planId"]): UsageSnapshot {
    const key = this.getKey(tenantId);
    const count = this.ledger.get(key) ?? 0;
    const remaining = Math.max(limit - count, 0);
    const warnings: string[] = [];

    const warningRatio = count / limit;
    if (warningRatio >= 0.9) warnings.push("Usage at 90% of monthly quota");
    else if (warningRatio >= 0.8) warnings.push("Usage at 80% of monthly quota");

    return {
      tenantId,
      month: key.split(":")[1],
      count,
      limit,
      remaining,
      warnings,
      planId,
    };
  }

  assertWithinQuota(tenantId: string, limit: number, planId: UsageSnapshot["planId"]) {
    const snapshot = this.getSnapshot(tenantId, limit, planId);
    if (snapshot.remaining <= 0) {
      const error = new Error("Monthly audit quota exceeded");
      (error as any).status = 429;
      throw error;
    }
  }

  increment(tenantId: string) {
    const key = this.getKey(tenantId);
    const current = this.ledger.get(key) ?? 0;
    this.ledger.set(key, current + 1);
  }
}

export const usageLedger = new UsageLedger();
