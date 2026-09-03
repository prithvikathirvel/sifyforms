import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import { authService } from '../../service/auth.service';
import { SignUpSchema, UpdateProfileSchema } from '../../schemas/auth.schema';
import { lambdaAuthMiddleware, lambdaValidate, lambdaResponse, lambdaError, isLambdaError, parseBody } from '../../utils/lambdaAuth';
import logger from '../../utils/logger';

// POST /registerUser
// Body: { email, password, username, firstName?, lastName?, phone?, gender?, address? }
export const registerUser = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> registerUser --> Request', { body: event.body });
    const body = parseBody(event);
    const validated = lambdaValidate(body, SignUpSchema);
    if (isLambdaError(validated)) return validated;
    const result = await authService.signUp(validated);
    return lambdaResponse(StatusCodes.CREATED, { message: 'Account created successfully', ...result });
  } catch (error: any) {
    logger.error('Lambda --> registerUser --> Error', error);
    return lambdaError(error);
  }
};

// GET /getSession
// Headers: Authorization: Bearer <token>
export const getSession = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> getSession --> Request', { headers: event.headers });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const session = await authService.getSession(auth.user.id);
    return lambdaResponse(StatusCodes.OK, session);
  } catch (error: any) {
    logger.error('Lambda --> getSession --> Error', error);
    return lambdaError(error);
  }
};

// POST /logout
export const logout = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('Lambda --> logout --> Request', { headers: event.headers });
  return lambdaResponse(StatusCodes.OK, { message: 'Logged out successfully' });
};

// PUT /updateProfile
// Headers: Authorization: Bearer <token>
// Body: { firstName?, lastName?, username?, phone?, gender?, address?, additionalDetails? }
export const updateProfile = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Lambda --> updateProfile --> Request', { body: event.body });
    const auth = await lambdaAuthMiddleware(event);
    if (isLambdaError(auth)) return auth;
    const body = parseBody(event);
    const validated = lambdaValidate(body, UpdateProfileSchema);
    if (isLambdaError(validated)) return validated;
    const token = String(event.headers?.Authorization ?? event.headers?.authorization ?? '').replace(/^Bearer /, '');
    await authService.updateProfile(auth.user.id, token, validated);
    return lambdaResponse(StatusCodes.OK, { response: { message: 'Profile updated successfully' } });
  } catch (error: any) {
    logger.error('Lambda --> updateProfile --> Error', error);
    return lambdaError(error);
  }
};
