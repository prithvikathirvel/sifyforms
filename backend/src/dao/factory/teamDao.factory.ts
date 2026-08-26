import { TeamDao } from '../interfaces/TeamDao';

export const createTeamDao = (): TeamDao => {
  const dbType = process.env.DB_TYPE ?? 'mysql';
  switch (dbType) {
    case 'mysql': {
      const { MySQLTeamDao } = require('../mysql/team.dao');
      return new MySQLTeamDao();
    }
    case 'firestore': {
      const { FirestoreTeamDao } = require('../firestore/team.dao');
      return new FirestoreTeamDao();
    }
    case 'mongodb': {
      const { MongoTeamDao } = require('../mongodb/team.dao');
      return new MongoTeamDao();
    }
    default:
      throw new Error(`Unsupported DB_TYPE: "${dbType}". Valid options: mysql, firestore, mongodb`);
  }
};

export const teamDao: TeamDao = createTeamDao();
