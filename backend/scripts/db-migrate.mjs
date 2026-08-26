/**
 * db-migrate.mjs
 * Runs Prisma migrations in production (prisma migrate deploy).
 * Also ensures JSON columns are LONGTEXT so large form schemas are not truncated.
 *
 * Usage:
 *   node scripts/db-migrate.mjs
 *
 * Reads DATABASE_URL from environment / .env
 */

import { execSync } from 'child_process';
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

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set.');
  process.exit(1);
}

// Step 1 — run prisma migrate deploy, fall back to db push if no migrations exist
console.log('Running Prisma migrations...');
try {
  const result = execSync('npx prisma migrate deploy 2>&1', { encoding: 'utf8' });
  process.stdout.write(result);
  if (result.includes('No migration found')) {
    console.log('No migration files found — using prisma db push instead...');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  }
} catch (e) {
  console.error('❌ Prisma migration failed.');
  process.exit(1);
}

// Step 2 — ensure JSON columns are LONGTEXT (Prisma maps String -> VARCHAR(191) by default)
console.log('\nEnsuring JSON columns are LONGTEXT...');
const config = parseDATABASE_URL(DATABASE_URL);
const conn = await mysql.createConnection({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
});

try {
  const fixes = [
    'ALTER TABLE `Form` MODIFY `schema` LONGTEXT NOT NULL',
    'ALTER TABLE `Form` MODIFY `settings` LONGTEXT NOT NULL',
    'ALTER TABLE `Submission` MODIFY `data` LONGTEXT NOT NULL',
    'ALTER TABLE `Draft` MODIFY `data` LONGTEXT NOT NULL',
    'ALTER TABLE `Template` MODIFY `schema` LONGTEXT NOT NULL',
    'ALTER TABLE `Template` MODIFY `settings` LONGTEXT NOT NULL',
  ];

  for (const sql of fixes) {
    await conn.query(sql);
    console.log(' ✔', sql.replace('ALTER TABLE ', '').replace(' MODIFY ', ' → '));
  }

  console.log('\n✅ Migration complete. Database is ready for production.');
} finally {
  await conn.end();
}
