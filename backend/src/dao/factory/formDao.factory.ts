import { FormDao } from '../interfaces/FormDao';

export const createFormDao = (): FormDao => {
  const dbType = process.env.DB_TYPE ?? 'mysql';
  switch (dbType) {
    case 'mysql': {
      const { MySQLFormDao } = require('../mysql/form.dao');
      return new MySQLFormDao();
    }
    case 'firestore': {
      const { FirestoreFormDao } = require('../firestore/form.dao');
      return new FirestoreFormDao();
    }
    case 'mongodb': {
      const { MongoFormDao } = require('../mongodb/form.dao');
      return new MongoFormDao();
    }
    default:
      throw new Error(`Unsupported DB_TYPE: "${dbType}". Valid options: mysql, firestore, mongodb`);
  }
};

export const formDao: FormDao = createFormDao();
