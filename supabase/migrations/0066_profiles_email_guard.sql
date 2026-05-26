-- 0066_profiles_email_guard.sql
--
-- Tighten the profiles_guard trigger so the `email` column joins the list of
-- owner-only fields.
--
-- WHY: The `profiles_update_self` policy from 0007 grants UPDATE on any column
-- of a user's own row, leaving column-level enforcement to this trigger. The
-- trigger guards role/location/can_enter_expenses/active/username/
-- allowed_pages/hidden_columns/cross_location (per 0060 + 0061) but NOT
-- `email`. A signed-in non-owner could rewrite `profiles.email` to a value
-- that no longer matches `auth.users.email`, which breaks the email vs.
-- username login resolution in lib/auth/auth-context.tsx and would corrupt
-- the synthetic-email convention used for team logins (see 0060).
--
-- This adds a single new branch to the existing trigger. All other branches
-- are preserved verbatim from 0061. Service_role + direct-DB sessions still
-- bypass (auth.uid() is null) as in 0018.

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
      raise exception 'Only owner can change profile role' using errcode = '42501';
    end if;
    if (old.location_id is distinct from new.location_id)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change profile location' using errcode = '42501';
    end if;
    if (old.can_enter_expenses is distinct from new.can_enter_expenses)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can toggle can_enter_expenses' using errcode = '42501';
    end if;
    if (old.active is distinct from new.active)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change profile active status' using errcode = '42501';
    end if;
    if (old.username is distinct from new.username)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change username' using errcode = '42501';
    end if;
    if (old.allowed_pages is distinct from new.allowed_pages
        or old.hidden_columns is distinct from new.hidden_columns)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change permission overrides' using errcode = '42501';
    end if;
    if (old.cross_location is distinct from new.cross_location)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change cross-location flag' using errcode = '42501';
    end if;
    if (old.email is distinct from new.email)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change profile email' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
