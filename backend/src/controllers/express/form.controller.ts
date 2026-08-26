import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../../middleware/auth.middleware';
import { PermissionRequest } from '../../middleware/permission.middleware';
import { ACTIONS } from '../../config/rbac.config';
import { CreateFormInput, UpdateFormInput, AIEditSchema } from '../../schemas/form.schema';
import * as formService from '../../service/form.service';
import * as formAccessService from '../../service/formAccess.service';
import * as formShareService from '../../service/formShare.service';
import logger from '../../utils/logger';

function getParamString(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

export async function createForm(req: AuthRequest, res: Response): Promise<void> {
  try {
    logger.info('Express --> createForm --> Request', { orgId: req.orgId });
    const result = await formService.createForm(req.body as CreateFormInput, req.orgId as string, req.user!.id);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    logger.error('Express --> createForm --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function listForms(req: AuthRequest, res: Response): Promise<void> {
  try {
    logger.info('Express --> listForms --> Request', { orgId: req.orgId });
    // Organization admins see every team's forms; everyone else sees the
    // teams they belong to and everything nested beneath them.
    const canSeeAll = (req as PermissionRequest).permissions?.actions.includes(ACTIONS.MANAGE_ORG) ?? false;
    const result = await formService.listForms(req.orgId as string, req.user!.id, canSeeAll);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> listForms --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function getForm(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    logger.info('Express --> getForm --> Request', { formId, orgId: req.orgId });
    const result = await formService.getForm(formId, req.orgId as string);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> getForm --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function updateForm(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    logger.info('Express --> updateForm --> Request', { formId, orgId: req.orgId });
    const result = await formService.updateForm(formId, req.orgId as string, req.body as UpdateFormInput);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> updateForm --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function deleteForm(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    logger.info('Express --> deleteForm --> Request', { formId, orgId: req.orgId });
    const result = await formService.deleteForm(formId, req.orgId as string);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> deleteForm --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function duplicateForm(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    logger.info('Express --> duplicateForm --> Request', { formId, orgId: req.orgId });
    const result = await formService.duplicateForm(formId, req.orgId as string, req.user!.id, req.body.name);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    logger.error('Express --> duplicateForm --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function publishForm(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    logger.info('Express --> publishForm --> Request', { formId, orgId: req.orgId });
    const result = await formService.publishForm(formId, req.orgId as string);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> publishForm --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function getPublicForm(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orgSlug = getParamString(req.params.orgSlug);
    const formSlug = getParamString(req.params.formSlug);
    logger.info('Express --> getPublicForm --> Request', { orgSlug, formSlug });
    const result = await formService.getPublicForm(orgSlug, formSlug);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> getPublicForm --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function getStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    logger.info('Express --> getStats --> Request', { orgId: req.orgId });
    const canSeeAll = (req as PermissionRequest).permissions?.actions.includes(ACTIONS.MANAGE_ORG) ?? false;
    const result = await formService.getStats(req.orgId as string, req.user!.id, canSeeAll);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> getStats --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function generateFormWithAI(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'Prompt is required and must be a string' });
      return;
    }
    logger.info('Express --> generateFormWithAI --> Request', { orgId: req.orgId });
    const result = await formService.generateFormWithAI(prompt);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> generateFormWithAI --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function editFormWithAI(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    const { prompt, sessionId } = req.body as { prompt?: string; sessionId?: string };
    if (!prompt || typeof prompt !== 'string') {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'Prompt is required and must be a string' });
      return;
    }
    logger.info('Express --> editFormWithAI --> Request', { formId, orgId: req.orgId });
    const result = await formService.editFormWithAI(formId, req.orgId as string, prompt, sessionId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> editFormWithAI --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function parseCSV(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'No CSV file uploaded' });
      return;
    }
    logger.info('Express --> parseCSV --> Request', { orgId: req.orgId });
    const result = await formService.parseCSVData(req.file.buffer);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> parseCSV --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function moveForm(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    logger.info('Express --> moveForm --> Request', { formId, teamId: req.body.teamId });
    const result = await formService.moveForm(formId, req.orgId as string, req.body.teamId ?? null);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> moveForm --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function setResponsePolicy(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    logger.info('Express --> setResponsePolicy --> Request', { formId, policy: req.body.policy });
    const result = await formService.setResponsePolicy(formId, req.orgId as string, req.body.policy);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> setResponsePolicy --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

/** What the caller may do with this form, and why. Drives the UI. */
export async function getFormAccess(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    const result = await formAccessService.getFormAccess(req.user!.id, req.orgId as string, formId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> getFormAccess --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

// --- sharing -----------------------------------------------------------------

export async function listFormShares(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    const result = await formShareService.listShares(formId, req.orgId as string);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> listFormShares --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function createFormShare(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    logger.info('Express --> createFormShare --> Request', { formId, body: req.body });
    const result = await formShareService.createShare(
      formId, req.orgId as string, req.user!.id, req.body
    );
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    logger.error('Express --> createFormShare --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function revokeFormShare(req: AuthRequest, res: Response): Promise<void> {
  try {
    const formId = getParamString(req.params.formId);
    const shareId = getParamString(req.params.shareId);
    const result = await formShareService.revokeShare(formId, req.orgId as string, shareId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> revokeFormShare --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}
