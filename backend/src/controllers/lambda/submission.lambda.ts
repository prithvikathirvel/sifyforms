import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import * as submissionService from '../../service/submission.service';
import { lambdaAuthMiddleware, lambdaResponse, lambdaError, isLambdaError, parseBody } from '../../utils/lambdaAuth';
import logger from '../../utils/logger';

// POST /createSubmission
// No auth — public form submission
// Body: { formId, data, turnstileToken }
export const createSubmission = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> createSubmission --> Request', { body: event.body });
    const body = parseBody(event);
    const ip = event.headers['x-forwarded-for'] || null;
    const userAgent = event.headers['user-agent'] || null;
    const result = await submissionService.createSubmission(body, ip, userAgent);
    return lambdaResponse(StatusCodes.CREATED, result);
  } catch (error: any) {
    logger.error('Lambda --> createSubmission --> Error', error);
    if (error.code === 'ALREADY_VOTED') {
      return lambdaResponse(StatusCodes.BAD_REQUEST, { error: error.message, code: 'ALREADY_VOTED' });
    }
    if (error.details) {
      return lambdaResponse(StatusCodes.BAD_REQUEST, { error: error.message, details: error.details });
    }
    return lambdaError(error);
  }
};

export const saveSurveyPartial = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const result = await submissionService.saveSurveyPartial(parseBody(event));
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    return lambdaError(error);
  }
};

// POST /checkFieldUniqueness
// No auth — Body: { formId, fieldId, value }
export const checkFieldUniqueness = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> checkFieldUniqueness --> Request', { body: event.body });
    const { formId, fieldId, value } = parseBody(event);
    if (!formId || !fieldId || value === undefined) {
      return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId, fieldId, and value are required' });
    }
    const result = await submissionService.checkFieldUniqueness(formId, fieldId, value);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> checkFieldUniqueness --> Error', error);
    return lambdaError(error);
  }
};

// POST /checkExternalValidation
// No auth — Body: { formId, fieldId, value, formData? }
export const checkExternalValidation = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> checkExternalValidation --> Request', { body: event.body });
    const { formId, fieldId, value, formData } = parseBody(event);
    const result = await submissionService.checkExternalValidation(formId, fieldId, value, formData);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> checkExternalValidation --> Error', error);
    return lambdaError(error);
  }
};

// GET /listSubmissions?formId=xxx&orgId=xxx&page=1&limit=50&status=&search=&startDate=&endDate=
// Headers: Authorization: Bearer <token>
export const listSubmissions = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> listSubmissions --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const q = event.queryStringParameters || {};
    const { formId, orgId, page = '1', limit = '50', status, search, startDate, endDate } = q;
    if (!formId || !orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId and orgId are required' });
    const result = await submissionService.listSubmissions(
      formId, orgId, auth.user.id,
      parseInt(page, 10), parseInt(limit, 10),
      status, search, startDate, endDate,
    );
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> listSubmissions --> Error', error);
    return lambdaError(error);
  }
};

// GET /getSubmission?formId=xxx&submissionId=xxx&orgId=xxx
// Headers: Authorization: Bearer <token>
export const getSubmission = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> getSubmission --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const { formId, submissionId, orgId } = event.queryStringParameters || {};
    if (!formId || !submissionId || !orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId, submissionId and orgId are required' });
    const result = await submissionService.getSubmission(submissionId, formId, orgId, auth.user.id);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> getSubmission --> Error', error);
    return lambdaError(error);
  }
};

// PUT /updateSubmission
// Headers: Authorization: Bearer <token>
// Body: { formId, submissionId, orgId, data?, isRead?, tags? }
export const updateSubmission = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> updateSubmission --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const { formId, submissionId, orgId, ...updates } = parseBody(event);
    if (!formId || !submissionId || !orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId, submissionId and orgId are required' });
    const result = await submissionService.updateSubmission(submissionId, formId, orgId, auth.user.id, updates);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> updateSubmission --> Error', error);
    return lambdaError(error);
  }
};

// DELETE /deleteSubmission?formId=xxx&submissionId=xxx&orgId=xxx
// Headers: Authorization: Bearer <token>
export const deleteSubmission = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> deleteSubmission --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const { formId, submissionId, orgId } = event.queryStringParameters || {};
    if (!formId || !submissionId || !orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId, submissionId and orgId are required' });
    const result = await submissionService.deleteSubmission(submissionId, formId, orgId, auth.user.id);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> deleteSubmission --> Error', error);
    return lambdaError(error);
  }
};

// POST /exportSubmissions
// Headers: Authorization: Bearer <token>
// Body: { formId, orgId, format?, ids? }
export const exportSubmissions = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> exportSubmissions --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const { formId, orgId, format = 'json', ids } = parseBody(event);
    if (!formId || !orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId and orgId are required' });
    const result = await submissionService.exportSubmissions(formId, orgId, auth.user.id, format, ids);
    if (result.format === 'csv') {
      return {
        statusCode: StatusCodes.OK,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${result.formName}-submissions.csv"`,
        },
        body: result.csvContent,
      };
    }
    return {
      statusCode: StatusCodes.OK,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${result.formName}-submissions.json"`,
      },
      body: JSON.stringify(result.data),
    };
  } catch (error: any) {
    logger.error('Lambda --> exportSubmissions --> Error', error);
    return lambdaError(error);
  }
};

// POST /bulkDeleteSubmissions
// Headers: Authorization: Bearer <token>
// Body: { formId, orgId, ids }
export const bulkDeleteSubmissions = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> bulkDeleteSubmissions --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const { formId, orgId, ids } = parseBody(event);
    if (!formId || !orgId || !ids || !Array.isArray(ids) || ids.length === 0) {
      return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId, orgId and ids array are required' });
    }
    const result = await submissionService.bulkDeleteSubmissions(formId, orgId, auth.user.id, ids);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> bulkDeleteSubmissions --> Error', error);
    return lambdaError(error);
  }
};
