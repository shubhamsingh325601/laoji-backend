import { Injectable, Logger } from '@nestjs/common';

/**
 * In-process, in-memory job scheduler (TRD Section 8) — no Redis, single
 * backend instance only. Used here for allocation-attempt SLA timeouts.
 *
 * Trade-off documented in the TRD and repeated here deliberately: jobs are
 * lost on process restart. Postgres (`allocation_attempts`) stays the
 * source of truth for *what's* pending; this is only *how* it gets
 * scheduled. A stuck order whose in-memory timer didn't survive a restart
 * would need a reconciliation sweep to recover — not built in this phase
 * (flagged, not silently skipped): revisit if restarts during active
 * allocation windows turn out to matter in practice.
 */
@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  schedule(key: string, delayMs: number, fn: () => void | Promise<void>): void {
    this.cancel(key);
    const timer = setTimeout(() => {
      this.timers.delete(key);
      Promise.resolve(fn()).catch((err) => this.logger.error(`Job ${key} failed`, err));
    }, delayMs);
    this.timers.set(key, timer);
  }

  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}
