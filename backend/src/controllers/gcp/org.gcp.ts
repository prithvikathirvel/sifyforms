import * as orgService from '../../service/org.service';
import * as inviteService from '../../service/invite.service';
import { gcfAuthMiddleware, gcfValidate } from '../../utils/gcfAuth';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CreateOrgSchema, UpdateOrgSchema } from '../../schemas/org.schema';
import logger from '../../utils/logger';
import { StatusCodes } from 'http-status-codes';

const functions = require('@google-cloud/functions-framework');

// POST https://<region>-<project>.cloudfunctions.net/createOrg
// Body: { name, slug, industry? }
export const createOrg = functions.http('createOrg', async (req: any, res: any) => {
  try {
    logger.info('GCF --> createOrg --> Request', { body: req.body, headers: req.headers });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    if (await gcfValidate(req, res, CreateOrgSchema)) return;
    const result = await orgService.createOrg(req.body, (req as AuthRequest).user!.id);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    logger.error('GCF --> createOrg --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// GET https://<region>-<project>.cloudfunctions.net/listOrgs
export const listOrgs = functions.http('listOrgs', async (req: any, res: any) => {
  try {
    logger.info('GCF --> listOrgs --> Request', { headers: req.headers });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const result = await orgService.listOrgs((req as AuthRequest).user!.id);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> listOrgs --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// GET https://<region>-<project>.cloudfunctions.net/getOrg?orgId=xxx
export const getOrg = functions.http('getOrg', async (req: any, res: any) => {
  try {
    logger.info('GCF --> getOrg --> Request', { query: req.query, headers: req.headers });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const orgId = String(req.query.orgId || '');
    if (!orgId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'orgId is required' });
      return;
    }
    const result = await orgService.getOrg(orgId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> getOrg --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// PUT https://<region>-<project>.cloudfunctions.net/updateOrg
// Body: { orgId, name?, industry?, logo? }
export const updateOrg = functions.http('updateOrg', async (req: any, res: any) => {
  try {
    logger.info('GCF --> updateOrg --> Request', { body: req.body, headers: req.headers });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const orgId = String(req.body.orgId || '');
    if (!orgId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'orgId is required' });
      return;
    }
    if (await gcfValidate(req, res, UpdateOrgSchema)) return;
    const { name, industry, logo } = req.body;
    const result = await orgService.updateOrg(orgId, (req as AuthRequest).user!.id, { name, industry, logo });
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> updateOrg --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// DELETE https://<region>-<project>.cloudfunctions.net/deleteOrg?orgId=xxx
export const deleteOrg = functions.http('deleteOrg', async (req: any, res: any) => {
  try {
    logger.info('GCF --> deleteOrg --> Request', { query: req.query, headers: req.headers });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const orgId = String(req.query.orgId || '');
    if (!orgId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'orgId is required' });
      return;
    }
    const result = await orgService.deleteOrg(orgId, (req as AuthRequest).user!.id);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> deleteOrg --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// GET https://<region>-<project>.cloudfunctions.net/listOrgUsers?orgId=xxx
export const listOrgUsers = functions.http('listOrgUsers', async (req: any, res: any) => {
  try {
    logger.info('GCF --> listOrgUsers --> Request', { query: req.query, headers: req.headers });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const orgId = String(req.query.orgId || '');
    if (!orgId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'orgId is required' });
      return;
    }
    const result = await orgService.listOrgUsers(orgId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> listOrgUsers --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// POST https://<region>-<project>.cloudfunctions.net/inviteOrgUser
// Body: { orgId, email, role? }
export const inviteOrgUser = functions.http('inviteOrgUser', async (req: any, res: any) => {
  try {
    logger.info('GCF --> inviteOrgUser --> Request', { body: req.body, headers: req.headers });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const { orgId, email, role } = req.body;
    if (!orgId || !email) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'orgId and email are required' });
      return;
    }
    const result = await inviteService.createInvite(orgId, (req as AuthRequest).user!.id, email, role);
    res.status(StatusCodes.CREATED).json(result);
  } catch (error: any) {
    logger.error('GCF --> inviteOrgUser --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});

// DELETE https://<region>-<project>.cloudfunctions.net/removeOrgUser?orgId=xxx&userId=xxx
export const removeOrgUser = functions.http('removeOrgUser', async (req: any, res: any) => {
  try {
    logger.info('GCF --> removeOrgUser --> Request', { query: req.query, headers: req.headers });
    if (await gcfAuthMiddleware(req as AuthRequest, res)) return;
    const orgId = String(req.query.orgId || '');
    const targetUserId = String(req.query.userId || '');
    if (!orgId || !targetUserId) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'orgId and userId are required' });
      return;
    }
    const result = await orgService.removeUser(orgId, (req as AuthRequest).user!.id, targetUserId);
    res.status(StatusCodes.OK).json(result);
  } catch (error: any) {
    logger.error('GCF --> removeOrgUser --> Error', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
});
