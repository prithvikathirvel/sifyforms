import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import { draftService } from '../../service/draft.service';
import { lambdaResponse, lambdaError, parseBody } from '../../utils/lambdaAuth';
import logger from '../../utils/logger';

// GET /getDraft?formId=xxx&identity=xxx
// No auth
export const getDraft = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> getDraft --> Request', { query: event.queryStringParameters });
    const formId = event.queryStringParameters?.formId || '';
    const identity = event.queryStringParameters?.identity || '';
    if (!formId || !identity) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId and identity are required' });
    const result = await draftService.getDraft(formId, identity);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> getDraft --> Error', error);
    return lambdaError(error);
  }
};

// POST /saveDraft
// No auth — Body: { formId, identity, data, stepIndex }
export const saveDraft = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> saveDraft --> Request', { body: event.body });
    const { formId, identity, data, stepIndex } = parseBody(event);
    if (!formId || !identity) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId and identity are required' });
    const result = await draftService.saveDraft({ formId, identity, data, stepIndex });
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> saveDraft --> Error', error);
    return lambdaError(error);
  }
};

// DELETE /deleteDraft?formId=xxx&identity=xxx
// No auth
export const deleteDraft = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> deleteDraft --> Request', { query: event.queryStringParameters });
    const formId = event.queryStringParameters?.formId || '';
    const identity = event.queryStringParameters?.identity || '';
    if (!formId || !identity) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId and identity are required' });
    const result = await draftService.deleteDraft(formId, identity);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> deleteDraft --> Error', error);
    return lambdaError(error);
  }
};
