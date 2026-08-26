import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import * as orgService from '../../service/org.service';
import * as inviteService from '../../service/invite.service';
import { CreateOrgSchema, UpdateOrgSchema } from '../../schemas/org.schema';
import { lambdaAuthMiddleware, lambdaValidate, lambdaResponse, lambdaError, isLambdaError, parseBody } from '../../utils/lambdaAuth';
import logger from '../../utils/logger';

// POST /createOrg
// Headers: Authorization: Bearer <token>
// Body: { name, slug, industry? }
export const createOrg = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> createOrg --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const body = parseBody(event);
    const validated = lambdaValidate(body, CreateOrgSchema);
    if (isLambdaError(validated)) return validated;
    const result = await orgService.createOrg(validated, auth.user.id);
    return lambdaResponse(StatusCodes.CREATED, result);
  } catch (error: any) {
    logger.error('Lambda --> createOrg --> Error', error);
    return lambdaError(error);
  }
};

// GET /listOrgs
// Headers: Authorization: Bearer <token>
export const listOrgs = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> listOrgs --> Request', { headers: event.headers });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const result = await orgService.listOrgs(auth.user.id);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> listOrgs --> Error', error);
    return lambdaError(error);
  }
};

// GET /getOrg?orgId=xxx
// Headers: Authorization: Bearer <token>
export const getOrg = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> getOrg --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const orgId = event.queryStringParameters?.orgId || '';
    if (!orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'orgId is required' });
    const result = await orgService.getOrg(orgId);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> getOrg --> Error', error);
    return lambdaError(error);
  }
};

// PUT /updateOrg
// Headers: Authorization: Bearer <token>
// Body: { orgId, name?, industry?, logo? }
export const updateOrg = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> updateOrg --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const body = parseBody(event);
    const orgId = body.orgId || '';
    if (!orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'orgId is required' });
    const validated = lambdaValidate(body, UpdateOrgSchema);
    if (isLambdaError(validated)) return validated;
    const { name, industry, logo } = body;
    const result = await orgService.updateOrg(orgId, auth.user.id, { name, industry, logo });
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> updateOrg --> Error', error);
    return lambdaError(error);
  }
};

// DELETE /deleteOrg?orgId=xxx
// Headers: Authorization: Bearer <token>
export const deleteOrg = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> deleteOrg --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const orgId = event.queryStringParameters?.orgId || '';
    if (!orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'orgId is required' });
    const result = await orgService.deleteOrg(orgId, auth.user.id);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> deleteOrg --> Error', error);
    return lambdaError(error);
  }
};

// GET /listOrgUsers?orgId=xxx
// Headers: Authorization: Bearer <token>
export const listOrgUsers = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> listOrgUsers --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const orgId = event.queryStringParameters?.orgId || '';
    if (!orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'orgId is required' });
    const result = await orgService.listOrgUsers(orgId);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> listOrgUsers --> Error', error);
    return lambdaError(error);
  }
};

// POST /inviteOrgUser
// Headers: Authorization: Bearer <token>
// Body: { orgId, email, role? }
export const inviteOrgUser = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> inviteOrgUser --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const { orgId, email, role } = parseBody(event);
    if (!orgId || !email) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'orgId and email are required' });
    const result = await inviteService.createInvite(orgId, auth.user.id, email, role);
    return lambdaResponse(StatusCodes.CREATED, result);
  } catch (error: any) {
    logger.error('Lambda --> inviteOrgUser --> Error', error);
    return lambdaError(error);
  }
};

// DELETE /removeOrgUser?orgId=xxx&userId=xxx
// Headers: Authorization: Bearer <token>
export const removeOrgUser = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> removeOrgUser --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const orgId = event.queryStringParameters?.orgId || '';
    const targetUserId = event.queryStringParameters?.userId || '';
    if (!orgId || !targetUserId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'orgId and userId are required' });
    const result = await orgService.removeUser(orgId, auth.user.id, targetUserId);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> removeOrgUser --> Error', error);
    return lambdaError(error);
  }
};
