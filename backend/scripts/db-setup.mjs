/**
 * db-setup.mjs
 * Creates the production MySQL database if it does not exist.
 *
 * Usage:
 *   node scripts/db-setup.mjs
 *
 * Reads from environment variables:
 *   DATABASE_URL  — mysql://user:password@host:port/dbname
 *
 * Or set individual vars:
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */

import mysql from 'mysql2/promise';

function parseDATABASE_URL(url) {
  // Handles special characters (@ : etc.) in passwords
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

let config;
try {
  config = parseDATABASE_URL(DATABASE_URL);
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
}

console.log(`Connecting to MySQL at ${config.host}:${config.port} as ${config.user}...`);

const conn = await mysql.createConnection({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
});

try {
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log(`✅ Database "${config.database}" is ready.`);
} finally {
  await conn.end();
}
