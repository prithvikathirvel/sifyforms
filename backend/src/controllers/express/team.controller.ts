import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { PermissionRequest } from '../../middleware/permission.middleware';
import { CreateTeamInput, UpdateTeamInput } from '../../schemas/team.schema';
import * as teamService from '../../service/team.service';
import { getEffectivePermissions } from '../../service/permission.service';
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

export async function createTeam(req: PermissionRequest, res: Response): Promise<void> {
  try {
    const orgId = req.orgId!;
    logger.info('Express --> createTeam --> Request', { orgId, body: req.body });
    const result = await teamService.createTeam(orgId, req.user!.id, req.body as CreateTeamInput);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    handleError(res, 'createTeam', error);
  }
}

export async function listTeams(req: PermissionRequest, res: Response): Promise<void> {
  try {
    const result = await teamService.listTeams(req.orgId!);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'listTeams', error);
  }
}

export async function getTeam(req: PermissionRequest, res: Response): Promise<void> {
  try {
    const teamId = getParamString(req.params.teamId);
    const result = await teamService.getTeam(req.orgId!, teamId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'getTeam', error);
  }
}

export async function updateTeam(req: PermissionRequest, res: Response): Promise<void> {
  try {
    const teamId = getParamString(req.params.teamId);
    const result = await teamService.updateTeam(req.orgId!, teamId, req.body as UpdateTeamInput);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'updateTeam', error);
  }
}

export async function deleteTeam(req: PermissionRequest, res: Response): Promise<void> {
  try {
    const teamId = getParamString(req.params.teamId);
    const result = await teamService.deleteTeam(req.orgId!, teamId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'deleteTeam', error);
  }
}

// --- membership --------------------------------------------------------------

export async function listMembers(req: PermissionRequest, res: Response): Promise<void> {
  try {
    const teamId = getParamString(req.params.teamId);
    const result = await teamService.listMembers(req.orgId!, teamId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'listTeamMembers', error);
  }
}

export async function addMember(req: PermissionRequest, res: Response): Promise<void> {
  try {
    const teamId = getParamString(req.params.teamId);
    const { userId } = req.body;
    logger.info('Express --> addTeamMember --> Request', { teamId, userId });
    const result = await teamService.addMember(req.orgId!, teamId, req.user!.id, userId);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    handleError(res, 'addTeamMember', error);
  }
}

export async function removeMember(req: PermissionRequest, res: Response): Promise<void> {
  try {
    const teamId = getParamString(req.params.teamId);
    const userId = getParamString(req.params.userId);
    const result = await teamService.removeMember(req.orgId!, teamId, userId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'removeTeamMember', error);
  }
}

/**
 * What the signed-in user may do in this organization, from their org role
 * alone. The frontend reads this to decide what to render, but every write is
 * still checked server-side.
 */
export async function getMyPermissions(req: PermissionRequest, res: Response): Promise<void> {
  try {
    const result = await getEffectivePermissions(req.user!.id, req.orgId!);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'getMyPermissions', error);
  }
}

/** Teams the signed-in user belongs to in this organization. */
export async function listMyTeams(req: PermissionRequest, res: Response): Promise<void> {
  try {
    const result = await teamService.listTeamsForUser(req.orgId!, req.user!.id);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'listMyTeams', error);
  }
}
