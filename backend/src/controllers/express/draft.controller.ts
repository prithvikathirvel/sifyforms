import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { draftService } from '../../service/draft.service';
import logger from '../../utils/logger';

export async function getDraft(req: Request, res: Response): Promise<void> {
  try {
    logger.info('Express --> getDraft --> Request', { params: req.params, query: req.query });
    const formId = String(req.params.formId);
    const identity = String(req.query.identity || '');
    if (!formId || !identity) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and identity are required' });
      return;
    }
    const result = await draftService.getDraft(formId, identity);
    res.json(result);
  } catch (error: any) {
    logger.error('Express --> getDraft --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function saveDraft(req: Request, res: Response): Promise<void> {
  try {
    logger.info('Express --> saveDraft --> Request', { body: req.body });
    const { formId, identity, data, stepIndex } = req.body;
    if (!formId || !identity) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and identity are required' });
      return;
    }
    const result = await draftService.saveDraft({ formId, identity, data, stepIndex });
    res.json(result);
  } catch (error: any) {
    logger.error('Express --> saveDraft --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function deleteDraft(req: Request, res: Response): Promise<void> {
  try {
    logger.info('Express --> deleteDraft --> Request', { params: req.params, query: req.query });
    const formId = String(req.params.formId);
    const identity = String(req.query.identity || '');
    if (!formId || !identity) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and identity are required' });
      return;
    }
    const result = await draftService.deleteDraft(formId, identity);
    res.json(result);
  } catch (error: any) {
    logger.error('Express --> deleteDraft --> Error', error);
    res.status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}
