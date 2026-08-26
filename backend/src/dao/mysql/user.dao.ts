import prisma from '../../utils/prisma';
import { CreateUserData, UpdateProfileData, UserDao, UserWithOrgs } from '../interfaces/UserDao';

export class MySQLUserDao implements UserDao {
  async findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    return prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  }

  async createUser(data: CreateUserData): Promise<void> {
    await prisma.user.create({ data });
  }

  async findUserWithOrgsByUserId(id: string): Promise<UserWithOrgs | null> {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        ownedOrgs: {
          select: { id: true, name: true, slug: true },
        },
        orgs: {
          include: {
            org: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
  }

  async updateUser(id: string, data: UpdateProfileData): Promise<void> {
    await prisma.user.update({ where: { id }, data });
  }
}

export const userDao = new MySQLUserDao();
