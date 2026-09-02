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
import rateLimit from 'express-rate-limit';

const router = Router();

// Public route for form submissions. Authentication is intentionally not
// required; the shared service requires server-verified Turnstile proof.
const surveyPartialLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
router.post('/partial', surveyPartialLimiter, saveSurveyPartial);
router.post('/', createSubmission);
router.post('/check-unique', checkFieldUniqueness);
router.post('/check-external', checkExternalValidation);

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
