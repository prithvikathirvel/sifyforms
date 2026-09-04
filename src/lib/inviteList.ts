/**
 * Turning a pasted list of people into invitations.
 *
 * Admins do not type invite lists; they paste them, out of a spreadsheet, an
 * email thread, or a chat message. What arrives is therefore never clean: it is
 * comma-separated, or newline-separated, or `Name <email>` from a mail client,
 * or a CSV with a header row and a role column, or all of these mixed together
 * because it came from three places.
 *
 * The alternative to parsing all of that is telling people to reformat it,
 * which they will do by hand, badly. So this accepts what people actually have
 * and reports precisely what it could not use — by line number, because a line
 * number is the only handle somebody has on a list they pasted.
 *
 * These rules deliberately mirror `createInvitesBulk` on the server. The client
 * copy exists so problems are visible before anything is sent, not so the
 * server can trust it: the server re-checks every one of them, because a
 * validation that only runs in a browser is not a validation.
 */

export interface ParsedInviteRow {
  /** 1-based position in the pasted text — what the person sees in the box. */
  row: number;
  email: string;
  /** Only when the line named one; otherwise the dialog's default applies. */
  role?: string;
  error?: string;
}

export interface ParsedInviteList {
  valid: ParsedInviteRow[];
  invalid: ParsedInviteRow[];
  /** Addresses that appear more than once; reported, then de-duplicated. */
  duplicates: ParsedInviteRow[];
}

/** The most rows one request will carry. Matches the server's cap exactly. */
export const BULK_INVITE_LIMIT = 200;

/*
 * Stricter than `type="email"` and looser than RFC 5322, on purpose.
 *
 * The full grammar permits quoted local parts and bracketed IP literals that no
 * invite list has ever contained, and accepting them means accepting the stray
 * punctuation that a paste actually produces. What this rejects is the real
 * failure set: trailing commas and semicolons, embedded spaces, unstripped
 * angle brackets, and a domain with no dot.
 */
const EMAIL_PATTERN = /^[^\s@,;<>"']+@[^\s@,;<>"'.]+(\.[^\s@,;<>"'.]+)+$/;

/** Headers a spreadsheet export puts on row one, which must not become a row. */
const HEADER_WORDS = new Set(['email', 'e-mail', 'email address', 'mail', 'address', 'user']);

/**
 * Split one line into fields on commas, semicolons and tabs — but not on the
 * ones that are part of somebody's name.
 *
 * `"Patel, Sam" <sam@example.com>` is a single field containing a comma, and a
 * naive `split(',')` turns it into a person called `patel` and a broken
 * address. Quotes and angle brackets both suppress the separator, which covers
 * every form a mail client produces.
 */
function splitFields(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuote: '"' | "'" | null = null;
  let inAngle = false;

  for (const char of line) {
    if (inQuote) {
      if (char === inQuote) inQuote = null;
      current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      inQuote = char;
      current += char;
      continue;
    }
    if (char === '<') inAngle = true;
    else if (char === '>') inAngle = false;

    if (!inAngle && (char === ',' || char === ';' || char === '\t')) {
      fields.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  fields.push(current.trim());
  return fields.filter(Boolean);
}

/**
 * Pull an address out of one field, in whatever shape a mail client left it.
 *
 * Handles `Jane Doe <jane@x.com>`, `"Doe, Jane" <jane@x.com>` and a bare
 * address, and strips the trailing punctuation a copied list leaves behind. The
 * display name is discarded — it is not ours to store.
 */
function extractEmail(text: string): string {
  const angled = text.match(/<([^>]+)>/);
  const raw = angled ? angled[1] : text;
  return raw.trim().replace(/^["'<]+/, '').replace(/["'>,;.]+$/, '').trim();
}

/**
 * Read one line as a sequence of people, each optionally followed by a role.
 *
 * A line is not reliably one person. It is one person with a role
 * (`jane@x.com, Analyst`), or several people with none (a pasted To: field), or
 * — from a mail client — several people each with a display name. Rather than
 * guessing which format a line is in, the rule is positional and covers all of
 * them: a field containing `@` starts a new person, and any field after it that
 * does not is that person's role.
 */
function readLine(line: string): Array<{ email: string; role?: string }> {
  const fields = splitFields(line);
  const people: Array<{ email: string; role?: string }> = [];

  for (const field of fields) {
    if (field.includes('@')) {
      people.push({ email: extractEmail(field) });
    } else if (people.length > 0 && !people[people.length - 1].role) {
      people[people.length - 1].role = field;
    } else {
      // A field with no address and no preceding person: unusable on its own,
      // but recorded so the line is still reported rather than vanishing.
      people.push({ email: field });
    }
  }

  return people.length > 0 ? people : [{ email: line.trim() }];
}

export function parseInviteList(text: string, assignableRoles: string[]): ParsedInviteList {
  const roleByLower = new Map(assignableRoles.map((role) => [role.toLowerCase(), role]));

  const valid: ParsedInviteRow[] = [];
  const invalid: ParsedInviteRow[] = [];
  const duplicates: ParsedInviteRow[] = [];
  const seen = new Map<string, number>();

  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const row = index + 1;
    const line = rawLine.trim();
    if (!line) return;

    for (const person of readLine(line)) {
      const email = person.email.toLowerCase();

      // A header row is not a person. Skipped silently rather than reported as
      // an error: complaining about it would be complaining about a correct
      // paste from a spreadsheet.
      if (index === 0 && HEADER_WORDS.has(email)) continue;

      if (!email) {
        invalid.push({ row, email: line, error: 'No email address on this line' });
        continue;
      }
      if (email.length > 320) {
        invalid.push({ row, email, error: 'Email address is too long' });
        continue;
      }
      if (!EMAIL_PATTERN.test(email)) {
        invalid.push({ row, email, error: 'Not a valid email address' });
        continue;
      }

      let role: string | undefined;
      if (person.role) {
        const matched = roleByLower.get(person.role.toLowerCase());
        if (!matched) {
          invalid.push({ row, email, error: `"${person.role}" is not a role you can assign` });
          continue;
        }
        role = matched;
      }

      const firstSeenAt = seen.get(email);
      if (firstSeenAt !== undefined) {
        duplicates.push({ row, email, error: `Already on line ${firstSeenAt}` });
        continue;
      }
      seen.set(email, row);
      valid.push({ row, email, role });
    }
  });

  return { valid, invalid, duplicates };
}
