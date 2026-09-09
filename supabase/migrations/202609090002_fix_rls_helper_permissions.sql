begin;

-- RLS policies on matches, players, and turns call this security-definer helper.
-- Authenticated includes Supabase anonymous users after they receive a session.
grant usage on schema private to authenticated;
grant execute on function private.is_match_participant(uuid) to authenticated;

commit;
