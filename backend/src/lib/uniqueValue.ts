import crypto from 'crypto';

/**
 * How a `unique` field's answer is turned into something a database constraint
 * can hold.
 *
 * Two decisions live here, and both are visible to respondents, so they are
 * worth being explicit about.
 *
 * **Comparison is case- and whitespace-insensitive.** The check this replaces
 * compared `String(a) === String(b)`, so `Ada@Example.com` and
 * `ada@example.com ` were two different people. For an email address, an
 * employee number or a national identity number — which is what `unique` is
 * used for — that is not uniqueness, it is a formality. Folding case makes the
 * constraint mean what the form promised. It is stricter than before, so a
 * value that previously slipped through will now be refused; that is the
 * correction, not a regression.
 *
 * **Answers that are not scalars cannot be unique.** A file, a likert matrix or
 * a table has no sensible identity, and pretending otherwise would either
 * reject legitimate responses or claim a hash of something meaningless.
 * `canonicaliseUniqueValue` returns null for them and the caller skips the
 * field.
 *
 * A mirror of these two functions lives in scripts/backfill-unique-values.mjs,
 * which has to produce byte-identical hashes for the rows that already exist.
 * If the two ever drift, the backfill writes hashes the application will never
 * look up and the constraint quietly stops constraining, so any change here has
 * to be made there in the same commit.
 */

function canonicaliseScalar(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return null;
  const text = String(value).trim().toLowerCase();
  return text === '' ? null : text;
}

/**
 * The comparable form of an answer, or null when the answer cannot take part
 * in a uniqueness check at all.
 *
 * Arrays are sorted before joining so that ["b","a"] and ["a","b"] — the same
 * set of choices picked in a different order — are one value rather than two.
 */
export function canonicaliseUniqueValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    const parts = value
      .map(canonicaliseScalar)
      .filter((part): part is string => part !== null)
      .sort();
    return parts.length > 0 ? parts.join('\u0000') : null;
  }
  return canonicaliseScalar(value);
}

/**
 * The stored form of a claimed value.
 *
 * Hashed rather than stored raw for two reasons. This table is queried by a
 * public endpoint, so it should not also be a plaintext directory of every
 * address and identity number the product has ever received; and the form and
 * field are mixed into the digest so the same email on two different forms
 * produces two unrelated hashes, which stops the table from being usable to
 * correlate one person across a customer's forms.
 */
export function hashUniqueValue(formId: string, fieldId: string, canonical: string): string {
  return crypto
    .createHash('sha256')
    .update(`${formId}\u0000${fieldId}\u0000${canonical}`)
    .digest('hex');
}

export interface UniqueClaim {
  fieldId: string;
  label: string;
  valueHash: string;
}

/**
 * Every claim a submission needs to make, in field order.
 *
 * `fields` is the published schema's field list; only entries marked `unique`
 * are considered, and only those the respondent actually answered.
 */
export function collectUniqueClaims(
  formId: string,
  fields: any[],
  data: Record<string, unknown>,
): UniqueClaim[] {
  const claims: UniqueClaim[] = [];
  const seen = new Set<string>();

  for (const field of fields) {
    if (!field?.unique) continue;
    const fieldId = String(field.id);
    const canonical = canonicaliseUniqueValue(data[fieldId]);
    if (canonical === null) continue;

    const valueHash = hashUniqueValue(formId, fieldId, canonical);
    // A schema with the same field listed twice would otherwise make a
    // submission collide with itself.
    const key = `${fieldId}:${valueHash}`;
    if (seen.has(key)) continue;
    seen.add(key);

    claims.push({ fieldId, label: field.label || fieldId, valueHash });
  }

  return claims;
}
