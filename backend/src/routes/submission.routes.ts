import { Router } from 'express';
import {
  createSubmission,
  saveSurveyPartial,
  listSubmissions,
  getSubmission,
  updateSubmission,
  deleteSubmission,
  exportSubmissions,
  bulkDeleteSubmissions,
  checkFieldUniqueness,
  checkExternalValidation,
  getSubmissionAggregate,
} from '../controllers/express/submission.controller';
import { authMiddleware, orgMiddleware } from '../middleware/auth.middleware';
import { requirePublicFormSession } from '../middleware/publicSession.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// Public route for form submissions. Authentication is intentionally not
// required; the shared service requires server-verified Turnstile proof.
const surveyPartialLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
router.post('/partial', surveyPartialLimiter, saveSurveyPartial);
router.post('/', createSubmission);

/*
 * These two are still public — they are used while somebody fills in a form —
 * but they are no longer anonymous, because of what they do.
 *
 * `check-unique` answers "has this person already submitted?", which for a
 * recruitment or medical form is the most sensitive fact on the system.
 * `check-external` makes this server call the organization's own API using the
 * organization's stored credentials.
 *
 * `requirePublicFormSession` gives each caller a server-issued handle so those
 * answers and that spending can be budgeted; the limiters below bound how fast
 * a single address can churn through sessions. See
 * service/publicSession.service.ts for what a session is and, more to the
 * point, what it is not.
 */
const checkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification requests, please try again later.' },
});
router.post('/check-unique', checkLimiter, requirePublicFormSession, checkFieldUniqueness);
router.post('/check-external', checkLimiter, requirePublicFormSession, checkExternalValidation);

// Protected routes for managing submissions
// Every route below resolves access against the form's own team, its shares
// and its response policy - see service/formAccess.ts.
router.get('/forms/:formId/submissions', authMiddleware, orgMiddleware, listSubmissions);
router.get('/forms/:formId/submissions/aggregate', authMiddleware, orgMiddleware, getSubmissionAggregate);
router.get('/forms/:formId/submissions/:submissionId', authMiddleware, orgMiddleware, getSubmission);
router.put('/forms/:formId/submissions/:submissionId', authMiddleware, orgMiddleware, updateSubmission);
router.delete('/forms/:formId/submissions/:submissionId', authMiddleware, orgMiddleware, deleteSubmission);
router.post('/forms/:formId/submissions/export', authMiddleware, orgMiddleware, exportSubmissions);
router.post('/forms/:formId/submissions/bulk-delete', authMiddleware, orgMiddleware, bulkDeleteSubmissions);

export default router;
