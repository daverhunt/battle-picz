const test = require('node:test');
const assert = require('node:assert/strict');
const { BattlePiczBackend, SESSION_KEY, MATCH_KEY } = require('../multiplayer.js');

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body === undefined ? '' : JSON.stringify(body)
  };
}

test('normalises share codes and rejects malformed values', () => {
  assert.equal(BattlePiczBackend.normaliseInviteCode(' ab12cd '), 'AB12CD');
  assert.equal(BattlePiczBackend.normaliseInviteCode('too-long'), '');
});

test('reuses an unexpired anonymous session', async () => {
  const session = { access_token: 'token', expires_at: 2_000_000_000 };
  const storage = memoryStorage({ [SESSION_KEY]: JSON.stringify(session) });
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public', storage,
    now: () => 1_000, fetchImpl: async () => { throw new Error('unexpected fetch'); }
  });
  assert.deepEqual(await backend.ensureSession(), session);
});

test('creates an anonymous session when none exists', async () => {
  const calls = [];
  const storage = memoryStorage();
  const session = { access_token: 'guest-token', refresh_token: 'refresh', expires_at: 9_999_999_999 };
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public', storage,
    fetchImpl: async (url, options) => { calls.push({ url, options }); return response(session); }
  });
  assert.deepEqual(await backend.ensureSession(), session);
  assert.match(calls[0].url, /\/auth\/v1\/signup$/);
  assert.equal(JSON.parse(storage.getItem(SESSION_KEY)).access_token, 'guest-token');
});

test('creates a challenge and returns a shareable URL', async () => {
  const storage = memoryStorage({
    [SESSION_KEY]: JSON.stringify({ access_token: 'token', expires_at: 9_999_999_999 })
  });
  const calls = [];
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public', storage,
    location: { origin: 'https://game.example', pathname: '/play', search: '' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response([{ match_id: 'match-1', invite_code: 'ABC234' }]);
    }
  });
  const challenge = await backend.createChallenge({ rounds: 2 });
  assert.equal(challenge.share_url, 'https://game.example/play?challenge=ABC234');
  assert.equal(storage.getItem(MATCH_KEY), 'match-1');
  assert.match(calls[0].url, /\/rest\/v1\/rpc\/create_challenge$/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token');
});

test('joins a challenge then loads its server-owned seed', async () => {
  const storage = memoryStorage({
    [SESSION_KEY]: JSON.stringify({ access_token: 'token', expires_at: 9_999_999_999 })
  });
  let requestNo = 0;
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public', storage,
    fetchImpl: async () => ++requestNo === 1
      ? response('match-2')
      : response([{ id: 'match-2', seed: 'seed-2', status: 'active' }])
  });
  const match = await backend.joinChallenge('xyz789');
  assert.equal(match.seed, 'seed-2');
  assert.equal(storage.getItem(MATCH_KEY), 'match-2');
});

test('surfaces Supabase errors', async () => {
  const storage = memoryStorage({
    [SESSION_KEY]: JSON.stringify({ access_token: 'token', expires_at: 9_999_999_999 })
  });
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public', storage,
    fetchImpl: async () => response({ message: 'Challenge is unavailable or expired' }, 400)
  });
  await assert.rejects(() => backend.joinChallenge('ABC234'), /unavailable or expired/);
});
