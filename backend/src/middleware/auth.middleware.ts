import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { runWithContext } from '../utils/requestContext';
import {
  KEYCLOAK_CLIENT_ID,
  KEYCLOAK_ISSUER,
  KEYCLOAK_JWKS_URI,
  KEYCLOAK_VERIFY_AZP,
} from '../config/ums.config';
import logger from '../utils/logger';

/**
 * The signing keys are fetched from an address built out of configuration and
 * never out of the token being checked. Deriving it from the token's own `iss`
 * lets anyone who can stand up an OIDC issuer mint a token for any user here,
 * and turns every request into an outbound fetch to an address an attacker
 * chose.
 */
let keys: ReturnType<typeof jwksClient> | null = null;

function signingKeys() {
  if (!keys) {
    if (!KEYCLOAK_JWKS_URI) {
      throw new Error('KEYCLOAK_ISSUER is not configured; tokens cannot be verified');
    }
    keys = jwksClient({
      jwksUri: KEYCLOAK_JWKS_URI,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 3600000, // 1 hour
    });
  }
  return keys;
}

function getKey(header: JwtHeader, callback: SigningKeyCallback) {
  signingKeys().getSigningKey(header.kid, (err: any, key: any) => {
    if (err) return callback(err);
    const signingKey = key?.getPublicKey?.() || key?.publicKey || key?.rsaPublicKey;
    callback(null, signingKey);
  });
}

async function verifyKeycloakToken(token: string): Promise<any> {
  if (!KEYCLOAK_ISSUER || !KEYCLOAK_JWKS_URI) {
    throw Object.assign(new Error('KEYCLOAK_ISSUER is not configured'), { unconfigured: true });
  }
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        // Never take the algorithm from the token header.
        algorithms: ['RS256'],
        issuer: KEYCLOAK_ISSUER,
        clockTolerance: 5,
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      }
    );
  });
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
  orgId?: string;
}

/**
 * Create the local user row from verified token claims.
 *
 * Accounts are created in Keycloak through the user-management service, and can
 * also arrive from another application on the same realm. Without this, such a
 * user authenticates successfully and is then refused forever, with no way to
 * recover: signing up again fails because the email is already registered.
 */
async function provisionFromClaims(payload: any) {
  const email: string | undefined = payload.email;
  if (!email) return null;

  return prisma.user.upsert({
    where: { id: payload.sub },
    update: {}, // never overwrite edits made here
    create: {
      id: payload.sub,
      email,
      firstName: payload.given_name ?? null,
      lastName: payload.family_name ?? null,
      username: payload.preferred_username ?? null,
    },
    select: { id: true, email: true, firstName: true, lastName: true, username: true },
  });
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    // Only the Authorization header. The refresh token lives in a cookie; an
    // access token accepted from one would reopen CSRF on every write route.
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    let payload: any;
    try {
      payload = await verifyKeycloakToken(token);
    } catch (error: any) {
      if (error?.unconfigured) {
        logger.error('Auth --> KEYCLOAK_ISSUER is not configured');
        res.status(500).json({ error: 'Authentication is not configured' });
        return;
      }
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Keycloak access tokens carry `aud: account`, so the authorized party is
    // the claim that actually identifies which client the token was issued to.
    if (KEYCLOAK_VERIFY_AZP && payload.azp && payload.azp !== KEYCLOAK_CLIENT_ID) {
      logger.warn('Auth --> token issued to another client', { azp: payload.azp });
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const keycloakId: string = payload.sub;
    if (!keycloakId) {
      res.status(401).json({ error: 'Token missing sub claim' });
      return;
    }

    let user = await prisma.user.findUnique({
      where: { id: keycloakId },
      select: { id: true, email: true, firstName: true, lastName: true, username: true },
    });

    if (!user) {
      user = await provisionFromClaims(payload);
      if (user) {
        logger.info('Auth --> provisioned user from token claims', { userId: user.id });
      }
    }

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = user;
    // Calls to the user-management service made while handling this request can
    // fall back to the caller's own token when no service user is configured.
    runWithContext({ token, userId: user.id }, next);
  } catch (error) {
    logger.error('Auth --> unexpected error', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

function getParamString(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) return param[0];
  return param;
}

export async function orgMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const headerOrgId = req.headers['x-org-id'];
    const headerOrgIdStr = Array.isArray(headerOrgId) ? headerOrgId[0] : headerOrgId;
    const paramOrgId = getParamString(req.params.orgId);
    const orgId = paramOrgId || headerOrgIdStr;
    
    if (!orgId) {
      res.status(400).json({ error: 'Organization ID required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const orgUser = await prisma.orgUser.findUnique({
      where: {
        orgId_userId: {
          orgId: orgId,
          userId: req.user.id,
        },
      },
    });
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org || (!orgUser && org.ownerId !== req.user.id)) {
      res.status(403).json({ error: 'Access denied to this organization' });
      return;
    }

    // An organization that is still being registered has no role definitions
    // yet, so every permission check inside it would resolve to nothing. Say so
    // rather than presenting an empty, apparently broken workspace.
    if (org.provisioningStatus === 'DELETING') {
      res.status(410).json({ error: 'This organization is being deleted' });
      return;
    }
    if (org.provisioningStatus !== 'ACTIVE') {
      res.status(409).json({
        error: 'This organization is still being set up. Please try again in a moment.',
        provisioningStatus: org.provisioningStatus,
      });
      return;
    }

    req.orgId = orgId;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Organization access error' });
  }
}
