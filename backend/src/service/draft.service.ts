import { DraftDao } from '../dao/interfaces/DraftDao';
import { FormDao, FormSettings } from '../dao/interfaces/FormDao';
import { draftDao } from '../dao/factory/draftDao.factory';
import { formDao } from '../dao/factory/formDao.factory';
import { createError } from '../utils/errors';
import { evaluateShowWhen } from '../lib/validation';

/**
 * Saved drafts for public forms.
 *
 * ## What changed and why
 *
 * A draft used to be addressed by the respondent's email address, taken from
 * the query string, on routes with no authentication and no rate limit:
 *
 *     GET    /api/drafts/<formId>?identity=victim@company.com
 *     POST   /api/drafts            {"identity":"victim@company.com", ...}
 *     DELETE /api/drafts/<formId>?identity=victim@company.com
 *
 * There was no secret anywhere in those requests. Knowing somebody's email
 * address was the entire authorisation check for reading, overwriting or
 * deleting their half-finished application. The form's OTP gate did not help:
 * it is enforced in the browser, so the drafts API never knew it existed.
 *
 * Drafts are now keyed on a server-issued session (see
 * service/publicSession.service.ts). The key is a secret the server generated,
 * held by the one browser it was handed to, and it says nothing about who the
 * respondent is.
 *
 * ## What this costs
 *
 * Resuming on a *different device* no longer works. That is deliberate, and it
 * is not really a loss: the only thing that made cross-device resume work
 * before was typing an email address, which is precisely the hole. Restoring
 * it properly needs an OTP the server actually verifies — at which point
 * `PublicFormSession.verifiedIdentity` is where the verified address lands, and
 * a draft can be adopted by matching on it. The column is there and is
 * deliberately unreachable from request input until that check exists.
 */

/** A draft is a partly-filled form, not a data store. */
const MAX_DRAFT_BYTES = 1_000_000;

export class DraftService {
  constructor(
    private readonly draftDao: DraftDao,
    private readonly formDao: FormDao,
  ) {}

  async getDraft(formId: string, sessionId: string) {
    const draft = await this.draftDao.findDraftByFormIdAndSession(formId, sessionId);
    if (!draft) return { draft: null };

    let parsedData: Record<string, unknown>;
    try {
      parsedData = JSON.parse(draft.data);
    } catch {
      return { draft: null };
    }

    return {
      draft: {
        id: draft.id,
        data: parsedData,
        stepIndex: draft.stepIndex,
        updatedAt: draft.updatedAt,
      },
    };
  }

  async saveDraft(input: {
    formId: string;
    sessionId: string;
    identity?: string | null;
    data: Record<string, unknown>;
    stepIndex?: number;
  }) {
    const form = await this.formDao.findFormById(input.formId);
    if (!form) {
      throw createError(404, 'Form not found');
    }

    let settings: FormSettings;
    let schema: any;
    try {
      settings = JSON.parse(form.settings);
      schema = JSON.parse(form.schema);
    } catch {
      throw createError(500, 'Invalid form configuration');
    }

    if (!settings?.authentication?.enabled || !settings?.partialSubmission?.enabled) {
      throw createError(403, 'Partial submission is not enabled for this form');
    }

    /*
     * Keep only answers to fields this form actually publishes, and only the
     * ones currently visible.
     *
     * The draft table used to accept whatever JSON was posted. That made an
     * unauthenticated endpoint into free storage, and it meant a draft could
     * carry keys that no field will ever validate — which then get restored
     * into the form on the next visit and travel along with the submission.
     * This is the same boundary `saveSurveyPartial` applies, for the same
     * reasons.
     */
    const fields = Array.isArray(schema?.fields) ? schema.fields : [];
    const allowed = new Set(
      fields
        .filter((field: any) => field && !field.disabled && !['display', 'html'].includes(field.type))
        .map((field: any) => String(field.id)),
    );
    const safeData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input.data ?? {})) {
      if (allowed.has(key)) safeData[key] = value;
    }
    for (const field of fields) {
      if (!evaluateShowWhen(field.showWhen, safeData)) delete safeData[field.id];
    }

    if (JSON.stringify(safeData).length > MAX_DRAFT_BYTES) {
      throw createError(413, 'This draft is too large to save.');
    }

    return this.draftDao.upsert({
      formId: input.formId,
      sessionId: input.sessionId,
      identity: input.identity ?? null,
      data: safeData,
      stepIndex: input.stepIndex,
    });
  }

  async deleteDraft(formId: string, sessionId: string) {
    await this.draftDao.deleteByFormAndSession(formId, sessionId);
    return { deleted: true };
  }
}

export const draftService = new DraftService(draftDao, formDao);
