/**
 * Client-side rate limiter using a sliding-window token bucket.
 *
 * Each limiter instance tracks call timestamps in AsyncStorage so limits
 * survive the screen being unmounted and re-mounted within the same session.
 *
 * Usage:
 *   const limiter = getRateLimiter("flight-lookup", { maxCalls: 5, windowMs: 60_000 });
 *   const { allowed, remainingCalls, retryAfterMs } = await limiter.check();
 *   if (!allowed) { ... show error ... return; }
 *   await limiter.consume();
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RateLimitOptions {
  /** Maximum number of calls allowed within the window */
  maxCalls: number;
  /** Rolling window in milliseconds (default: 60 000 = 1 minute) */
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingCalls: number;
  /** ms until the oldest call expires and a slot opens — 0 when allowed */
  retryAfterMs: number;
}

const STORAGE_PREFIX = "@rl_";

class RateLimiter {
  private readonly key: string;
  private readonly maxCalls: number;
  private readonly windowMs: number;

  constructor(name: string, opts: RateLimitOptions) {
    this.key       = STORAGE_PREFIX + name;
    this.maxCalls  = opts.maxCalls;
    this.windowMs  = opts.windowMs ?? 60_000;
  }

  private async getTimestamps(): Promise<number[]> {
    try {
      const raw = await AsyncStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as number[]) : [];
    } catch {
      return [];
    }
  }

  private async setTimestamps(ts: number[]): Promise<void> {
    await AsyncStorage.setItem(this.key, JSON.stringify(ts));
  }

  /** Prune timestamps outside the current window */
  private prune(timestamps: number[], now: number): number[] {
    return timestamps.filter((t) => now - t < this.windowMs);
  }

  /** Check whether a call is allowed WITHOUT consuming a slot */
  async check(): Promise<RateLimitResult> {
    const now    = Date.now();
    const recent = this.prune(await this.getTimestamps(), now);
    const allowed = recent.length < this.maxCalls;
    const retryAfterMs = allowed
      ? 0
      : this.windowMs - (now - Math.min(...recent));
    return {
      allowed,
      remainingCalls: Math.max(0, this.maxCalls - recent.length),
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  /** Record a call (consume one slot) */
  async consume(): Promise<void> {
    const now    = Date.now();
    const recent = this.prune(await this.getTimestamps(), now);
    recent.push(now);
    await this.setTimestamps(recent);
  }

  /** Reset the limiter (e.g. for testing) */
  async reset(): Promise<void> {
    await AsyncStorage.removeItem(this.key);
  }
}

// ─── Singleton registry so every import shares the same instance ───────────────
const registry = new Map<string, RateLimiter>();

export function getRateLimiter(name: string, opts: RateLimitOptions): RateLimiter {
  if (!registry.has(name)) registry.set(name, new RateLimiter(name, opts));
  return registry.get(name)!;
}

/** Human-readable countdown, e.g. "45s" or "1m 12s" */
export function formatRetryAfter(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}
