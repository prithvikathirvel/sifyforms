import { TemplateDao } from '../interfaces/TemplateDao';

export const createTemplateDao = (): TemplateDao => {
  const dbType = process.env.DB_TYPE ?? 'mysql';
  switch (dbType) {
    case 'mysql': {
      const { MySQLTemplateDao } = require('../mysql/template.dao');
      return new MySQLTemplateDao();
    }
    case 'firestore': {
      const { FirestoreTemplateDao } = require('../firestore/template.dao');
      return new FirestoreTemplateDao();
    }
    case 'mongodb': {
      const { MongoTemplateDao } = require('../mongodb/template.dao');
      return new MongoTemplateDao();
    }
    default:
      throw new Error(`Unsupported DB_TYPE: "${dbType}". Valid options: mysql, firestore, mongodb`);
  }
};

export const templateDao: TemplateDao = createTemplateDao();
