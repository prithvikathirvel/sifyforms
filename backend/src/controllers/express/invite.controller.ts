import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../../middleware/auth.middleware';
import { InviteStatus } from '../../dao/interfaces/InviteDao';
import * as inviteService from '../../service/invite.service';
import logger from '../../utils/logger';

function getParamString(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

function handleError(res: Response, label: string, error: any): void {
  logger.error(`Express --> ${label} --> Error`, error);
  res
    .status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: error.message ?? 'Internal server error' });
}

// --- organization side -------------------------------------------------------

export async function createInvite(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orgId = getParamString(req.params.orgId);
    const { email, role } = req.body;
    logger.info('Express --> createInvite --> Request', { orgId, email, role });
    const result = await inviteService.createInvite(orgId, req.user!.id, email, role);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    handleError(res, 'createInvite', error);
  }
}

export async function listOrgInvites(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orgId = getParamString(req.params.orgId);
    const status = getParamString(req.query.status as any) as InviteStatus | '';
    const result = await inviteService.listOrgInvites(orgId, status || undefined);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'listOrgInvites', error);
  }
}

export async function revokeInvite(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orgId = getParamString(req.params.orgId);
    const inviteId = getParamString(req.params.inviteId);
    const result = await inviteService.revokeInvite(orgId, inviteId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'revokeInvite', error);
  }
}

// --- invitee side ------------------------------------------------------------

/** Pending invites addressed to the signed-in user, shown on the org chooser. */
export async function listMyInvites(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await inviteService.listMyInvites(req.user!.email);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'listMyInvites', error);
  }
}

export async function acceptInvite(req: AuthRequest, res: Response): Promise<void> {
  try {
    const inviteId = getParamString(req.params.inviteId);
    logger.info('Express --> acceptInvite --> Request', { inviteId, userId: req.user!.id });
    const result = await inviteService.acceptInvite(inviteId, req.user!.id, req.user!.email);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'acceptInvite', error);
  }
}

export async function rejectInvite(req: AuthRequest, res: Response): Promise<void> {
  try {
    const inviteId = getParamString(req.params.inviteId);
    const result = await inviteService.rejectInvite(inviteId, req.user!.email);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'rejectInvite', error);
  }
}
