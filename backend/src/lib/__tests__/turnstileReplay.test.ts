import assert from 'node:assert/strict';
import test from 'node:test';
import {
  claimVerifiedTurnstileToken,
  hashTurnstileToken,
  type TurnstileTokenStore,
} from '../turnstileReplay';

class UniqueTokenStore implements TurnstileTokenStore {
  readonly hashes = new Set<string>();

  async create(args: { data: { tokenHash: string; formId: string; expiresAt: Date } }): Promise<void> {
    if (this.hashes.has(args.data.tokenHash)) throw { code: 'P2002' };
    this.hashes.add(args.data.tokenHash);
  }
}

test('hashes tokens without retaining the raw token', () => {
  const raw = 'private-turnstile-token';
  const hash = hashTurnstileToken(raw);
  assert.equal(hash.length, 64);
  assert.notEqual(hash, raw);
  assert.equal(hash, hashTurnstileToken(raw));
});

test('atomically rejects a second claim for the same token', async () => {
  const store = new UniqueTokenStore();
  const expiresAt = new Date(Date.now() + 600_000);

  await claimVerifiedTurnstileToken(store, 'single-use-token', 'form-1', expiresAt);

  await assert.rejects(
    claimVerifiedTurnstileToken(store, 'single-use-token', 'form-1', expiresAt),
    (error: unknown) => {
      assert.equal((error as { statusCode?: number }).statusCode, 409);
      return true;
    },
  );
});

test('fails closed when the token claim datastore is unavailable', async () => {
  const unavailableStore: TurnstileTokenStore = {
    create: async () => {
      throw new Error('database unavailable');
    },
  };

  await assert.rejects(
    claimVerifiedTurnstileToken(
      unavailableStore,
      'new-token',
      'form-1',
      new Date(Date.now() + 600_000),
    ),
    (error: unknown) => {
      assert.equal((error as { statusCode?: number }).statusCode, 503);
      return true;
    },
  );
});
