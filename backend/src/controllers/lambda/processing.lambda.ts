import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import * as processingService from '../../service/processing.service';
import { lambdaAuthMiddleware, lambdaResponse, lambdaError, isLambdaError } from '../../utils/lambdaAuth';
import logger from '../../utils/logger';

// GET /getSubmissionResultPublic?submissionId=xxx
// No auth — used by PublicFormPage to poll for scorecard
export const getSubmissionResultPublic = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> getSubmissionResultPublic --> Request', { query: event.queryStringParameters });
    const submissionId = event.queryStringParameters?.submissionId || '';
    if (!submissionId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'submissionId is required' });
    const result = await processingService.getSubmissionResultPublic(submissionId);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> getSubmissionResultPublic --> Error', error);
    return lambdaError(error);
  }
};

// GET /getPollResults?formId=xxx
// No auth — live vote counts for published voting forms
export const getPollResults = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> getPollResults --> Request', { query: event.queryStringParameters });
    const formId = event.queryStringParameters?.formId || '';
    if (!formId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId is required' });
    const result = await processingService.getPollResults(formId);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> getPollResults --> Error', error);
    return lambdaError(error);
  }
};

// GET /getSubmissionResult?formId=xxx&submissionId=xxx&orgId=xxx
// Headers: Authorization: Bearer <token>
export const getSubmissionResult = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> getSubmissionResult --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const { formId, submissionId, orgId } = event.queryStringParameters || {};
    if (!formId || !submissionId || !orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId, submissionId and orgId are required' });
    const result = await processingService.getSubmissionResult(submissionId, formId, orgId, auth.user.id);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> getSubmissionResult --> Error', error);
    return lambdaError(error);
  }
};

// GET /getLeaderboard?formId=xxx&orgId=xxx
// Headers: Authorization: Bearer <token>
export const getLeaderboard = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> getLeaderboard --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const { formId, orgId } = event.queryStringParameters || {};
    if (!formId || !orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId and orgId are required' });
    const result = await processingService.getLeaderboard(formId, orgId, auth.user.id);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> getLeaderboard --> Error', error);
    return lambdaError(error);
  }
};

// GET /getAssessmentAnalytics?formId=xxx&orgId=xxx
// Headers: Authorization: Bearer <token>
export const getAssessmentAnalytics = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> getAssessmentAnalytics --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const { formId, orgId } = event.queryStringParameters || {};
    if (!formId || !orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId and orgId are required' });
    const result = await processingService.getAssessmentAnalytics(formId, orgId, auth.user.id);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> getAssessmentAnalytics --> Error', error);
    return lambdaError(error);
  }
};

// GET /getAuditLog?formId=xxx&orgId=xxx
// Headers: Authorization: Bearer <token>
export const getAuditLog = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> getAuditLog --> Request', { query: event.queryStringParameters });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const { formId, orgId } = event.queryStringParameters || {};
    if (!formId || !orgId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId and orgId are required' });
    const result = await processingService.getAuditLog(formId, orgId);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> getAuditLog --> Error', error);
    return lambdaError(error);
  }
};
