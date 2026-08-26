import { Router } from 'express';
import { listTemplates, getTemplate, createTemplateFromForm, duplicateTemplate } from '../controllers/express/template.controller';
import { authMiddleware, orgMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);
router.use(orgMiddleware);

router.get('/', listTemplates);
router.get('/:id', getTemplate);
router.post('/:formId/create-template', createTemplateFromForm);
router.post('/:id/duplicate', duplicateTemplate);

export default router;
