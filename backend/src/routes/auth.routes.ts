import { Router } from 'express';
import { registerUser, getSession, logout, updateProfile } from '../controllers/express/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { SignUpSchema, UpdateProfileSchema } from '../schemas/auth.schema';

const router = Router();

router.post('/register', validate(SignUpSchema), registerUser);                            // no auth — pre-Keycloak-login
router.get('/session', authMiddleware, getSession);                                        // requires Keycloak token
router.put('/profile', authMiddleware, validate(UpdateProfileSchema), updateProfile);      // requires Keycloak token
router.post('/logout', logout);

export default router;
