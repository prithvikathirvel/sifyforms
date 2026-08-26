import { Router } from 'express';
import {
  getSubmissionResult,
  getSubmissionResultPublic,
  getLeaderboard,
  getAssessmentAnalytics,
  getPollResults,
  getAuditLog,
} from '../controllers/express/processing.controller';
import { authMiddleware, orgMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Public — used by PublicFormPage to poll for scorecard after assessment submission
router.get('/submissions/:submissionId/result/public', getSubmissionResultPublic);

// Public — live vote counts for voting forms
router.get('/forms/:formId/poll-results', getPollResults);

// Protected — admin views
router.get('/forms/:formId/submissions/:submissionId/result', authMiddleware, orgMiddleware, getSubmissionResult);
router.get('/forms/:formId/leaderboard', authMiddleware, orgMiddleware, getLeaderboard);
router.get('/forms/:formId/assessment-analytics', authMiddleware, orgMiddleware, getAssessmentAnalytics);
router.get('/forms/:formId/audit-log', authMiddleware, orgMiddleware, getAuditLog);

export default router;
