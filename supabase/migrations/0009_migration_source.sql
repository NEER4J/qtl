-- 0009_migration_source.sql
-- Idempotency table for the scripts/migrate importer. Each Excel row is hashed
-- and tracked by (source_file, row_hash) so reruns skip already-imported rows.
--
-- Only service_role writes here (the migrate script bypasses RLS). Owners can
-- read to see what was imported; no one else has visibility.

create table if not exists public.migration_source (
  source_file  text not null,
  row_hash     text not null,
  target_table text not null,
  target_id    text not null,
  imported_at  timestamptz not null default now(),
  imported_by  uuid references auth.users(id),
  primary key (source_file, row_hash)
);

create index if not exists idx_migration_source_target
  on public.migration_source (target_table, target_id);

alter table public.migration_source enable row level security;

drop policy if exists migration_source_select_owner on public.migration_source;
create policy migration_source_select_owner on public.migration_source
  for select to authenticated
  using (private.current_role() = 'owner');

-- No INSERT/UPDATE/DELETE policies — service_role bypasses RLS, and no UI
-- should ever mutate this table.
