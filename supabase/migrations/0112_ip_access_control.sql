-- 0112_ip_access_control.sql
--
-- IP lock — restrict the platform to a set of approved networks (the shops'
-- office / wifi IPs), so a leaked password on its own isn't enough to sign in
-- from anywhere in the world.
--
--   * app_settings.ip_lock_enabled  — master switch, OFF by default.
--   * public.ip_allowlist           — the approved addresses / CIDR ranges.
--   * public.check_ip_access(text)  — a single-round-trip verdict, called by
--                                     the Next.js middleware on every request.
--
-- Two deliberate escape hatches so a bad rule can never brick the business:
--   1. The Admin (co_owner) is ALWAYS exempt. They're the only role that can
--      reach /settings/ip-access to fix a bad rule, so locking them out would
--      be unrecoverable without DB access.
--   2. "Enabled with zero active rules" is treated as not-configured-yet and
--      allows everyone, rather than locking out the entire company.

-- ============================================================================
-- app_settings — master switch
-- ============================================================================
alter table public.app_settings
  add column if not exists ip_lock_enabled boolean not null default false;

-- ============================================================================
-- ip_allowlist
-- ============================================================================
create table if not exists public.ip_allowlist (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  -- `cidr` covers a single address (203.0.113.7/32) and a whole range
  -- (203.0.113.0/24) with the same `>>=` containment operator, IPv6 included.
  network cidr not null,
  -- Purely organisational: which shop this address belongs to. Access is NOT
  -- scoped by it — any allowed address lets any permitted user in.
  location_id uuid references public.locations(id) on delete set null,
  note text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_ip_allowlist_network
  on public.ip_allowlist(network);
create index if not exists idx_ip_allowlist_active
  on public.ip_allowlist(active) where active;

drop trigger if exists trg_ip_allowlist_updated_at on public.ip_allowlist;
create trigger trg_ip_allowlist_updated_at
  before update on public.ip_allowlist
  for each row execute function public.set_updated_at();

drop trigger if exists trg_ip_allowlist_audit on public.ip_allowlist;
create trigger trg_ip_allowlist_audit
  after insert or update or delete on public.ip_allowlist
  for each row execute function public.audit_row();

alter table public.ip_allowlist enable row level security;

-- Per the note in 0067 §3, a table that turns on RLS after that migration must
-- add its own owner/co_owner policy.
drop policy if exists ip_allowlist_co_owner_all on public.ip_allowlist;
create policy ip_allowlist_co_owner_all on public.ip_allowlist
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

-- ============================================================================
-- check_ip_access(p_ip) — the verdict the middleware asks for
-- ============================================================================
-- Returns {enforced, allowed, role}. `enforced` tells the caller whether the
-- lock is even on (so the UI can explain itself); `allowed` is the decision.
-- SECURITY DEFINER because ordinary roles cannot read ip_allowlist.
create or replace function public.check_ip_access(p_ip text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_role    text;
  v_enabled boolean;
  v_rules   integer;
  v_addr    inet;
  v_match   boolean;
begin
  select role::text into v_role
    from public.profiles
   where id = auth.uid() and active = true;

  -- Not signed in / no profile / disabled account: nothing for this function
  -- to decide — the middleware's own auth redirect already handles it.
  if v_role is null then
    return jsonb_build_object('enforced', false, 'allowed', true, 'role', null);
  end if;

  select ip_lock_enabled into v_enabled from public.app_settings where id = 1;
  v_enabled := coalesce(v_enabled, false);

  select count(*) into v_rules from public.ip_allowlist where active;

  -- Escape hatches (see header) + portal customers, who are external and were
  -- never expected to sit on a shop network.
  if not v_enabled
     or v_rules = 0
     or v_role in ('co_owner', 'portal_customer') then
    return jsonb_build_object('enforced', v_enabled, 'allowed', true, 'role', v_role);
  end if;

  begin
    v_addr := p_ip::inet;
  exception when others then
    v_addr := null;
  end;

  -- No usable client IP while the lock is on → deny. Letting an unknown
  -- address through would make the whole feature bypassable behind any proxy
  -- that strips the forwarding headers.
  if v_addr is null then
    return jsonb_build_object('enforced', true, 'allowed', false, 'role', v_role);
  end if;

  select exists (
    select 1 from public.ip_allowlist
     where active and network >>= v_addr
  ) into v_match;

  return jsonb_build_object('enforced', true, 'allowed', v_match, 'role', v_role);
end;
$$;

grant execute on function public.check_ip_access(text) to authenticated;
