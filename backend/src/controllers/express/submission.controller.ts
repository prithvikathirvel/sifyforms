import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../../middleware/auth.middleware';
import { UpdateSubmissionInput } from '../../schemas/submission.schema';
import * as submissionService from '../../service/submission.service';
import logger from '../../utils/logger';

function getParamString(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

export async function createSubmission(req: Request, res: Response): Promise<void> {
  try {
    logger.info('Express --> createSubmission --> Request', { formId: req.body.formId });
    // Express resolves this through the explicitly configured trusted proxy.
    // Do not trust a raw X-Forwarded-For value supplied by an internet client.
    const ip = req.ip || null;
    const userAgent = req.headers['user-agent'] || null;
    const result = await submissionService.createSubmission(req.body, ip, userAgent);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    logger.error('Express --> createSubmission --> Error', error);
    if (error.code === 'ALREADY_VOTED') {
      res.status(StatusCodes.BAD_REQUEST).json({ error: error.message, code: 'ALREADY_VOTED' });
      return;
    }
    if (error.details) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: error.message, details: error.details });
      return;
    }
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function checkFieldUniqueness(req: Request, res: Response): Promise<void> {
  try {
    const { formId, fieldId, value } = req.body;
    if (!formId || !fieldId || value === undefined) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId, fieldId, and value are required' });
      return;
    }
    logger.info('Express --> checkFieldUniqueness --> Request', { formId, fieldId });
    const result = await submissionService.checkFieldUniqueness(formId, fieldId, value);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> checkFieldUniqueness --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function checkExternalValidation(req: Request, res: Response): Promise<void> {
  try {
    const { formId, fieldId, value, formData } = req.body;
    logger.info('Express --> checkExternalValidation --> Request', { formId, fieldId });
    const result = await submissionService.checkExternalValidation(formId, fieldId, value, formData);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> checkExternalValidation --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function listSubmissions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    const orgId = req.orgId as string;
    const { page = '1', limit = '50', status, search, startDate, endDate } = req.query;
    logger.info('Express --> listSubmissions --> Request', { formId, orgId });
    const result = await submissionService.listSubmissions(
      formId, orgId, req.user!.id,
      parseInt(page as string, 10), parseInt(limit as string, 10),
      status as string, search as string, startDate as string, endDate as string,
    );
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> listSubmissions --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function getSubmission(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    const submissionId = getParamString(req.params.submissionId);
    const orgId = req.orgId as string;
    logger.info('Express --> getSubmission --> Request', { formId, submissionId });
    const result = await submissionService.getSubmission(submissionId, formId, orgId, req.user!.id);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> getSubmission --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function updateSubmission(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    const submissionId = getParamString(req.params.submissionId);
    const orgId = req.orgId as string;
    logger.info('Express --> updateSubmission --> Request', { formId, submissionId });
    const result = await submissionService.updateSubmission(submissionId, formId, orgId, req.user!.id, req.body as UpdateSubmissionInput);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> updateSubmission --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function deleteSubmission(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    const submissionId = getParamString(req.params.submissionId);
    const orgId = req.orgId as string;
    logger.info('Express --> deleteSubmission --> Request', { formId, submissionId });
    const result = await submissionService.deleteSubmission(submissionId, formId, orgId, req.user!.id);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> deleteSubmission --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function exportSubmissions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    const orgId = req.orgId as string;
    const { format = 'json', ids } = req.body;
    logger.info('Express --> exportSubmissions --> Request', { formId, format });
    const result = await submissionService.exportSubmissions(formId, orgId, req.user!.id, format, ids);
    if (result.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${result.formName}-submissions.csv"`);
      res.send(result.csvContent);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${result.formName}-submissions.json"`);
      res.json(result.data);
    }
  } catch (error: any) {
    logger.error('Express --> exportSubmissions --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function bulkDeleteSubmissions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    const orgId = req.orgId as string;
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'No submission IDs provided' });
      return;
    }
    logger.info('Express --> bulkDeleteSubmissions --> Request', { formId, count: ids.length });
    const result = await submissionService.bulkDeleteSubmissions(formId, orgId, req.user!.id, ids);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> bulkDeleteSubmissions --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

/**
 * Counts and distributions only. The endpoint an aggregate-only viewer uses,
 * and the only response endpoint an anonymous form exposes at all.
 */
export async function getSubmissionAggregate(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    const orgId = req.orgId as string;
    logger.info('Express --> getSubmissionAggregate --> Request', { formId, orgId });
    const result = await submissionService.getSubmissionAggregate(formId, orgId, req.user!.id);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> getSubmissionAggregate --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}
