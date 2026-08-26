import { Router } from 'express';
import { getDraft, saveDraft, deleteDraft } from '../controllers/express/draft.controller';

const router = Router();

router.get('/:formId', getDraft);
router.post('/', saveDraft);
router.delete('/:formId', deleteDraft);

export default router;
