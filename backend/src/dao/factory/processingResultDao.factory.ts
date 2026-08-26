import { ProcessingResultDao } from '../interfaces/ProcessingResultDao';

export const createProcessingResultDao = (): ProcessingResultDao => {
  const dbType = process.env.DB_TYPE ?? 'mysql';
  switch (dbType) {
    case 'mysql': {
      const { MySQLProcessingResultDao } = require('../mysql/processing.dao');
      return new MySQLProcessingResultDao();
    }
    case 'firestore': {
      const { FirestoreProcessingResultDao } = require('../firestore/processing.dao');
      return new FirestoreProcessingResultDao();
    }
    case 'mongodb': {
      const { MongoProcessingResultDao } = require('../mongodb/processing.dao');
      return new MongoProcessingResultDao();
    }
    default:
      throw new Error(`Unsupported DB_TYPE: "${dbType}". Valid options: mysql, firestore, mongodb`);
  }
};

export const processingResultDao: ProcessingResultDao = createProcessingResultDao();
