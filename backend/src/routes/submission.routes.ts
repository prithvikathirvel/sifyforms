import { Router } from 'express';
import {
  createSubmission,
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

const router = Router();

// Public route for form submissions
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
