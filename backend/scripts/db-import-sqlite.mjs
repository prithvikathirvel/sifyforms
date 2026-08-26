/**
 * db-import-sqlite.mjs
 * One-time migration: copies all data from an existing SQLite database into MySQL.
 *
 * Usage:
 *   SQLITE_PATH=./prisma/dev.db node scripts/db-import-sqlite.mjs
 *
 * Prerequisites:
 *   - MySQL database must already exist and be migrated (npm run db:setup && npm run db:deploy)
 *   - DATABASE_URL must point to the target MySQL instance
 *   - better-sqlite3 and mysql2 must be installed (npm install --save-dev better-sqlite3 mysql2)
 */

import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import { resolve } from 'path';

const SQLITE_PATH = process.env.SQLITE_PATH || './prisma/dev.db';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set.');
  process.exit(1);
}

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

function toMySQLDate(val) {
  if (!val) return null;
  // SQLite may store ISO strings like "2024-01-15T10:30:00.000Z"
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 23).replace('T', ' '); // "YYYY-MM-DD HH:MM:SS.mmm"
}

const sqlitePath = resolve(SQLITE_PATH);
console.log(`\nSQLite source : ${sqlitePath}`);
console.log(`MySQL target  : ${DATABASE_URL.replace(/:([^@]+)@/, ':***@')}\n`);

const sqlite = new Database(sqlitePath, { readonly: true });
const config = parseDATABASE_URL(DATABASE_URL);
const conn = await mysql.createConnection({ ...config, multipleStatements: false });

// Check SQLite tables
const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'").all().map(r => r.name);
console.log('Tables found in SQLite:', tables.join(', '), '\n');

await conn.query('SET FOREIGN_KEY_CHECKS = 0');

try {
  // --- Users ---
  const users = sqlite.prepare('SELECT * FROM User').all();
  console.log(`Importing ${users.length} users...`);
  for (const r of users) {
    await conn.query(
      `INSERT INTO User (id, email, emailVerified, password, name, image, googleId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE email=email`,
      [r.id, r.email, toMySQLDate(r.emailVerified), r.password, r.name, r.image, r.googleId,
       toMySQLDate(r.createdAt) ?? new Date(), toMySQLDate(r.updatedAt) ?? new Date()]
    );
  }

  // --- Organizations ---
  const orgs = sqlite.prepare('SELECT * FROM Organization').all();
  console.log(`Importing ${orgs.length} organizations...`);
  for (const r of orgs) {
    await conn.query(
      `INSERT INTO Organization (id, slug, name, logo, industry, ownerId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE slug=slug`,
      [r.id, r.slug, r.name, r.logo, r.industry, r.ownerId,
       toMySQLDate(r.createdAt) ?? new Date(), toMySQLDate(r.updatedAt) ?? new Date()]
    );
  }

  // --- OrgUsers ---
  const orgUsers = sqlite.prepare('SELECT * FROM OrgUser').all();
  console.log(`Importing ${orgUsers.length} org memberships...`);
  for (const r of orgUsers) {
    await conn.query(
      `INSERT INTO OrgUser (id, orgId, userId, role) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE role=role`,
      [r.id, r.orgId, r.userId, r.role]
    );
  }

  // --- Forms ---
  const forms = sqlite.prepare('SELECT * FROM Form').all();
  console.log(`Importing ${forms.length} forms...`);
  for (const r of forms) {
    await conn.query(
      `INSERT INTO Form (id, orgId, name, slug, description, \`schema\`, settings, isPublished, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=name`,
      [r.id, r.orgId, r.name, r.slug, r.description, r.schema, r.settings,
       r.isPublished ? 1 : 0, r.createdBy,
       toMySQLDate(r.createdAt) ?? new Date(), toMySQLDate(r.updatedAt) ?? new Date()]
    );
  }

  // --- Submissions ---
  const subs = sqlite.prepare('SELECT * FROM Submission').all();
  console.log(`Importing ${subs.length} submissions...`);
  for (const r of subs) {
    await conn.query(
      `INSERT INTO Submission (id, formId, data, ip, userAgent, isRead, tags, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE formId=formId`,
      [r.id, r.formId, r.data, r.ip, r.userAgent, r.isRead ? 1 : 0,
       r.tags ?? '[]', toMySQLDate(r.createdAt) ?? new Date()]
    );
  }

  // --- Drafts ---
  const drafts = sqlite.prepare('SELECT * FROM Draft').all();
  console.log(`Importing ${drafts.length} drafts...`);
  for (const r of drafts) {
    await conn.query(
      `INSERT INTO Draft (id, formId, identity, data, stepIndex, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE formId=formId`,
      [r.id, r.formId, r.identity, r.data, r.stepIndex ?? 0,
       toMySQLDate(r.createdAt) ?? new Date(), toMySQLDate(r.updatedAt) ?? new Date()]
    );
  }

  // --- Templates ---
  const templates = sqlite.prepare('SELECT * FROM Template').all();
  console.log(`Importing ${templates.length} templates...`);
  for (const r of templates) {
    await conn.query(
      `INSERT INTO Template (id, name, description, category, \`schema\`, settings, isStatic, orgId, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=name`,
      [r.id, r.name, r.description, r.category, r.schema, r.settings,
       r.isStatic ? 1 : 0, r.orgId, r.createdBy,
       toMySQLDate(r.createdAt) ?? new Date(), toMySQLDate(r.updatedAt) ?? new Date()]
    );
  }

  console.log('\n✅ Import complete!');
} catch (err) {
  console.error('\n❌ Import failed:', err.message);
  process.exit(1);
} finally {
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  sqlite.close();
  await conn.end();
}
