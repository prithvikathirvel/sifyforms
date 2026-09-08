import { draftService } from '../../service/draft.service';
import { readFormSessionToken, requirePublicSession } from '../../service/publicSession.service';
import logger from '../../utils/logger';
import { StatusCodes } from 'http-status-codes';

const functions = require('@google-cloud/functions-framework');

/**
 * Drafts, as Cloud Functions.
 *
 * Same change as the Express controller, and it has to be made here too: these
 * handlers are a second front door onto the same service. A draft used to be
 * addressed by `?identity=someone@example.com` with nothing else in the
 * request, so anyone who knew an email address could read, overwrite or delete
 * that person's half-finished application. It is now scoped by the server-
 * issued form session — see service/draft.service.ts.
 *
 * Request bodies and headers are no longer logged: a draft body is somebody's
 * partly-filled answers, and the headers now carry the session token.
 */

function fail(res: any, label: string, error: any): void {
  logger.error(`GCF --> ${label} --> Error`, { message: error?.message });
  res
    .status(error?.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
    .json({
      message: error?.message || 'Internal server error',
      ...(error?.code === 'FORM_SESSION_REQUIRED' ? { code: error.code } : {}),
    });
}

// GET .../getDraft?formId=xxx     Header: X-Form-Session
export const getDraft = functions.http('getDraft', async (req: any, res: any) => {
  try {
    const formId = String(req.query.formId || '');
    logger.info('GCF --> getDraft --> Request', { formId });
    if (!formId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId is required' });
      return;
    }
    const session = await requirePublicSession(formId, readFormSessionToken(req.headers, req.body));
    const result = await draftService.getDraft(formId, session.id);
    res.json(result);
  } catch (error: any) {
    fail(res, 'getDraft', error);
  }
});

// POST .../saveDraft   Body: { formId, data, stepIndex }   Header: X-Form-Session
export const saveDraft = functions.http('saveDraft', async (req: any, res: any) => {
  try {
    const { formId, identity, data, stepIndex } = req.body ?? {};
    logger.info('GCF --> saveDraft --> Request', { formId });
    if (!formId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId is required' });
      return;
    }
    const session = await requirePublicSession(String(formId), readFormSessionToken(req.headers, req.body));
    const result = await draftService.saveDraft({
      formId: String(formId),
      sessionId: session.id,
      // A label for a future verified-resume flow. Nothing is looked up by it.
      identity: typeof identity === 'string' ? identity.slice(0, 320) : null,
      data: data && typeof data === 'object' ? data : {},
      stepIndex: Number.isInteger(stepIndex) ? stepIndex : 0,
    });
    res.json(result);
  } catch (error: any) {
    fail(res, 'saveDraft', error);
  }
});

// DELETE .../deleteDraft?formId=xxx     Header: X-Form-Session
export const deleteDraft = functions.http('deleteDraft', async (req: any, res: any) => {
  try {
    const formId = String(req.query.formId || '');
    logger.info('GCF --> deleteDraft --> Request', { formId });
    if (!formId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId is required' });
      return;
    }
    const session = await requirePublicSession(formId, readFormSessionToken(req.headers, req.body));
    const result = await draftService.deleteDraft(formId, session.id);
    res.json(result);
  } catch (error: any) {
    fail(res, 'deleteDraft', error);
  }
});
