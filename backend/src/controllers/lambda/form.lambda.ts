import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import * as formService from '../../service/form.service';
import { CreateFormSchema, UpdateFormSchema, AIEditSchema } from '../../schemas/form.schema';
import { lambdaAuthMiddleware, lambdaOrgMiddleware, lambdaValidate, lambdaResponse, lambdaError, isLambdaError, parseBody } from '../../utils/lambdaAuth';
import logger from '../../utils/logger';

// GET /getPublicForm?orgSlug=xxx&formSlug=xxx
// No auth — public form viewer
export const getPublicForm = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> getPublicForm --> Request', { query: event.queryStringParameters });
    const orgSlug = event.queryStringParameters?.orgSlug || '';
    const formSlug = event.queryStringParameters?.formSlug || '';
    if (!orgSlug || !formSlug) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'orgSlug and formSlug are required' });
    const result = await formService.getPublicForm(orgSlug, formSlug);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> getPublicForm --> Error', error);
    return lambdaError(error);
  }
};

// POST /createForm
// Headers: Authorization: Bearer <token>
// Body: { orgId, name, description?, schema, settings? }
export const createForm = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> createForm --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const body = parseBody(event);
    const validated = lambdaValidate(body, CreateFormSchema);
    if (isLambdaError(validated)) return validated;
    const orgId = body.orgId || '';
    if (!orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'orgId is required' });
    const result = await formService.createForm(validated, orgId, auth.user.id);
    return lambdaResponse(StatusCodes.CREATED, result);
  } catch (error: any) {
    logger.error('Lambda --> createForm --> Error', error);
    return lambdaError(error);
  }
};

// GET /listForms?orgId=xxx
// Headers: Authorization: Bearer <token>
export const listForms = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> listForms --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const orgId = event.queryStringParameters?.orgId || '';
    if (!orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'orgId is required' });
    const result = await formService.listForms(orgId, auth.user.id, false);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> listForms --> Error', error);
    return lambdaError(error);
  }
};

// GET /getForm?formId=xxx&orgId=xxx
// Headers: Authorization: Bearer <token>
export const getForm = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> getForm --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const formId = event.queryStringParameters?.formId || '';
    const orgId = event.queryStringParameters?.orgId || '';
    if (!formId || !orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId and orgId are required' });
    const result = await formService.getForm(formId, orgId);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> getForm --> Error', error);
    return lambdaError(error);
  }
};

// PUT /updateForm
// Headers: Authorization: Bearer <token>
// Body: { formId, orgId, name?, description?, schema?, settings?, isPublished? }
export const updateForm = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> updateForm --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const body = parseBody(event);
    const validated = lambdaValidate(body, UpdateFormSchema);
    if (isLambdaError(validated)) return validated;
    const formId = body.formId || '';
    const orgId = body.orgId || '';
    if (!formId || !orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId and orgId are required' });
    const result = await formService.updateForm(formId, orgId, validated);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> updateForm --> Error', error);
    return lambdaError(error);
  }
};

// DELETE /deleteForm?formId=xxx&orgId=xxx
// Headers: Authorization: Bearer <token>
export const deleteForm = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> deleteForm --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const formId = event.queryStringParameters?.formId || '';
    const orgId = event.queryStringParameters?.orgId || '';
    if (!formId || !orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId and orgId are required' });
    const result = await formService.deleteForm(formId, orgId);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> deleteForm --> Error', error);
    return lambdaError(error);
  }
};

// POST /publishForm
// Headers: Authorization: Bearer <token>
// Body: { formId, orgId }
export const publishForm = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> publishForm --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const { formId, orgId } = parseBody(event);
    if (!formId || !orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId and orgId are required' });
    const result = await formService.publishForm(formId, orgId);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> publishForm --> Error', error);
    return lambdaError(error);
  }
};

// POST /duplicateForm
// Headers: Authorization: Bearer <token>
// Body: { formId, orgId, name? }
export const duplicateForm = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> duplicateForm --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const { formId, orgId, name } = parseBody(event);
    if (!formId || !orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId and orgId are required' });
    const result = await formService.duplicateForm(formId, orgId, auth.user.id, name);
    return lambdaResponse(StatusCodes.CREATED, result);
  } catch (error: any) {
    logger.error('Lambda --> duplicateForm --> Error', error);
    return lambdaError(error);
  }
};

// GET /getFormStats?orgId=xxx
// Headers: Authorization: Bearer <token>
export const getFormStats = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> getFormStats --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const orgId = event.queryStringParameters?.orgId || '';
    if (!orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'orgId is required' });
    const result = await formService.getStats(orgId, auth.user.id, false);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> getFormStats --> Error', error);
    return lambdaError(error);
  }
};

// POST /generateFormWithAI
// Headers: Authorization: Bearer <token>
// Body: { prompt }
export const generateFormWithAI = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> generateFormWithAI --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const { prompt } = parseBody(event);
    if (!prompt || typeof prompt !== 'string') return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'Prompt is required and must be a string' });
    const result = await formService.generateFormWithAI(prompt);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> generateFormWithAI --> Error', error);
    return lambdaError(error);
  }
};

// POST /editFormWithAI
// Headers: Authorization: Bearer <token>
// Body: { formId, orgId, prompt, sessionId? }
export const editFormWithAI = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> editFormWithAI --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const body = parseBody(event);
    const validated = lambdaValidate(body, AIEditSchema);
    if (isLambdaError(validated)) return validated;
    const { formId, orgId, prompt, sessionId } = body;
    if (!formId || !orgId || !prompt) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId, orgId and prompt are required' });
    const result = await formService.editFormWithAI(formId, orgId, prompt, sessionId);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> editFormWithAI --> Error', error);
    return lambdaError(error);
  }
};
