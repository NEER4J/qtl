-- 0010_profiles_role_guard.sql
-- Enforce matrix rule: only owner may change profiles.role or profiles.location_id.
-- profiles_update_self lets a user update their own row (name, email, etc.),
-- but they must not be able to promote themselves.

create or replace function public.profiles_guard()
returns trigger
language plpgsql
as $$
begin
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

    -- Active flag — owner only. Self-deactivation is a footgun.
    if (old.active is distinct from new.active)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change profile active status'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();
