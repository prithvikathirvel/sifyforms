import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { draftService } from '../../service/draft.service';
import { PublicSessionRequest } from '../../middleware/publicSession.middleware';
import logger from '../../utils/logger';

/**
 * Draft endpoints.
 *
 * `requirePublicFormSession` runs in front of all three, so `req.publicSession`
 * is guaranteed and is the only thing that scopes the read or write. Note what
 * is absent: nothing here reads an `identity` from the request in order to find
 * a row. That parameter is what made these routes readable by anyone who knew
 * an email address.
 *
 * Request bodies are no longer logged either. A draft body is a person's
 * half-finished answers, which for these forms includes identity numbers and
 * salary — none of which belongs in application logs.
 */

export async function getDraft(req: PublicSessionRequest, res: Response): Promise<void> {
  try {
    const session = req.publicSession!;
    logger.info('Express --> getDraft --> Request', { formId: session.formId });
    const result = await draftService.getDraft(session.formId, session.id);
    res.json(result);
  } catch (error: any) {
    logger.error('Express --> getDraft --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function saveDraft(req: PublicSessionRequest, res: Response): Promise<void> {
  try {
    const session = req.publicSession!;
    const { data, stepIndex, identity } = req.body ?? {};
    logger.info('Express --> saveDraft --> Request', { formId: session.formId });

    const result = await draftService.saveDraft({
      formId: session.formId,
      sessionId: session.id,
      // Recorded as a label only. It is never used to find a draft, so a caller
      // claiming somebody else's address gains nothing by it.
      identity: typeof identity === 'string' ? identity.slice(0, 320) : null,
      data: data && typeof data === 'object' ? data : {},
      stepIndex: Number.isInteger(stepIndex) ? stepIndex : 0,
    });
    res.json(result);
  } catch (error: any) {
    logger.error('Express --> saveDraft --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function deleteDraft(req: PublicSessionRequest, res: Response): Promise<void> {
  try {
    const session = req.publicSession!;
    logger.info('Express --> deleteDraft --> Request', { formId: session.formId });
    const result = await draftService.deleteDraft(session.formId, session.id);
    res.json(result);
  } catch (error: any) {
    logger.error('Express --> deleteDraft --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}
