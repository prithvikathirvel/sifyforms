import axios from 'axios';
import { createError } from '../utils/errors';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const EXPECTED_ACTION = 'form_submission';

export interface TurnstileVerificationResponse {
  success: boolean;
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

  const allowedHostnames = (process.env.TURNSTILE_EXPECTED_HOSTNAMES || '')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

  assertTurnstileVerification(result, formId, allowedHostnames);
}
