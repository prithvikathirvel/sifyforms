import { randomUUID } from 'crypto';
import prisma from '../../utils/prisma';
import { SubmissionUniqueValueDao, UniqueValueClaim } from '../interfaces/SubmissionUniqueValueDao';
import { isUniqueConstraintViolation } from '../../services/voteIdentity';

export class MySQLSubmissionUniqueValueDao implements SubmissionUniqueValueDao {
  async exists(formId: string, fieldId: string, valueHash: string): Promise<boolean> {
    const row = await prisma.submissionUniqueValue.findUnique({
      where: { formId_fieldId_valueHash: { formId, fieldId, valueHash } },
      select: { id: true },
    });
    return row !== null;
  }

  async claim(claim: UniqueValueClaim): Promise<boolean> {
    try {
      await prisma.submissionUniqueValue.create({
        data: {
          id: randomUUID(),
          formId: claim.formId,
          fieldId: claim.fieldId,
          valueHash: claim.valueHash,
          submissionId: claim.submissionId,
        },
      });
      return true;
    } catch (error) {
      // The one error that means "someone else got there first". Everything
      // else is a real failure and has to propagate: swallowing it here would
      // turn a database outage into a silent loss of the constraint.
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }
}

export const submissionUniqueValueDao = new MySQLSubmissionUniqueValueDao();
