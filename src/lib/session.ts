/**
 * Session lifecycle, in one place.
 *
 * Two problems live here, and they are two halves of the same thing.
 *
 * A session that ends must *say so*. Being moved to the login screen with no
 * explanation reads as a bug — people assume they were logged out at random,
 * and the honest answer ("your sign-in lasted eight hours and that time is up")
 * never reaches them.
 *
 * A session that has *not* ended must survive a reload. The access token is
 * held in memory, so every refresh of the page has to exchange the refresh
 * cookie for a new one. That exchange must be attempted exactly once, and a
 * failure to reach the server must never be mistaken for a rejection.
 */

/** Why a session ended, phrased for the person it happened to. */
export type SessionEndReason = 'expired' | 'signed-out' | 'unauthorized';

export interface SessionEndedEvent {
  reason: SessionEndReason;
}

const REASON_KEY = 'sifyforms.sessionEndReason';

/**
 * Whether this browser has ever completed a sign-in.
 *
 * Without it, "the refresh cookie is gone" is indistinguishable from "this
 * person has never signed in", and we would announce an expired session to
 * first-time visitors.
 */
const HAD_SESSION_KEY = 'sifyforms.hadSession';

type Listener = (event: SessionEndedEvent) => void;
const listeners = new Set<Listener>();

/** Subscribe to session endings. Returns the unsubscribe function. */
export function onSessionEnded(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Announce that the session is over.
 *
 * The reason is also written to sessionStorage, because some endings are
 * followed by a full page navigation that destroys every listener before they
 * can react. The login screen reads it back and says what happened.
 */
export function notifySessionEnded(reason: SessionEndReason): void {
  try {
    if (reason !== 'signed-out' && hadSession()) {
      sessionStorage.setItem(REASON_KEY, reason);
    }
  } catch {
    // Private browsing modes can refuse storage. The in-page listeners below
    // still fire, so the message is not lost in the common case.
  }
  for (const listener of listeners) listener({ reason });
}

/** Read and clear the reason left for the login screen. */
export function takeSessionEndReason(): SessionEndReason | null {
  try {
    const value = sessionStorage.getItem(REASON_KEY);
    if (value) sessionStorage.removeItem(REASON_KEY);
    return value === 'expired' || value === 'unauthorized' ? value : null;
  } catch {
    return null;
  }
}

export function markSessionStarted(): void {
  try {
    localStorage.setItem(HAD_SESSION_KEY, '1');
  } catch {
    // Not fatal: the worst case is a missing explanation on the login screen.
  }
}

export function clearSessionMarker(): void {
  try {
    localStorage.removeItem(HAD_SESSION_KEY);
  } catch {
    // As above.
  }
}

export function hadSession(): boolean {
  try {
    return localStorage.getItem(HAD_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/** The sentence shown to the person, by reason. */
export const SESSION_END_MESSAGE: Record<SessionEndReason, { title: string; description: string }> = {
  expired: {
    title: 'Your session has expired',
    description: 'You were signed out because your sign-in timed out. Sign in again to pick up where you left off.',
  },
  unauthorized: {
    title: 'You have been signed out',
    description: 'Your access was revoked or your account changed. Sign in again to continue.',
  },
  'signed-out': {
    title: 'Signed out',
    description: 'You have been signed out of this device.',
  },
};
