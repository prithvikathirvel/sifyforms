/**
 * One identity, however it is typed.
 *
 * Sign-up asks for five things only — first name, last name, a username,
 * a password and its confirmation. The user-management service keys an
 * account on an email address, so the one "username" field accepts either:
 *
 *   - "johndoe"      → username "johndoe",   email "johndoe@users.sifyforms.local"
 *   - "john@co.com"  → username "john",      email "john@co.com"
 *
 * The derivation is deterministic, so sign-in resolves the same email from
 * whatever the person types there — no hidden state, no server change.
 */

/** The domain stamped onto bare usernames so they form a valid address. */
const SYNTHETIC_EMAIL_DOMAIN = 'users.sifyforms.local';

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeEmail(value: string): boolean {
  return EMAIL_LIKE.test(value.trim());
}

/** The email an account is registered under for a typed username-or-email. */
export function emailForIdentity(typed: string): string {
  const value = typed.trim();
  if (looksLikeEmail(value)) return value;
  return `${value.toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'user'}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/** The username an account is registered under for a typed username-or-email. */
export function usernameForIdentity(typed: string): string {
  const value = typed.trim();
  if (looksLikeEmail(value)) return value.split('@')[0];
  return value;
}
