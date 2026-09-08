import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getDraft, saveDraft, deleteDraft } from '../controllers/express/draft.controller';
import { requirePublicFormSession } from '../middleware/publicSession.middleware';

const router = Router();

/**
 * Unauthenticated, and now scoped by a server-issued session rather than by an
 * email address in the query string. See service/draft.service.ts.
 *
 * The limiter is a second line: a session is cheap to mint, so it bounds how
 * fast one address can churn through sessions probing for anything. The form
 * itself autosaves every three seconds, so the ceiling is set well above
 * ordinary use.
 */
const draftLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many draft requests, please try again later.' },
});

router.use(draftLimiter);

// `formId` reaches the session check from the path on GET/DELETE and from the
// body on POST; the middleware reads either.
router.get('/:formId', requirePublicFormSession, getDraft);
router.post('/', requirePublicFormSession, saveDraft);
router.delete('/:formId', requirePublicFormSession, deleteDraft);

export default router;
