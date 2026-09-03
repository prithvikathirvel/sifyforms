import { AuthRequest } from '../../middleware/auth.middleware';
import { authService } from '../../service/auth.service';
import { gcfAuthMiddleware, gcfValidate } from '../../utils/gcfAuth';
import { SignUpSchema, UpdateProfileSchema } from '../../schemas/auth.schema';
import logger from '../../utils/logger';
import { StatusCodes } from 'http-status-codes';

const functions = require('@google-cloud/functions-framework');

// POST https://<region>-<project>.cloudfunctions.net/registerUser
export const registerUser = functions.http('registerUser', async (req: any, res: any) => {
  try {
    logger.info('GCF --> registerUser --> Request', { body: req.body, headers: req.headers });
    if (await gcfValidate(req, res, SignUpSchema)) return;
    const result = await authService.signUp(req.body);
    res.status(StatusCodes.CREATED).json({ message: 'Account created successfully', ...result });
  } catch (error: any) {
    logger.error('GCF --> registerUser --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
  }
});

// GET https://<region>-<project>.cloudfunctions.net/getSession
export const getSession = functions.http('getSession', async (req: any, res: any) => {
  try {
    logger.info('GCF --> getSession --> Request', { headers: req.headers });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const session = await authService.getSession((req as AuthRequest).user!.id);
    res.json(session);
  } catch (error: any) {
    logger.error('GCF --> getSession --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
  }
});

// POST https://<region>-<project>.cloudfunctions.net/logout
export const logout = functions.http('logout', (req: any, res: any) => {
  logger.info('GCF --> logout --> Request', { headers: req.headers });
  res.json({ message: 'Logged out successfully' });
});

// PUT https://<region>-<project>.cloudfunctions.net/updateProfile
// Body: { firstName?, lastName?, username?, phone?, gender?, address?, additionalDetails? }
export const updateProfile = functions.http('updateProfile', async (req: any, res: any) => {
  try {
    logger.info('GCF --> updateProfile --> Request', { body: req.body, headers: req.headers });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    if (await gcfValidate(req, res, UpdateProfileSchema)) return;
    const token = String(req.headers?.authorization ?? '').replace(/^Bearer /, '');
    await authService.updateProfile((req as AuthRequest).user!.id, token, req.body);
    res.status(StatusCodes.OK).json({ response: { message: 'Profile updated successfully' } });
  } catch (error: any) {
    logger.error('GCF --> updateProfile --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
  }
});
