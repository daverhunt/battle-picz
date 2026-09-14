import fs from 'node:fs/promises';

const configSource = await fs.readFile(new URL('../supabase-config.js', import.meta.url), 'utf8');
const url = configSource.match(/url:\s*'([^']+)'/)?.[1];
const publishableKey = configSource.match(/publishableKey:\s*'([^']+)'/)?.[1];

if (!url || !publishableKey) throw new Error('Supabase public configuration is missing');

async function request(path, { token, body, method = 'POST' } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: publishableKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json'
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  return data;
}

async function guest() {
  const session = await request('/auth/v1/signup', { body: {} });
  if (!session?.access_token) throw new Error('Anonymous sign-in returned no access token');
  return session.access_token;
}

const creator = await guest();
const opponent = await guest();
const [challenge] = await request('/rest/v1/rpc/create_challenge', {
  token: creator,
  body: { p_game_config: { version: 1, smoke_test: true }, p_invited_user_id: null }
});

if (!challenge?.match_id || !challenge?.invite_code) throw new Error('Challenge creation failed');

const joinedMatchId = await request('/rest/v1/rpc/join_challenge', {
  token: opponent,
  body: { p_invite_code: challenge.invite_code }
});
if (joinedMatchId !== challenge.match_id) throw new Error('Opponent joined the wrong match');

const rounds = [
  { chooser: creator, category: 'ANIMALS', difficulty: 'easy', scores: [3200, 2800] },
  { chooser: opponent, category: 'FOOD', difficulty: 'medium', scores: [2600, 3000] },
  { chooser: creator, category: 'SPORT', difficulty: 'hard', scores: [3400, 3100] }
];

for (const [index, round] of rounds.entries()) {
  const roundNo = index + 1;
  const roundConfig = await request('/rest/v1/rpc/set_round_config', {
    token: round.chooser,
    body: {
      p_match_id: challenge.match_id,
      p_round_no: roundNo,
      p_category: round.category,
      p_difficulty: round.difficulty
    }
  });
  if (roundConfig?.category !== round.category || roundConfig?.difficulty !== round.difficulty) {
    throw new Error(`Round ${roundNo} configuration was not saved`);
  }

  for (const [playerIndex, token] of [creator, opponent].entries()) {
    const score = round.scores[playerIndex];
    await request('/rest/v1/rpc/submit_turn', {
      token,
      body: {
        p_match_id: challenge.match_id,
        p_round_no: roundNo,
        p_score: score,
        p_answers: [{ correct: true, elapsed_ms: 2500, tiles_used: 4, score }],
        p_ghost_timeline: [{ at_ms: 2500, score }],
        p_is_final: roundNo === 3
      }
    });
  }
}

const matches = await request(
  `/rest/v1/matches?id=eq.${encodeURIComponent(challenge.match_id)}&select=status,winner_id`,
  { token: creator, method: 'GET' }
);
if (matches?.[0]?.status !== 'complete' || !matches[0].winner_id) {
  throw new Error('Completed match state was not calculated');
}

console.log('Supabase smoke test passed: two guests completed all three rounds and produced a winner.');
