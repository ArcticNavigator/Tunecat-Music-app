-- ═══════════════════════════════════════════════════════════════════════════════
-- 0006_harden_function_grants.sql — Security Advisor cleanup (function EXECUTE)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Postgres grants EXECUTE to PUBLIC by default on every new function, so our
-- SECURITY DEFINER helpers (enforce_signup_cap, sweep_dormant, rls_auto_enable)
-- were technically callable through the Data API with the anon key. Not actually
-- exploitable here — trigger/event-trigger functions can't be invoked directly,
-- and sweep_dormant only applies the existing 6-month retention policy — but
-- there's no reason to leave them callable. This revokes client access:
--
--   - Triggers still fire (EXECUTE isn't checked when a trigger runs).
--   - pg_cron's nightly sweep still works (runs as postgres, the owner).
--   - Edge Functions (service_role) are unaffected.
--
-- The loop resolves each function's exact signature from the catalog, so it
-- also covers rls_auto_enable() (created via the dashboard, not in this repo)
-- and skips silently if a function doesn't exist in the environment.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('enforce_signup_cap', 'sweep_dormant', 'rls_auto_enable')
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated', fn.sig
    );
  end loop;
end $$;

-- And for anything created from now on: new functions in public no longer get
-- the automatic PUBLIC/anon/authenticated EXECUTE grant. (Applies to objects
-- created by the role running this — the dashboard/migration role.)
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
