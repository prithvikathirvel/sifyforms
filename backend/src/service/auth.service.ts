import { UserDao } from '../dao/interfaces/UserDao';
import { userDao } from '../dao/factory/userDao.factory';
import {
  ConfirmForgotPasswordInput,
  SignUpInput,
  UpdateProfileInput,
} from '../schemas/auth.schema';
import { StatusCodes } from 'http-status-codes';
import { createError } from '../utils/errors';
import { listMyInvites } from './invite.service';
import * as ums from './ums.client';
import logger from '../utils/logger';

/**
 * Identity, owned by the user-management service.
 *
 * Credentials, the account record and the tokens all live there; this
 * application keeps a projection of the user so forms, teams and memberships
 * have something local to join against. Every write goes to that service first
 * and is reflected here afterwards, so the two can never disagree about who
 * exists.
 */
export class AuthService {
  constructor(private readonly userDao: UserDao) {}

  /**
   * Create an account.
   *
   * A single call from the client, so there is no window in which the browser
   * can create the remote account and then fail to create the local one - the
   * failure mode that used to leave people able to log in and be refused
   * forever. If the local write still fails, the row is created from verified
   * token claims on the first authenticated request, so the account is never
   * stranded.
   */
  async signUp(input: SignUpInput): Promise<{ userId: string; email: string }> {
    const existing = await this.userDao.findUserByEmail(input.email);
    if (existing) {
      throw createError(StatusCodes.BAD_REQUEST, 'Email already registered');
    }

    const created = await ums.createUser({
      email: input.email,
      password: input.password,
      username: input.username,
      firstName: input.firstName ?? '',
      lastName: input.lastName ?? '',
      phone: input.phone ?? '',
      ...(input.gender ? { gender: input.gender } : {}),
      ...(input.address ? { address: input.address } : {}),
      ...(input.additionalDetails ? { additionalDetails: input.additionalDetails } : {}),
    });

    if (!created?.userId) {
      throw createError(StatusCodes.BAD_GATEWAY, 'Account created but no user id was returned');
    }

    try {
      await this.userDao.createUser({
        id: created.userId,
        email: input.email,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        username: input.username ?? null,
        phone: input.phone ?? null,
        gender: input.gender ?? null,
        address: input.address ?? null,
        additionalDetails: input.additionalDetails ? JSON.stringify(input.additionalDetails) : null,
      });
    } catch (error: any) {
      logger.error('AuthService --> signUp --> local user write failed', {
        userId: created.userId,
        message: error?.message,
      });
    }

    return { userId: created.userId, email: input.email };
  }

  async login(email: string, password: string) {
    return ums.login(email, password);
  }

  async refresh(token: string) {
    return ums.refreshToken(token);
  }

  async logout(accessToken: string | undefined, refreshToken: string | undefined) {
    if (accessToken && refreshToken) {
      await ums.logout(accessToken, refreshToken);
    }
  }

  async forgotPassword(email: string) {
    return ums.forgotPassword(email);
  }

  async confirmForgotPassword(input: ConfirmForgotPasswordInput) {
    return ums.confirmForgotPassword(input);
  }

  async getSession(userId: string) {
    const user = await this.userDao.findUserWithOrgsByUserId(userId);
    if (!user) {
      throw createError(StatusCodes.NOT_FOUND, 'User not found');
    }

    // The owner also has an OrgUser row now, so the two sources overlap.
    const byId = new Map<string, { id: string; name: string; slug: string }>();
    for (const org of [...user.ownedOrgs, ...user.orgs.map(o => o.org)]) {
      byId.set(org.id, org);
    }
    const allOrgs = [...byId.values()];

    const pendingInvites = await listMyInvites(user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      organizations: allOrgs,
      pendingInvites,
      // Only send someone to the create-organization screen when they have
      // neither an organization nor an invitation waiting for them.
      needsOrgSetup: allOrgs.length === 0 && pendingInvites.length === 0,
    };
  }

  /**
   * Update the profile in the user-management service first; only mirror it
   * locally once that succeeded, so the local copy never drifts ahead of the
   * record of truth.
   */
  async updateProfile(
    userId: string,
    callerToken: string,
    input: UpdateProfileInput
  ): Promise<unknown> {
    const user = await this.userDao.findUserWithOrgsByUserId(userId);
    if (!user) {
      throw createError(StatusCodes.NOT_FOUND, 'User not found');
    }

    const remote = await ums.updateProfile(callerToken, {
      username: input.username ?? user.username ?? '',
      firstName: input.firstName ?? user.firstName ?? '',
      lastName: input.lastName ?? user.lastName ?? '',
      phone: input.phone ?? '',
      ...(input.gender ? { gender: input.gender } : {}),
      ...(input.address ? { address: input.address } : {}),
      ...(input.additionalDetails ? { additionalDetails: input.additionalDetails } : {}),
    });

    await this.userDao.updateUser(userId, {
      ...input,
      additionalDetails: input.additionalDetails ? JSON.stringify(input.additionalDetails) : undefined,
    });

    return remote;
  }

  async findUserByEmail(email: string) {
    return ums.getUserByEmail(email);
  }
}

export const authService = new AuthService(userDao);
