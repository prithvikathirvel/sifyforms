import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { Action } from '../config/rbac.config';
import { assertPermission, EffectivePermissions } from '../service/permission.service';
import logger from '../utils/logger';

/**
 * Route-level authorization.
 *
 * Replaces the old `org.ownerId !== userId` checks: what a user may do now comes
 * from the roles they hold in the RBAC service at ORG and TEAM scope, rather
 * than from being the org's owner.
 */

export interface PermissionRequest extends AuthRequest {
  /** Set by requirePermission so handlers can read the decision they passed. */
  permissions?: EffectivePermissions;
}

function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Where the team id sits on the request, when the action is team-scoped. */
export type TeamIdSource = 'params' | 'body' | 'none';

export interface PermissionOptions {
  /**
   * Which request field carries the team id. Defaults to 'params' (`:teamId`).
   * Use 'none' for org-wide actions.
   */
  teamIdFrom?: TeamIdSource;
  /** Param/body key holding the team id. Defaults to 'teamId'. */
  teamIdKey?: string;
}

export function requirePermission(action: Action | string, options: PermissionOptions = {}) {
  const { teamIdFrom = 'params', teamIdKey = 'teamId' } = options;

  return async (req: PermissionRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const orgId = req.orgId ?? param(req.params.orgId) ?? param(req.headers['x-org-id'] as any);

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      if (!orgId) {
        res.status(400).json({ error: 'Organization ID required' });
        return;
      }

      let teamId: string | undefined;
      if (teamIdFrom === 'params') {
        teamId = param(req.params[teamIdKey]);
      } else if (teamIdFrom === 'body') {
        teamId = req.body?.[teamIdKey] ?? undefined;
      }

      req.permissions = await assertPermission(userId, action, orgId, teamId);
      req.orgId = orgId;
      next();
    } catch (error: any) {
      logger.error('requirePermission --> Error', { action, message: error?.message });
      res
        .status(error?.statusCode ?? 500)
        .json({ error: error?.message ?? 'Authorization error' });
    }
  };
}
