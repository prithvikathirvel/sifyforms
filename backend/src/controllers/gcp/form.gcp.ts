import * as formService from '../../service/form.service';
import { gcfAuthMiddleware, gcfValidate } from '../../utils/gcfAuth';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CreateFormSchema, UpdateFormSchema, AIEditSchema } from '../../schemas/form.schema';
import logger from '../../utils/logger';
import { StatusCodes } from 'http-status-codes';

const functions = require('@google-cloud/functions-framework');

// GET https://<region>-<project>.cloudfunctions.net/getPublicForm?orgSlug=xxx&formSlug=xxx
// No auth — public form viewer
export const getPublicForm = functions.http('getPublicForm', async (req: any, res: any) => {
  try {
    logger.info('GCF --> getPublicForm --> Request', { query: req.query });
    const orgSlug = String(req.query.orgSlug || '');
    const formSlug = String(req.query.formSlug || '');
    if (!orgSlug || !formSlug) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'orgSlug and formSlug are required' });
      return;
    }
    const result = await formService.getPublicForm(orgSlug, formSlug);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> getPublicForm --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// POST https://<region>-<project>.cloudfunctions.net/createForm
// Body: { orgId, name, description?, schema, settings? }
export const createForm = functions.http('createForm', async (req: any, res: any) => {
  try {
    logger.info('GCF --> createForm --> Request', { body: req.body });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    if (await gcfValidate(req, res, CreateFormSchema)) return;
    const orgId = String(req.body.orgId || '');
    if (!orgId) { res.status(StatusCodes.BAD_REQUEST).json({ error: 'orgId is required' }); return; }
    const result = await formService.createForm(req.body, orgId, (req as AuthRequest).user!.id);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    logger.error('GCF --> createForm --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// GET https://<region>-<project>.cloudfunctions.net/listForms?orgId=xxx
export const listForms = functions.http('listForms', async (req: any, res: any) => {
  try {
    logger.info('GCF --> listForms --> Request', { query: req.query });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const orgId = String(req.query.orgId || '');
    if (!orgId) { res.status(StatusCodes.BAD_REQUEST).json({ error: 'orgId is required' }); return; }
    const result = await formService.listForms(orgId, (req as AuthRequest).user!.id, false);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> listForms --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// GET https://<region>-<project>.cloudfunctions.net/getForm?formId=xxx&orgId=xxx
export const getForm = functions.http('getForm', async (req: any, res: any) => {
  try {
    logger.info('GCF --> getForm --> Request', { query: req.query });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const formId = String(req.query.formId || '');
    const orgId = String(req.query.orgId || '');
    if (!formId || !orgId) { res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and orgId are required' }); return; }
    const result = await formService.getForm(formId, orgId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> getForm --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// PUT https://<region>-<project>.cloudfunctions.net/updateForm
// Body: { formId, orgId, name?, description?, schema?, settings?, isPublished? }
export const updateForm = functions.http('updateForm', async (req: any, res: any) => {
  try {
    logger.info('GCF --> updateForm --> Request', { body: req.body });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    if (await gcfValidate(req, res, UpdateFormSchema)) return;
    const formId = String(req.body.formId || '');
    const orgId = String(req.body.orgId || '');
    if (!formId || !orgId) { res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and orgId are required' }); return; }
    const result = await formService.updateForm(formId, orgId, req.body);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> updateForm --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// DELETE https://<region>-<project>.cloudfunctions.net/deleteForm?formId=xxx&orgId=xxx
export const deleteForm = functions.http('deleteForm', async (req: any, res: any) => {
  try {
    logger.info('GCF --> deleteForm --> Request', { query: req.query });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const formId = String(req.query.formId || '');
    const orgId = String(req.query.orgId || '');
    if (!formId || !orgId) { res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and orgId are required' }); return; }
    const result = await formService.deleteForm(formId, orgId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> deleteForm --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// POST https://<region>-<project>.cloudfunctions.net/publishForm
// Body: { formId, orgId }
export const publishForm = functions.http('publishForm', async (req: any, res: any) => {
  try {
    logger.info('GCF --> publishForm --> Request', { body: req.body });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const formId = String(req.body.formId || '');
    const orgId = String(req.body.orgId || '');
    if (!formId || !orgId) { res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and orgId are required' }); return; }
    const result = await formService.publishForm(formId, orgId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> publishForm --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// POST https://<region>-<project>.cloudfunctions.net/duplicateForm
// Body: { formId, orgId, name? }
export const duplicateForm = functions.http('duplicateForm', async (req: any, res: any) => {
  try {
    logger.info('GCF --> duplicateForm --> Request', { body: req.body });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const formId = String(req.body.formId || '');
    const orgId = String(req.body.orgId || '');
    if (!formId || !orgId) { res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId and orgId are required' }); return; }
    const result = await formService.duplicateForm(formId, orgId, (req as AuthRequest).user!.id, req.body.name);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    logger.error('GCF --> duplicateForm --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// GET https://<region>-<project>.cloudfunctions.net/getFormStats?orgId=xxx
export const getFormStats = functions.http('getFormStats', async (req: any, res: any) => {
  try {
    logger.info('GCF --> getFormStats --> Request', { query: req.query });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const orgId = String(req.query.orgId || '');
    if (!orgId) { res.status(StatusCodes.BAD_REQUEST).json({ error: 'orgId is required' }); return; }
    const result = await formService.getStats(orgId, (req as AuthRequest).user!.id, false);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> getFormStats --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// POST https://<region>-<project>.cloudfunctions.net/generateFormWithAI
// Body: { prompt }
export const generateFormWithAI = functions.http('generateFormWithAI', async (req: any, res: any) => {
  try {
    logger.info('GCF --> generateFormWithAI --> Request', { body: req.body });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'Prompt is required and must be a string' });
      return;
    }
    const result = await formService.generateFormWithAI(prompt);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> generateFormWithAI --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// POST https://<region>-<project>.cloudfunctions.net/editFormWithAI
// Body: { formId, orgId, prompt, sessionId? }
export const editFormWithAI = functions.http('editFormWithAI', async (req: any, res: any) => {
  try {
    logger.info('GCF --> editFormWithAI --> Request', { body: req.body });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    if (await gcfValidate(req, res, AIEditSchema)) return;
    const formId = String(req.body.formId || '');
    const orgId = String(req.body.orgId || '');
    const { prompt, sessionId } = req.body;
    if (!formId || !orgId || !prompt) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId, orgId and prompt are required' });
      return;
    }
    const result = await formService.editFormWithAI(formId, orgId, prompt, sessionId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> editFormWithAI --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});
