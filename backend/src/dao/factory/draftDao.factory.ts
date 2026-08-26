import { DraftDao } from '../interfaces/DraftDao';

export const createDraftDao = (): DraftDao => {
  const dbType = process.env.DB_TYPE ?? 'mysql';
  switch (dbType) {
    case 'mysql': {
      const { MySQLDraftDao } = require('../mysql/draft.dao');
      return new MySQLDraftDao();
    }
    case 'firestore': {
      const { FirestoreDraftDao } = require('../firestore/draft.dao');
      return new FirestoreDraftDao();
    }
    case 'mongodb': {
      const { MongoDraftDao } = require('../mongodb/draft.dao');
      return new MongoDraftDao();
    }
    default:
      throw new Error(`Unsupported DB_TYPE: "${dbType}". Valid options: mysql, firestore, mongodb`);
  }
};

export const draftDao: DraftDao = createDraftDao();
