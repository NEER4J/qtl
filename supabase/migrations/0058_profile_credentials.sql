-- 0058_profile_credentials.sql
--
-- Owner-only plaintext storage of the LAST password the owner set for each user.
--
-- WHY: The owner runs an in-shop staff list and wants to be able to look up
-- "what's Bob's password?" without having to phone Bob. Supabase Auth itself
-- only stores the bcrypt hash (one-way) so we can't read the actual password
-- back from there — we store a separate plaintext copy here, written every
-- time the owner sets/resets a password via `setUserPassword` or `inviteUser`.
--
-- SECURITY: This table holds plaintext credentials. It is locked down hard:
--   * Separate from `profiles` so a stray SELECT on profiles can't leak it.
--   * RLS: only the `owner` role can read/write. Even the user themselves
--     cannot SELECT their own row here.
--   * If a user changes their own password via the forgot-password flow, this
--     column will become stale (the auth.users hash updates, this doesn't).
--     The "Last set" timestamp surfaces that ambiguity in the UI.

create table if not exists public.profile_credentials (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  password_plain text not null check (length(password_plain) >= 6),
  set_at timestamptz not null default now(),
  set_by uuid references auth.users(id)
);

drop trigger if exists trg_profile_credentials_set_at on public.profile_credentials;
create or replace function public.set_profile_credentials_set_at()
returns trigger language plpgsql as $$
begin
  new.set_at := now();
  return new;
end$$;
create trigger trg_profile_credentials_set_at
  before update on public.profile_credentials
  for each row execute function public.set_profile_credentials_set_at();

drop trigger if exists trg_profile_credentials_audit on public.profile_credentials;
create trigger trg_profile_credentials_audit
  after insert or update or delete on public.profile_credentials
  for each row execute function public.audit_row();

alter table public.profile_credentials enable row level security;

-- Owners can do anything. Nobody else gets SELECT — not even the user
-- themselves (they can change their own password via the auth flow which
-- doesn't touch this table).
drop policy if exists profile_credentials_owner_all on public.profile_credentials;
create policy profile_credentials_owner_all on public.profile_credentials
  for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');
