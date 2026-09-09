/**
 * Length limits for the strings a form's author types — the twins of
 * backend/src/schemas/limits.ts.
 *
 * The inputs that edit these values set `maxLength` from here, so a draft can
 * never be typed past what the API would reject with a validation error. The
 * backend still enforces them on save; this is the UX half of the contract.
 *
 * When you change a number here, change its twin in the backend file.
 */

/** A likert statement (surveyConfig.rows[].label). */
export const SURVEY_STATEMENT_MAX = 200;
/** Endpoint labels of a scale ("Not at all likely"…). */
export const SURVEY_SCALE_LABEL_MAX = 80;
/** The short analysis caption a report uses for a survey question. */
export const SURVEY_ANALYSIS_LABEL_MAX = 120;
/** Most single-line hints and prompts share one budget. */
export const PLACEHOLDER_MAX = 200;
/** Longer helper text under a question. */
export const HELP_TEXT_MAX = 1000;
