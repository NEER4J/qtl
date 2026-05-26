-- 0065_technicians_roster.sql
--
-- Client roster (2026-05-22) — names that get assigned to Upper tech / Lower
-- tech / Advisor on a sales job. These people are NOT login users; the table
-- is just a curated list to feed the dropdowns on the job form. Existing
-- sales_jobs.upper_tech / lower_tech stay text and aren't FK'd here, so any
-- legacy free-text values keep working as-is.

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  -- Free-text role label ("Technician", "Front Counter", "Manager",
  -- "Accounts Payable", …). Shown next to the name in dropdowns; no
  -- behavioural meaning beyond that.
  role text,
  sort_order int not null default 100,
  active boolean not null default true,
  deactivated_at timestamptz,
  deactivated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

-- Case-insensitive uniqueness across active rows only. Deactivated rows can
-- keep their old name so reactivation / rename doesn't trip the constraint.
create unique index if not exists technicians_name_uniq
  on public.technicians (lower(name)) where active;

create index if not exists technicians_sort_idx
  on public.technicians (sort_order, name) where active;

drop trigger if exists trg_technicians_updated_at on public.technicians;
create trigger trg_technicians_updated_at
  before update on public.technicians
  for each row execute function public.set_updated_at();

drop trigger if exists trg_technicians_audit on public.technicians;
create trigger trg_technicians_audit
  after insert or update or delete on public.technicians
  for each row execute function public.audit_row();

alter table public.technicians enable row level security;

drop policy if exists technicians_select on public.technicians;
create policy technicians_select on public.technicians
  for select to authenticated using (true);

drop policy if exists technicians_write on public.technicians;
create policy technicians_write on public.technicians
  for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

-- ============================================================================
-- Seed — initial roster supplied 2026-05-22. NOT EXISTS guards against
-- re-running the migration: if a name is already on the active roster it
-- isn't reinserted. Owners can still rename / deactivate via the settings UI.
-- ============================================================================
insert into public.technicians (name, role, sort_order)
select v.name, v.role, v.sort_order
  from (values
    ('Amit',       'Technician',            100),
    ('Baldev',     'Technician',            110),
    ('Charandeep', 'Technician',            120),
    ('Deepak',     'Technician',            130),
    ('Donald',     'Technician',            140),
    ('Gurpreet',   'Technician',            150),
    ('Karanveer',  'Technician',            160),
    ('Kihyuk',     'Technician',            170),
    ('Manjot',     'Technician',            180),
    ('Satvir',     'Technician',            190),
    ('Erica',      'Front Counter',         200),
    ('Marina',     'Front Counter',         210),
    ('Jaimie',     'Manager/Front Counter', 220),
    ('Richa',      'Accounts Payable',      230)
  ) as v(name, role, sort_order)
 where not exists (
   select 1 from public.technicians t
    where lower(t.name) = lower(v.name) and t.active
 );
