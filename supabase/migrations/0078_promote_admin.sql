-- 0078_promote_admin.sql
--
-- Promote neeraj.kumar@virtualxcellence.com to the Admin role (co_owner):
-- full platform access INCLUDING the Settings section. co_owner is an
-- email-login role, so this account signs in with its real email + existing
-- password (no username).
--
-- Requirements / notes:
--   * The profile must already exist (created via the normal sign-up / invite
--     flow). If it doesn't, this is a harmless no-op and emits a warning —
--     create the account first, then re-run.
--   * co_owner has existed since 0067, so this does not depend on 0074.
--   * auth.uid() is null in a migration / service-role context, so
--     profiles_guard (0067) lets this role change through.
--   * Idempotent: re-running it just re-asserts role = co_owner.

do $$
declare
  v_count int;
begin
  update public.profiles
     set role   = 'co_owner',
         active = true
   where lower(email) = lower('neeraj.kumar@virtualxcellence.com');

  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise warning
      'No profile found for neeraj.kumar@virtualxcellence.com — create the account first (Settings -> Users), then re-run this migration.';
  else
    raise notice 'Promoted % profile(s) to co_owner (Admin).', v_count;
  end if;
end $$;
