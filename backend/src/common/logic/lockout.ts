/**
 * Brute-force lockout (pure logic). After MAX_FAILURES wrong guesses within WINDOW_MS the key is
 * locked for LOCK_MS. Keys: `login:<phone>` and `verify:<staffId>`.
 */
export const MAX_FAILURES = 5;
export const LOCK_MS = 15 * 60_000;
export const FAILURE_WINDOW_MS = 15 * 60_000;
export const LOCKED_MESSAGE = 'Too many attempts. Try again in 15 minutes';

export interface LockState {
  failures: number;
  lastFailureAt: Date | null;
  lockedUntil: Date | null;
}

export const emptyLockState = (): LockState => ({ failures: 0, lastFailureAt: null, lockedUntil: null });

export const isLocked = (s: LockState, now: Date = new Date()) => !!s.lockedUntil && s.lockedUntil.getTime() > now.getTime();

export function normalizeLockState(s: LockState, now: Date = new Date()): LockState {
  if (s.lockedUntil && s.lockedUntil.getTime() <= now.getTime()) return emptyLockState();
  if (!s.lockedUntil && s.lastFailureAt && now.getTime() - s.lastFailureAt.getTime() > FAILURE_WINDOW_MS) return emptyLockState();
  return { failures: s.failures, lastFailureAt: s.lastFailureAt, lockedUntil: s.lockedUntil };
}

export function registerFailure(s: LockState, now: Date = new Date()): LockState {
  const failures = normalizeLockState(s, now).failures + 1;
  return { failures, lastFailureAt: now, lockedUntil: failures >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MS) : null };
}
