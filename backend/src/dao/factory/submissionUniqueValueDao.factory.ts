import { SubmissionUniqueValueDao } from '../interfaces/SubmissionUniqueValueDao';

/**
 * Only the MySQL implementation exists.
 *
 * The other two backends in this factory pattern have no equivalent of a
 * multi-column unique constraint that fails an insert, which is the entire
 * point of this table — a Firestore or Mongo version would have to reintroduce
 * the read-then-write race it was built to remove. Failing at startup is the
 * honest response; a stub that silently returns "not taken" would be worse than
 * no table at all.
 */
export const createSubmissionUniqueValueDao = (): SubmissionUniqueValueDao => {
  const dbType = process.env.DB_TYPE ?? 'mysql';
  if (dbType !== 'mysql') {
    throw new Error(
      `Unique-field enforcement requires DB_TYPE="mysql"; "${dbType}" has no equivalent constraint.`,
    );
  }
  const { MySQLSubmissionUniqueValueDao } = require('../mysql/submissionUniqueValue.dao');
  return new MySQLSubmissionUniqueValueDao();
};

export const submissionUniqueValueDao: SubmissionUniqueValueDao = createSubmissionUniqueValueDao();
