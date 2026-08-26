import { Response } from 'express';
import { ZodSchema } from 'zod';
import { authMiddleware, orgMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

/**
 * GCF auth helper — async equivalent of Express authMiddleware.
 * Returns true if request is unauthorized (response already sent — caller should return).
 * Returns false if authorized (req.user is populated).
 *
 * Usage in GCF:
 *   if (await gcfAuthMiddleware(req, res)) return;
 *   // req.user is now available
 */
export async function gcfAuthMiddleware(req: AuthRequest, res: Response): Promise<boolean> {
  return new Promise(resolve => {
    authMiddleware(req, res, () => resolve(false));
  }).then(result => {
    if (res.headersSent) return true;
    return result as boolean;
  });
}

/**
 * GCF validate helper — runs Zod schema validation like Express validate() middleware.
 * Returns true if validation failed (response already sent — caller should return).
 * Returns false if validation passed (req.body is valid).
 *
 * Usage in GCF:
 *   if (await gcfValidate(req, res, MySchema)) return;
 *   // req.body is now validated
 */
export async function gcfValidate(req: any, res: Response, schema: ZodSchema): Promise<boolean> {
  return new Promise(resolve => {
    const fn = validate(schema)
    fn(req, res, () => resolve(false))
  }).then(result => {
    if (res.headersSent) return true;
    return result as boolean;
  });
}

/**
 * GCF org helper — async equivalent of Express orgMiddleware.
 * Must be called AFTER gcfAuthMiddleware (req.user must be set).
 * Returns true if org check failed (response already sent — caller should return).
 * Returns false if authorized (req.orgId is populated).
 *
 * Usage in GCF:
 *   if (await gcfAuthMiddleware(req, res)) return;
 *   if (await gcfOrgMiddleware(req, res)) return;
 *   // req.user and req.orgId are now available
 */
export async function gcfOrgMiddleware(req: AuthRequest, res: Response): Promise<boolean> {
  return new Promise(resolve => {
    orgMiddleware(req, res, () => resolve(false));
  }).then(result => {
    if (res.headersSent) return true;
    return result as boolean;
  });
}
