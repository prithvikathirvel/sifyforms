import prisma from '../utils/prisma';
import {
  UMS_OUTBOX_ENABLED,
  UMS_OUTBOX_INTERVAL_MS,
  UMS_OUTBOX_MAX_ATTEMPTS,
} from '../config/ums.config';
import { resolveRoleId } from './rbac.client';
import {
  mirrorMemberRemoval,
  mirrorMembership,
  provisionOrg,
  unwindOrg,
} from './ums.provisioning';
import logger from '../utils/logger';

/**
 * Work owed to the user-management service.
 *
 * A membership change is a local write plus a remote one, and the remote half
 * must never be able to fail the user's request or be lost when it does fail.
 * The row is written in the same transaction as the change it describes, then
 * drained here.
 */

export type OutboxKind =
  | 'ORG_PROVISION'
  | 'MEMBER_SYNC'
  | 'MEMBER_REMOVE'
  | 'ORG_DELETE';

interface OutboxPayloads {
  ORG_PROVISION: { name: string };
  MEMBER_SYNC: { userId: string; roleName: string };
  MEMBER_REMOVE: { userId: string };
  ORG_DELETE: { memberIds: string[] };
}

/** Anything with `umsOutbox` — the Prisma client or a transaction handle. */
type PrismaLike = Pick<typeof prisma, 'umsOutbox'>;

export async function enqueue<K extends OutboxKind>(
  db: PrismaLike,
  kind: K,
  orgId: string,
  payload: OutboxPayloads[K]
): Promise<void> {
  await db.umsOutbox.create({
    data: { kind, orgId, payload: JSON.stringify(payload) },
  });
}

/** Enqueue without failing the caller: mirroring is never worth losing a request over. */
export async function enqueueQuietly<K extends OutboxKind>(
  kind: K,
  orgId: string,
  payload: OutboxPayloads[K]
): Promise<void> {
  try {
    await enqueue(prisma, kind, orgId, payload);
  } catch (error: any) {
    logger.error('UmsOutbox --> enqueue failed', { kind, orgId, message: error?.message });
  }
}

/**
 * Drop work queued for an organization that is going away.
 *
 * A membership sync for a deleted organization can never succeed, and retrying
 * it until it dies would leave a permanent false alarm in the dead-letter count.
 */
export async function cancelPendingFor(orgId: string): Promise<void> {
  try {
    await prisma.umsOutbox.updateMany({
      where: { orgId, status: 'PENDING' },
      data: { status: 'DONE', lastError: 'Cancelled: organization deleted' },
    });
  } catch (error: any) {
    logger.warn('UmsOutbox --> cancel failed', { orgId, message: error?.message });
  }
}

async function execute(kind: string, orgId: string, payload: any): Promise<void> {
  switch (kind) {
    case 'ORG_PROVISION':
      await provisionOrg(orgId, payload.name);
      return;
    case 'MEMBER_SYNC': {
      const roleId = await resolveRoleId(payload.roleName, orgId);
      await mirrorMembership(orgId, payload.userId, roleId);
      return;
    }
    case 'MEMBER_REMOVE':
      await mirrorMemberRemoval(orgId, payload.userId);
      return;
    case 'ORG_DELETE':
      await unwindOrg(orgId, payload.memberIds ?? []);
      return;
    default:
      throw new Error(`Unknown outbox kind "${kind}"`);
  }
}

function backoffMs(attempts: number): number {
  return Math.min(15_000 * 2 ** attempts, 30 * 60_000);
}

let draining = false;

/** Process everything currently due. Returns how many entries succeeded. */
export async function drainOutbox(limit = 25): Promise<number> {
  if (draining) return 0;
  draining = true;
  let done = 0;

  try {
    const due = await prisma.umsOutbox.findMany({
      where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    for (const entry of due) {
      try {
        await execute(entry.kind, entry.orgId, JSON.parse(entry.payload));
        await prisma.umsOutbox.update({
          where: { id: entry.id },
          data: { status: 'DONE', lastError: null },
        });
        done += 1;
      } catch (error: any) {
        const attempts = entry.attempts + 1;
        const dead = attempts >= UMS_OUTBOX_MAX_ATTEMPTS;
        await prisma.umsOutbox.update({
          where: { id: entry.id },
          data: {
            attempts,
            status: dead ? 'DEAD' : 'PENDING',
            nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
            lastError: String(error?.message ?? error).slice(0, 1000),
          },
        });
        logger[dead ? 'error' : 'warn']('UmsOutbox --> entry failed', {
          id: entry.id,
          kind: entry.kind,
          orgId: entry.orgId,
          attempts,
          dead,
          message: error?.message,
        });
      }
    }
  } catch (error: any) {
    logger.error('UmsOutbox --> drain failed', { message: error?.message });
  } finally {
    draining = false;
  }

  return done;
}

let timer: NodeJS.Timeout | null = null;

export function startOutboxWorker(): void {
  if (!UMS_OUTBOX_ENABLED || timer) return;
  timer = setInterval(() => {
    void drainOutbox();
  }, UMS_OUTBOX_INTERVAL_MS);
  timer.unref();
  logger.info('UmsOutbox --> worker started', { intervalMs: UMS_OUTBOX_INTERVAL_MS });
}

export function stopOutboxWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
