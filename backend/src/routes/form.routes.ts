import { Router } from 'express';
import multer from 'multer';
import {
  createForm,
  listForms,
  getForm,
  updateForm,
  deleteForm,
  publishForm,
  getPublicForm,
  getStats,
  generateFormWithAI,
  editFormWithAI,
  duplicateForm,
  parseCSV,
  moveForm,
  setResponsePolicy,
  getFormAccess,
  listFormShares,
  createFormShare,
  revokeFormShare,
} from '../controllers/express/form.controller';
import { validate } from '../middleware/validate.middleware';
import { authMiddleware, orgMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { ACTIONS } from '../config/rbac.config';
import { CreateFormSchema, UpdateFormSchema, AIEditSchema } from '../schemas/form.schema';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Public route for viewing published forms
router.get('/public/:orgSlug/:formSlug', getPublicForm);

// Protected routes
router.use(authMiddleware);
router.use(orgMiddleware);

// Creating a form is checked against the team it will land in, so a team lead
// can create there without needing organization-wide rights.
router.post(
  '/',
  requirePermission(ACTIONS.CREATE_FORM, { teamIdFrom: 'body', teamIdKey: 'teamId' }),
  validate(CreateFormSchema),
  createForm
);
router.post('/ai-generate', generateFormWithAI);
// edit existing form schema using AI; prompt and optional sessionId in body
router.post('/:formId/ai-edit', validate(AIEditSchema), editFormWithAI);
router.get('/', requirePermission(ACTIONS.VIEW_FORM, { teamIdFrom: 'none' }), listForms);
router.get('/stats', requirePermission(ACTIONS.VIEW_FORM, { teamIdFrom: 'none' }), getStats);
router.post('/parse-csv', upload.single('file'), parseCSV);
router.get('/:formId', getForm);
router.put('/:formId', validate(UpdateFormSchema), updateForm);
router.delete('/:formId', deleteForm);
router.post('/:formId/publish', publishForm);
router.post('/:formId/duplicate', duplicateForm);

// --- team ownership, policy and sharing --------------------------------------
router.get('/:formId/access', getFormAccess);
router.put('/:formId/team', moveForm);
router.put('/:formId/response-policy', setResponsePolicy);
router.get('/:formId/shares', listFormShares);
router.post('/:formId/shares', createFormShare);
router.delete('/:formId/shares/:shareId', revokeFormShare);

export default router;
