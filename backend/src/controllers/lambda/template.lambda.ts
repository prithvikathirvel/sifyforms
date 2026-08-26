import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import * as templateService from '../../service/template.service';
import { lambdaAuthMiddleware, lambdaOrgMiddleware, lambdaResponse, lambdaError, isLambdaError, parseBody } from '../../utils/lambdaAuth';
import logger from '../../utils/logger';

// GET /listTemplates
// Headers: Authorization: Bearer <token>, x-org-id: xxx
export const listTemplates = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> listTemplates --> Request', { headers: event.headers });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const orgCtx = await lambdaOrgMiddleware(event, auth.user);
    if (isLambdaError(orgCtx)) return orgCtx;
    const result = await templateService.listTemplates(orgCtx.orgId);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> listTemplates --> Error', error);
    return lambdaError(error);
  }
};

// GET /getTemplate?id=xxx
// Headers: Authorization: Bearer <token>
export const getTemplate = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> getTemplate --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const id = event.queryStringParameters?.id || '';
    if (!id) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'id is required' });
    const result = await templateService.getTemplate(id);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> getTemplate --> Error', error);
    return lambdaError(error);
  }
};

// POST /createTemplateFromForm
// Headers: Authorization: Bearer <token>, x-org-id: xxx
// Body: { formId, name?, category? }
export const createTemplateFromForm = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> createTemplateFromForm --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const orgCtx = await lambdaOrgMiddleware(event, auth.user);
    if (isLambdaError(orgCtx)) return orgCtx;
    const { formId, name, category } = parseBody(event);
    if (!formId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId is required' });
    const result = await templateService.createTemplateFromForm(formId, orgCtx.orgId, auth.user.id, name, category);
    return lambdaResponse(StatusCodes.CREATED, result);
  } catch (error: any) {
    logger.error('Lambda --> createTemplateFromForm --> Error', error);
    return lambdaError(error);
  }
};

// POST /duplicateTemplate
// Headers: Authorization: Bearer <token>, x-org-id: xxx
// Body: { id, name? }
export const duplicateTemplate = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> duplicateTemplate --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const orgCtx = await lambdaOrgMiddleware(event, auth.user);
    if (isLambdaError(orgCtx)) return orgCtx;
    const { id, name } = parseBody(event);
    if (!id) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'id is required' });
    const result = await templateService.duplicateTemplate(id, orgCtx.orgId, auth.user.id, name);
    return lambdaResponse(StatusCodes.CREATED, result);
  } catch (error: any) {
    logger.error('Lambda --> duplicateTemplate --> Error', error);
    return lambdaError(error);
  }
};
