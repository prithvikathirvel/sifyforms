import { submissionDao } from '../dao/factory/submissionDao.factory';
import { formDao } from '../dao/factory/formDao.factory';
import { submissionUniqueValueDao } from '../dao/factory/submissionUniqueValueDao.factory';
import { createError } from '../utils/errors';
import logger from '../utils/logger';
import { ACTIONS } from '../config/rbac.config';
import { assertResponseLevel, assertFormAction } from './formAccess.service';
import { viewSubmission, aggregateSubmissions } from './responseView.service';
import { evaluateShowWhen, validateSubmission } from '../lib/validation';
import { processAssessment } from '../services/assessment.processor';
import { ALREADY_VOTED_MESSAGE, checkVotingDuplicate, claimVote, processVote } from '../services/voting.processor';
import { resolveVoteIdentifier, type DuplicatePrevention } from '../services/voteIdentity';
import { CreateSubmissionSchema, UpdateSubmissionInput } from '../schemas/submission.schema';
import { SubmissionListFilter } from '../dao/interfaces/SubmissionDao';
import { verifyTurnstileToken } from './turnstile.service';
import { isBotProtectionEnabled, resolveUploadRules } from '../lib/formPolicy';
import { canonicaliseUniqueValue, collectUniqueClaims, hashUniqueValue } from '../lib/uniqueValue';
import { toCsv } from '../lib/csv';
import { createDocumentLookup } from './documentVerification.service';
import {
  EXTERNAL_CHECK_BUDGET,
  EXTERNAL_CHECK_HOURLY_BUDGET,
  UNIQUE_CHECK_BUDGET,
  budgetExceeded,
  consumeSessionBudget,
  consumeSharedBudget,
  type PublicSession,
} from './publicSession.service';
import axios from 'axios';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import { z } from 'zod';

export async function saveSurveyPartial(input: unknown) {
  const parsed = z.object({
    formId: z.string().min(1),
    sessionToken: z.string().min(32).max(256),
    data: z.record(z.string(), z.unknown()),
    stepIndex: z.number().int().min(0).max(1000).default(0),
  }).strict().safeParse(input);
  if (!parsed.success) throw createError(400, 'Invalid partial survey request');

  const form = await formDao.findFormById(parsed.data.formId);
  if (!form || !form.isPublished) throw createError(404, 'Survey not found or not published');
  const schema = JSON.parse(form.schema);
  const settings = JSON.parse(form.settings);
  if (settings.formType !== 'survey') throw createError(400, 'Partial sessions are available only for surveys');

  const strictAnonymous = (settings.survey?.identityMode ?? 'anonymous') === 'anonymous';
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  const allowed = new Set(fields.filter((field: any) => !field.disabled && !['display', 'html'].includes(field.type)
    && !(strictAnonymous && ['email', 'phone', 'signature', 'file'].includes(field.type))).map((field: any) => String(field.id)));
  const safeData = Object.fromEntries(Object.entries(parsed.data.data).filter(([key]) => allowed.has(key)));
  // Partial sessions follow the same conditional-visibility boundary as final
  // submissions. If an earlier answer hides a branch, stale answers from that
  // branch must not remain in storage or later analytics.
  for (const field of fields) {
    if (!evaluateShowWhen(field.showWhen, safeData)) delete safeData[field.id];
  }
  const serialized = JSON.stringify(safeData);
  if (serialized.length > 1_000_000) throw createError(413, 'Partial survey response is too large');
  const tokenHash = crypto.createHash('sha256').update(parsed.data.sessionToken).digest('hex');
  const sessions = (prisma as any).surveyResponseSession;
  await sessions.upsert({
    where: { formId_tokenHash: { formId: parsed.data.formId, tokenHash } },
    create: { formId: parsed.data.formId, tokenHash, data: serialized, stepIndex: parsed.data.stepIndex },
    update: { data: serialized, stepIndex: parsed.data.stepIndex },
  });
  return { saved: true };
}

export async function createSubmission(
  input: unknown,
  ip: string | null,
  userAgent: string | null,
) {
  const parsed = CreateSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    throw Object.assign(createError(400, 'Invalid submission request'), {
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  const { formId, data, turnstileToken, surveySessionToken } = parsed.data;

  // Whether bot protection applies is part of the form's settings, so the form
  // has to be loaded first. Nothing else happens before the check: no schema
  // processing, no external validation, no write, and no work proportional to
  // the size of the payload. The one thing an unverified caller can learn is
  // whether a form id exists and is published, which the public form endpoint
  // already tells anybody who asks.
  const form = await formDao.findFormById(formId);
  if (!form || !form.isPublished) throw createError(404, 'Form not found or not published');

  const schema = JSON.parse(form.schema);
  const settings = JSON.parse(form.settings);

  if (isBotProtectionEnabled(settings)) {
    if (!turnstileToken) {
      throw Object.assign(createError(400, 'Invalid submission request'), {
        details: [{ field: 'turnstileToken', message: 'Security verification is required' }],
      });
    }
    // Missing, forged, expired, and replayed tokens all fail here.
    await verifyTurnstileToken(turnstileToken, ip, formId);
  }

  if (settings.isFormActive === false) throw createError(403, 'This form is no longer accepting submissions.');
  if (settings.expirationDateTime && new Date() > new Date(settings.expirationDateTime)) {
    throw createError(403, 'This form has expired.');
  }

  // Field validation. The previous math challenge was client-generated and
  // therefore not a security boundary; Turnstile is now verified above.
  //
  // The file context is what lets validation check an upload instead of reading
  // the browser's description of it. Without it, file answers are refused —
  // see lib/fileAnswer.ts.
  const validation = await validateSubmission(schema, data, null, undefined, {
    files: {
      formId,
      uploadRules: resolveUploadRules(settings.dms),
      lookup: createDocumentLookup(),
    },
  });
  if (!validation.valid) {
    throw Object.assign(createError(400, 'Validation failed'), { details: validation.errors });
  }
  const finalData = validation.data;

  // Voting duplicate prevention.
  //
  // Two steps, and only the second one is a guarantee. This read turns away the
  // common case — somebody clicking submit twice, or coming back an hour later
  // — with a clear message and without writing anything. The race that two
  // simultaneous votes create is settled after the insert, by a unique
  // constraint the database enforces.
  const isVotingForm = settings.formType === 'voting';
  const votingMethod: DuplicatePrevention = isVotingForm
    ? (settings.voting?.duplicatePrevention ?? 'ip')
    : 'none';
  const voteIdentifier = isVotingForm
    ? resolveVoteIdentifier(votingMethod, ip, finalData, schema)
    : null;

  if (voteIdentifier) {
    const duplicateError = await checkVotingDuplicate(formId, voteIdentifier);
    if (duplicateError) throw Object.assign(createError(400, duplicateError), { code: 'ALREADY_VOTED' });
  }

  /*
   * Unique fields: the friendly pre-check.
   *
   * This turns away the ordinary case — somebody submitting the same
   * application twice — with a clear message naming the field, and without
   * writing anything. It is not the guarantee; the claim after the insert is.
   * Treat this exactly as `checkVotingDuplicate` above is treated.
   *
   * It also no longer costs a full table scan. The old version loaded every
   * submission for the form and compared answers in Node; this is one indexed
   * lookup per unique field.
   */
  const uniqueClaims = collectUniqueClaims(formId, schema.fields || [], finalData);
  for (const claim of uniqueClaims) {
    if (await submissionUniqueValueDao.exists(formId, claim.fieldId, claim.valueHash)) {
      throw createError(400, `The value for "${claim.label}" must be unique.`);
    }
  }

  const strictAnonymous = settings.formType === 'survey' && (settings.survey?.identityMode ?? 'anonymous') === 'anonymous';
  const submission = await submissionDao.createSubmission({
    formId,
    data: JSON.stringify(finalData),
    // Strict anonymous surveys deliberately discard transport metadata before persistence.
    ip: strictAnonymous ? null : ip,
    userAgent: strictAnonymous ? null : userAgent,
  });

  /*
   * Unique fields: the guarantee.
   *
   * A unique index decides who wins, not application code. Two submissions of
   * the same email that interleave between the pre-check and the insert both
   * passed the read; only one can create this row.
   *
   * The loser's submission is deleted, which cascades the claims it had already
   * made — so a partly-claimed submission cannot leave values reserved by a
   * response that no longer exists. Claiming one at a time rather than in a
   * batch is deliberate: a batch insert tells you it failed but not which value
   * collided, and the respondent needs to be told which field to change.
   */
  for (const claim of uniqueClaims) {
    let claimed = false;
    try {
      claimed = await submissionUniqueValueDao.claim({
        formId,
        fieldId: claim.fieldId,
        valueHash: claim.valueHash,
        submissionId: submission.id,
      });
    } catch (error) {
      await submissionDao.deleteSubmissionById(submission.id).catch(() => undefined);
      logger.error(`Failed to record unique value for form ${formId}`, error);
      throw createError(500, 'We could not save your response. Please try again.');
    }
    if (!claimed) {
      await submissionDao.deleteSubmissionById(submission.id).catch(() => undefined);
      throw createError(400, `The value for "${claim.label}" must be unique.`);
    }
  }

  // Claim the vote before telling anyone the submission succeeded. Whoever
  // loses the race here has their submission removed again, so a rejected voter
  // never leaves a row behind.
  if (voteIdentifier) {
    let claimed = false;
    try {
      claimed = await claimVote(formId, submission.id, voteIdentifier);
    } catch (error) {
      await submissionDao.deleteSubmissionById(submission.id).catch(() => undefined);
      logger.error(`Failed to record vote for form ${formId}`, error);
      throw createError(500, 'We could not record your vote. Please try again.');
    }
    if (!claimed) {
      await submissionDao.deleteSubmissionById(submission.id).catch(() => undefined);
      throw Object.assign(createError(400, ALREADY_VOTED_MESSAGE), { code: 'ALREADY_VOTED' });
    }
  }

  if (settings.formType === 'survey' && surveySessionToken) {
    const tokenHash = crypto.createHash('sha256').update(surveySessionToken).digest('hex');
    await (prisma as any).surveyResponseSession.updateMany({
      where: { formId, tokenHash },
      data: { completedAt: new Date() },
    });
  }

  // People answered under the terms shown on the form at this moment, so freeze
  // the response policy: it cannot be widened after the fact.
  const ownership = await formDao.findFormOwnership(formId);
  if (ownership && !ownership.responsePolicyLockedAt) {
    await formDao.updateForm(formId, { responsePolicyLockedAt: new Date() });
  }

  // Fire-and-forget post-submission processing
  if (settings.formType === 'assessment') {
    setImmediate(() => processAssessment(submission.id));
  } else if (isVotingForm) {
    // Only the tally recomputation is deferred; the vote itself is already
    // recorded above.
    setImmediate(() => processVote(submission.id, voteIdentifier ?? ''));
  }

  const redirectUrl = settings.redirectUrl || null;
  const safeRedirectUrl = (redirectUrl && /^(https?:\/\/)/i.test(redirectUrl)) ? redirectUrl : null;

  return {
    success: true,
    submissionId: submission.id,
    thankYouMessage: settings.thankYouMessage || 'Thank you for your submission!',
    redirectUrl: safeRedirectUrl,
  };
}

/**
 * "Is this value already taken?", asked from a public form while somebody
 * types.
 *
 * ## What was wrong with it
 *
 * The endpoint had no authentication, no session and no budget, and it answered
 * for any `fieldId` at all:
 *
 *     curl -d '{"formId":"F","fieldId":"email","value":"ceo@rival.com"}' .../check-unique
 *     {"isUnique": false}     ← that person applied
 *
 * For a recruitment form, a whistleblower form or a medical intake form, "has
 * this person submitted?" is often the most sensitive fact in the system, and
 * anyone with the public link could ask it about anyone, as fast as they liked.
 * Each question also loaded every submission for the form and compared answers
 * in Node, so one cheap request cost O(total responses).
 *
 * ## What it does now
 *
 * Four things narrow it, and it is worth being clear that they narrow it rather
 * than close it — an endpoint whose purpose is to answer this question is an
 * oracle by construction. The guarantee is still the submit-time check; this is
 * a courtesy that tells someone about a clash before they fill in the rest of
 * the page.
 *
 *  1. A server-issued session is required, so every question is attributable to
 *     a handle this server minted rather than to nobody.
 *  2. Each session may ask a fixed number of times. Enumeration then costs a
 *     fresh session per batch, and minting is rate limited per address.
 *  3. Only fields the schema actually marks `unique` can be asked about. Before
 *     this, `fieldId` was free text, so the endpoint would happily report on
 *     any answer to any question on the form — salary, medical history,
 *     anything — not just the ones whose uniqueness the form advertises.
 *  4. The lookup is a single indexed read of hashed values instead of a scan.
 */
export async function checkFieldUniqueness(
  formId: string,
  fieldId: string,
  value: unknown,
  session: PublicSession,
) {
  const form = await formDao.findFormById(formId);
  if (!form || !form.isPublished) throw createError(404, 'Form not found or not published');

  const schema = JSON.parse(form.schema);
  const field = (schema.fields || []).find((f: any) => String(f.id) === fieldId);

  // Not a unique field, so there is nothing to disclose. Reported as "unique"
  // rather than as an error: the browser asks this speculatively and a 400 here
  // would surface as a broken-looking field rather than as the no-op it is.
  if (!field?.unique) return { isUnique: true };

  const canonical = canonicaliseUniqueValue(value);
  if (canonical === null) return { isUnique: true };

  if (!(await consumeSessionBudget(session.id, 'uniqueChecks', UNIQUE_CHECK_BUDGET))) {
    throw budgetExceeded();
  }

  const valueHash = hashUniqueValue(formId, fieldId, canonical);
  const taken = await submissionUniqueValueDao.exists(formId, fieldId, valueHash);
  return { isUnique: !taken };
}

export async function listSubmissions(
  formId: string, orgId: string, userId: string,
  page: number, limit: number,
  status?: string, search?: string,
  startDate?: string, endDate?: string,
  sort?: string,
) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  // REDACTED is the floor for seeing rows at all. Anyone below it is either
  // aggregate-only or has no response access, and must use /aggregate instead.
  const access = await assertResponseLevel(userId, orgId, formId, 'REDACTED');
  const schema = JSON.parse(form.schema);

  const filter: SubmissionListFilter = {};
  if (status === 'read') filter.isRead = true;
  else if (status === 'unread') filter.isRead = false;
  if (startDate) filter.createdAtGte = new Date(startDate);
  if (endDate) filter.createdAtLte = new Date(endDate);
  filter.sort = sort === 'oldest' ? 'oldest' : 'newest';

  const term = search?.trim();
  // Whether this viewer has anything hidden from them. It depends on their
  // access level and the form's policy, not on any individual row, so it can
  // be decided before a single record is read.
  const mustRedact = access.level === 'REDACTED' || access.policy === 'BLIND_REVIEW';

  const shape = (rows: Awaited<ReturnType<typeof submissionDao.findSubmissionsByFormId>>) => rows
    .map(s => viewSubmission(s, schema, access.level, access.policy))
    .filter((s): s is NonNullable<ReturnType<typeof viewSubmission>> => s !== null);

  if (term && mustRedact) {
    /*
     * The careful path.
     *
     * This viewer has fields masked, so the term cannot be handed to the
     * database: `WHERE data LIKE '%0412345678%'` would happily return the row
     * containing a phone number this person is not allowed to read, and the
     * hit itself discloses the value. Instead every candidate row is redacted
     * first and the term is matched against what the viewer would actually
     * see, which is also what makes the count honest.
     *
     * The cost is loading the form's rows to answer one search. Acceptable
     * because it only happens while someone is typing in the search box on a
     * blind-review or redacted form, and it is the only way to search without
     * leaking. The unredacted case below stays on the indexed path.
     */
    const all = await submissionDao.findSubmissionsForExport(formId);
    const inFilter = all.filter(row => {
      if (filter.isRead !== undefined && row.isRead !== filter.isRead) return false;
      if (filter.createdAtGte && row.createdAt < filter.createdAtGte) return false;
      if (filter.createdAtLte && row.createdAt > filter.createdAtLte) return false;
      return true;
    });
    if (filter.sort === 'oldest') inFilter.reverse();

    const needle = term.toLowerCase();
    const matched = shape(inFilter).filter(s => JSON.stringify(s.data).toLowerCase().includes(needle));

    const start = (page - 1) * limit;
    return {
      submissions: matched.slice(start, start + limit),
      access: { level: access.level, policy: access.policy },
      pagination: { page, limit, total: matched.length, totalPages: Math.ceil(matched.length / limit) },
    };
  }

  if (term) filter.dataContains = term;

  const skip = (page - 1) * limit;
  const [submissions, total] = await Promise.all([
    submissionDao.findSubmissionsByFormId(formId, skip, limit, filter),
    submissionDao.countSubmissionsByFormId(formId, filter),
  ]);

  return {
    // Shaped before anything else touches it, so no unredacted value can leak
    // through a later code path.
    submissions: shape(submissions),
    access: { level: access.level, policy: access.policy },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Counts and distributions, with no individual response leaving the server.
 *
 * This is what an aggregate-only viewer gets, and it is the reason the AGGREGATE
 * tier is worth having: real insight from a form nobody may read row by row.
 */
export async function getSubmissionAggregate(formId: string, orgId: string, userId: string) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  const access = await assertResponseLevel(userId, orgId, formId, 'AGGREGATE');
  const submissions = await submissionDao.findSubmissionsForExport(formId);
  const summary = aggregateSubmissions(formId, submissions, JSON.parse(form.schema));
  const settings = JSON.parse(form.settings);
  let surveyOverview: { incomplete: number; started: number; completionRate: number } | undefined;
  if (settings.formType === 'survey') {
    const incomplete = await (prisma as any).surveyResponseSession.count({ where: { formId, completedAt: null } });
    const completedSessions = await (prisma as any).surveyResponseSession.count({ where: { formId, completedAt: { not: null } } });
    const started = incomplete + Math.max(completedSessions, summary.total);
    surveyOverview = { incomplete, started, completionRate: started ? Number((summary.total / started * 100).toFixed(1)) : 0 };
  }

  return { ...summary, formName: form.name, surveyOverview, access: { level: access.level, policy: access.policy } };
}

export async function getSubmission(
  submissionId: string, formId: string, orgId: string, userId: string
) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  const access = await assertResponseLevel(userId, orgId, formId, 'REDACTED');

  const submission = await submissionDao.findSubmissionByIdAndForm(submissionId, formId);
  if (!submission) throw createError(404, 'Submission not found');

  if (!submission.isRead) await submissionDao.markSubmissionAsRead(submissionId);

  const viewed = viewSubmission(submission, JSON.parse(form.schema), access.level, access.policy);
  if (!viewed) throw createError(403, 'You cannot view individual responses to this form');
  return viewed;
}

export async function updateSubmission(
  submissionId: string, formId: string, orgId: string, userId: string, updates: UpdateSubmissionInput,
) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  // Editing response content requires seeing it unmasked; writing over a
  // redacted view would destroy the values the mask was hiding.
  const editsContent = updates.data !== undefined;
  await assertResponseLevel(userId, orgId, formId, editsContent ? 'FULL' : 'REDACTED');

  const submission = await submissionDao.findSubmissionByIdAndForm(submissionId, formId);
  if (!submission) throw createError(404, 'Submission not found');

  const updateData: { data?: string; isRead?: boolean; tags?: string } = {};
  if (updates.data !== undefined) updateData.data = JSON.stringify(updates.data);
  if (updates.isRead !== undefined) updateData.isRead = updates.isRead;
  if (updates.tags !== undefined) updateData.tags = JSON.stringify(updates.tags);

  const updated = await submissionDao.updateSubmission(submissionId, updateData);
  return { ...updated, data: JSON.parse(updated.data), tags: JSON.parse(updated.tags) };
}

export async function deleteSubmission(
  submissionId: string, formId: string, orgId: string, userId: string
) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  await assertFormAction(userId, orgId, formId, ACTIONS.DELETE_RESPONSES);

  const submission = await submissionDao.findSubmissionByIdAndForm(submissionId, formId);
  if (!submission) throw createError(404, 'Submission not found');

  await submissionDao.deleteSubmissionById(submissionId);
  return { message: 'Submission deleted successfully' };
}

export async function exportSubmissions(
  formId: string, orgId: string, userId: string, format: string = 'json', ids?: string[]
) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  // EXPORT is its own tier rather than a consequence of FULL: this is the point
  // at which the data leaves the platform, so it is granted and logged apart.
  const access = await assertResponseLevel(userId, orgId, formId, 'EXPORT');
  logger.info('Submission export', {
    userId, orgId, formId, format, count: ids ? ids.length : 'all', policy: access.policy,
  });

  const submissions = await submissionDao.findSubmissionsForExport(formId, ids);
  const exportSchema = JSON.parse(form.schema);
  const exportFields = Array.isArray(exportSchema.fields) ? exportSchema.fields : [];
  const data = submissions.map(s => {
    const answers = JSON.parse(s.data);
    const flattened: Record<string, unknown> = {};
    for (const field of exportFields) {
      const answer = answers[field.id];
      if (field.type === 'likert' && answer && typeof answer === 'object' && !Array.isArray(answer)) {
        for (const row of field.surveyConfig?.rows ?? []) flattened[`${field.id}.${row.id}`] = answer[row.id] ?? '';
      } else if (field.type === 'ranking' && Array.isArray(answer)) {
        flattened[field.id] = answer.join(' > ');
      } else {
        flattened[field.id] = answer;
      }
    }
    return { id: s.id, ...flattened, submittedAt: s.createdAt, isRead: s.isRead };
  });

  if (format === 'csv') {
    if (data.length === 0) return { format: 'csv' as const, formName: form.name, csvContent: 'No submissions' };
    const headers = Array.from(new Set(data.flatMap((row) => Object.keys(row))));
    // Quoting alone protected the file's shape, not the person opening it: a
    // value beginning `=`, `+`, `-` or `@` is still a live formula once Excel
    // has unquoted the cell. See lib/csv.ts.
    return { format: 'csv' as const, formName: form.name, csvContent: toCsv(headers, data) };
  }

  return { format: 'json' as const, formName: form.name, data };
}

export async function bulkDeleteSubmissions(
  formId: string, orgId: string, userId: string, ids: string[]
) {
  const form = await formDao.findFormByIdAndOrg(formId, orgId);
  if (!form) throw createError(404, 'Form not found');

  await assertFormAction(userId, orgId, formId, ACTIONS.DELETE_RESPONSES);

  await submissionDao.bulkDeleteSubmissions(formId, ids);
  return { message: `${ids.length} submissions deleted successfully` };
}

/**
 * Ask the organization's own API whether a value is valid — a PAN number, an
 * employee id, a policy number.
 *
 * ## What was wrong with it
 *
 * The endpoint was public, and the config it loads holds the customer's stored
 * credentials: a bearer token, a basic-auth password or a custom API key. So an
 * unauthenticated caller could make this server send a request to the
 * customer's endpoint, with the customer's credentials, as often as they liked:
 *
 *     curl -d '{"formId":"F","fieldId":"pan","value":"X","formData":{...}}' .../check-external
 *
 * `formData` made it worse. `param.type === 'field'` copies values out of it
 * into the outbound body, so the caller partially chose the contents of a
 * request sent by us, signed by them. Enough volume and the organization's
 * third-party quota is spent or their rate limit trips — and neither the bill
 * nor the block lands on the person who caused it.
 *
 * ## What it does now
 *
 * A session is required, so the calls are attributable and boundable. Two
 * budgets apply, and they answer different questions:
 *
 *  - per session, because one respondent filling in one form needs a handful of
 *    checks, not hundreds;
 *  - per form per hour, shared across every replica, because the thing being
 *    protected is the organization's spend. `express-rate-limit` cannot express
 *    this: its counters live in one process's memory, so its limit is really
 *    per replica per restart. See `consumeSharedBudget`.
 *
 * And `formData` is filtered here rather than in the browser. The client
 * already sends only the referenced fields, but a client-side filter is a
 * courtesy; this is the copy that decides what may enter the outbound payload.
 */
export async function checkExternalValidation(
  formId: string,
  fieldId: string,
  value: unknown,
  formData: Record<string, unknown> | undefined,
  session: PublicSession,
) {
  const form = await formDao.findFormById(formId);
  if (!form) throw createError(404, 'Form not found');

  const schema = JSON.parse(form.schema);
  const field = schema.fields.find((f: any) => f.id === fieldId);

  if (!field || !field.externalValidation?.enabled) return { isValid: true };

  const config = field.externalValidation;

  // Both budgets are consumed before the outbound call. The session's own
  // budget is spent first so that a call we are going to refuse anyway is not
  // also charged to the organization's hourly ceiling. Checking in the other
  // order would not make the ceiling any stronger — a caller with a fresh
  // session per request passes the session budget every time regardless — it
  // would only bill the customer for requests that never left the building.
  if (!(await consumeSessionBudget(session.id, 'externalChecks', EXTERNAL_CHECK_BUDGET))) {
    throw budgetExceeded();
  }
  if (!(await consumeSharedBudget(`external:${formId}`, 60 * 60 * 1000, EXTERNAL_CHECK_HOURLY_BUDGET))) {
    throw createError(429, 'This form has reached its verification limit for now. Please try again later.');
  }

  const payload: Record<string, unknown> = {};
  payload[config.fieldValueKey || 'value'] = value;

  // Only fields this config names may contribute to the outbound body. An id
  // that is not in the list, or not a real field on this form, is dropped.
  const referenced = new Set<string>(
    (Array.isArray(config.referencedFieldIds) ? config.referencedFieldIds : []).map(String),
  );
  const publishedFieldIds = new Set<string>((schema.fields || []).map((f: any) => String(f.id)));

  if (config.params && Array.isArray(config.params)) {
    config.params.forEach((param: any) => {
      if (!param.key) return;
      if (param.type === 'static') {
        // Set by the organization when it configured the field, not by the
        // caller, so it passes through as written.
        payload[param.key] = param.value;
        return;
      }
      if (param.type !== 'field' || !formData) return;
      const sourceId = String(param.value);
      // `param.value` naming a field is the config's decision; whether that
      // field may be read from the request is checked here.
      if (!publishedFieldIds.has(sourceId)) return;
      if (referenced.size > 0 && !referenced.has(sourceId)) return;
      payload[param.key] = formData[sourceId];
    });
  }

  const headers: Record<string, string> = {};
  (config.headers ?? []).forEach((h: any) => { if (h.key) headers[h.key] = h.value; });
  if (config.auth?.type === 'bearer' && config.auth.token) {
    headers['Authorization'] = `Bearer ${config.auth.token}`;
  } else if (config.auth?.type === 'basic' && config.auth.username && config.auth.password) {
    headers['Authorization'] = `Basic ${Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64')}`;
  } else if (config.auth?.type === 'custom' && config.auth.customHeaderName && config.auth.token) {
    headers[config.auth.customHeaderName] = config.auth.token;
  }

  try {
    const isGet = (config.method || 'POST').toUpperCase() === 'GET';
    const response = await axios({ url: config.url, method: config.method || 'POST', headers, [isGet ? 'params' : 'data']: payload, timeout: 5000 });

    let extracted = response.data;
    const responseCheck = config.responseCheck;
    const checkType = responseCheck?.type || responseCheck?.logic || 'boolean';
    const path = responseCheck?.path || config.successPath;
    if (path) extracted = path.split('.').reduce((obj: any, k: string) => obj?.[k], response.data);

    let isValid = true;
    switch (checkType) {
      case 'boolean':    isValid = Boolean(extracted); break;
      case 'equals':     isValid = String(extracted) === String(responseCheck?.targetValue); break;
      case 'notEquals':  isValid = String(extracted) !== String(responseCheck?.targetValue); break;
      case 'contains':   isValid = String(extracted).includes(String(responseCheck?.targetValue)); break;
      case 'notContains':isValid = !String(extracted).includes(String(responseCheck?.targetValue)); break;
      case 'regex':      try { isValid = new RegExp(String(responseCheck?.targetValue)).test(String(extracted)); } catch { isValid = false; } break;
      case 'greaterThan':isValid = Number(extracted) > Number(responseCheck?.targetValue); break;
      case 'lessThan':   isValid = Number(extracted) < Number(responseCheck?.targetValue); break;
      case 'exists':     isValid = extracted !== undefined && extracted !== null; break;
      default:           isValid = Boolean(extracted);
    }

    return { isValid, message: isValid ? (config.successMsg || 'Verified') : (config.errorMsg || 'Validation failed') };
  } catch {
    return { isValid: false, message: config.errorMsg || 'Could not reach validation server' };
  }
}
