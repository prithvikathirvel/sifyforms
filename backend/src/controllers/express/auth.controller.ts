import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  ConfirmForgotPasswordInput,
  ForgotPasswordInput,
  LoginInput,
  SignUpInput,
  UpdateProfileInput,
} from '../../schemas/auth.schema';
import { AuthRequest } from '../../middleware/auth.middleware';
import { authService } from '../../service/auth.service';
import {
  REFRESH_COOKIE_DOMAIN,
  REFRESH_COOKIE_MAX_AGE_MS,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_SAMESITE,
  REFRESH_COOKIE_SECURE,
} from '../../config/ums.config';
import logger from '../../utils/logger';

/**
 * The single entry point for identity.
 *
 * The browser talks only to this application; the user-management service is
 * reached from here. That keeps its origin, its application id and - most
 * importantly - the refresh token out of anything JavaScript can read, and puts
 * rate limiting on the login path, which that service does not have.
 */

const COOKIE_PATH = '/api/auth';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: REFRESH_COOKIE_SECURE,
    sameSite: REFRESH_COOKIE_SAMESITE,
    path: COOKIE_PATH,
    ...(REFRESH_COOKIE_DOMAIN ? { domain: REFRESH_COOKIE_DOMAIN } : {}),
  };
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...cookieOptions(), maxAge: REFRESH_COOKIE_MAX_AGE_MS });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
}

function fail(res: Response, label: string, error: any, fallback: string): void {
  logger.error(`Express --> ${label} --> Error`, { message: error?.message });
  res
    .status(error?.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: error?.message ?? fallback });
}

function bearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.substring(7) : undefined;
}

export async function registerUser(req: Request, res: Response): Promise<void> {
  try {
    const input = req.body as SignUpInput;
    logger.info('Express --> registerUser --> Request', { email: input?.email });
    const result = await authService.signUp(input);
    // No tokens: the client signs in immediately afterwards through the same
    // path everyone else uses, so there is only one way to obtain a session.
    res.status(StatusCodes.CREATED).json({
      message: 'Account created successfully',
      userId: result.userId,
      email: result.email,
    });
  } catch (error: any) {
    fail(res, 'registerUser', error, 'Registration failed');
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as LoginInput;
    logger.info('Express --> login --> Request', { email });
    const tokens = await authService.login(email, password);

    if (tokens.refreshToken) setRefreshCookie(res, tokens.refreshToken);

    res.json({
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      user: (tokens as any).user ?? null,
    });
  } catch (error: any) {
    fail(res, 'login', error, 'Login failed');
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    res.status(StatusCodes.UNAUTHORIZED).json({ error: 'No active session' });
    return;
  }
  try {
    const tokens = await authService.refresh(token);
    // Rotate: a refresh token is spent once it has been exchanged.
    if (tokens.refreshToken) setRefreshCookie(res, tokens.refreshToken);
    res.json({
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      user: (tokens as any).user ?? null,
    });
  } catch (error: any) {
    clearRefreshCookie(res);
    logger.warn('Express --> refresh --> rejected', { message: error?.message });
    res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Session expired' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  try {
    await authService.logout(bearer(req), refreshToken);
  } finally {
    clearRefreshCookie(res);
    res.json({ message: 'Logged out successfully' });
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as ForgotPasswordInput;
  try {
    await authService.forgotPassword(email);
  } catch (error: any) {
    logger.warn('Express --> forgotPassword --> upstream error', { message: error?.message });
  }
  // Always the same answer, so this cannot be used to discover which addresses
  // have accounts.
  res.json({ message: 'If that email has an account, a reset link is on its way.' });
}

export async function confirmForgotPassword(req: Request, res: Response): Promise<void> {
  try {
    await authService.confirmForgotPassword(req.body as ConfirmForgotPasswordInput);
    res.json({ message: 'Password updated. You can sign in now.' });
  } catch (error: any) {
    fail(res, 'confirmForgotPassword', error, 'Could not reset the password');
  }
}

export async function getSession(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Not authenticated' });
      return;
    }
    const session = await authService.getSession(req.user.id);
    res.json(session);
  } catch (error: any) {
    fail(res, 'getSession', error, 'Failed to get session');
  }
}

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Not authenticated' });
      return;
    }
    const token = bearer(req);
    if (!token) {
      res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Not authenticated' });
      return;
    }
    const updated = await authService.updateProfile(
      req.user.id,
      token,
      req.body as UpdateProfileInput
    );
    res.json({ message: 'Profile updated successfully', user: updated });
  } catch (error: any) {
    fail(res, 'updateProfile', error, 'Failed to update profile');
  }
}

/** Account details as the user-management service holds them, for the profile screen. */
export async function getAccount(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Not authenticated' });
      return;
    }
    const account = await authService.findUserByEmail(req.user.email);
    res.json(account ?? null);
  } catch (error: any) {
    fail(res, 'getAccount', error, 'Failed to load account details');
  }
}
