begin;

select plan(16);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'matches', 'matches table exists');
select has_table('public', 'match_players', 'match_players table exists');
select has_table('public', 'match_turns', 'match_turns table exists');
select has_table('public', 'matchmaking_queue', 'matchmaking queue exists');
select has_table('public', 'devices', 'devices table exists');

select ok(row_security_active('public.profiles'::regclass), 'profiles has RLS');
select ok(row_security_active('public.matches'::regclass), 'matches has RLS');
select ok(row_security_active('public.match_players'::regclass), 'match players has RLS');
select ok(row_security_active('public.match_turns'::regclass), 'turns have RLS');
select ok(row_security_active('public.matchmaking_queue'::regclass), 'queue has RLS');
select ok(row_security_active('public.devices'::regclass), 'devices has RLS');

select has_function('public', 'create_challenge', array['jsonb', 'uuid'], 'challenge RPC exists');
select has_function('public', 'join_challenge', array['text'], 'join RPC exists');
select has_function('public', 'find_random_match', array[]::text[], 'matchmaking RPC exists');
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
