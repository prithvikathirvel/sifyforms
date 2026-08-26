import { SubmissionDao } from '../interfaces/SubmissionDao';

export const createSubmissionDao = (): SubmissionDao => {
  const dbType = process.env.DB_TYPE ?? 'mysql';
  switch (dbType) {
    case 'mysql': {
      const { MySQLSubmissionDao } = require('../mysql/submission.dao');
      return new MySQLSubmissionDao();
    }
    case 'firestore': {
      const { FirestoreSubmissionDao } = require('../firestore/submission.dao');
      return new FirestoreSubmissionDao();
    }
    case 'mongodb': {
      const { MongoSubmissionDao } = require('../mongodb/submission.dao');
      return new MongoSubmissionDao();
    }
    default:
      throw new Error(`Unsupported DB_TYPE: "${dbType}". Valid options: mysql, firestore, mongodb`);
  }
};

export const submissionDao: SubmissionDao = createSubmissionDao();
