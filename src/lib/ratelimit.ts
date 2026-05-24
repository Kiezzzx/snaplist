import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Daily quotas. Anonymous users are throttled hard to protect the Gemini free
// tier (RPD 20); logged-in users get the higher allowance. CLAUDE.md #5.
const ANON_DAILY_LIMIT = 3;
const AUTH_DAILY_LIMIT = 20;

// Fail-open budget: if Redis doesn't answer within this, Upstash resolves the
// check as allowed. A rate-limiter outage must never take down uploads.
// CLAUDE.md #1.
const REDIS_TIMEOUT_MS = 1500;

export type RateLimitTier = 'anon' | 'auth';

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms when the window refills; 0 when not enforced
}

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const configured = Boolean(url && token);

// Reuse one limiter pair across HMR reloads (mirrors db/index.ts) so dev saves
// don't accumulate stale Redis clients.
const globalForRatelimit = globalThis as unknown as {
  __anonLimiter?: Ratelimit;
  __authLimiter?: Ratelimit;
};

function buildLimiter(prefix: string, limit: number): Ratelimit {
  return new Ratelimit({
    redis: new Redis({ url: url!, token: token! }),
    // Sliding 24h window: fairer than a fixed calendar day and closes the
    // burst-at-midnight-boundary loophole (limit at 23:59 + limit at 00:00).
    limiter: Ratelimit.slidingWindow(limit, '1 d'),
    timeout: REDIS_TIMEOUT_MS,
    prefix,
    analytics: false,
  });
}

const anonLimiter: Ratelimit | null = configured
  ? globalForRatelimit.__anonLimiter ??
    (globalForRatelimit.__anonLimiter = buildLimiter('ratelimit:anon', ANON_DAILY_LIMIT))
  : null;

const authLimiter: Ratelimit | null = configured
  ? globalForRatelimit.__authLimiter ??
    (globalForRatelimit.__authLimiter = buildLimiter('ratelimit:auth', AUTH_DAILY_LIMIT))
  : null;

let warnedDisabled = false;
function warnDisabledOnce(): void {
  if (warnedDisabled) return;
  warnedDisabled = true;
  console.warn(
    '[ratelimit] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting disabled (fail-open).',
  );
}

// Resolve the throttle key. Anonymous users are keyed on client IP (harder to
// reset than the cookie). We fall back to the anon session id, then a shared
// bucket, only when no IP header is present.
export function getClientIdentifier(req: Request, anonSessionId: string | null): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim();
  if (ip) return `ip:${ip}`;
  if (anonSessionId) return `sid:${anonSessionId}`;
  return 'unknown';
}

export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier,
): Promise<RateLimitDecision> {
  const limiter = tier === 'auth' ? authLimiter : anonLimiter;
  const limit = tier === 'auth' ? AUTH_DAILY_LIMIT : ANON_DAILY_LIMIT;

  // Not configured (e.g. local dev without Upstash) → skip + warn, fail-open.
  if (!limiter) {
    warnDisabledOnce();
    return { allowed: true, limit, remaining: limit, reset: 0 };
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      allowed: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    // Redis threw (network/outage). Fail-open — a limiter failure must not block
    // a core upload. The `timeout` option covers slowness; this covers errors.
    console.error('[ratelimit] check failed — failing open:', err);
    return { allowed: true, limit, remaining: limit, reset: 0 };
  }
}
