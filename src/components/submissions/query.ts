/**
 * The question the responses table asks the server.
 *
 * Kept in its own module so both the page that owns the state and the table
 * that renders the controls can import it without either one having to import
 * the other. (It also keeps the table file exporting nothing but components,
 * which is what React Fast Refresh needs to swap it without a reload.)
 */
export type SubmissionSort = 'newest' | 'oldest';

export interface SubmissionsQuery {
  /** Free text, matched across every answer in every response. */
  search: string;
  /** '' for everything, or narrowed to responses already opened or not. */
  status: '' | 'read' | 'unread';
  /** Inclusive yyyy-mm-dd bounds on when the response arrived. */
  startDate: string;
  endDate: string;
  sort: SubmissionSort;
}

export const EMPTY_SUBMISSIONS_QUERY: SubmissionsQuery = {
  search: '', status: '', startDate: '', endDate: '', sort: 'newest',
};
