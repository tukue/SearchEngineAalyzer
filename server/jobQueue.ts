import { setImmediate } from "timers";

export class JobQueue<TJob> {
  private queue: TJob[] = [];
  private processing = false;

  constructor(private readonly worker: (job: TJob) => Promise<void>, private readonly timeoutMs = 30000) {}

  enqueue(job: TJob) {
    this.queue.push(job);
    void this.processNext();
  }

  private async processNext() {
    if (this.processing) return;
    const job = this.queue.shift();
    if (!job) return;
    this.processing = true;

    try {
      await this.runWithTimeout(this.worker(job));
    } finally {
      this.processing = false;
      setImmediate(() => void this.processNext());
    }
  }

  private runWithTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("TIMEOUT")), this.timeoutMs);
      promise
        .then((result) => resolve(result))
        .catch((err) => reject(err))
        .finally(() => clearTimeout(timer));
    });
  }
}
