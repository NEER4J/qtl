-- 0168_parts_permission.sql
--
-- Parts can be given to a parts manager (client voice note 2026-11-24: "the
-- part manager needs a permission so parts are visible to them and they can
-- edit"). Pricing Catalogue > Parts stays Admin-only by default; the Admin
-- grants it per user in Settings > Users > permissions (the page plus its
-- Update right).
--
-- parts_write (0015) allowed owner only (co_owner via the 0124 alias). It now
-- also allows a signed-in user whose profile holds the page
-- 'settings_pricing_parts' in allowed_pages AND 'settings_pricing_parts.update'
-- in allowed_actions — the same keys the app checks (lib/permissions). The
-- permissions matrix saves both lists together, so a granted user always has
-- them stored.
--
-- Needs private.has_action from 0165.

create or replace function private.has_page(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select p_key = any(coalesce(p.allowed_pages, array[]::text[]))
       from public.profiles p
      where p.id = auth.uid() and p.active = true),
    false
  );
$$;

revoke all on function private.has_page(text) from public;
grant execute on function private.has_page(text) to authenticated;

drop policy if exists parts_write on public.parts;
create policy parts_write on public.parts for all to authenticated
  using (
    private.current_role() = 'owner'
    or (private.has_page('settings_pricing_parts')
        and private.has_action('settings_pricing_parts.update'))
  )
  with check (
    private.current_role() = 'owner'
    or (private.has_page('settings_pricing_parts')
        and private.has_action('settings_pricing_parts.update'))
  );
