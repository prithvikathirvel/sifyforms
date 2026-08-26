import * as templateService from '../../service/template.service';
import { gcfAuthMiddleware, gcfOrgMiddleware } from '../../utils/gcfAuth';
import { AuthRequest } from '../../middleware/auth.middleware';
import logger from '../../utils/logger';
import { StatusCodes } from 'http-status-codes';

const functions = require('@google-cloud/functions-framework');

// GET https://<region>-<project>.cloudfunctions.net/listTemplates
// Headers: Authorization, x-org-id
export const listTemplates = functions.http('listTemplates', async (req: any, res: any) => {
  try {
    logger.info('GCF --> listTemplates --> Request', { headers: req.headers });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    if (await gcfOrgMiddleware(req as AuthRequest, res)) return;
    const orgId: string = (req as AuthRequest).orgId!;
    const templates = await templateService.listTemplates(orgId);
    res.status(StatusCodes.OK).json(templates);
  } catch (error: any) {
    logger.error('GCF --> listTemplates --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
  }
});

// GET https://<region>-<project>.cloudfunctions.net/getTemplate
// Query: ?id=xxx
// Headers: Authorization, x-org-id
export const getTemplate = functions.http('getTemplate', async (req: any, res: any) => {
  try {
    logger.info('GCF --> getTemplate --> Request', { query: req.query, headers: req.headers });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const id = String(req.query.id || '');
    if (!id) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'id is required' });
      return;
    }
    const template = await templateService.getTemplate(id);
    res.status(StatusCodes.OK).json(template);
  } catch (error: any) {
    logger.error('GCF --> getTemplate --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
  }
});

// POST https://<region>-<project>.cloudfunctions.net/createTemplateFromForm
// Body: { formId, name?, category? }
// Headers: Authorization, x-org-id
export const createTemplateFromForm = functions.http('createTemplateFromForm', async (req: any, res: any) => {
  try {
    logger.info('GCF --> createTemplateFromForm --> Request', { body: req.body, headers: req.headers });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    if (await gcfOrgMiddleware(req as AuthRequest, res)) return;
    const authReq = req as AuthRequest;
    const orgId: string = authReq.orgId!;
    const { formId, name, category } = req.body;
    if (!formId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId is required' });
      return;
    }
    const result = await templateService.createTemplateFromForm(formId, orgId, authReq.user!.id, name, category);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    logger.error('GCF --> createTemplateFromForm --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
  }
});

// POST https://<region>-<project>.cloudfunctions.net/duplicateTemplate
// Body: { id, name? }
// Headers: Authorization, x-org-id
export const duplicateTemplate = functions.http('duplicateTemplate', async (req: any, res: any) => {
  try {
    logger.info('GCF --> duplicateTemplate --> Request', { body: req.body, headers: req.headers });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    if (await gcfOrgMiddleware(req as AuthRequest, res)) return;
    const authReq = req as AuthRequest;
    const orgId: string = authReq.orgId!;
    const { id, name } = req.body;
    if (!id) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'id is required' });
      return;
    }
    const form = await templateService.duplicateTemplate(id, orgId, authReq.user!.id, name);
    res.status(StatusCodes.CREATED).json(form);
  } catch (error: any) {
    logger.error('GCF --> duplicateTemplate --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
  }
});
