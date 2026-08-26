import { CreateUserData, UpdateProfileData, UserDao, UserWithOrgs } from '../interfaces/UserDao';

// TODO: Install mongoose or mongodb driver and implement when switching to MongoDB
// npm install mongoose

export class MongoUserDao implements UserDao {
  async findUserByEmail(_email: string): Promise<{ id: string; email: string } | null> {
    throw new Error('MongoUserDao.findByEmail not implemented');
  }

  async createUser(_data: CreateUserData): Promise<void> {
    throw new Error('MongoUserDao.create not implemented');
  }

  async findUserWithOrgsByUserId(_id: string): Promise<UserWithOrgs | null> {
    throw new Error('MongoUserDao.findWithOrgs not implemented');
  }

  async updateUser(_id: string, _data: UpdateProfileData): Promise<void> {
    throw new Error('MongoUserDao.updateUser not implemented');
  }
}
