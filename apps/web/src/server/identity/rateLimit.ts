/** How many attempts one key may spend inside a window, and how long the window is. */
export type WindowRule = {
  limit: number;
  windowMs: number;
};

export type LimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type SlidingWindowLimiter = {
  /** Spends one attempt for `key` and answers whether it may proceed. */
  check(key: string, now: number): LimitResult;
  reset(): void;
};

/**
 * A refusal with a retry window rather than a silent failure: the caller can
 * tell the person how long to wait. It counts attempts, not failures, so a
 * distributed guesser cannot spend a fresh budget by getting the password right
 * occasionally.
 *
 * This is process-local state. A multi-instance deployment needs a shared
 * store before the limit is a security control; it is still enough to stop a
 * single client walking a word list.
 */
export function createSlidingWindowLimiter(rule: WindowRule): SlidingWindowLimiter {
  const attempts = new Map<string, number[]>();

  return {
    check(key, now) {
      const cutoff = now - rule.windowMs;
      const recent = (attempts.get(key) ?? []).filter((at) => at > cutoff);

      if (recent.length >= rule.limit) {
        attempts.set(key, recent);
        const oldest = recent[0] ?? now;
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1_000));
        return { allowed: false, retryAfterSeconds };
      }

      recent.push(now);
      attempts.set(key, recent);
      return { allowed: true };
    },
    reset() {
      attempts.clear();
    },
  };
}
