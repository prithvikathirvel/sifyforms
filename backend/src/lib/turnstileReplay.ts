import { createHash } from 'crypto';
import { createError } from '../utils/errors';

export interface TurnstileTokenStore {
  create(args: {
    data: {
      tokenHash: string;
      formId: string;
      expiresAt: Date;
    };
  }): Promise<unknown>;
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export function hashTurnstileToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Claim a token exactly once using the datastore's unique token-hash index. */
export async function claimVerifiedTurnstileToken(
  store: TurnstileTokenStore,
  token: string,
  formId: string,
  expiresAt: Date,
): Promise<void> {
  try {
    await store.create({
      data: {
        tokenHash: hashTurnstileToken(token),
        formId,
        expiresAt,
      },
    });
  } catch (error: unknown) {
    if (errorCode(error) === 'P2002') {
      throw createError(409, 'Security verification token has already been used. Please try again.');
    }
    // Failing open here would restore the replay vulnerability.
    throw createError(503, 'Security verification could not be recorded');
  }
}
