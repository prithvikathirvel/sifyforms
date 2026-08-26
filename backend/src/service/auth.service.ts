import { UserDao } from '../dao/interfaces/UserDao';
import { userDao } from '../dao/factory/userDao.factory';
import { SignUpInput, UpdateProfileInput } from '../schemas/auth.schema';
import { StatusCodes } from 'http-status-codes';
import { createError } from '../utils/errors';
import { listMyInvites } from './invite.service';

export class AuthService {
  constructor(private readonly userDao: UserDao) {}

  async register(input: SignUpInput): Promise<void> {
    const existing = await this.userDao.findUserByEmail(input.email);
    if (existing) {
      throw createError(StatusCodes.BAD_REQUEST, 'Email already registered');
    }

    await this.userDao.createUser({
      id: input.id,
      email: input.email,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      username: input.username ?? null,
      phone: input.phone ?? null,
      gender: input.gender ?? null,
      address: input.address ?? null,
      additionalDetails: input.additionalDetails ? JSON.stringify(input.additionalDetails) : null,
    });
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

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<void> {
    const user = await this.userDao.findUserWithOrgsByUserId(userId);
    if (!user) {
      throw createError(StatusCodes.NOT_FOUND, 'User not found');
    }
    await this.userDao.updateUser(userId, {
      ...input,
      additionalDetails: input.additionalDetails ? JSON.stringify(input.additionalDetails) : undefined,
    });
  }
}

export const authService = new AuthService(userDao);
