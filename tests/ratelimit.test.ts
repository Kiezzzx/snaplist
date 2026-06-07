import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// TC-09/10/11 — fail-open rate limiting (CLAUDE.md constraint #1).
//
// ratelimit.ts reads UPSTASH_* env at import time and constructs the limiters
// at module load, so each case sets env first, then re-imports the module
// fresh (vi.resetModules) to re-evaluate the `configured` flag. The Upstash
// client + limiter are mocked — no real Redis is contacted — and `limitMock`
// lets each test drive the limiter's resolve/reject behaviour.

const { limitMock } = vi.hoisted(() => ({ limitMock: vi.fn() }));

// server-only throws outside an RSC graph; stub it to a no-op for the test env.
// Redis/Ratelimit are invoked with `new`, so the mocks must be real
// constructors (classes) — an arrow fn would throw "is not a constructor".
vi.mock('server-only', () => ({}));
vi.mock('@upstash/redis', () => ({
  Redis: class {},
}));
vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    limit = limitMock;
    static slidingWindow = () => ({});
  }
  return { Ratelimit };
});

async function loadCheckRateLimit() {
  vi.resetModules();
  const mod = await import('../src/lib/ratelimit');
  return mod.checkRateLimit;
}

function stubEnvPresent() {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
}

let errSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  limitMock.mockReset();
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  errSpy.mockRestore();
  warnSpy.mockRestore();
  vi.unstubAllEnvs();
});

describe('checkRateLimit (TC-09/10/11)', () => {
  it('fails open (allowed: true) when limiter.limit() throws (TC-09)', async () => {
    stubEnvPresent();
    limitMock.mockRejectedValueOnce(new Error('redis down'));

    const checkRateLimit = await loadCheckRateLimit();
    const decision = await checkRateLimit('ip:1.2.3.4', 'anon');

    expect(decision.allowed).toBe(true);
    expect(limitMock).toHaveBeenCalledTimes(1);
  });

  it('fails open (allowed: true) when Upstash env vars are missing (TC-10)', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');

    const checkRateLimit = await loadCheckRateLimit();
    const decision = await checkRateLimit('ip:1.2.3.4', 'anon');

    expect(decision.allowed).toBe(true);
    // No limiter was built, so the underlying .limit() is never called.
    expect(limitMock).not.toHaveBeenCalled();
  });

  it('allows and reports remaining when the limiter reports success (TC-11)', async () => {
    stubEnvPresent();
    limitMock.mockResolvedValueOnce({
      success: true,
      limit: 3,
      remaining: 2,
      reset: Date.now() + 60_000,
    });

    const checkRateLimit = await loadCheckRateLimit();
    const decision = await checkRateLimit('ip:1.2.3.4', 'anon');

    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(2);
  });

  it('blocks (allowed: false, remaining: 0) when the limiter reports exceeded (TC-11)', async () => {
    stubEnvPresent();
    limitMock.mockResolvedValueOnce({
      success: false,
      limit: 3,
      remaining: 0,
      reset: Date.now() + 60_000,
    });

    const checkRateLimit = await loadCheckRateLimit();
    const decision = await checkRateLimit('ip:1.2.3.4', 'anon');

    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
  });
});
