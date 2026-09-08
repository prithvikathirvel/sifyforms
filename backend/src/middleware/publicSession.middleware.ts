import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  PublicSession,
  readFormSessionToken,
  requirePublicSession,
} from '../service/publicSession.service';

/**
 * Attaches the caller's public-form session to the request, and refuses the
 * request if there isn't one.
 *
 * Sits in front of the public endpoints that either return information about
 * other people's answers (`check-unique`), spend the organization's money
 * (`check-external`), or read and write stored respondent data (drafts).
 *
 * This is not authentication and does not pretend to be: anyone can mint a
 * session by asking. What it buys is that every one of those calls is
 * attributable to a handle the *server* issued, which is what makes a budget
 * enforceable and what stops a draft from being addressable by an email
 * address. Nothing here should be read as "the caller is who they say they
 * are" — see service/publicSession.service.ts.
 *
 * The decision itself lives in `requirePublicSession` rather than here, because
 * these endpoints also exist as Cloud Functions and as Lambda handlers, and a
 * gate that lives in Express middleware is a gate that only guards one of the
 * three.
 */

export interface PublicSessionRequest extends Request {
  publicSession?: PublicSession;
}

export const FORM_SESSION_HEADER = 'x-form-session';

/**
 * `formId` for these routes is always in the path or the body. It is not taken
 * from the token, because the token deliberately carries nothing: the session
 * row holds the form, and `resolvePublicSession` refuses when the two disagree.
 */
function readFormId(req: Request): string {
  const fromParams = req.params?.formId;
  if (typeof fromParams === 'string' && fromParams) return fromParams;
  const fromBody = (req.body as Record<string, unknown> | undefined)?.formId;
  if (typeof fromBody === 'string' && fromBody) return fromBody;
  const fromQuery = req.query?.formId;
  return typeof fromQuery === 'string' ? fromQuery : '';
}

export async function requirePublicFormSession(
  req: PublicSessionRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const formId = readFormId(req);
  if (!formId) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: 'formId is required' });
    return;
  }

  try {
    req.publicSession = await requirePublicSession(
      formId,
      readFormSessionToken(req.headers as Record<string, unknown>, req.body),
    );
    next();
  } catch (error: any) {
    res
      .status(error.statusCode ?? StatusCodes.UNAUTHORIZED)
      .json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
  }
}
