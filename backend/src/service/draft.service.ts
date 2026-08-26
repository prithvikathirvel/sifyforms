import { DraftDao } from '../dao/interfaces/DraftDao';
import { FormDao, FormSettings } from '../dao/interfaces/FormDao';
import { draftDao } from '../dao/factory/draftDao.factory';
import { formDao } from '../dao/factory/formDao.factory';
import { createError } from '../utils/errors';

export class DraftService {
  constructor(
    private readonly draftDao: DraftDao,
    private readonly formDao: FormDao,
  ) {}

  async getDraft(formId: string, identity: string) {
    const draft = await this.draftDao.findDraftByFormIdAndIdentity(formId, identity);
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
    identity: string;
    data: Record<string, unknown>;
    stepIndex?: number;
  }) {
    const form = await this.formDao.findFormById(input.formId);
    if (!form) {
      throw createError(404, 'Form not found');
    }

    let settings: FormSettings;
    try {
      settings = JSON.parse(form.settings);
    } catch {
      throw createError(500, 'Invalid form configuration');
    }

    if (!settings?.authentication?.enabled || !settings?.partialSubmission?.enabled) {
      throw createError(403, 'Partial submission is not enabled for this form');
    }

    return this.draftDao.upsert(input);
  }

  async deleteDraft(formId: string, identity: string) {
    await this.draftDao.deleteByFormAndIdentity(formId, identity);
    return { deleted: true };
  }
}

export const draftService = new DraftService(draftDao, formDao);
