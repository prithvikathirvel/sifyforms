import { FormShareDao } from '../interfaces/FormShareDao';

export const createFormShareDao = (): FormShareDao => {
  const dbType = process.env.DB_TYPE ?? 'mysql';
  switch (dbType) {
    case 'mysql': {
      const { MySQLFormShareDao } = require('../mysql/formShare.dao');
      return new MySQLFormShareDao();
    }
    case 'firestore': {
      const { FirestoreFormShareDao } = require('../firestore/formShare.dao');
      return new FirestoreFormShareDao();
    }
    case 'mongodb': {
      const { MongoFormShareDao } = require('../mongodb/formShare.dao');
      return new MongoFormShareDao();
    }
    default:
      throw new Error(`Unsupported DB_TYPE: "${dbType}". Valid options: mysql, firestore, mongodb`);
  }
};

export const formShareDao: FormShareDao = createFormShareDao();
