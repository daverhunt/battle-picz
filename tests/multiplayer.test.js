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

test('refreshes and retries when Supabase rejects a stale guest token', async () => {
  const storage = memoryStorage({
    [SESSION_KEY]: JSON.stringify({
      access_token: 'stale-token', refresh_token: 'refresh-me', expires_at: 9_999_999_999
    })
  });
  const calls = [];
  const refreshed = {
    access_token: 'fresh-token', refresh_token: 'fresh-refresh', expires_at: 9_999_999_999
  };
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public', storage,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) return response({ message: 'JWT issued at future' }, 401);
      if (calls.length === 2) return response(refreshed);
      return response([{ id: 'match-after-refresh' }]);
    }
  });

  assert.deepEqual(await backend.getMatch('match-after-refresh'), { id: 'match-after-refresh' });
  assert.match(calls[1].url, /\/auth\/v1\/token\?grant_type=refresh_token$/);
  assert.equal(JSON.parse(calls[1].options.body).refresh_token, 'refresh-me');
  assert.equal(calls[2].options.headers.Authorization, 'Bearer fresh-token');
  assert.equal(JSON.parse(storage.getItem(SESSION_KEY)).access_token, 'fresh-token');
});

test('starts a new guest session when a stale session cannot be refreshed', async () => {
  const storage = memoryStorage({
    [SESSION_KEY]: JSON.stringify({
      access_token: 'stale-token', refresh_token: 'dead-refresh', expires_at: 9_999_999_999
    })
  });
  const calls = [];
  const newGuest = {
    access_token: 'new-guest-token', refresh_token: 'new-refresh', expires_at: 9_999_999_999
  };
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public', storage,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) return response({ message: 'Invalid JWT' }, 401);
      if (calls.length === 2) return response({ message: 'Invalid refresh token' }, 400);
      if (calls.length === 3) return response(newGuest);
      return response([]);
    }
  });

  assert.deepEqual(await backend.listMatches(), []);
  assert.match(calls[2].url, /\/auth\/v1\/signup$/);
  assert.equal(calls[3].options.headers.Authorization, 'Bearer new-guest-token');
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

test('builds a current-player context with the opponent turn', async () => {
  const session = { access_token: 'token', expires_at: 9_999_999_999, user: { id: 'me' } };
  const storage = memoryStorage({ [SESSION_KEY]: JSON.stringify(session) });
  const replies = [
    [{ id: 'match-3', game_config: { rounds: { 1: { category: 'FOOD', difficulty: 'hard' } } } }],
    [{ user_id: 'me', player_no: 2 }, { user_id: 'them', player_no: 1 }],
    [{ user_id: 'them', round_no: 1, score: 4200, answers: [] }]
  ];
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public', storage,
    fetchImpl: async () => response(replies.shift())
  });
  const context = await backend.getMatchContext('match-3', 1);
  assert.equal(context.me.player_no, 2);
  assert.equal(context.ownTurn, null);
  assert.equal(context.opponentTurn.score, 4200);
  assert.deepEqual(context.roundConfig, { category: 'FOOD', difficulty: 'hard' });
  assert.equal(context.canChoose, false);
});

test('sorts dashboard matches into my turn, their turn, and completed', () => {
  const baseMatch = {
    id: 'match-4', status: 'active', created_at: '2026-09-09T10:00:00Z',
    game_config: { rounds: { 1: { category: 'ANIMALS', difficulty: 'easy' } } }
  };
  const players = [
    { user_id: 'me', player_no: 1, total_score: 0, accepted_at: 'now' },
    { user_id: 'them', player_no: 2, total_score: 1200, accepted_at: 'now' }
  ];

  const ready = BattlePiczBackend.describeMatch(baseMatch, players, [], 'me');
  assert.equal(ready.bucket, 'your-turn');
  assert.equal(ready.action, 'play');

  const waiting = BattlePiczBackend.describeMatch(baseMatch, players, [
    { user_id: 'me', round_no: 1, score: 900, completed_at: '2026-09-09T10:05:00Z' }
  ], 'me');
  assert.equal(waiting.bucket, 'waiting');
  assert.equal(waiting.action, 'waiting');

  const complete = BattlePiczBackend.describeMatch(
    { ...baseMatch, status: 'complete' }, players, [], 'me'
  );
  assert.equal(complete.bucket, 'completed');
  assert.equal(complete.result, 'lost');
});

test('marks an unaccepted direct rematch as actionable', () => {
  const item = BattlePiczBackend.describeMatch(
    { id: 'match-5', status: 'waiting', game_config: {}, created_at: '2026-09-09T10:00:00Z' },
    [
      { user_id: 'them', player_no: 1, accepted_at: 'now', total_score: 0 },
      { user_id: 'me', player_no: 2, accepted_at: null, total_score: 0 }
    ],
    [],
    'me'
  );
  assert.equal(item.bucket, 'your-turn');
  assert.equal(item.action, 'accept');
});

test('creates a rematch and returns its share URL', async () => {
  const storage = memoryStorage({
    [SESSION_KEY]: JSON.stringify({ access_token: 'token', expires_at: 9_999_999_999 })
  });
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public', storage,
    location: { origin: 'https://game.example', pathname: '/', search: '' },
    fetchImpl: async () => response([{ match_id: 'rematch-1', invite_code: 'REM234' }])
  });
  const rematch = await backend.createRematch('original-1');
  assert.equal(rematch.share_url, 'https://game.example/?challenge=REM234');
  assert.equal(storage.getItem(MATCH_KEY), 'rematch-1');
});

test('dashboard query only requests the current player memberships', async () => {
  const storage = memoryStorage({
    [SESSION_KEY]: JSON.stringify({
      access_token: 'token', expires_at: 9_999_999_999, user: { id: 'player-123' }
    })
  });
  const calls = [];
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public', storage,
    fetchImpl: async url => { calls.push(url); return response([]); }
  });
  assert.deepEqual(await backend.getMatchesDashboard(), []);
  assert.match(calls[0], /match_players\?user_id=eq\.player-123&select=/);
});

test('only allows a waiting player to nudge once per cooldown', () => {
  const match = { id: 'match-6', status: 'active', game_config: {}, created_at: '2026-09-09T10:00:00Z' };
  const players = [
    { user_id: 'me', player_no: 1, accepted_at: 'now', total_score: 500 },
    { user_id: 'them', player_no: 2, accepted_at: 'now', total_score: 0 }
  ];
  const turns = [{ user_id: 'me', round_no: 1, score: 500 }];
  assert.equal(BattlePiczBackend.describeMatch(match, players, turns, 'me').canNudge, true);
  const recentNudge = [{
    match_id: 'match-6', from_user_id: 'me', to_user_id: 'them', created_at: new Date().toISOString()
  }];
  assert.equal(BattlePiczBackend.describeMatch(match, players, turns, 'me', recentNudge).canNudge, false);
});

test('sends a nudge through the protected RPC', async () => {
  const storage = memoryStorage({
    [SESSION_KEY]: JSON.stringify({ access_token: 'token', expires_at: 9_999_999_999 })
  });
  let call;
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public', storage,
    fetchImpl: async (url, options) => { call = { url, options }; return response('2026-09-09T12:00:00Z'); }
  });
  await backend.sendNudge('match-6');
  assert.match(call.url, /rpc\/send_match_nudge$/);
  assert.deepEqual(JSON.parse(call.options.body), { p_match_id: 'match-6' });
});
