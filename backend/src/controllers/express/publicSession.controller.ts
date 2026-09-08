import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { issueSessionForPublishedForm } from '../../service/publicSession.service';
import logger from '../../utils/logger';

/**
 * Hands a respondent a session for a published form.
 *
 * Open by design — a public form is public, so anyone who can load the page can
 * get one. The point is not to decide who may have a session; it is that the
 * handle is issued by the server instead of being whatever the browser felt
 * like calling itself. See service/publicSession.service.ts for what that does
 * and, more importantly, what it does not do.
 */
export async function createFormSession(req: Request, res: Response): Promise<void> {
  try {
    const formId = Array.isArray(req.params.formId) ? req.params.formId[0] : req.params.formId;
    if (!formId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId is required' });
      return;
    }
    const { token, expiresAt } = await issueSessionForPublishedForm(formId);
    res.status(StatusCodes.CREATED).json({ token, expiresAt });
  } catch (error: any) {
    logger.error('Express --> createFormSession --> Error', { message: error?.message });
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}
