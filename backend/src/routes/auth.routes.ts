import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
  confirmForgotPassword,
  forgotPassword,
  getAccount,
  getSession,
  login,
  logout,
  refresh,
  registerUser,
  updateProfile,
} from '../controllers/express/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  ConfirmForgotPasswordSchema,
  ForgotPasswordSchema,
  LoginSchema,
  SignUpSchema,
  UpdateProfileSchema,
} from '../schemas/auth.schema';

const router = Router();

/**
 * The user-management service has no throttle on its own login route, and until
 * now the browser reached it directly. Everything credential-related is funnelled
 * through here so this limit is the one that applies.
 */
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Keyed on address and email together, so one noisy network cannot lock out
  // everyone behind it while a single account still cannot be brute forced.
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip ?? '')}|${String((req.body as any)?.email ?? '').toLowerCase()}`,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

// --- credentials (no session yet) -------------------------------------------
router.post('/register', credentialLimiter, validate(SignUpSchema), registerUser);
router.post('/login', credentialLimiter, validate(LoginSchema), login);
router.post('/refresh', refreshLimiter, refresh);
router.post('/logout', logout);
router.post('/forgot-password', credentialLimiter, validate(ForgotPasswordSchema), forgotPassword);
router.post(
  '/confirm-forgot-password',
  credentialLimiter,
  validate(ConfirmForgotPasswordSchema),
  confirmForgotPassword
);

// --- the signed-in user ------------------------------------------------------
router.get('/session', authMiddleware, getSession);
router.get('/account', authMiddleware, getAccount);
router.put('/profile', authMiddleware, validate(UpdateProfileSchema), updateProfile);

export default router;
