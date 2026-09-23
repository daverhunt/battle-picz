const test = require('node:test');
const assert = require('node:assert/strict');
const { BattlePiczBackend, SESSION_KEY, MATCH_KEY } = require('../multiplayer.js');

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
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
    [{ id: 'match-3', status: 'active', game_config: { rounds: { 1: { category: 'FOOD', difficulty: 'hard' } } } }],
    [{ user_id: 'me', player_no: 2 }, { user_id: 'them', player_no: 1 }],
    [{ user_id: 'them', round_no: 1, score: 4200, answers: [] }]
  ];
  const calls = [];
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public', storage,
    fetchImpl: async url => { calls.push(url); return response(replies.shift()); }
  });
  const context = await backend.getMatchContext('match-3', 1);
  assert.equal(context.me.player_no, 2);
  assert.equal(context.ownTurn, null);
  assert.equal(context.opponentTurn.score, 4200);
  assert.deepEqual(context.roundConfig, { category: 'FOOD', difficulty: 'hard' });
  assert.equal(context.canChoose, false);
  assert.equal(context.canPlay, true);
  assert.match(calls[1], /profiles!match_players_user_id_fkey\(display_name\)/);
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
    { ...baseMatch, status: 'complete', winner_id: 'them' }, players, [], 'me'
  );
  assert.equal(complete.bucket, 'completed');
  assert.equal(complete.result, 'lost');
});

test('only shows a round comparison after both players finish the three pictures', () => {
  const ownTurn = { user_id: 'me', round_no: 1, answers: [{}, {}, {}] };
  const opponentTurn = { user_id: 'them', round_no: 1, answers: [{}, {}, {}] };

  assert.equal(BattlePiczBackend.isRoundComparisonReady({ ownTurn, opponentTurn: null }), false);
  assert.equal(BattlePiczBackend.isRoundComparisonReady({ ownTurn: null, opponentTurn }), false);
  assert.equal(BattlePiczBackend.isRoundComparisonReady({ ownTurn, opponentTurn }), true);
});

test('keeps later rounds sequential instead of letting both players start together', () => {
  const players = [
    { user_id: 'one', player_no: 1, accepted_at: 'now', total_score: 1000 },
    { user_id: 'two', player_no: 2, accepted_at: 'now', total_score: 1200 }
  ];
  const completedRoundOne = [
    { user_id: 'one', round_no: 1, score: 1000 },
    { user_id: 'two', round_no: 1, score: 1200 }
  ];
  const baseMatch = {
    id: 'sequential-match', status: 'active', created_at: '2026-09-21T08:00:00Z',
    game_config: { rounds: { 1: { category: 'FOOD', difficulty: 'easy' } } }
  };

  const chooser = BattlePiczBackend.describeMatch(baseMatch, players, completedRoundOne, 'two');
  const waitingForChoice = BattlePiczBackend.describeMatch(baseMatch, players, completedRoundOne, 'one');
  assert.equal(chooser.action, 'choose');
  assert.equal(waitingForChoice.action, 'waiting');

  const configuredMatch = {
    ...baseMatch,
    game_config: {
      rounds: {
        ...baseMatch.game_config.rounds,
        2: { category: 'SPORT', difficulty: 'medium' }
      }
    }
  };
  const starter = BattlePiczBackend.describeMatch(configuredMatch, players, completedRoundOne, 'two');
  const responderWaiting = BattlePiczBackend.describeMatch(configuredMatch, players, completedRoundOne, 'one');
  assert.equal(starter.action, 'play');
  assert.equal(responderWaiting.action, 'waiting');

  const starterFinished = [
    ...completedRoundOne,
    { user_id: 'two', round_no: 2, score: 1500 }
  ];
  const responder = BattlePiczBackend.describeMatch(configuredMatch, players, starterFinished, 'one');
  const starterWaiting = BattlePiczBackend.describeMatch(configuredMatch, players, starterFinished, 'two');
  assert.equal(responder.action, 'play');
  assert.equal(starterWaiting.action, 'waiting');
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

test('lets the creator configure round one before an opponent joins', async () => {
  const session = { access_token: 'token', expires_at: 9_999_999_999, user: { id: 'me' } };
  const storage = memoryStorage({ [SESSION_KEY]: JSON.stringify(session) });
  const replies = [
    [{ id: 'waiting-match', status: 'waiting', game_config: {} }],
    [{ user_id: 'me', player_no: 1, accepted_at: 'now' }],
    []
  ];
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public', storage,
    fetchImpl: async () => response(replies.shift())
  });
  const context = await backend.getMatchContext('waiting-match');
  assert.equal(context.canChoose, true);
});

test('makes an unjoined challenge actionable until the creator submits round one', () => {
  const match = {
    id: 'opening-match', status: 'waiting', game_config: {}, created_at: '2026-09-14T10:00:00Z'
  };
  const players = [{ user_id: 'creator', player_no: 1, accepted_at: 'now', total_score: 0 }];
  const opening = BattlePiczBackend.describeMatch(match, players, [], 'creator');
  assert.equal(opening.bucket, 'your-turn');
  assert.equal(opening.action, 'choose');

  const configured = BattlePiczBackend.describeMatch(
    { ...match, game_config: { rounds: { 1: { category: 'FOOD', difficulty: 'easy' } } } },
    players,
    [],
    'creator'
  );
  assert.equal(configured.action, 'play');

  const submitted = BattlePiczBackend.describeMatch(match, players, [
    { user_id: 'creator', round_no: 1, score: 1200 }
  ], 'creator');
  assert.equal(submitted.bucket, 'waiting');
  assert.equal(submitted.action, 'waiting');
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
  assert.match(calls[0], /matches!match_players_match_id_fkey\(/);
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

test('resets backend gameplay and clears local game state while preserving the guest session', async () => {
  const session = { access_token: 'token', expires_at: 9_999_999_999 };
  const storage = memoryStorage({
    [SESSION_KEY]: JSON.stringify(session),
    [MATCH_KEY]: 'match-6',
    'battle-picz.progress.match-6.1': '{"questionIndex":2}',
    'battle-picz.week-summary.2026-09-07': 'shown',
    'another-app.setting': 'keep'
  });
  let call;
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public', storage,
    fetchImpl: async (url, options) => {
      call = { url, options };
      return response({ matches_deleted: 1 });
    }
  });

  assert.deepEqual(await backend.resetMyGameData(), { matches_deleted: 1 });
  assert.match(call.url, /rpc\/reset_my_game_data$/);
  assert.deepEqual(JSON.parse(storage.getItem(SESSION_KEY)), session);
  assert.equal(storage.getItem(MATCH_KEY), null);
  assert.equal(storage.getItem('battle-picz.progress.match-6.1'), null);
  assert.equal(storage.getItem('battle-picz.week-summary.2026-09-07'), null);
  assert.equal(storage.getItem('another-app.setting'), 'keep');
});

test('uses one global UTC tournament week from Monday to Monday', () => {
  const sunday = BattlePiczBackend.utcWeekWindow('2026-09-13T23:59:59.999Z');
  const monday = BattlePiczBackend.utcWeekWindow('2026-09-14T00:00:00.000Z');
  assert.equal(sunday.key, '2026-09-07');
  assert.equal(new Date(sunday.end).toISOString(), '2026-09-14T00:00:00.000Z');
  assert.equal(monday.key, '2026-09-14');
});

test('UTC tournament weeks remain correct across a year boundary', () => {
  const week = BattlePiczBackend.utcWeekWindow('2027-01-01T12:00:00Z');
  assert.equal(week.key, '2026-12-28');
  assert.equal(new Date(week.end).toISOString(), '2027-01-04T00:00:00.000Z');
});

test('builds the weekly record from ongoing battles and completed rounds', () => {
  const me = { user_id: 'me' };
  const base = {
    match: { status: 'active', week_start: '2026-09-07', created_at: '2026-09-09T10:00:00Z' },
    me,
    opponent: { user_id: 'friend-1' },
    turns: [
      { user_id: 'me', round_no: 1, score: 50 },
      { user_id: 'friend-1', round_no: 1, score: 100 },
      { user_id: 'me', round_no: 2, score: 50 },
      { user_id: 'friend-1', round_no: 2, score: 100 }
    ]
  };
  const summary = BattlePiczBackend.weeklySummary([
    {
      ...base,
      turns: [
        { user_id: 'me', round_no: 1, score: 200 },
        { user_id: 'friend-1', round_no: 1, score: 100 },
        { user_id: 'me', round_no: 2, score: 200 },
        { user_id: 'friend-1', round_no: 2, score: 100 }
      ]
    },
    { ...base, match: { ...base.match, created_at: '2026-09-10T10:00:00Z' } },
    {
      ...base,
      opponent: { user_id: 'friend-2' },
      match: { ...base.match, created_at: '2026-09-11T10:00:00Z' },
      turns: [
        { user_id: 'me', round_no: 1, score: 100 },
        { user_id: 'friend-2', round_no: 1, score: 100 },
        { user_id: 'me', round_no: 2, score: 100 },
        { user_id: 'friend-2', round_no: 2, score: 100 }
      ]
    },
    { ...base, match: { ...base.match, week_start: '2026-08-31', created_at: '2026-09-01T10:00:00Z' } }
  ], '2026-09-12T12:00:00Z');
  assert.deepEqual(
    { wins: summary.wins, losses: summary.losses, draws: summary.draws },
    { wins: 1, losses: 1, draws: 1 }
  );
  assert.equal(summary.matchesPlayed, 3);
  assert.equal(summary.opponentsPlayed, 2);
  assert.equal(summary.roundsPlayed, 6);
  assert.equal(summary.coins, 15);
  assert.deepEqual(
    { wins: summary.roundWins, losses: summary.roundLosses, draws: summary.roundDraws },
    { wins: 2, losses: 2, draws: 2 }
  );
});

test('keeps advancing after both players complete every round', () => {
  const match = { status: 'active' };
  assert.equal(BattlePiczBackend.currentRound(match, []), 1);
  assert.equal(BattlePiczBackend.currentRound(match, [
    { user_id: 'one', round_no: 1 }
  ]), 1);
  assert.equal(BattlePiczBackend.currentRound(match, [
    { user_id: 'one', round_no: 1 },
    { user_id: 'two', round_no: 1 }
  ]), 2);
  assert.equal(BattlePiczBackend.currentRound(match, [
    { user_id: 'one', round_no: 1 }, { user_id: 'two', round_no: 1 },
    { user_id: 'one', round_no: 2 }, { user_id: 'two', round_no: 2 }
  ]), 3);
  assert.equal(BattlePiczBackend.currentRound(match, Array.from({ length: 24 }, (_, index) => [
    { user_id: 'one', round_no: index + 1 },
    { user_id: 'two', round_no: index + 1 }
  ]).flat()), 25);
});

test('scores the overall match by rounds won rather than raw points', () => {
  const results = BattlePiczBackend.roundResults([
    { user_id: 'me', round_no: 1, score: 100 }, { user_id: 'them', round_no: 1, score: 90 },
    { user_id: 'me', round_no: 2, score: 100 }, { user_id: 'them', round_no: 2, score: 90 },
    { user_id: 'me', round_no: 3, score: 1 }, { user_id: 'them', round_no: 3, score: 10000 }
  ], 'me');
  assert.deepEqual(results.map(result => result.result), ['won', 'won', 'lost']);
});

test('alternates the category chooser for unlimited rounds', () => {
  const match = { id: 'weekly-battle', status: 'active', game_config: {} };
  const players = [
    { user_id: 'one', player_no: 1, accepted_at: 'now' },
    { user_id: 'two', player_no: 2, accepted_at: 'now' }
  ];
  const roundTwoTurns = [
    { user_id: 'one', round_no: 1, score: 100 },
    { user_id: 'two', round_no: 1, score: 90 }
  ];
  assert.equal(BattlePiczBackend.describeMatch(match, players, [], 'one').action, 'choose');
  assert.equal(BattlePiczBackend.describeMatch(match, players, roundTwoTurns, 'one').action, 'waiting');
  assert.equal(BattlePiczBackend.describeMatch(match, players, roundTwoTurns, 'two').action, 'choose');

  const throughRoundThree = [...roundTwoTurns,
    { user_id: 'one', round_no: 2, score: 100 },
    { user_id: 'two', round_no: 2, score: 90 },
    { user_id: 'one', round_no: 3, score: 100 },
    { user_id: 'two', round_no: 3, score: 90 }
  ];
  assert.equal(BattlePiczBackend.describeMatch(match, players, throughRoundThree, 'two').action, 'choose');
});

test('loads persistent power-up inventory from the player profile', async () => {
  const calls = [];
  const session = { access_token: 'token', expires_at: 9_999_999_999, user: { id: 'me' } };
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public',
    storage: memoryStorage({ [SESSION_KEY]: JSON.stringify(session) }),
    fetchImpl: async (url) => {
      calls.push(url);
      return response([{ power_bomb: 1, power_remove: 8, power_reveal: 3 }]);
    }
  });

  assert.deepEqual(await backend.getPowerUps(), { bomb: 1, remove: 8, reveal: 3 });
  assert.match(calls[0], /power_bomb,power_remove,power_reveal/);
});

test('consumes one server-owned power-up and rejects unknown types', async () => {
  const calls = [];
  const session = { access_token: 'token', expires_at: 9_999_999_999, user: { id: 'me' } };
  const backend = new BattlePiczBackend({
    url: 'https://example.supabase.co', publishableKey: 'public',
    storage: memoryStorage({ [SESSION_KEY]: JSON.stringify(session) }),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ bomb: 1, remove: 10, reveal: 5 });
    }
  });

  assert.deepEqual(await backend.consumePowerUp('bomb'), { bomb: 1, remove: 10, reveal: 5 });
  assert.match(calls[0].url, /\/rest\/v1\/rpc\/consume_power_up$/);
  assert.deepEqual(JSON.parse(calls[0].options.body), { p_power_up: 'bomb' });
  await assert.rejects(() => backend.consumePowerUp('free-money'), /Unknown power-up/);
  assert.equal(calls.length, 1);
});
