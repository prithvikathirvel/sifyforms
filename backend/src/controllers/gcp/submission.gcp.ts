import * as submissionService from '../../service/submission.service';
import { gcfAuthMiddleware } from '../../utils/gcfAuth';
import { AuthRequest } from '../../middleware/auth.middleware';
import { readFormSessionToken, requirePublicSession } from '../../service/publicSession.service';
import logger from '../../utils/logger';
import { StatusCodes } from 'http-status-codes';

const functions = require('@google-cloud/functions-framework');

// POST https://<region>-<project>.cloudfunctions.net/createSubmission
// No auth — public form submission
// Body: { formId, data, turnstileToken }
export const createSubmission = functions.http('createSubmission', async (req: any, res: any) => {
  try {
    logger.info('GCF --> createSubmission --> Request', { formId: req.body.formId });
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const userAgent = req.headers['user-agent'] || null;
    const result = await submissionService.createSubmission(req.body, ip, userAgent);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    logger.error('GCF --> createSubmission --> Error', error);
    if (error.code === 'ALREADY_VOTED') {
      res.status(StatusCodes.BAD_REQUEST).json({ error: error.message, code: 'ALREADY_VOTED' });
      return;
    }
    if (error.details) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: error.message, details: error.details });
      return;
    }
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

export const saveSurveyPartial = functions.http('saveSurveyPartial', async (req: any, res: any) => {
  try {
    const result = await submissionService.saveSurveyPartial(req.body);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

/*
 * These two are public but no longer anonymous, exactly as in the Express
 * routes. `checkFieldUniqueness` answers "has this person already submitted?",
 * and `checkExternalValidation` makes this server call the organization's API
 * with the organization's stored credentials. Both now require a server-issued
 * form session so the answers and the spending can be budgeted.
 *
 * The gate lives in `requirePublicSession` rather than in a middleware so that
 * all three transports enforce the same thing; guarding only the Express copy
 * would leave this one exactly as it was.
 */

function publicSessionFailure(res: any, label: string, error: any): void {
  logger.error(`GCF --> ${label} --> Error`, { message: error?.message });
  res.status(error?.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: error?.message,
    ...(error?.code ? { code: error.code } : {}),
  });
}

// POST https://<region>-<project>.cloudfunctions.net/checkFieldUniqueness
// Body: { formId, fieldId, value }   Header: X-Form-Session
export const checkFieldUniqueness = functions.http('checkFieldUniqueness', async (req: any, res: any) => {
  try {
    const { formId, fieldId, value } = req.body ?? {};
    // The value is deliberately absent from the log line: this endpoint is
    // asked about addresses belonging to people who have submitted nothing.
    logger.info('GCF --> checkFieldUniqueness --> Request', { formId, fieldId });
    if (!formId || !fieldId || value === undefined) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId, fieldId, and value are required' });
      return;
    }
    const session = await requirePublicSession(String(formId), readFormSessionToken(req.headers, req.body));
    const result = await submissionService.checkFieldUniqueness(String(formId), String(fieldId), value, session);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    publicSessionFailure(res, 'checkFieldUniqueness', error);
  }
});

// POST https://<region>-<project>.cloudfunctions.net/checkExternalValidation
// Body: { formId, fieldId, value, formData? }   Header: X-Form-Session
export const checkExternalValidation = functions.http('checkExternalValidation', async (req: any, res: any) => {
  try {
    const { formId, fieldId, value, formData } = req.body ?? {};
    logger.info('GCF --> checkExternalValidation --> Request', { formId, fieldId });
    if (!formId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId is required' });
      return;
    }
    const session = await requirePublicSession(String(formId), readFormSessionToken(req.headers, req.body));
    const result = await submissionService.checkExternalValidation(String(formId), fieldId, value, formData, session);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    publicSessionFailure(res, 'checkExternalValidation', error);
  }
});

// GET https://<region>-<project>.cloudfunctions.net/listSubmissions?formId=xxx&orgId=xxx&page=1&limit=50&status=&search=&startDate=&endDate=
export const listSubmissions = functions.http('listSubmissions', async (req: any, res: any) => {
  try {
    logger.info('GCF --> listSubmissions --> Request', { query: req.query });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const { formId, orgId, page = '1', limit = '50', status, search, startDate, endDate } = req.query;
    if (!formId || !orgId) { res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and orgId are required' }); return; }
    const result = await submissionService.listSubmissions(
      String(formId), String(orgId), (req as AuthRequest).user!.id,
      parseInt(String(page), 10), parseInt(String(limit), 10),
      status ? String(status) : undefined,
      search ? String(search) : undefined,
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined,
    );
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> listSubmissions --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// GET https://<region>-<project>.cloudfunctions.net/getSubmission?formId=xxx&submissionId=xxx&orgId=xxx
export const getSubmission = functions.http('getSubmission', async (req: any, res: any) => {
  try {
    logger.info('GCF --> getSubmission --> Request', { query: req.query });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const { formId, submissionId, orgId } = req.query;
    if (!formId || !submissionId || !orgId) { res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId, submissionId and orgId are required' }); return; }
    const result = await submissionService.getSubmission(String(submissionId), String(formId), String(orgId), (req as AuthRequest).user!.id);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> getSubmission --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// PUT https://<region>-<project>.cloudfunctions.net/updateSubmission
// Body: { formId, submissionId, orgId, data?, isRead?, tags? }
export const updateSubmission = functions.http('updateSubmission', async (req: any, res: any) => {
  try {
    logger.info('GCF --> updateSubmission --> Request', { body: req.body });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const { formId, submissionId, orgId, ...updates } = req.body;
    if (!formId || !submissionId || !orgId) { res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId, submissionId and orgId are required' }); return; }
    const result = await submissionService.updateSubmission(String(submissionId), String(formId), String(orgId), (req as AuthRequest).user!.id, updates);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> updateSubmission --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// DELETE https://<region>-<project>.cloudfunctions.net/deleteSubmission?formId=xxx&submissionId=xxx&orgId=xxx
export const deleteSubmission = functions.http('deleteSubmission', async (req: any, res: any) => {
  try {
    logger.info('GCF --> deleteSubmission --> Request', { query: req.query });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const { formId, submissionId, orgId } = req.query;
    if (!formId || !submissionId || !orgId) { res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId, submissionId and orgId are required' }); return; }
    const result = await submissionService.deleteSubmission(String(submissionId), String(formId), String(orgId), (req as AuthRequest).user!.id);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> deleteSubmission --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// POST https://<region>-<project>.cloudfunctions.net/exportSubmissions
// Body: { formId, orgId, format?, ids? }
export const exportSubmissions = functions.http('exportSubmissions', async (req: any, res: any) => {
  try {
    logger.info('GCF --> exportSubmissions --> Request', { body: req.body });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const { formId, orgId, format = 'json', ids } = req.body;
    if (!formId || !orgId) { res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and orgId are required' }); return; }
    const result = await submissionService.exportSubmissions(String(formId), String(orgId), (req as AuthRequest).user!.id, format, ids);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> exportSubmissions --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// POST https://<region>-<project>.cloudfunctions.net/bulkDeleteSubmissions
// Body: { formId, orgId, ids }
export const bulkDeleteSubmissions = functions.http('bulkDeleteSubmissions', async (req: any, res: any) => {
  try {
    logger.info('GCF --> bulkDeleteSubmissions --> Request', { body: req.body });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const { formId, orgId, ids } = req.body;
    if (!formId || !orgId || !ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId, orgId and ids array are required' });
      return;
    }
    const result = await submissionService.bulkDeleteSubmissions(String(formId), String(orgId), (req as AuthRequest).user!.id, ids);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> bulkDeleteSubmissions --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});
