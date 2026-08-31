import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { Action } from '../config/rbac.config';
import { assertPermission, EffectivePermissions } from '../service/permission.service';
import logger from '../utils/logger';

/**
 * Route-level authorization.
 *
 * Replaces the old `org.ownerId !== userId` checks: what a user may do now comes
 * from the organization role they hold in the RBAC service, rather than from
 * being the org's owner. Teams carry no permissions of their own.
 */

export interface PermissionRequest extends AuthRequest {
  /** Set by requirePermission so handlers can read the decision they passed. */
  permissions?: EffectivePermissions;
}

function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function requirePermission(action: Action | string) {
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

      req.permissions = await assertPermission(userId, action, orgId);
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
