import { InviteDao } from '../interfaces/InviteDao';

export const createInviteDao = (): InviteDao => {
  const dbType = process.env.DB_TYPE ?? 'mysql';
  switch (dbType) {
    case 'mysql': {
      const { MySQLInviteDao } = require('../mysql/invite.dao');
      return new MySQLInviteDao();
    }
    case 'firestore': {
      const { FirestoreInviteDao } = require('../firestore/invite.dao');
      return new FirestoreInviteDao();
    }
    case 'mongodb': {
      const { MongoInviteDao } = require('../mongodb/invite.dao');
      return new MongoInviteDao();
    }
    default:
      throw new Error(`Unsupported DB_TYPE: "${dbType}". Valid options: mysql, firestore, mongodb`);
  }
};

export const inviteDao: InviteDao = createInviteDao();
