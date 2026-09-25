const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '202609250001_notification_hooks.sql'
  ),
  'utf8'
);

test('notification outbox remains dormant until a sender claims it', () => {
  assert.match(migration, /create table public\.notification_outbox/);
  assert.match(migration, /status text not null default 'pending'/);
  assert.match(migration, /revoke all on public\.notification_outbox/);
  assert.match(migration, /grant execute on function public\.claim_notification_outbox\(integer\)\s+to service_role/);
  assert.doesNotMatch(migration, /http_request|net\.http|firebase|fcm\.googleapis/);
});

test('notification events carry stable deep-link data and deduplicate', () => {
  for (const event of [
    'challenge_received',
    'challenge_accepted',
    'match_found',
    'turn_ready',
    'results_ready',
    'nudge',
    'weekly_summary'
  ]) {
    assert.match(migration, new RegExp("'" + event + "'"));
  }
  assert.match(migration, /dedupe_key text not null unique/);
  assert.match(migration, /'screen', 'match'/);
  assert.match(migration, /'match_id', new\.match_id/);
  assert.match(migration, /'round_no', new\.round_no/);
});

test('device registration is user-owned and ready for Firebase tokens', () => {
  assert.match(migration, /provider text not null default 'fcm'/);
  assert.match(migration, /create or replace function public\.register_push_device/);
  assert.match(migration, /user_id = caller/);
  assert.match(migration, /enabled = true/);
  assert.match(migration, /create or replace function public\.unregister_push_device/);
});

test('delivery completion has bounded retries and terminal failure', () => {
  assert.match(migration, /when n\.attempts >= 8 then 'failed'/);
  assert.match(migration, /least\(3600,/);
  assert.match(migration, /where n\.id = p_event_id and n\.status = 'processing'/);
});
