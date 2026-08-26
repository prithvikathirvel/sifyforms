import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CreateOrgInput, UpdateOrgInput } from '../../schemas/org.schema';
import * as orgService from '../../service/org.service';
import logger from '../../utils/logger';

function getParamString(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

export async function createOrg(req: AuthRequest, res: Response): Promise<void> {
  try {
    logger.info('Express --> createOrg --> Request', { body: req.body });
    const result = await orgService.createOrg(req.body as CreateOrgInput, req.user!.id);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    logger.error('Express --> createOrg --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function listOrgs(req: AuthRequest, res: Response): Promise<void> {
  try {
    logger.info('Express --> listOrgs --> Request', { userId: req.user!.id });
    const result = await orgService.listOrgs(req.user!.id);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> listOrgs --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function getOrg(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orgId = getParamString(req.params.orgId);
    logger.info('Express --> getOrg --> Request', { orgId });
    const result = await orgService.getOrg(orgId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> getOrg --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function updateOrg(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orgId = getParamString(req.params.orgId);
    logger.info('Express --> updateOrg --> Request', { orgId, body: req.body });
    const result = await orgService.updateOrg(orgId, req.user!.id, req.body as UpdateOrgInput);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> updateOrg --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function deleteOrg(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orgId = getParamString(req.params.orgId);
    logger.info('Express --> deleteOrg --> Request', { orgId });
    const result = await orgService.deleteOrg(orgId, req.user!.id);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> deleteOrg --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function listOrgUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orgId = getParamString(req.params.orgId);
    logger.info('Express --> listOrgUsers --> Request', { orgId });
    const result = await orgService.listOrgUsers(orgId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> listOrgUsers --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function updateOrgUserRole(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orgId = getParamString(req.params.orgId);
    const userId = getParamString(req.params.userId);
    logger.info('Express --> updateOrgUserRole --> Request', { orgId, userId, role: req.body.role });
    const result = await orgService.updateOrgUserRole(orgId, userId, req.body.role);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> updateOrgUserRole --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function removeUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orgId = getParamString(req.params.orgId);
    const userId = getParamString(req.params.userId);
    logger.info('Express --> removeUser --> Request', { orgId, userId });
    const result = await orgService.removeUser(orgId, req.user!.id, userId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('Express --> removeUser --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}
