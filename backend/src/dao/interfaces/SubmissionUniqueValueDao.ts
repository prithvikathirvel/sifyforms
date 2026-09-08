export interface UniqueValueClaim {
  formId: string;
  fieldId: string;
  valueHash: string;
  submissionId: string;
}

export interface SubmissionUniqueValueDao {
  /**
   * Whether this value is already taken on this form.
   *
   * A single indexed lookup. The check this replaced loaded every submission
   * for the form and compared answers in Node, on a public endpoint, so one
   * cheap request cost O(total responses).
   */
  exists(formId: string, fieldId: string, valueHash: string): Promise<boolean>;

  /**
   * Take the value, or report that somebody else already has it.
   *
   * Returns false only for a unique-constraint violation. Anything else throws,
   * because "the database is unreachable" must not read as "this value is
   * taken" and must certainly not read as "this value is free".
   */
  claim(claim: UniqueValueClaim): Promise<boolean>;
}
