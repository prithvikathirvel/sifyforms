import { Router } from 'express';
import {
  listMyInvites,
  acceptInvite,
  rejectInvite,
} from '../controllers/express/invite.controller';
import { authMiddleware } from '../middleware/auth.middleware';

/**
 * Invitee-facing routes.
 *
 * These sit outside `/orgs` on purpose: the caller is not a member of the
 * organization yet, so `orgMiddleware` would reject them. Authorization here is
 * that the invite's email matches the signed-in user's, checked in the service.
 */
const router = Router();

router.use(authMiddleware);

router.get('/me', listMyInvites);
router.post('/:inviteId/accept', acceptInvite);
router.post('/:inviteId/reject', rejectInvite);

export default router;
