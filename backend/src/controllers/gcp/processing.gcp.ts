import * as processingService from '../../service/processing.service';
import { gcfAuthMiddleware } from '../../utils/gcfAuth';
import { AuthRequest } from '../../middleware/auth.middleware';
import logger from '../../utils/logger';
import { StatusCodes } from 'http-status-codes';

const functions = require('@google-cloud/functions-framework');

// GET https://<region>-<project>.cloudfunctions.net/getSubmissionResultPublic?submissionId=xxx
// No auth — used by PublicFormPage to poll for scorecard
export const getSubmissionResultPublic = functions.http('getSubmissionResultPublic', async (req: any, res: any) => {
  try {
    logger.info('GCF --> getSubmissionResultPublic --> Request', { query: req.query });
    const submissionId = String(req.query.submissionId || '');
    if (!submissionId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'submissionId is required' });
      return;
    }
    const result = await processingService.getSubmissionResultPublic(submissionId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> getSubmissionResultPublic --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// GET https://<region>-<project>.cloudfunctions.net/getPollResults?formId=xxx
// No auth — live vote counts for published voting forms
export const getPollResults = functions.http('getPollResults', async (req: any, res: any) => {
  try {
    logger.info('GCF --> getPollResults --> Request', { query: req.query });
    const formId = String(req.query.formId || '');
    if (!formId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId is required' });
      return;
    }
    const result = await processingService.getPollResults(formId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> getPollResults --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// GET https://<region>-<project>.cloudfunctions.net/getSubmissionResult?formId=xxx&submissionId=xxx&orgId=xxx
export const getSubmissionResult = functions.http('getSubmissionResult', async (req: any, res: any) => {
  try {
    logger.info('GCF --> getSubmissionResult --> Request', { query: req.query });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const formId = String(req.query.formId || '');
    const submissionId = String(req.query.submissionId || '');
    const orgId = String(req.query.orgId || '');
    if (!formId || !submissionId || !orgId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId, submissionId and orgId are required' });
      return;
    }
    const result = await processingService.getSubmissionResult(submissionId, formId, orgId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> getSubmissionResult --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// GET https://<region>-<project>.cloudfunctions.net/getLeaderboard?formId=xxx&orgId=xxx
export const getLeaderboard = functions.http('getLeaderboard', async (req: any, res: any) => {
  try {
    logger.info('GCF --> getLeaderboard --> Request', { query: req.query });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const formId = String(req.query.formId || '');
    const orgId = String(req.query.orgId || '');
    if (!formId || !orgId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and orgId are required' });
      return;
    }
    const result = await processingService.getLeaderboard(formId, orgId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> getLeaderboard --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// GET https://<region>-<project>.cloudfunctions.net/getAssessmentAnalytics?formId=xxx&orgId=xxx
export const getAssessmentAnalytics = functions.http('getAssessmentAnalytics', async (req: any, res: any) => {
  try {
    logger.info('GCF --> getAssessmentAnalytics --> Request', { query: req.query });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const formId = String(req.query.formId || '');
    const orgId = String(req.query.orgId || '');
    if (!formId || !orgId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and orgId are required' });
      return;
    }
    const result = await processingService.getAssessmentAnalytics(formId, orgId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> getAssessmentAnalytics --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// GET https://<region>-<project>.cloudfunctions.net/getAuditLog?formId=xxx&orgId=xxx
export const getAuditLog = functions.http('getAuditLog', async (req: any, res: any) => {
  try {
    logger.info('GCF --> getAuditLog --> Request', { query: req.query });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const formId = String(req.query.formId || '');
    const orgId = String(req.query.orgId || '');
    if (!formId || !orgId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and orgId are required' });
      return;
    }
    const result = await processingService.getAuditLog(formId, orgId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> getAuditLog --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});
