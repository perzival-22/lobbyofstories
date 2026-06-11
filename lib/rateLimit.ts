/**
 * lib/rateLimit.ts
 *
 * Minimal in-memory fixed-window rate limiter.
 *
 * ⚠️ LIMITATIONS — read before relying on this for real protection:
 *   - State lives in this process's memory. On Vercel (Fluid Compute /
 *     serverless), each function instance has its own Map, so the effective
 *     limit is multiplied by the number of warm instances, and a cold start
 *     resets all counters. It is a basic abuse speed-bump, not a hard guarantee.
 *   - For production-grade, cross-instance limiting, swap this for
 *     @upstash/ratelimit + @upstash/redis (needs UPSTASH_REDIS_REST_URL and
 *     UPSTASH_REDIS_REST_TOKEN env vars) — the call sites only need the
 *     { success, remaining, resetAt } shape returned here.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // epoch ms when the current window resets
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Opportunistic cleanup so the Map doesn't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, limit, remaining: limit - 1, resetAt };
  }

  existing.count += 1;
  return {
    success: existing.count <= limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Standard rate-limit response headers for a given result. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
  if (!result.success) {
    headers['Retry-After'] = String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000)));
  }
  return headers;
}
