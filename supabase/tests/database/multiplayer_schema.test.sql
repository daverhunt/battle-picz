begin;

select plan(46);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'matches', 'matches table exists');
select has_table('public', 'match_players', 'match_players table exists');
select has_table('public', 'match_turns', 'match_turns table exists');
select has_table('public', 'matchmaking_queue', 'matchmaking queue exists');
select has_table('public', 'devices', 'devices table exists');
select has_table('public', 'match_round_rewards', 'round coin reward ledger exists');
select has_table('public', 'weekly_rewards', 'weekly reward ledger exists');
select has_table('public', 'notification_outbox', 'notification outbox exists');

select ok(row_security_active('public.profiles'::regclass), 'profiles has RLS');
select ok(row_security_active('public.matches'::regclass), 'matches has RLS');
select ok(row_security_active('public.match_players'::regclass), 'match players has RLS');
select ok(row_security_active('public.match_turns'::regclass), 'turns have RLS');
select ok(row_security_active('public.matchmaking_queue'::regclass), 'queue has RLS');
select ok(row_security_active('public.devices'::regclass), 'devices has RLS');
select ok(row_security_active('public.match_round_rewards'::regclass), 'round rewards have RLS');
select ok(row_security_active('public.weekly_rewards'::regclass), 'weekly rewards have RLS');
select ok(row_security_active('public.notification_outbox'::regclass), 'notification outbox has RLS');

select has_column('public', 'profiles', 'power_bomb', 'profiles track bomb inventory');
select has_column('public', 'profiles', 'power_remove', 'profiles track remove-letter inventory');
select has_column('public', 'profiles', 'power_reveal', 'profiles track reveal-letter inventory');
select has_column('public', 'devices', 'provider', 'devices track push provider');
select has_column('public', 'devices', 'enabled', 'devices can be disabled');
select has_column('public', 'devices', 'device_id', 'devices track app installation');

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
select has_function(
  'public',
  'consume_power_up',
  array['text'],
  'power-up consumption RPC exists'
);
select has_function(
  'public',
  'register_push_device',
  array['text', 'text', 'text'],
  'push device registration RPC exists'
);
select has_function(
  'public',
  'unregister_push_device',
  array['text'],
  'push device removal RPC exists'
);
select has_function(
  'public',
  'claim_notification_outbox',
  array['integer'],
  'notification claim RPC exists'
);
select has_function(
  'public',
  'complete_notification_delivery',
  array['bigint', 'boolean', 'text'],
  'notification completion RPC exists'
);
select function_privs_are(
  'public',
  'consume_power_up',
  array['text'],
  'authenticated',
  array['EXECUTE'],
  'authenticated players can consume their own power-ups'
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
select function_privs_are(
  'public',
  'register_push_device',
  array['text', 'text', 'text'],
  'authenticated',
  array['EXECUTE'],
  'authenticated players can register their own push device'
);
select function_privs_are(
  'public',
  'unregister_push_device',
  array['text'],
  'authenticated',
  array['EXECUTE'],
  'authenticated players can unregister their own push device'
);
select has_trigger(
  'public',
  'matches',
  'notification_match_created',
  'direct challenges create notification events'
);
select has_trigger(
  'public',
  'match_players',
  'notification_match_player_accepted',
  'accepted challenges create notification events'
);
select has_trigger(
  'public',
  'match_turns',
  'notification_turn_completed',
  'completed turns create notification events'
);
select has_trigger(
  'public',
  'match_nudges',
  'notification_nudge_created',
  'nudges create notification events'
);
select has_trigger(
  'public',
  'weekly_rewards',
  'notification_weekly_reward_updated',
  'weekly rewards create summary events'
);

select * from finish();
rollback;
