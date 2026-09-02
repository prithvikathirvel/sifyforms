import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../../middleware/auth.middleware';
import * as roleService from '../../service/role.service';
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

/**
 * Roles, and the features and actions they can be built from.
 *
 * The permission catalogue ships alongside the list so the role editor can
 * render every available checkbox without a second request.
 */
export async function listRoles(req: AuthRequest, res: Response): Promise<void> {
  try {
    const [roles, permissions] = await Promise.all([
      roleService.listRoleViews(req.orgId),
      Promise.resolve(roleService.listAvailablePermissions()),
    ]);
    res.status(StatusCodes.OK).json({ roles, permissions });
  } catch (error: any) {
    handleError(res, 'listRoles', error);
  }
}

export async function createRole(req: AuthRequest, res: Response): Promise<void> {
  try {
    logger.info('Express --> createRole --> Request', { name: req.body?.name });
    const result = await roleService.createRole(req.body);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    handleError(res, 'createRole', error);
  }
}

export async function updateRole(req: AuthRequest, res: Response): Promise<void> {
  try {
    const roleId = getParamString(req.params.roleId);
    logger.info('Express --> updateRole --> Request', { roleId });
    const result = await roleService.updateRole(roleId, req.body);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'updateRole', error);
  }
}

export async function setRoleActive(req: AuthRequest, res: Response): Promise<void> {
  try {
    const roleId = getParamString(req.params.roleId);
    const active = req.body?.active !== false;
    const result = await roleService.setRoleActive(roleId, active);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    handleError(res, 'setRoleActive', error);
  }
}
