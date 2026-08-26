import { Router } from 'express';
import {
  initiateUpload,
  publicInitiateUpload,
  confirmUpload,
  downloadUrl,
  previewUrl,
  publicDownloadUrl,
} from '../controllers/express/dms.controller';
import { validate } from '../middleware/validate.middleware';
import { authMiddleware, orgMiddleware } from '../middleware/auth.middleware';
import {
  InitiateUploadSchema,
  PublicInitiateUploadSchema,
  ConfirmUploadSchema,
  DownloadSchema,
  PublicDownloadSchema,
} from '../schemas/dms.schema';
import rateLimit from 'express-rate-limit';

const router = Router();

const publicUploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: { error: 'Too many upload requests, please try again later.' },
});

const publicDownloadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: { error: 'Too many download requests, please try again later.' },
});

// Public routes (form respondents)
router.post('/upload/public-initiate', publicUploadLimiter, validate(PublicInitiateUploadSchema), publicInitiateUpload);
router.post('/upload/public-confirm/:documentId', publicUploadLimiter, validate(ConfirmUploadSchema), confirmUpload);
router.post('/download/public/:documentId', publicDownloadLimiter, validate(PublicDownloadSchema), publicDownloadUrl);

// Protected routes (authenticated form builders/admins)
router.use(authMiddleware);
router.use(orgMiddleware);

router.post('/upload/initiate', validate(InitiateUploadSchema), initiateUpload);
router.post('/upload/confirm/:documentId', validate(ConfirmUploadSchema), confirmUpload);
router.post('/download/:documentId', validate(DownloadSchema), downloadUrl);
router.post('/preview/:documentId', validate(DownloadSchema), previewUrl);

export default router;
