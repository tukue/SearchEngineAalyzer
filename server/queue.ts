import { randomUUID } from "crypto";

export type AuditJob<T> = {
  id: string;
  payload: T;
  attempts: number;
};

export type JobProcessor<T, R> = (job: AuditJob<T>) => Promise<R>;

export class AuditQueue<T, R> {
  private inflight = new Map<string, Promise<R>>();
  private dlq: AuditJob<T>[] = [];
  private maxAttempts = 3;

  constructor(private getKey: (payload: T) => string) {}

  async enqueue(payload: T, processor: JobProcessor<T, R>): Promise<R> {
    const key = this.getKey(payload);
    const existingPromise = this.inflight.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const job: AuditJob<T> = { id: randomUUID(), payload, attempts: 0 };
    const runPromise = this.runWithRetry(job, processor).finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, runPromise);
    return runPromise;
  }

  private async runWithRetry(job: AuditJob<T>, processor: JobProcessor<T, R>): Promise<R> {
    while (job.attempts < this.maxAttempts) {
      const attempt = job.attempts + 1;
      try {
        const startedAt = Date.now();
        const result = await processor({ ...job, attempts: attempt });
        const duration = Date.now() - startedAt;
        console.log(
          `job ${job.id} succeeded on attempt ${attempt} in ${duration}ms`,
        );
        return result;
      } catch (error) {
        job.attempts++;
        const backoff = Math.min(job.attempts * 100, 1000);
        console.warn(`job ${job.id} failed (attempt ${attempt}), retrying in ${backoff}ms`);
        if (job.attempts >= this.maxAttempts) {
          this.dlq.push(job);
          console.error(`job ${job.id} moved to dead letter queue`);
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
    throw new Error("Job exceeded retry attempts");
  }

  getDeadLetterQueue() {
    return [...this.dlq];
  }
}
