/**
 * Length limits for the strings a form's author types.
 *
 * One place to change them. The frontend mirrors these values
 * (src/lib/fieldLimits.ts) and caps the inputs at the same numbers, so a
 * draft cannot be typed past what the API would reject; the schema enforces
 * them again on save — the defense in depth is deliberate.
 *
 * When you change a number here, change its twin in the frontend file.
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
