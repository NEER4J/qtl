-- 0018_profiles_guard_service_role.sql
-- Let service_role writes bypass the profiles_guard trigger.
--
-- Bug: inviteUser() in the app calls the Supabase admin API (service_role)
-- to patch a freshly-invited profile's role + location. Service_role bypasses
-- RLS but NOT triggers, and auth.uid() is NULL in that context, so
-- private.current_role() returns NULL, the guard's "distinct from 'owner'"
-- branch fires, and the update is rejected with 42501.
--
-- The guard's real intent is to stop authenticated end-users from
-- self-promoting. Service_role callers are already trusted at the app layer
-- (inviteUser is gated by `roles: ["owner"]` in wrapAction), so skipping the
-- guard for service_role is safe and matches the policy intent.

create or replace function public.profiles_guard()
returns trigger
language plpgsql
as $$
begin
  -- Service_role or direct DB session (no JWT) — let it through.
  -- End-user requests always have a JWT, so auth.uid() is set.
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
  end if;
  return new;
end;
$$;
