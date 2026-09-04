import { createError } from '../utils/errors';

/**
 * Who cast a vote, reduced to one canonical string.
 *
 * Duplicate prevention is only as good as this function. Two requests from the
 * same person must produce byte-identical identifiers, and two requests from
 * different people must never collide — the old code failed both halves:
 * `::ffff:203.0.113.9` and `203.0.113.9` counted as two voters, `Ada@x.com` and
 * `ada@x.com` counted as two voters, and every voter whose IP was unknown was
 * bucketed under the literal string `'unknown'`, so the first such vote locked
 * out all the rest.
 */

export type DuplicatePrevention = 'none' | 'ip' | 'email';

/**
 * Reduce a client address to a stable key.
 *
 * Handles the three shapes Express hands us: a bare address, an
 * `X-Forwarded-For` list (the left-most entry is the client), and the
 * IPv4-mapped IPv6 form Node uses on dual-stack sockets.
 */
export function canonicalIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  let value = String(ip).split(',')[0]?.trim() ?? '';
  if (!value) return null;

  // Strip a bracketed IPv6 host and any port: "[::1]:443" or "1.2.3.4:443".
  if (value.startsWith('[')) {
    const close = value.indexOf(']');
    if (close > 0) value = value.slice(1, close);
  } else if (value.split(':').length === 2) {
    value = value.split(':')[0];
  }

  value = value.toLowerCase();

  // ::ffff:203.0.113.9 is the same host as 203.0.113.9.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  if (mapped) value = mapped[1];

  return value || null;
}

/** Reduce an email to a stable key: case and surrounding space are not identity. */
export function canonicalEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The identifier this vote is recorded under, or `null` when the form does not
 * limit voting at all.
 *
 * Throws when the form *does* limit voting but the voter cannot be identified.
 * Failing closed matters here: the alternative is to let the vote through
 * unrecorded, which quietly turns duplicate prevention off for exactly the
 * requests most likely to be automated.
 */
export function resolveVoteIdentifier(
  method: DuplicatePrevention,
  ip: string | null,
  data: Record<string, any>,
  schema: any,
): string | null {
  if (method === 'none') return null;

  if (method === 'ip') {
    const address = canonicalIp(ip);
    if (!address) {
      throw createError(
        400,
        'We could not identify where this vote came from, so it was not counted. Please try again, or ask the form owner to switch this poll to email verification.',
      );
    }
    return `ip:${address}`;
  }

  if (method === 'email') {
    const emailField = (schema?.fields ?? []).find((f: any) => f.type === 'email');
    const email = emailField ? canonicalEmail(data[emailField.id]) : null;
    if (!email) {
      throw createError(
        400,
        'This poll accepts one vote per email address, so an email address is required.',
      );
    }
    return `email:${email}`;
  }

  return null;
}

/** Prisma's code for "a unique constraint rejected this row". */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}
