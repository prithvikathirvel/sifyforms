import crypto from 'crypto';
import prisma from '../utils/prisma';
import { formDao } from '../dao/factory/formDao.factory';
import { createError } from '../utils/errors';

/**
 * A respondent's session on a public form.
 *
 * ## Why this exists
 *
 * Three public endpoints needed to know "who is asking", and all three answered
 * that question with a value the caller supplies. Drafts were scoped to an
 * email address in the query string. `check-unique` and `check-external` were
 * scoped to nothing at all. An email address is not a secret, and neither is an
 * empty string, so none of the three had a boundary — knowing somebody's
 * address was the entire authorisation check for reading their half-finished
 * application.
 *
 * A session is the missing secret: 48 random bytes the server generates, hands
 * out once, and thereafter recognises by hash. It says nothing about who the
 * respondent is. It says only that this is the same browser that was here
 * before, which is exactly what "my draft" and "my budget" need and no more.
 *
 * ## What it deliberately does not do
 *
 * It does not establish identity. `verifiedIdentity` is on the row and is never
 * written from request input; it is reserved for a server-side OTP check that
 * does not exist yet (the current gate is a hardcoded `1234` verified in the
 * browser). Until that check exists, no path here will tell a caller anything
 * scoped to a person — which is the correct behaviour for a verification step
 * that has not been built, rather than pretending the browser's word for it is
 * good enough.
 *
 * ## Transport
 *
 * The token travels in an `X-Form-Session` header, not a cookie. A cookie would
 * be sent automatically by the browser on any cross-site request, which would
 * turn every draft write into a CSRF target and mean adding a second token to
 * defend the first. A header has to be set deliberately by our own code, and
 * the cross-origin rules stop another site from setting it.
 */

/** How long a session is good for. Long enough to finish a long form in one sitting, come back after lunch, and not much more. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Per-session budgets.
 *
 * These are not rate limits in the "stop a flood" sense; the IP limiter does
 * that. They put a ceiling on how much one session can learn or spend, so that
 * abusing either endpoint costs a fresh session every N questions — and minting
 * a session is itself limited per address.
 */
export const UNIQUE_CHECK_BUDGET = 25;
export const EXTERNAL_CHECK_BUDGET = 25;

/**
 * How often one form may spend its organization's API credentials in an hour.
 *
 * Deliberately generous — this is a ceiling on abuse, not a throttle on use. A
 * busy recruitment form might legitimately run a few hundred PAN checks in a
 * peak hour; nothing legitimate runs fifty thousand. Shared across replicas,
 * because it is a fact about the customer's account rather than about one
 * process.
 */
export const EXTERNAL_CHECK_HOURLY_BUDGET = 500;

export interface PublicSession {
  id: string;
  formId: string;
  verifiedIdentity: string | null;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Mint a session for `formId`.
 *
 * Returns the token exactly once. Only its hash is stored, so a database dump
 * cannot be replayed and neither can a log line that captured the row.
 */
export async function createPublicSession(formId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.publicFormSession.create({
    data: { formId, tokenHash: hashToken(token), expiresAt },
  });

  // Opportunistic cleanup. Sessions are small and expire quickly, so a sweep on
  // roughly one mint in fifty keeps the table flat without a scheduled job.
  if (Math.random() < 0.02) {
    prisma.publicFormSession
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => undefined);
  }

  return { token, expiresAt };
}

/**
 * The session this token names, or null.
 *
 * Null covers every failure the same way — unknown token, expired token, token
 * for a different form — because telling them apart would let a caller probe
 * for live tokens.
 */
export async function resolvePublicSession(formId: string, token: string | undefined): Promise<PublicSession | null> {
  if (!token || typeof token !== 'string' || token.length < 32 || token.length > 256) return null;

  const row = await prisma.publicFormSession.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row) return null;

  // A session belongs to one form. Without this, a token minted on a form the
  // caller owns would authorise budgeted calls against somebody else's.
  if (row.formId !== formId) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;

  // Cheap liveness marker for the sweep. Not awaited; nothing depends on it.
  prisma.publicFormSession
    .update({ where: { id: row.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);

  return { id: row.id, formId: row.formId, verifiedIdentity: row.verifiedIdentity };
}

/**
 * Spend one unit of a session's budget, or refuse.
 *
 * The increment and the limit test are the same statement: `updateMany` with
 * the current count in the `where` clause updates one row when there was room
 * and zero rows when there was not. Two simultaneous requests cannot both see
 * the last remaining unit, which a read-then-write would allow.
 */
export async function consumeSessionBudget(
  sessionId: string,
  kind: 'uniqueChecks' | 'externalChecks',
  limit: number,
): Promise<boolean> {
  const { count } = await prisma.publicFormSession.updateMany({
    where: { id: sessionId, [kind]: { lt: limit } },
    data: { [kind]: { increment: 1 } },
  });
  return count === 1;
}

/**
 * A budget shared by every replica, for limits that belong to an organization
 * rather than to a process.
 *
 * `express-rate-limit` keeps its counters in memory, so "200 per hour" is
 * really "200 per hour per replica since the last restart". That is fine for
 * turning away a flood and useless for "this form may spend its third-party API
 * credentials 200 times an hour", which has to hold across the deployment.
 *
 * Fixed windows, not a sliding log: a caller can burst across a boundary and
 * get up to twice the limit in a short span. Accepted deliberately — the cost
 * is one row and one upsert per call, and the thing being protected is a
 * spending ceiling, not a fairness guarantee.
 */
export async function consumeSharedBudget(scope: string, windowMs: number, limit: number): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const row = await prisma.publicRateCounter.upsert({
    where: { scope_windowStart: { scope, windowStart } },
    create: { scope, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  if (Math.random() < 0.02) {
    prisma.publicRateCounter
      .deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      .catch(() => undefined);
  }

  return row.count <= limit;
}

/**
 * Mint a session for a form, having first checked that the form is one a
 * respondent could actually be looking at.
 *
 * Shared by all three transports so the same two conditions apply everywhere.
 * A caller learns nothing from the 404 that the public form endpoint would not
 * already tell them.
 */
export async function issueSessionForPublishedForm(formId: string): Promise<{ token: string; expiresAt: Date }> {
  const form = await formDao.findFormById(formId);
  if (!form || !form.isPublished) throw createError(404, 'Form not found or not published.');
  return createPublicSession(formId);
}

/** The 429 every budget failure raises, so the wording is the same everywhere. */
export function budgetExceeded(): Error {
  return createError(429, 'Too many verification requests. Please reload the form and try again.');
}

/**
 * Pull the session token out of a request, whichever transport delivered it.
 *
 * The header is the intended channel. The body is accepted as well so a caller
 * that cannot set headers is not locked out; it is the same secret either way,
 * and the header is preferred only because it stays out of anything that logs
 * request bodies.
 */
export function readFormSessionToken(
  headers: Record<string, unknown> | undefined,
  body: Record<string, unknown> | undefined,
): string | undefined {
  const raw = headers?.['x-form-session'] ?? headers?.['X-Form-Session'];
  const fromHeader = Array.isArray(raw) ? raw[0] : raw;
  if (typeof fromHeader === 'string' && fromHeader) return fromHeader;
  const fromBody = body?.formSessionToken;
  return typeof fromBody === 'string' ? fromBody : undefined;
}

/**
 * Resolve a session or refuse the request.
 *
 * Shared by all three transports — Express, Cloud Functions and Lambda — so the
 * gate cannot be present on one and missing on another. That is not
 * hypothetical: the endpoints this guards exist three times over in this
 * codebase, and a fix applied to one copy would have left the other two exactly
 * as they were.
 *
 * `FORM_SESSION_REQUIRED` is what the browser watches for; it means "mint a new
 * session and retry once", which is what happens when a session expires
 * mid-form. Without a distinguishable code the client cannot tell a stale
 * session from a real refusal.
 */
export async function requirePublicSession(
  formId: string,
  token: string | undefined,
): Promise<PublicSession> {
  const session = await resolvePublicSession(formId, token);
  if (!session) {
    throw Object.assign(
      createError(401, 'This form session has expired. Reload the page to continue.'),
      { code: 'FORM_SESSION_REQUIRED' },
    );
  }
  return session;
}
