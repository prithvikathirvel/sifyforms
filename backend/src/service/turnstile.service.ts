import { createHash } from 'crypto';
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
      throw createError(409, 'Security verification expired or was already used. Please try again.');
    }
    throw createError(400, 'Security verification failed. Please refresh and try again.');
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

  const body = new URLSearchParams({
    secret,
    response: responseToken,
  });
  const remoteIp = canonicalClientIp(ip);
  if (remoteIp) body.set('remoteip', remoteIp);

  let result: TurnstileVerificationResponse;
  try {
    const response = await axios.post<TurnstileVerificationResponse>(SITEVERIFY_URL, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000,
    });
    result = response.data;
  } catch {
    throw createError(503, 'Security verification is temporarily unavailable');
  }

  const audit = {
    // A short one-way fingerprint lets operations correlate retries without
    // logging a credential that could be copied and replayed.
    tokenFingerprint: createHash('sha256').update(responseToken).digest('hex').slice(0, 12),
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

  assertTurnstileVerification(result, formId, allowedHostnames);
}
