import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import { draftService } from '../../service/draft.service';
import { readFormSessionToken, requirePublicSession } from '../../service/publicSession.service';
import { lambdaResponse, lambdaError, parseBody } from '../../utils/lambdaAuth';
import logger from '../../utils/logger';

/**
 * Drafts, as Lambda handlers.
 *
 * Same change as the Express and Cloud Functions controllers, and it has to be
 * made in all three: they are three front doors onto one service, and a fix
 * applied to one of them is not a fix. A draft used to be addressed by
 * `?identity=someone@example.com` and nothing else, so knowing an email address
 * was the whole authorisation check. It is now scoped by the server-issued form
 * session — see service/draft.service.ts.
 *
 * Request bodies are no longer logged either: they are somebody's partly-filled
 * answers, and they now carry a session token.
 */

// GET /getDraft?formId=xxx     Header: X-Form-Session
export const getDraft = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const formId = event.queryStringParameters?.formId || '';
    logger.info('Lambda --> getDraft --> Request', { formId });
    if (!formId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId is required' });

    const session = await requirePublicSession(formId, readFormSessionToken(event.headers, undefined));
    const result = await draftService.getDraft(formId, session.id);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> getDraft --> Error', { message: error?.message });
    return lambdaError(error);
  }
};

// POST /saveDraft   Body: { formId, data, stepIndex }   Header: X-Form-Session
export const saveDraft = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = parseBody(event);
    const { formId, identity, data, stepIndex } = body;
    logger.info('Lambda --> saveDraft --> Request', { formId });
    if (!formId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId is required' });

    const session = await requirePublicSession(String(formId), readFormSessionToken(event.headers, body));
    const result = await draftService.saveDraft({
      formId: String(formId),
      sessionId: session.id,
      // A label for a future verified-resume flow. Nothing is looked up by it.
      identity: typeof identity === 'string' ? identity.slice(0, 320) : null,
      data: data && typeof data === 'object' ? data : {},
      stepIndex: Number.isInteger(stepIndex) ? stepIndex : 0,
    });
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> saveDraft --> Error', { message: error?.message });
    return lambdaError(error);
  }
};

// DELETE /deleteDraft?formId=xxx     Header: X-Form-Session
export const deleteDraft = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const formId = event.queryStringParameters?.formId || '';
    logger.info('Lambda --> deleteDraft --> Request', { formId });
    if (!formId) return lambdaResponse(StatusCodes.BAD_REQUEST, { error: 'formId is required' });

    const session = await requirePublicSession(formId, readFormSessionToken(event.headers, undefined));
    const result = await draftService.deleteDraft(formId, session.id);
    return lambdaResponse(StatusCodes.OK, result);
  } catch (error: any) {
    logger.error('Lambda --> deleteDraft --> Error', { message: error?.message });
    return lambdaError(error);
  }
};
