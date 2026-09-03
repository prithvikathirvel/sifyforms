import { createHash, randomUUID } from 'crypto';
import axios from 'axios';
import { createError } from '../utils/errors';
import logger from '../utils/logger';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const EXPECTED_ACTION = 'form_submission';
const CLOUDFLARE_TEST_SECRETS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

// Cloudflare is the canonical single-use authority. This bounded process-local
// guard is defense in depth for duplicate requests and prevents a second write
// even if an intermediary unexpectedly repeats a successful Siteverify result.
const TOKEN_GUARD_TTL_MS = 5 * 60 * 1000;
const TOKEN_GUARD_MAX_ENTRIES = 50_000;
const acceptedTokenHashes = new Map<string, number>();
const inFlightTokenHashes = new Set<string>();
let guardOperations = 0;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function pruneTokenGuard(now: number): void {
  guardOperations += 1;
  if (guardOperations % 100 !== 0 && acceptedTokenHashes.size < TOKEN_GUARD_MAX_ENTRIES) return;

  for (const [hash, expiresAt] of acceptedTokenHashes) {
    if (expiresAt <= now) acceptedTokenHashes.delete(hash);
  }
  while (acceptedTokenHashes.size >= TOKEN_GUARD_MAX_ENTRIES) {
    const oldest = acceptedTokenHashes.keys().next().value as string | undefined;
    if (!oldest) break;
    acceptedTokenHashes.delete(oldest);
  }
}

function beginTokenVerification(hash: string): void {
  const now = Date.now();
  pruneTokenGuard(now);
  const acceptedUntil = acceptedTokenHashes.get(hash);
  if ((acceptedUntil && acceptedUntil > now) || inFlightTokenHashes.has(hash)) {
    logger.warn('Turnstile local replay guard rejected submission', {
      tokenFingerprint: hash.slice(0, 12),
    });
    throw createError(409, "Your request was unambiguous. Please reload the page and try again.");
  }
  inFlightTokenHashes.add(hash);
}

export interface TurnstileVerificationResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  'error-codes'?: string[];
}

function canonicalClientIp(ip: string | null): string | undefined {
  if (!ip) return undefined;
  const first = ip.split(',')[0]?.trim();
  return first || undefined;
}

/** Interpret Siteverify exactly once; Cloudflare owns expiry and replay state. */
export function assertTurnstileVerification(
  result: TurnstileVerificationResponse,
  formId: string,
  allowedHostnames: string[],
): void {
  if (!result.success) {
    const codes = result['error-codes'] ?? [];
    if (codes.includes('timeout-or-duplicate')) {
      throw createError(409, 'Your request was unambiguous. Please reload the page and try again.');
    }
    throw createError(400, 'Your request was unambiguous. Please reload the page and try again.');
  }

  if (result.action !== EXPECTED_ACTION) {
    throw createError(400, 'Security verification action is invalid');
  }
  if (result.cdata !== formId) {
    throw createError(400, 'Security verification does not match this form');
  }
  if (
    allowedHostnames.length > 0 &&
    (!result.hostname || !allowedHostnames.includes(result.hostname.toLowerCase()))
  ) {
    throw createError(400, 'Security verification hostname is not allowed');
  }
}

/**
 * Verify a short-lived, single-use Turnstile token with Cloudflare.
 * Fails closed when the server is not configured or Cloudflare cannot verify it.
 */
export async function verifyTurnstileToken(
  token: string,
  ip: string | null,
  formId: string,
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    throw createError(503, 'Security verification is not configured');
  }
  const usesTestSecret = CLOUDFLARE_TEST_SECRETS.has(secret);
  if (usesTestSecret && process.env.TURNSTILE_ALLOW_TEST_KEYS !== 'true') {
    throw createError(503, 'Cloudflare Turnstile test credentials are not allowed in this environment');
  }

  const allowedHostnames = (process.env.TURNSTILE_EXPECTED_HOSTNAMES || '')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  if (!usesTestSecret && allowedHostnames.length === 0) {
    throw createError(503, 'Cloudflare Turnstile frontend hostnames are not configured');
  }

  const responseToken = token?.trim();
  if (!responseToken || responseToken.length > 2048) {
    throw createError(400, 'Security verification is required');
  }

  const hash = tokenHash(responseToken);
  beginTokenVerification(hash);

  const body = new URLSearchParams({
    secret,
    response: responseToken,
    // A new key identifies this application submission. If the HTTP call itself
    // is retried later, that retry must deliberately reuse this same key.
    idempotency_key: randomUUID(),
  });
  const remoteIp = canonicalClientIp(ip);
  if (remoteIp) body.set('remoteip', remoteIp);

  let result: TurnstileVerificationResponse;
  try {
    const response = await axios.post<TurnstileVerificationResponse>(SITEVERIFY_URL, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Cache-Control': 'no-store, no-cache',
        'Pragma': 'no-cache',
      },
      timeout: 5000,
    });
    result = response.data;
  } catch {
    inFlightTokenHashes.delete(hash);
    throw createError(503, 'Security verification is temporarily unavailable');
  }

  // Remember every provider-accepted token before checking our additional
  // action/hostname/form binding. Siteverify has consumed it at this point.
  if (result.success) {
    acceptedTokenHashes.set(hash, Date.now() + TOKEN_GUARD_TTL_MS);
  }

  const audit = {
    // A short one-way fingerprint lets operations correlate retries without
    // logging a credential that could be copied and replayed.
    tokenFingerprint: hash.slice(0, 12),
    formId,
    success: result.success,
    errorCodes: result['error-codes'] ?? [],
    action: result.action ?? null,
    hostname: result.hostname ?? null,
    challengeTimestamp: result.challenge_ts ?? null,
    cdataMatchesForm: result.cdata === formId,
  };

  if (
    !result.success ||
    result.action !== EXPECTED_ACTION ||
    result.cdata !== formId ||
    (allowedHostnames.length > 0 && !allowedHostnames.includes((result.hostname || '').toLowerCase()))
  ) {
    logger.warn('Turnstile Siteverify rejected submission', audit);
  } else {
    logger.info('Turnstile Siteverify accepted submission', audit);
  }

  try {
    assertTurnstileVerification(result, formId, allowedHostnames);
  } finally {
    inFlightTokenHashes.delete(hash);
  }
}
