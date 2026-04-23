-- 0012_payroll.sql
-- Payroll module: employees, statutory rates, weekly pay cycles, entries,
-- management cash daily tracking, and payment records.
--
-- DEFAULT ASSUMPTIONS (confirm with owner before Phase 2 UAT):
--   * bonus: within EI/CPP base (standard CA treatment)
--   * misc_extra: outside EI/CPP base, income-tax liable
--   * management payroll has cheque_amount + a cash sub-table (daily)
--   * benefits: two columns (employee deduction + employer contribution)
--   * pay week: Monday start (app_settings.pay_week_start = 1)
--   * statutory rates: data-driven, seeded below for 2024 + 2025

-- ============================================================================
-- employees
-- ============================================================================
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  sin_last4 text,                              -- last 4 digits only — no full SIN stored
  hire_date date,
  termination_date date,
  payroll_type text not null default 'employee'
    check (payroll_type in ('employee', 'management')),
  default_hourly_rate numeric(10,4) not null default 0 check (default_hourly_rate >= 0),
  location_id uuid references public.locations(id),
  profile_id uuid references auth.users(id),   -- nullable — not all employees log in
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index if not exists idx_employees_location on public.employees(location_id);
create index if not exists idx_employees_active  on public.employees(active);

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

drop trigger if exists trg_employees_audit on public.employees;
create trigger trg_employees_audit
  after insert or update on public.employees
  for each row execute function public.audit_row();

alter table public.employees enable row level security;

-- ============================================================================
-- statutory_rates
-- Federal EI and CPP rates change annually. Owners/accountants manage this.
-- ============================================================================
create table if not exists public.statutory_rates (
  id uuid primary key default gen_random_uuid(),
  year smallint not null,
  type text not null check (type in (
    'ei_employee',
    'ei_employer_multiplier',
    'cpp_employee',
    'cpp2_employee'
  )),
  rate numeric(8,6) not null check (rate >= 0),
  annual_max_insurable numeric(12,2),     -- EI max insurable earnings
  annual_max_pensionable numeric(12,2),   -- CPP max pensionable earnings (tier 1)
  annual_max_pensionable2 numeric(12,2),  -- CPP2 upper limit
  basic_exemption numeric(12,2),          -- CPP basic annual exemption
  unique (year, type),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_statutory_rates_updated_at on public.statutory_rates;
create trigger trg_statutory_rates_updated_at
  before update on public.statutory_rates
  for each row execute function public.set_updated_at();

alter table public.statutory_rates enable row level security;

-- ============================================================================
-- payroll_weeks
-- ============================================================================
create table if not exists public.payroll_weeks (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  week_start date not null,                          -- always a Monday
  week_end date not null generated always as (week_start + 6) stored,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'paid')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint payroll_weeks_start_is_monday
    check (extract(isodow from week_start) = 1),
  unique (location_id, week_start)
);

create index if not exists idx_payroll_weeks_location on public.payroll_weeks(location_id, week_start desc);

drop trigger if exists trg_payroll_weeks_updated_at on public.payroll_weeks;
create trigger trg_payroll_weeks_updated_at
  before update on public.payroll_weeks
  for each row execute function public.set_updated_at();

drop trigger if exists trg_payroll_weeks_audit on public.payroll_weeks;
create trigger trg_payroll_weeks_audit
  after insert or update on public.payroll_weeks
  for each row execute function public.audit_row();

alter table public.payroll_weeks enable row level security;

-- ============================================================================
-- payroll_entries — one row per employee per pay week
-- ============================================================================
create table if not exists public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  payroll_week_id uuid not null references public.payroll_weeks(id) on delete restrict,
  employee_id uuid not null references public.employees(id),

  -- Compensation inputs
  hours numeric(6,2) not null default 0 check (hours >= 0),
  rate  numeric(10,4) not null default 0 check (rate >= 0),
  gross_wages numeric(12,2) not null default 0,  -- stored: hours × rate (trigger)

  -- Bonus: within EI/CPP base
  bonus numeric(12,2) not null default 0 check (bonus >= 0),

  -- Misc/extra: outside EI/CPP base but income-tax liable
  -- (e.g. reimbursements, tool allowance that are taxable)
  misc_extra numeric(12,2) not null default 0 check (misc_extra >= 0),

  -- Statutory deductions (filled by server action from statutory_rates)
  insurable_earnings numeric(12,2) not null default 0, -- gross_wages + bonus
  ei_employee        numeric(12,2) not null default 0,
  cpp_employee       numeric(12,2) not null default 0,
  income_tax         numeric(12,2) not null default 0,

  -- Benefits
  benefit_employee_deduction    numeric(12,2) not null default 0,
  benefit_employer_contribution numeric(12,2) not null default 0,

  -- Management-only
  -- cheque_amount: the formal cheque component of management pay
  -- (cash is tracked day-by-day in payroll_cash_daily)
  cheque_amount numeric(12,2) not null default 0 check (cheque_amount >= 0),

  -- Derived: total cash from payroll_cash_daily (maintained by trigger)
  cash_total numeric(12,2) not null default 0,

  -- Net pay (stored, recomputed by trigger)
  net_pay numeric(12,2) not null default 0,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),

  unique (payroll_week_id, employee_id)
);

create index if not exists idx_payroll_entries_week     on public.payroll_entries(payroll_week_id);
create index if not exists idx_payroll_entries_employee on public.payroll_entries(employee_id);

drop trigger if exists trg_payroll_entries_updated_at on public.payroll_entries;
create trigger trg_payroll_entries_updated_at
  before update on public.payroll_entries
  for each row execute function public.set_updated_at();

drop trigger if exists trg_payroll_entries_audit on public.payroll_entries;
create trigger trg_payroll_entries_audit
  after insert or update on public.payroll_entries
  for each row execute function public.audit_row();

alter table public.payroll_entries enable row level security;

-- ============================================================================
-- payroll_cash_daily — management cash entries per day
-- ============================================================================
create table if not exists public.payroll_cash_daily (
  id uuid primary key default gen_random_uuid(),
  payroll_entry_id uuid not null references public.payroll_entries(id) on delete cascade,
  day date not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (payroll_entry_id, day)
);

create index if not exists idx_cash_daily_entry on public.payroll_cash_daily(payroll_entry_id);

alter table public.payroll_cash_daily enable row level security;

-- Rollup cash_total → payroll_entries when daily rows change
create or replace function public.payroll_cash_daily_rollup()
returns trigger language plpgsql security definer
set search_path = public, pg_catalog as $$
declare v_entry_id uuid;
begin
  v_entry_id := coalesce(new.payroll_entry_id, old.payroll_entry_id);
  update public.payroll_entries
     set cash_total = (
       select coalesce(sum(amount), 0)
         from public.payroll_cash_daily
        where payroll_entry_id = v_entry_id
     )
   where id = v_entry_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_cash_daily_rollup on public.payroll_cash_daily;
create trigger trg_cash_daily_rollup
  after insert or update or delete on public.payroll_cash_daily
  for each row execute function public.payroll_cash_daily_rollup();

-- ============================================================================
-- payroll_payments — actual disbursement records
-- ============================================================================
create table if not exists public.payroll_payments (
  id uuid primary key default gen_random_uuid(),
  payroll_week_id uuid not null references public.payroll_weeks(id),
  employee_id uuid not null references public.employees(id),
  paid_on date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  mode payment_mode not null,
  transaction_id text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_payroll_payments_week on public.payroll_payments(payroll_week_id);
create index if not exists idx_payroll_payments_emp  on public.payroll_payments(employee_id);

alter table public.payroll_payments enable row level security;

-- ============================================================================
-- RLS — Payroll is sensitive. Only owner + accountant see all; manager sees
-- own location.  Employees never see payroll. Staff never see payroll.
-- ============================================================================

-- employees table
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select to authenticated
  using (
    private.current_role() in ('owner', 'accountant')
    or (private.current_role() = 'manager' and location_id = private.current_location())
  );
drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees for insert to authenticated
  with check (
    private.current_role() in ('owner', 'manager')
  );
drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees for update to authenticated
  using (private.current_role() in ('owner', 'manager'))
  with check (private.current_role() in ('owner', 'manager'));

-- statutory_rates
drop policy if exists statutory_rates_select on public.statutory_rates;
create policy statutory_rates_select on public.statutory_rates for select to authenticated
  using (private.current_role() in ('owner', 'accountant', 'manager'));
drop policy if exists statutory_rates_write_owner on public.statutory_rates;
create policy statutory_rates_write_owner on public.statutory_rates for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

-- payroll_weeks
drop policy if exists payroll_weeks_select on public.payroll_weeks;
create policy payroll_weeks_select on public.payroll_weeks for select to authenticated
  using (
    private.current_role() in ('owner', 'accountant')
    or (private.current_role() = 'manager' and location_id = private.current_location())
  );
drop policy if exists payroll_weeks_write on public.payroll_weeks;
create policy payroll_weeks_write on public.payroll_weeks for all to authenticated
  using (
    private.current_role() = 'owner'
    or (private.current_role() = 'manager' and location_id = private.current_location())
  )
  with check (
    private.current_role() = 'owner'
    or (private.current_role() = 'manager' and location_id = private.current_location())
  );

-- payroll_entries + payroll_cash_daily + payroll_payments — mirror week policy
drop policy if exists payroll_entries_select on public.payroll_entries;
create policy payroll_entries_select on public.payroll_entries for select to authenticated
  using (
    exists (
      select 1 from public.payroll_weeks pw
       where pw.id = payroll_entries.payroll_week_id
    )
  );  -- visible if the parent week is visible (RLS on payroll_weeks already gates it)

drop policy if exists payroll_entries_write on public.payroll_entries;
create policy payroll_entries_write on public.payroll_entries for all to authenticated
  using (
    exists (
      select 1 from public.payroll_weeks pw
       where pw.id = payroll_entries.payroll_week_id
         and pw.status = 'draft'
    )
  )
  with check (
    exists (
      select 1 from public.payroll_weeks pw
       where pw.id = payroll_entries.payroll_week_id
         and pw.status = 'draft'
    )
  );

drop policy if exists payroll_cash_daily_select on public.payroll_cash_daily;
create policy payroll_cash_daily_select on public.payroll_cash_daily for select to authenticated
  using (
    exists (select 1 from public.payroll_entries pe where pe.id = payroll_cash_daily.payroll_entry_id)
  );

drop policy if exists payroll_cash_daily_write on public.payroll_cash_daily;
create policy payroll_cash_daily_write on public.payroll_cash_daily for all to authenticated
  using (
    exists (
      select 1 from public.payroll_entries pe
        join public.payroll_weeks pw on pw.id = pe.payroll_week_id
       where pe.id = payroll_cash_daily.payroll_entry_id
         and pw.status = 'draft'
    )
  )
  with check (
    exists (
      select 1 from public.payroll_entries pe
        join public.payroll_weeks pw on pw.id = pe.payroll_week_id
       where pe.id = payroll_cash_daily.payroll_entry_id
         and pw.status = 'draft'
    )
  );

drop policy if exists payroll_payments_select on public.payroll_payments;
create policy payroll_payments_select on public.payroll_payments for select to authenticated
  using (
    exists (select 1 from public.payroll_weeks pw where pw.id = payroll_payments.payroll_week_id)
  );

drop policy if exists payroll_payments_write on public.payroll_payments;
create policy payroll_payments_write on public.payroll_payments for all to authenticated
  using (private.current_role() in ('owner', 'manager'))
  with check (private.current_role() in ('owner', 'manager'));

-- ============================================================================
-- Seed statutory rates — 2024 + 2025 federal rates
-- ============================================================================
insert into public.statutory_rates (year, type, rate, annual_max_insurable, annual_max_pensionable, annual_max_pensionable2, basic_exemption)
values
  -- 2024
  (2024, 'ei_employee',           0.016600, 63200.00, null,     null,     null),
  (2024, 'ei_employer_multiplier',1.400000, null,     null,     null,     null),
  (2024, 'cpp_employee',          0.059500, null,     68500.00, null,     3500.00),
  (2024, 'cpp2_employee',         0.040000, null,     null,     73200.00, null),
  -- 2025
  (2025, 'ei_employee',           0.016400, 65700.00, null,     null,     null),
  (2025, 'ei_employer_multiplier',1.400000, null,     null,     null,     null),
  (2025, 'cpp_employee',          0.059500, null,     71300.00, null,     3500.00),
  (2025, 'cpp2_employee',         0.040000, null,     null,     81900.00, null)
on conflict (year, type) do nothing;
