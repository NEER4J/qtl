-- ----------------------------------------------------------------------------
-- 0141 — Data fix: bring stored permission overrides back in line with the
--        role defaults for two specific pages.
-- ----------------------------------------------------------------------------
-- From the shop's marked-up screenshots:
--   · Manager    (Jaimie)    — "Dashboard: No Need"
--   · Staff      (Yadwinder) — "Vendors: No Need"
--
-- Neither is a code change. PAGE_REGISTRY already excludes `dashboard` from
-- manager and `vendors` from staff, so anyone in those roles still seeing
-- those pages is reaching them through a per-user `allowed_pages` override
-- that was saved at some point in the Users screen. This migration removes
-- just those two keys from just those overrides.
--
-- Scope, deliberately:
--   · Targets ROLE + KEY, not a named person. The notes label the sheets by
--     role, the two keys are already role-default-denied, and matching on a
--     free-text full_name would be guesswork that silently no-ops if the
--     spelling differs.
--   · Touches ONE key per role. Everything else in each override — including
--     any page a user was deliberately granted — is left exactly as it was.
--   · Accountant is NOT touched. Richa's Dashboard was not marked "No Need",
--     and her override keeps it.
--   · Rows with allowed_pages IS NULL are skipped: they already follow the
--     role default, which denies both keys.
--
-- To reverse: re-tick the page for that user in Settings → Users. There is no
-- down migration because the matrix is the supported way to grant a page.

do $$
declare
  managers_fixed  int;
  staff_fixed     int;
  emptied         int;
begin
  -- Guard: never strip a user's LAST page. Removing it would leave
  -- defaultLandingPath() with nothing to return and bounce them straight to
  -- /auth/login?error=no_access on their next sign-in. If this ever reports a
  -- non-zero count, those users need looking at by hand rather than a silent
  -- lock-out.
  select count(*) into emptied
  from public.profiles
  where allowed_pages is not null
    and (
      (role = 'manager' and allowed_pages <@ array['dashboard']::text[])
      or (role = 'staff' and allowed_pages <@ array['vendors']::text[])
    );

  if emptied > 0 then
    raise notice '0141: skipped % profile(s) whose only remaining page would have been removed', emptied;
  end if;

  with updated as (
    update public.profiles
    set allowed_pages = array_remove(allowed_pages, 'dashboard')
    where role = 'manager'
      and allowed_pages is not null
      and 'dashboard' = any(allowed_pages)
      and not (allowed_pages <@ array['dashboard']::text[])
    returning 1
  )
  select count(*) into managers_fixed from updated;

  with updated as (
    update public.profiles
    set allowed_pages = array_remove(allowed_pages, 'vendors')
    where role = 'staff'
      and allowed_pages is not null
      and 'vendors' = any(allowed_pages)
      and not (allowed_pages <@ array['vendors']::text[])
    returning 1
  )
  select count(*) into staff_fixed from updated;

  raise notice '0141: revoked Dashboard from % manager override(s), Vendors from % staff override(s)',
    managers_fixed, staff_fixed;
end
$$;
