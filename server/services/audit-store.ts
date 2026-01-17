import { kvGet, kvSet, isKvConfigured } from "./kv-client";
import type { AnalysisResult } from "@shared/schema";

export type AuditStatus = "processing" | "completed" | "failed";

export type AuditRecord = {
  id: string;
  status: AuditStatus;
  url: string;
  createdAt: string;
  updatedAt: string;
  result?: AnalysisResult;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

const memoryStore = new Map<string, AuditRecord>();
const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

function getKey(id: string) {
  return `audit:${id}`;
}

export function isAuditStorePersistent() {
  return isKvConfigured();
}

export async function getAuditRecord(id: string): Promise<AuditRecord | null> {
  if (!isKvConfigured()) {
    return memoryStore.get(id) ?? null;
  }

  return await kvGet<AuditRecord>(getKey(id));
}

export async function saveAuditRecord(record: AuditRecord, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!isKvConfigured()) {
    memoryStore.set(record.id, record);
    return;
  }

  await kvSet(getKey(record.id), record, ttlSeconds);
}
