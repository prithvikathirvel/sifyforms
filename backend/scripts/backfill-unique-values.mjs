/**
 * backfill-unique-values.mjs
 *
 * Fills `SubmissionUniqueValue` from the submissions that already exist.
 *
 * Why this is a script and not part of the migration: working out which answers
 * are unique means reading each form's schema, which is JSON in a text column,
 * and then reading each submission's answers, which is also JSON in a text
 * column. Doing that in SQL needs JSON_TABLE and a MySQL 8 assumption, and it
 * fails silently and unhelpfully on a schema shape it did not expect. Doing it
 * here is legible, reports what it did, and can be re-run.
 *
 * Idempotent: every insert is INSERT IGNORE against the unique key.
 *
 * Duplicates that already exist in the data are expected. The first submission
 * for a value claims it and the rest are reported at the end; they are left
 * exactly as they are, because deleting somebody's response to tidy up an index
 * is not a decision a migration gets to make. Once the backfill has run, new
 * submissions cannot add to them.
 *
 * Usage:  node scripts/backfill-unique-values.mjs
 */

import crypto from 'crypto';
import mysql from 'mysql2/promise';

function parseDATABASE_URL(url) {
  const withoutProtocol = url.replace(/^mysql:\/\//, '');
  const lastAt = withoutProtocol.lastIndexOf('@');
  if (lastAt === -1) throw new Error('Invalid DATABASE_URL. Expected: mysql://user:password@host:port/dbname');
  const credentials = withoutProtocol.slice(0, lastAt);
  const hostPart = withoutProtocol.slice(lastAt + 1);
  const colonInCreds = credentials.indexOf(':');
  const user = credentials.slice(0, colonInCreds);
  const password = decodeURIComponent(credentials.slice(colonInCreds + 1));
  const [hostPort, dbAndParams] = hostPart.split('/');
  const [host, portStr] = hostPort.split(':');
  return { user, password, host, port: parseInt(portStr, 10), database: dbAndParams.split('?')[0] };
}

/*
 * These two must stay identical to `canonicaliseUniqueValue` and
 * `hashUniqueValue` in src/lib/uniqueValue.ts. If they drift, the backfill
 * writes hashes the application will never look up, and the constraint quietly
 * stops constraining. There is a test for exactly this in
 * src/lib/uniqueValue.test.ts.
 */
function canonicaliseUniqueValue(value) {
  const scalar = (v) => {
    if (v === null || v === undefined || typeof v === 'object') return null;
    const s = String(v).trim().toLowerCase();
    return s === '' ? null : s;
  };
  if (Array.isArray(value)) {
    const parts = value.map(scalar).filter((v) => v !== null).sort();
    return parts.length > 0 ? parts.join('\u0000') : null;
  }
  return scalar(value);
}

function hashUniqueValue(formId, fieldId, canonical) {
  return crypto.createHash('sha256')
    .update(`${formId}\u0000${fieldId}\u0000${canonical}`)
    .digest('hex');
}

export async function backfillUniqueValues(connection, { log = console.log } = {}) {
  const [forms] = await connection.query('SELECT `id`, `name`, `schema` FROM `Form`');

  let formsWithUniqueFields = 0;
  let claimed = 0;
  const collisions = [];

  for (const form of forms) {
    let schema;
    try {
      schema = JSON.parse(form.schema);
    } catch {
      log(`  ! form ${form.id} (${form.name}) has an unparseable schema — skipped`);
      continue;
    }

    const uniqueFieldIds = (Array.isArray(schema?.fields) ? schema.fields : [])
      .filter((f) => f && f.unique === true)
      .map((f) => String(f.id));
    if (uniqueFieldIds.length === 0) continue;
    formsWithUniqueFields++;

    // Oldest first, so the response that got there first keeps the value.
    const [submissions] = await connection.query(
      'SELECT `id`, `data` FROM `Submission` WHERE `formId` = ? ORDER BY `createdAt` ASC, `id` ASC',
      [form.id],
    );

    for (const submission of submissions) {
      let answers;
      try {
        answers = JSON.parse(submission.data);
      } catch {
        continue;
      }

      for (const fieldId of uniqueFieldIds) {
        const canonical = canonicaliseUniqueValue(answers[fieldId]);
        if (canonical === null) continue;

        const valueHash = hashUniqueValue(form.id, fieldId, canonical);
        const [result] = await connection.execute(
          'INSERT IGNORE INTO `SubmissionUniqueValue` (`id`, `formId`, `fieldId`, `valueHash`, `submissionId`, `createdAt`) VALUES (?, ?, ?, ?, ?, NOW(3))',
          [crypto.randomUUID(), form.id, fieldId, valueHash, submission.id],
        );
        if (result.affectedRows === 1) claimed++;
        else collisions.push({ form: form.name, formId: form.id, fieldId, submissionId: submission.id });
      }
    }
  }

  log(`  forms with unique fields : ${formsWithUniqueFields}`);
  log(`  values claimed           : ${claimed}`);
  if (collisions.length > 0) {
    log(`  pre-existing duplicates  : ${collisions.length} (left in place)`);
    for (const c of collisions.slice(0, 20)) {
      log(`    - ${c.form} / ${c.fieldId} / submission ${c.submissionId}`);
    }
    if (collisions.length > 20) log(`    ... and ${collisions.length - 20} more`);
  } else {
    log('  pre-existing duplicates  : none');
  }

  return { formsWithUniqueFields, claimed, collisions };
}

// Run directly: node scripts/backfill-unique-values.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set.');
    process.exit(1);
  }
  const config = parseDATABASE_URL(DATABASE_URL);
  const connection = await mysql.createConnection(config);
  try {
    console.log('Backfilling SubmissionUniqueValue...');
    await backfillUniqueValues(connection);
    console.log('Done.');
  } finally {
    await connection.end();
  }
}
