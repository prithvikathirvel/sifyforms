import { UserDao } from '../interfaces/UserDao';
import { MySQLUserDao } from '../mysql/user.dao';
import { FirestoreUserDao } from '../firestore/user.dao';
import { MongoUserDao } from '../mongodb/user.dao';

export const createUserDao = (): UserDao => {
  const dbType = process.env.DB_TYPE ?? 'mysql';

  switch (dbType) {
    case 'mysql':
      return new MySQLUserDao();
    case 'firestore':
      return new FirestoreUserDao();
    case 'mongodb':
      return new MongoUserDao();
    default:
      throw new Error(`Unsupported DB_TYPE: "${dbType}". Valid options: mysql, firestore, mongodb`);
  }
}

export const userDao: UserDao = createUserDao();
