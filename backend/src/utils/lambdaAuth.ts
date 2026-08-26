import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ZodSchema } from 'zod';
import { Response } from 'express';
import { authMiddleware, orgMiddleware, AuthRequest } from '../middleware/auth.middleware';

export interface LambdaUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}

function buildMockReq(event: APIGatewayProxyEvent, extra?: Partial<AuthRequest>): AuthRequest {
  // Normalize headers to lowercase (API Gateway v1 passes mixed case)
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(event.headers || {})) {
    if (v !== undefined) headers[k.toLowerCase()] = v;
  }
  return {
    headers,
    cookies: {},
    params: (event.pathParameters as Record<string, string>) || {},
    query: (event.queryStringParameters as Record<string, string>) || {},
    body: parseBody(event),
    ...extra,
  } as unknown as AuthRequest;
}

function buildMockRes(): {
  res: Response;
  getResult: () => { headersSent: boolean; statusCode: number; responseBody: any };
} {
  let headersSent = false;
  let statusCode = 200;
  let responseBody: any = null;

  const res: any = {
    get headersSent() { return headersSent; },
    status(code: number) { statusCode = code; return res; },
    json(body: any) { responseBody = body; headersSent = true; return res; },
    send(body: any) { responseBody = body; headersSent = true; return res; },
  };

  return { res, getResult: () => ({ headersSent, statusCode, responseBody }) };
}

export function parseBody(event: APIGatewayProxyEvent): any {
  try {
    if (!event.body) return {};
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

export function lambdaResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function lambdaError(error: any): APIGatewayProxyResult {
  return lambdaResponse(error?.statusCode || 500, { error: error?.message || 'Internal server error' });
}

export function isLambdaError(result: any): result is APIGatewayProxyResult {
  return result !== null && typeof result === 'object' && typeof result.statusCode === 'number' && typeof result.body === 'string';
}

/**
 * Lambda auth helper — verifies Keycloak token and returns user or error response.
 * Usage:
 *   const auth = await lambdaAuthMiddleware(event);
 *   if (isLambdaError(auth)) return auth;
 *   // auth.user is now available
 */
export async function lambdaAuthMiddleware(event: APIGatewayProxyEvent): Promise<{ user: LambdaUser } | APIGatewayProxyResult> {
  const mockReq = buildMockReq(event);
  const { res: mockRes, getResult } = buildMockRes();

  await new Promise<void>(resolve => {
    authMiddleware(mockReq, mockRes as Response, () => resolve());
  });

  const { headersSent, statusCode, responseBody } = getResult();
  if (headersSent) {
    return lambdaResponse(statusCode, responseBody);
  }

  return { user: mockReq.user! };
}

/**
 * Lambda org helper — validates x-org-id header and org membership.
 * Must be called AFTER lambdaAuthMiddleware (user must be set).
 * Usage:
 *   const orgCtx = await lambdaOrgMiddleware(event, auth.user);
 *   if (isLambdaError(orgCtx)) return orgCtx;
 *   // orgCtx.orgId is now available
 */
export async function lambdaOrgMiddleware(
  event: APIGatewayProxyEvent,
  user: LambdaUser,
): Promise<{ orgId: string } | APIGatewayProxyResult> {
  const mockReq = buildMockReq(event, { user });
  const { res: mockRes, getResult } = buildMockRes();

  await new Promise<void>(resolve => {
    orgMiddleware(mockReq, mockRes as Response, () => resolve());
  });

  const { headersSent, statusCode, responseBody } = getResult();
  if (headersSent) {
    return lambdaResponse(statusCode, responseBody);
  }

  return { orgId: mockReq.orgId! };
}

/**
 * Lambda validate helper — Zod schema validation on parsed body.
 * Returns validated data or error response.
 * Usage:
 *   const data = lambdaValidate(body, MySchema);
 *   if (isLambdaError(data)) return data;
 */
export function lambdaValidate<T>(body: any, schema: ZodSchema<T>): T | APIGatewayProxyResult {
  const result = schema.safeParse(body);
  if (!result.success) {
    return lambdaResponse(400, { error: 'Validation failed', details: result.error.issues });
  }
  return result.data;
}
