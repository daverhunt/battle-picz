begin;

select plan(25);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'matches', 'matches table exists');
select has_table('public', 'match_players', 'match_players table exists');
select has_table('public', 'match_turns', 'match_turns table exists');
select has_table('public', 'matchmaking_queue', 'matchmaking queue exists');
select has_table('public', 'devices', 'devices table exists');
select has_table('public', 'match_round_rewards', 'round coin reward ledger exists');
select has_table('public', 'weekly_rewards', 'weekly reward ledger exists');

select ok(row_security_active('public.profiles'::regclass), 'profiles has RLS');
select ok(row_security_active('public.matches'::regclass), 'matches has RLS');
select ok(row_security_active('public.match_players'::regclass), 'match players has RLS');
select ok(row_security_active('public.match_turns'::regclass), 'turns have RLS');
select ok(row_security_active('public.matchmaking_queue'::regclass), 'queue has RLS');
select ok(row_security_active('public.devices'::regclass), 'devices has RLS');
select ok(row_security_active('public.match_round_rewards'::regclass), 'round rewards have RLS');
select ok(row_security_active('public.weekly_rewards'::regclass), 'weekly rewards have RLS');

select has_function('public', 'create_challenge', array['jsonb', 'uuid'], 'challenge RPC exists');
select has_function('public', 'join_challenge', array['text'], 'join RPC exists');
select has_function('public', 'find_random_match', array[]::text[], 'matchmaking RPC exists');
select has_function(
  'public',
  'set_round_config',
  array['uuid', 'integer', 'text', 'text'],
  'shared round configuration RPC exists'
);
select has_function(
  'public',
  'submit_turn',
  array['uuid', 'integer', 'integer', 'jsonb', 'jsonb', 'boolean'],
  'unlimited round submission RPC exists'
);
select has_function(
  'public',
  'finalize_weekly_tournaments',
  array[]::text[],
  'weekly tournament finalizer exists'
);
select has_function(
  'public',
  'reset_my_game_data',
  array[]::text[],
  'current-player test reset RPC exists'
);
select function_privs_are(
  'public',
  'reset_my_game_data',
  array[]::text[],
  'authenticated',
  array['EXECUTE'],
  'authenticated players can reset their own test game data'
);
select function_privs_are(
  'private',
  'is_match_participant',
  array['uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated players can run the RLS participant helper'
);

select * from finish();
rollback;
