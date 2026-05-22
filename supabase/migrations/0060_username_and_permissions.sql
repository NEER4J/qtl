-- 0060_username_and_permissions.sql
--
-- Two related additions:
--
-- 1. USERNAME LOGIN for team members. Supabase Auth's primary identifier is
--    email, so we keep that working under the hood. Owner / accountant still
--    use their real email. Manager / staff / employee instead pick a username;
--    the app stores a synthetic email of the form `<username>@team.qtl.app`
--    in auth.users so signInWithPassword keeps working without changes.
--    `profiles.username` mirrors that username for display + lookup.
--
--    An anon-callable RPC `public.auth_email_for_username(text)` resolves a
--    username to its underlying auth email so the login form can call
--    Supabase Auth without leaking that domain trick into client code.
--
-- 2. PER-USER PAGE/COLUMN PERMISSIONS. Roles are still the source of defaults
--    (see lib/permissions/registry.ts), and the owner can override per user:
--      - profiles.allowed_pages  text[] | null   NULL = use role default.
--      - profiles.hidden_columns jsonb           { pageKey: [colKey, ...] }.
--    Owner role bypasses both checks at the application layer; the schema is
--    permissive (no DB-side enforcement) per the agreed UI-hide approach.

-- ----------------------------------------------------------------------------
-- 0. Defensive: drop the legacy profiles_role_location_chk constraint.
--    Migration 0017 was meant to remove it, but environments that diverged
--    before that ran (or that re-applied 0002 manually) can still have it.
--    The constraint rejects every role='staff' insert with location_id=null,
--    which is exactly what handle_new_auth_user does for new team-member
--    signups — so leaving it on breaks every Add user call.
-- ----------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_role_location_chk;

-- ----------------------------------------------------------------------------
-- 1. profiles: new columns
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists username citext;

-- citext + unique partial index so null usernames don't collide.
create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

alter table public.profiles
  add column if not exists allowed_pages text[];

alter table public.profiles
  add column if not exists hidden_columns jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- 2. Guard: only owner can change permission columns (matches existing
--    profiles_guard policy for role / location). Service-role bypasses
--    (auth.uid() is null) as in 0018.
-- ----------------------------------------------------------------------------
create or replace function public.profiles_guard()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (old.role is distinct from new.role)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change profile role'
        using errcode = '42501';
    end if;

    if (old.location_id is distinct from new.location_id)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change profile location'
        using errcode = '42501';
    end if;

    if (old.can_enter_expenses is distinct from new.can_enter_expenses)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can toggle can_enter_expenses'
        using errcode = '42501';
    end if;

    if (old.active is distinct from new.active)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change profile active status'
        using errcode = '42501';
    end if;

    if (old.username is distinct from new.username)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change username'
        using errcode = '42501';
    end if;

    if (old.allowed_pages is distinct from new.allowed_pages
        or old.hidden_columns is distinct from new.hidden_columns)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change permission overrides'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. RPC: resolve a username to its synthetic auth email.
--    SECURITY DEFINER + locked search_path so anon can call it during login
--    without granting SELECT on profiles. Returns null for unknown usernames.
-- ----------------------------------------------------------------------------
create or replace function public.auth_email_for_username(p_username text)
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select email
    from public.profiles
   where username = p_username
     and active = true
   limit 1;
$$;

revoke all on function public.auth_email_for_username(text) from public;
grant execute on function public.auth_email_for_username(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Auto-update the signup trigger to also copy username from raw_user_meta_data
--    so admin-created users (inviteUser) keep DB + app in sync if the trigger
--    fires before the explicit profile upsert.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_full_name text;
  v_username  text;
  v_role user_role := 'staff';
  v_active boolean := true;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  v_username := nullif(new.raw_user_meta_data->>'username', '');

  if not exists (select 1 from public.profiles) then
    v_role := 'owner';
  end if;

  insert into public.profiles (id, email, full_name, username, role, active)
    values (new.id, new.email, v_full_name, v_username, v_role, v_active)
  on conflict (id) do update
    set email = excluded.email,
        active = true;

  return new;
end;
$$;
