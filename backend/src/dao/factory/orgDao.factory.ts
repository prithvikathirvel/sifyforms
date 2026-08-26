import { OrgDao } from '../interfaces/OrgDao';

export const createOrgDao = (): OrgDao => {
  const dbType = process.env.DB_TYPE ?? 'mysql';
  switch (dbType) {
    case 'mysql': {
      const { MySQLOrgDao } = require('../mysql/org.dao');
      return new MySQLOrgDao();
    }
    case 'firestore': {
      const { FirestoreOrgDao } = require('../firestore/org.dao');
      return new FirestoreOrgDao();
    }
    case 'mongodb': {
      const { MongoOrgDao } = require('../mongodb/org.dao');
      return new MongoOrgDao();
    }
    default:
      throw new Error(`Unsupported DB_TYPE: "${dbType}". Valid options: mysql, firestore, mongodb`);
  }
};

export const orgDao: OrgDao = createOrgDao();
