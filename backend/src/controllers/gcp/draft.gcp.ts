import { draftService } from '../../service/draft.service';
import { gcfAuthMiddleware } from '../../utils/gcfAuth';
import { AuthRequest } from '../../middleware/auth.middleware';
import logger from '../../utils/logger';
import { StatusCodes } from 'http-status-codes';

const functions = require('@google-cloud/functions-framework');

// GET https://<region>-<project>.cloudfunctions.net/getDraft
// Query: ?formId=xxx&identity=xxx
export const getDraft = functions.http('getDraft', async (req: any, res: any) => {
  try {
    logger.info('GCF --> getDraft --> Request', { query: req.query, headers: req.headers });
    const formId = String(req.query.formId || '');
    const identity = String(req.query.identity || '');
    if (!formId || !identity) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and identity are required' });
      return;
    }
    const result = await draftService.getDraft(formId, identity);
    res.json(result);
  } catch (error: any) {
    logger.error('GCF --> getDraft --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
  }
});

// POST https://<region>-<project>.cloudfunctions.net/saveDraft
// Body: { formId, identity, data, stepIndex }
export const saveDraft = functions.http('saveDraft', async (req: any, res: any) => {
  try {
    logger.info('GCF --> saveDraft --> Request', { body: req.body, headers: req.headers });
    const { formId, identity, data, stepIndex } = req.body;
    if (!formId || !identity) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and identity are required' });
      return;
    }
    const result = await draftService.saveDraft({ formId, identity, data, stepIndex });
    res.json(result);
  } catch (error: any) {
    logger.error('GCF --> saveDraft --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
  }
});

// DELETE https://<region>-<project>.cloudfunctions.net/deleteDraft
// Query: ?formId=xxx&identity=xxx
export const deleteDraft = functions.http('deleteDraft', async (req: any, res: any) => {
  try {
    logger.info('GCF --> deleteDraft --> Request', { query: req.query, headers: req.headers });
    const formId = String(req.query.formId || '');
    const identity = String(req.query.identity || '');
    if (!formId || !identity) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and identity are required' });
      return;
    }
    const result = await draftService.deleteDraft(formId, identity);
    res.json(result);
  } catch (error: any) {
    logger.error('GCF --> deleteDraft --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
  }
});
