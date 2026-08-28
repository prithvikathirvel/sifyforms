import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../../middleware/auth.middleware';
import * as processingService from '../../service/processing.service';
import logger from '../../utils/logger';

function getParam(req: AuthRequest, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : (val || '');
}

export async function getSubmissionResult(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParam(req, 'formId');
    const submissionId = getParam(req, 'submissionId');
    const orgId = req.orgId as string;
    logger.info('Express --> getSubmissionResult --> Request', { formId, submissionId });
    const result = await processingService.getSubmissionResult(submissionId, formId, orgId, req.user!.id);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> getSubmissionResult --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function getSubmissionResultPublic(req: AuthRequest, res: Response): Promise<void> {
  try {
    const submissionId = getParam(req, 'submissionId');
    logger.info('Express --> getSubmissionResultPublic --> Request', { submissionId });
    const result = await processingService.getSubmissionResultPublic(submissionId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> getSubmissionResultPublic --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function getLeaderboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParam(req, 'formId');
    const orgId = req.orgId as string;
    logger.info('Express --> getLeaderboard --> Request', { formId });
    const result = await processingService.getLeaderboard(formId, orgId, req.user!.id);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> getLeaderboard --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function getAssessmentAnalytics(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParam(req, 'formId');
    const orgId = req.orgId as string;
    logger.info('Express --> getAssessmentAnalytics --> Request', { formId });
    const result = await processingService.getAssessmentAnalytics(formId, orgId, req.user!.id);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> getAssessmentAnalytics --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function getPollResults(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParam(req, 'formId');
    logger.info('Express --> getPollResults --> Request', { formId });
    const result = await processingService.getPollResults(formId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> getPollResults --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function getAuditLog(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParam(req, 'formId');
    const orgId = req.orgId as string;
    logger.info('Express --> getAuditLog --> Request', { formId });
    const result = await processingService.getAuditLog(formId, orgId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> getAuditLog --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}
