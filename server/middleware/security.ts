import type { Request, Response, NextFunction } from "express";

// ─── Security Headers (helmet-equivalent, zero dependencies) ─────────────────
// Sets all headers that helmet would set, manually. This avoids adding a
// dependency for what is ultimately just a handful of res.setHeader() calls.
export function securityHeaders() {
  return (_req: Request, res: Response, next: NextFunction) => {
    // Prevent MIME-type sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Prevent clickjacking
    res.setHeader("X-Frame-Options", "DENY");
    // Legacy XSS filter (still respected by some older browsers)
    res.setHeader("X-XSS-Protection", "1; mode=block");
    // Limit referrer information leakage
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Disable browser features not needed by this API
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=(), payment=()",
    );
    // Basic CSP — this is a pure JSON API so no scripts/styles needed
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'",
    );
    // Remove Express fingerprint header
    res.removeHeader("X-Powered-By");
    next();
  };
}

// ─── In-memory sliding-window rate limiter (zero dependencies) ───────────────
// Tracks request counts per IP using a Map. Each entry holds the count and the
// window start time. Stale entries (older than windowMs) are pruned every 5
// minutes to prevent unbounded memory growth.

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export interface RateLimiterOptions {
  /** Number of requests allowed per window. */
  max: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Human-readable description for log messages. */
  name: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { max, windowMs, name } = options;
  const store = new Map<string, RateLimitEntry>();

  // Prune stale entries every 5 minutes to avoid memory leaks
  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart > windowMs) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Allow the process to exit cleanly even if this interval is still running
  if (pruneInterval.unref) pruneInterval.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Use X-Forwarded-For if behind a proxy (Render, Railway, etc.), else socket IP
    const forwarded = req.headers["x-forwarded-for"];
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim()) ??
      req.socket.remoteAddress ??
      "unknown";

    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now - entry.windowStart > windowMs) {
      // New window
      store.set(ip, { count: 1, windowStart: now });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSec = Math.ceil((windowMs - (now - entry.windowStart)) / 1000);
      console.warn(`[RateLimit] ${name} — ${ip} exceeded ${max} req/${windowMs / 1000}s`);
      res.setHeader("Retry-After", String(retryAfterSec));
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", "0");
      return res.status(429).json({
        error: "Too many requests. Please slow down and try again shortly.",
        retryAfterSeconds: retryAfterSec,
      });
    }

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(max - entry.count));
    return next();
  };
}

// ─── Pre-configured limiters ──────────────────────────────────────────────────

/** Auth endpoints: 10 requests per 15 minutes per IP.
 *  Prevents brute-force / credential stuffing on sign-in upsert. */
export const authLimiter = createRateLimiter({
  name: "auth",
  max: 10,
  windowMs: 15 * 60 * 1000,
});

/** Write endpoints (POST/PATCH/DELETE flights & trips): 60 req/min per IP.
 *  Prevents bulk-write abuse while being generous enough for normal use. */
export const writeLimiter = createRateLimiter({
  name: "write",
  max: 60,
  windowMs: 60 * 1000,
});

/** Read endpoints (GET flights, trips, lookup, percentile): 120 req/min per IP.
 *  Generous for normal app use; blocks aggressive scrapers. */
export const readLimiter = createRateLimiter({
  name: "read",
  max: 120,
  windowMs: 60 * 1000,
});
