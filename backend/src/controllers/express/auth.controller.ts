import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { SignUpInput, UpdateProfileInput } from '../../schemas/auth.schema';
import { AuthRequest } from '../../middleware/auth.middleware';
import { authService } from '../../service/auth.service';
import logger from '../../utils/logger';

export async function registerUser(req: Request, res: Response): Promise<void> {
  try {
    logger.info('Express --> registerUser --> Request', { body: req.body, headers: req.headers });
    await authService.register(req.body as SignUpInput);
    res.status(StatusCodes.CREATED).json({ response: { message: 'User registered successfully' } });
  } catch (error: any) {
    logger.error('Express --> registerUser --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message ?? 'Registration failed' });
  }
}

export async function getSession(req: AuthRequest, res: Response): Promise<void> {
  try {
    logger.info('Express --> getSession --> Request', { headers: req.headers });
    if (!req.user) {
      res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Not authenticated' });
      return;
    }
    const session = await authService.getSession(req.user.id);
    res.json(session);
  } catch (error: any) {
    logger.error('Express --> getSession --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message ?? 'Failed to get session' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  logger.info('Express --> logout --> Request', { headers: req.headers });
  res.json({ message: 'Logged out successfully' });
}

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    logger.info('Express --> updateProfile --> Request', { body: req.body, headers: req.headers });
    if (!req.user) {
      res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Not authenticated' });
      return;
    }
    await authService.updateProfile(req.user.id, req.body as UpdateProfileInput);
    res.json({ response: { message: 'Profile updated successfully' } });
  } catch (error: any) {
    logger.error('Express --> updateProfile --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message ?? 'Failed to update profile' });
  }
}
