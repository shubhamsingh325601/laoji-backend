import { Injectable } from '@nestjs/common';

// In-process response cache for public, read-only endpoints. Single backend
// instance by design (see CLAUDE.md rule 3), so a Map is enough — no Redis.
export const RESPONSE_CACHE_TTL_MS = 30 * 60 * 1000;

// Catalog keys include the caller's lat/lng, so the key space is unbounded;
// the oldest entry is evicted once this many are stored.
const MAX_ENTRIES = 2000;

interface Entry {
  value: unknown;
  expiresAt: number;
}

@Injectable()
export class ResponseCacheService {
  private readonly entries = new Map<string, Entry>();

  get(key: string): { hit: true; value: unknown } | { hit: false } {
    const entry = this.entries.get(key);
    if (!entry) return { hit: false };
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return { hit: false };
    }
    return { hit: true, value: entry.value };
  }

  set(key: string, value: unknown, ttlMs = RESPONSE_CACHE_TTL_MS): void {
    this.entries.delete(key);
    if (this.entries.size >= MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}
