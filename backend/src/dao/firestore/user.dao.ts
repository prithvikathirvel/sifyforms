import { CreateUserData, UpdateProfileData, UserDao, UserWithOrgs } from '../interfaces/UserDao';

// TODO: Install firebase-admin and implement when switching to Firestore
// npm install firebase-admin

export class FirestoreUserDao implements UserDao {
  async findUserByEmail(_email: string): Promise<{ id: string; email: string } | null> {
    throw new Error('FirestoreUserDao.findByEmail not implemented');
  }

  async createUser(_data: CreateUserData): Promise<void> {
    throw new Error('FirestoreUserDao.create not implemented');
  }

  async findUserWithOrgsByUserId(_id: string): Promise<UserWithOrgs | null> {
    throw new Error('FirestoreUserDao.findWithOrgs not implemented');
  }

  async updateUser(_id: string, _data: UpdateProfileData): Promise<void> {
    throw new Error('FirestoreUserDao.updateUser not implemented');
  }
}
