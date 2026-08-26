import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { runWithContext } from '../utils/requestContext';

// Cache JWKS clients per issuer
const jwksClients: Record<string, ReturnType<typeof jwksClient>> = {};

function getJwksClient(issuer: string) {
  if (!jwksClients[issuer]) {
    jwksClients[issuer] = jwksClient({
      jwksUri: `${issuer}/protocol/openid-connect/certs`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 3600000, // 1 hour
    });
  }
  return jwksClients[issuer];
}

async function verifyKeycloakToken(token: string, jwksUri: string): Promise<any> {
  const client = getJwksClient(jwksUri);

  function getKey(header: JwtHeader, callback: SigningKeyCallback) {
    client.getSigningKey(header.kid, (err: any, key: any) => {
      if (err) return callback(err);
      const signingKey = key?.getPublicKey?.() || key?.publicKey || key?.rsaPublicKey;
      callback(null, signingKey);
    });
  }

  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
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

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.token;
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = jwt.decode(token, { complete: true }) as any;
    if (!decoded) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const isKeycloak = decoded.header?.alg === 'RS256' && !!decoded.payload?.iss;
    let user;

    if (isKeycloak) {
      let payload: any;
      try {
        payload = await verifyKeycloakToken(token, decoded.payload.iss);
      } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }

      const keycloakId: string = payload.sub;
      if (!keycloakId) {
        res.status(401).json({ error: 'Token missing sub claim' });
        return;
      }

      user = await prisma.user.findUnique({
        where: { id: keycloakId },
        select: { id: true, email: true, firstName: true, lastName: true, username: true },
      });
    } else {
      res.status(401).json({ error: 'Invalid token: only Keycloak tokens are accepted' });
      return;
    }

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = user;
    // Downstream calls to the RBAC service reuse this token: it is the caller's
    // own Keycloak credential, which is the only thing that service accepts.
    runWithContext({ token, userId: user.id }, next);
  } catch (error) {
    console.error('Auth error:', error);
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
    console.log('orgUser:', orgUser);
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org || (!orgUser && org.ownerId !== req.user.id)) {
      res.status(403).json({ error: 'Access denied to this organization' });
      return;
    }

    req.orgId = orgId;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Organization access error' });
  }
}
