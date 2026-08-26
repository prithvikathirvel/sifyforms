import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import * as templateService from '../../service/template.service';
import logger from '../../utils/logger';

function getParamString(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

export async function listTemplates(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as any;
    const orgId: string = authReq.orgId;
    if (!orgId) {
      res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Unauthorized: Organization context required' });
      return;
    }
    logger.info('Express --> listTemplates --> Request', { orgId });
    const templates = await templateService.listTemplates(orgId);
    res.status(StatusCodes.OK).json(templates);
  } catch (error: any) {
    logger.error('Express --> listTemplates --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function getTemplate(req: Request, res: Response): Promise<void> {
  try {
    const id = getParamString(req.params.id);
    logger.info('Express --> getTemplate --> Request', { id });
    const template = await templateService.getTemplate(id);
    res.status(StatusCodes.OK).json(template);
  } catch (error: any) {
    logger.error('Express --> getTemplate --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function createTemplateFromForm(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as any;
    const formId = getParamString(req.params.formId);
    const orgId: string = authReq.orgId;
    if (!orgId) {
      res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Unauthorized: Organization context required' });
      return;
    }
    logger.info('Express --> createTemplateFromForm --> Request', { formId, orgId });
    const { name, category } = req.body;
    const result = await templateService.createTemplateFromForm(formId, orgId, authReq.user.id, name, category);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    logger.error('Express --> createTemplateFromForm --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function duplicateTemplate(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as any;
    const id = getParamString(req.params.id);
    const { name, teamId } = req.body;
    const orgId: string = authReq.orgId;
    if (!orgId) {
      res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Unauthorized: Organization context required' });
      return;
    }
    logger.info('Express --> duplicateTemplate --> Request', { id, orgId });
    const form = await templateService.duplicateTemplate(id, orgId, authReq.user.id, name, teamId);
    res.status(StatusCodes.CREATED).json(form);
  } catch (error: any) {
    logger.error('Express --> duplicateTemplate --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}
