const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const mysql = require('mysql2/promise');

const databaseName = `sify_name_sync_test_${randomUUID().replaceAll('-', '')}`;
let admin;
let server;
let prisma;
let dao;
let drainOutbox;
let syncLatestOrganizationName;
let remote;
let failRemote;
let onPut;
let puts;
let acknowledge;
let keycloakRecords;
let reportDirectory;
let createConflict;
let createdKeycloak;
let ensureOrganization;

before(async () => {
  assert.ok(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL is required; tests create a separate disposable database');
  const url = new URL(process.env.TEST_DATABASE_URL);
  const sourceDatabase = url.pathname.slice(1);
  assert.match(sourceDatabase, /^[a-zA-Z0-9_]+$/);
  admin = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) });
  await admin.query(`CREATE DATABASE \`${databaseName}\``);
  for (const table of ['Organization', 'UmsOutbox']) {
    await admin.query(`CREATE TABLE \`${databaseName}\`.\`${table}\` LIKE \`${sourceDatabase}\`.\`${table}\``);
  }
  url.pathname = `/${databaseName}`;
  process.env.DATABASE_URL = url.toString();
  server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/user/login' || request.url.endsWith('/token')) {
      response.end(JSON.stringify({ accessToken: 'fixture-token', expiresIn: 300, access_token: 'fixture-token', expires_in: 300 }));
      return;
    }
    if (request.url.startsWith('/admin/realms/fixture/organizations')) {
      if (request.method === 'POST') {
        let body = '';
        for await (const chunk of request) body += chunk;
        createdKeycloak = JSON.parse(body);
        response.statusCode = createConflict ? 409 : 201;
        response.end('{}');
        return;
      }
      const url = new URL(request.url, 'http://fixture');
      response.end(JSON.stringify(keycloakRecords.slice(Number(url.searchParams.get('first') || 0))));
      return;
    }
    if (request.method === 'GET' && request.url === '/api/organisations/Form-Builder') {
      response.end(JSON.stringify(remote));
      return;
    }
    if (request.method === 'PUT' && request.url === '/api/organisations/registry-id') {
      let body = '';
      for await (const chunk of request) body += chunk;
      puts.push(JSON.parse(body));
      if (onPut) await onPut();
      if (failRemote) {
        response.statusCode = 503;
        response.end(JSON.stringify({ message: 'Fixture outage' }));
      } else {
        remote[0].name = JSON.parse(body).name;
        keycloakRecords[0].name = JSON.parse(body).name;
        response.end(JSON.stringify({ code: 0, nameSynced: acknowledge }));
      }
      return;
    }
    response.statusCode = 404;
    response.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  Object.assign(process.env, {
    UMS_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    UMS_APP_ID: 'Form-Builder', UMS_SERVICE_USER_EMAIL: 'fixture@example.invalid',
    UMS_SERVICE_USER_PASSWORD: 'fixture', UMS_ORG_NAME_SYNC_ENABLED: 'true',
    UMS_OUTBOX_MAX_ATTEMPTS: '2',
    UMS_OUTBOX_ENABLED: 'true',
    KEYCLOAK_ISSUER: `http://127.0.0.1:${server.address().port}/realms/fixture`,
    KEYCLOAK_ADMIN_USERNAME: 'fixture', KEYCLOAK_ADMIN_PASSWORD: 'fixture',
  });
  reportDirectory = mkdtempSync(join(tmpdir(), 'sify-name-sync-'));
  require('ts-node/register/transpile-only');
  prisma = require('../src/utils/prisma').default;
  dao = new (require('../src/dao/mysql/org.dao').MySQLOrgDao)();
  ({ drainOutbox } = require('../src/service/ums.outbox'));
  ({ syncLatestOrganizationName } = require('../src/service/ums.org-name-sync'));
  ({ ensureOrganization } = require('../src/service/keycloak.admin'));
});

beforeEach(async () => {
  await prisma.umsOutbox.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.organization.create({ data: { id: 'org-id', name: 'Initial', slug: 'fixture', ownerId: 'fixture-user', provisioningStatus: 'ACTIVE' } });
  remote = [{ id: 'registry-id', orgId: 'org-id', appId: 'Form-Builder', name: 'Initial', isActive: true }];
  failRemote = false;
  onPut = null;
  puts = [];
  acknowledge = true;
  keycloakRecords = [{ id: 'kc-id', alias: 'org-id', name: 'org-id', enabled: true }];
  createConflict = false;
  createdKeycloak = null;
});

after(async () => {
  if (prisma) await prisma.$disconnect();
  if (reportDirectory) rmSync(reportDirectory, { recursive: true });
  if (server) await new Promise(resolve => server.close(resolve));
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    await admin.end();
  }
});

test('rename and durable name-sync job are saved together; non-name edits do not enqueue', async () => {
  await dao.updateOrg('org-id', { name: 'Readable' });
  assert.equal((await prisma.organization.findUnique({ where: { id: 'org-id' } })).name, 'Readable');
  const jobs = await prisma.umsOutbox.findMany();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].kind, 'ORG_NAME_SYNC');
  assert.equal(jobs[0].payload, '{}');
  await dao.updateOrg('org-id', { name: 'Readable', industry: 'Technology' });
  assert.equal(await prisma.umsOutbox.count(), 1);
});

test('outbox insertion failure rolls back the local rename', async () => {
  await admin.query(`RENAME TABLE \`${databaseName}\`.UmsOutbox TO \`${databaseName}\`.TestPausedOutbox`);
  try {
    await assert.rejects(dao.updateOrg('org-id', { name: 'Must roll back' }));
    assert.equal((await prisma.organization.findUnique({ where: { id: 'org-id' } })).name, 'Initial');
  } finally {
    await admin.query(`RENAME TABLE \`${databaseName}\`.TestPausedOutbox TO \`${databaseName}\`.UmsOutbox`);
  }
});

test('queued events send the latest name and preserve IDs', async () => {
  await dao.updateOrg('org-id', { name: 'Older' });
  await dao.updateOrg('org-id', { name: 'Latest' });
  assert.equal(await drainOutbox(), 2);
  assert.deepEqual(puts, [{ name: 'Latest' }, { name: 'Latest' }]);
  assert.equal(remote[0].orgId, 'org-id');
  assert.equal(remote[0].id, 'registry-id');
  assert.equal(await prisma.umsOutbox.count({ where: { status: 'DONE' } }), 2);
});

test('remote failure retries and eventually succeeds', async () => {
  await dao.updateOrg('org-id', { name: 'Retry me' });
  failRemote = true;
  assert.equal(await drainOutbox(), 0);
  const pending = await prisma.umsOutbox.findFirst();
  assert.equal(pending.status, 'PENDING');
  assert.equal(pending.attempts, 1);
  assert.ok(pending.lastError.includes('Fixture outage'));
  failRemote = false;
  await prisma.umsOutbox.update({ where: { id: pending.id }, data: { nextAttemptAt: new Date(0) } });
  assert.equal(await drainOutbox(), 1);
  assert.equal(remote[0].name, 'Retry me');
});

test('repeated failures become visible DEAD jobs, not false success', async () => {
  await dao.updateOrg('org-id', { name: 'Blocked' });
  failRemote = true;
  await drainOutbox();
  await prisma.umsOutbox.updateMany({ data: { nextAttemptAt: new Date(0) } });
  await drainOutbox();
  assert.equal((await prisma.umsOutbox.findFirst()).status, 'DEAD');
  assert.equal(remote[0].name, 'Initial');
});

test('a concurrent rename queues after the in-flight sync and is delivered next', async () => {
  let entered;
  let release;
  const started = new Promise(resolve => { entered = resolve; });
  const proceed = new Promise(resolve => { release = resolve; });
  onPut = async () => { entered(); await proceed; };
  const sync = syncLatestOrganizationName('org-id');
  await started;
  const update = dao.updateOrg('org-id', { name: 'Concurrent latest' });
  release();
  await Promise.all([sync, update]);
  onPut = null;
  await drainOutbox();
  assert.equal(remote[0].name, 'Concurrent latest');
});

test('deleted organizations are skipped without recreating remote records', async () => {
  await dao.updateOrg('org-id', { name: 'Removed' });
  await prisma.organization.delete({ where: { id: 'org-id' } });
  assert.equal(await drainOutbox(), 1);
  assert.equal(puts.length, 0);
});

test('an organization from another application is never renamed', async () => {
  remote[0].appId = 'Other';
  await assert.rejects(syncLatestOrganizationName('org-id'), /not registered/);
  assert.equal(puts.length, 0);
});

test('an old UMS success response cannot mark name synchronization DONE', async () => {
  acknowledge = false;
  await dao.updateOrg('org-id', { name: 'Awaiting UMS upgrade' });
  assert.equal(await drainOutbox(), 0);
  const job = await prisma.umsOutbox.findFirst();
  assert.equal(job.status, 'PENDING');
  assert.match(job.lastError, /deploy the compatible UMS release/);
});

function runReport(args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/scripts/umsOrgNames.ts', ...args], { env: process.env });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, output }));
  });
}

test('repair command defaults to a read-only report and verification detects drift', async () => {
  const result = await runReport();
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /DRY_RUN/);
  assert.equal(await prisma.umsOutbox.count(), 0);
  assert.equal(puts.length, 0);
  assert.equal((await runReport(['--verify'])).code, 1);
});

test('explicit repair saves a report, queues work, and verifies after delivery', async () => {
  const path = join(reportDirectory, 'before.json');
  const result = await runReport(['--apply', '--org', 'org-id', '--report', path]);
  assert.equal(result.code, 0, result.output);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).rows[0].keycloak.name, 'org-id');
  assert.equal(await prisma.umsOutbox.count(), 1);
  assert.equal(puts.length, 0);
  await drainOutbox();
  const verified = await runReport(['--verify', '--org', 'org-id']);
  assert.equal(verified.code, 0, verified.output);
  assert.equal(keycloakRecords[0].alias, 'org-id');
  assert.equal(keycloakRecords[0].id, 'kc-id');
});

test('repair refuses a name collision without queueing jobs', async () => {
  await prisma.organization.create({ data: { id: 'other-org', name: 'Initial', slug: 'other', ownerId: 'fixture-user', provisioningStatus: 'ACTIVE' } });
  const result = await runReport(['--apply', '--org', 'org-id', '--report', join(reportDirectory, 'blocked.json')]);
  assert.equal(result.code, 1);
  assert.match(result.output, /Duplicate local display name/);
  assert.equal(await prisma.umsOutbox.count(), 0);
});

test('new Keycloak organizations use a readable name and stable alias', async () => {
  await ensureOrganization('org-id', 'Readable');
  assert.equal(createdKeycloak.name, 'Readable');
  assert.equal(createdKeycloak.alias, 'org-id');
  assert.ok(createdKeycloak.domains[0].name.startsWith('org-id.'));
});

test('a duplicate display-name conflict is not mistaken for an existing alias', async () => {
  createConflict = true;
  keycloakRecords[0].alias = 'other-org';
  await assert.rejects(ensureOrganization('org-id', 'Readable'), /already used by another organization/);
  keycloakRecords[0].alias = 'org-id';
  await ensureOrganization('org-id', 'Readable');
});