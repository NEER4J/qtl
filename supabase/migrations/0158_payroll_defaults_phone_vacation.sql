-- 0158_payroll_defaults_phone_vacation.sql
-- Payroll requests from the client (2026-10-20):
--   27. a "Phone allowance" column on payroll
--   28. a vacation-percentage override per employee
--   29. default wages / bonus / deductions on the employee, so a new payroll
--       entry fills itself in instead of being typed every week
--   30. payroll payments fully editable (and audited like the rest of payroll)
--   31. a proper pay stub — needs a pay date for the whole week
--
-- Everything is additive and nullable (or defaulted), so the app keeps working
-- on rows written before this runs. The app also retries without these
-- columns when they are missing, so it can ship ahead of this migration.
-- Requires 0152 (payroll_entries.cheque_no / pay_date) — get_my_pay reads both.

-- ============================================================================
-- payroll_entries — phone allowance + the vacation rate actually used
-- (client 2026-10-20)
-- ============================================================================
-- Phone allowance is a taxable, insurable cash allowance (the owner's call):
-- it counts in gross, insurable earnings (EI / CPP / WSIB) and net pay, but
-- NOT in the vacation-pay base, which stays wages + OT + bonus + holiday.
alter table public.payroll_entries
  add column if not exists phone_allowance numeric(10,2) not null default 0,
  add column if not exists vacation_rate numeric(6,4);

alter table public.payroll_entries drop constraint if exists payroll_entries_phone_allowance_check;
alter table public.payroll_entries
  add constraint payroll_entries_phone_allowance_check check (phone_allowance >= 0);

-- Snapshot of the rate vacation_pay was calculated at, so re-saving an old
-- entry after the shop rate or the employee's override changes keeps its
-- figure. NULL on entries saved before this migration.
alter table public.payroll_entries drop constraint if exists payroll_entries_vacation_rate_check;
alter table public.payroll_entries
  add constraint payroll_entries_vacation_rate_check
    check (vacation_rate is null or (vacation_rate >= 0 and vacation_rate <= 1));

comment on column public.payroll_entries.phone_allowance is
  'Phone allowance paid this period. Taxable and insurable: in gross, insurable earnings and net pay, not in the vacation base (0158).';
comment on column public.payroll_entries.vacation_rate is
  'Vacation rate (fraction) vacation_pay was calculated at. NULL on entries saved before 0158.';

-- ============================================================================
-- employees — vacation override + pay defaults that pre-fill a new entry
-- (client 2026-10-20)
-- ============================================================================
-- All nullable: NULL means "no default", and the entry starts at 0 as before.
-- vacation_pay_rate NULL means "use app_settings.vacation_pay_rate".
alter table public.employees
  add column if not exists vacation_pay_rate numeric(6,4),
  add column if not exists default_hours numeric(8,2),
  add column if not exists default_overtime_hours numeric(8,2),
  add column if not exists default_bonus numeric(10,2),
  add column if not exists default_phone_allowance numeric(10,2),
  add column if not exists default_misc_extra numeric(10,2),
  add column if not exists default_income_tax numeric(10,2),
  add column if not exists default_benefit_employee_deduction numeric(10,2),
  add column if not exists default_benefit_employer_contribution numeric(10,2);

alter table public.employees drop constraint if exists employees_vacation_pay_rate_check;
alter table public.employees
  add constraint employees_vacation_pay_rate_check
    check (vacation_pay_rate is null or (vacation_pay_rate >= 0 and vacation_pay_rate <= 1));

alter table public.employees drop constraint if exists employees_pay_defaults_check;
alter table public.employees
  add constraint employees_pay_defaults_check check (
        coalesce(default_hours, 0) >= 0
    and coalesce(default_overtime_hours, 0) >= 0
    and coalesce(default_bonus, 0) >= 0
    and coalesce(default_phone_allowance, 0) >= 0
    and coalesce(default_misc_extra, 0) >= 0
    and coalesce(default_income_tax, 0) >= 0
    and coalesce(default_benefit_employee_deduction, 0) >= 0
    and coalesce(default_benefit_employer_contribution, 0) >= 0
  );

comment on column public.employees.vacation_pay_rate is
  'Per-employee vacation pay rate (fraction, 0.06 = 6%). NULL = use app_settings.vacation_pay_rate (0158).';

-- ============================================================================
-- payroll_weeks — the week's pay date, printed on every stub (client 2026-10-20)
-- ============================================================================
-- An entry's own pay_date (0152) still wins; this is the default for everyone
-- on the week so it doesn't have to be typed on each entry.
alter table public.payroll_weeks
  add column if not exists pay_date date;

comment on column public.payroll_weeks.pay_date is
  'Default pay date for everyone on this week. payroll_entries.pay_date overrides it per employee (0158).';

-- ============================================================================
-- payroll_payments — editable like the rest of payroll (client 2026-10-20)
-- ============================================================================
-- updated_at is backfilled from created_at only when the column is first
-- added (before any trigger below exists), so a re-run never rewrites rows.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'payroll_payments'
       and column_name = 'updated_at'
  ) then
    alter table public.payroll_payments add column updated_at timestamptz;
    update public.payroll_payments set updated_at = created_at;
    alter table public.payroll_payments
      alter column updated_at set default now(),
      alter column updated_at set not null;
  end if;
end $$;

alter table public.payroll_payments
  add column if not exists updated_by uuid references auth.users(id);

drop trigger if exists trg_payroll_payments_updated_at on public.payroll_payments;
create trigger trg_payroll_payments_updated_at
  before update on public.payroll_payments
  for each row execute function public.set_updated_at();

-- Payments had no audit trigger at all. Deletes are audited too (the newer
-- pattern, 0090 / 0112): a payment removed by mistake must leave a trace.
drop trigger if exists trg_payroll_payments_audit on public.payroll_payments;
create trigger trg_payroll_payments_audit
  after insert or update or delete on public.payroll_payments
  for each row execute function public.audit_row();

-- The TXN- reference fill (0019) also runs on UPDATE, so blanking the
-- reference while editing a payment issues a new number instead of leaving it
-- NULL. (The app itself keeps the old reference when the box is left blank.)
drop trigger if exists trg_payroll_payments_fill_txn on public.payroll_payments;
create trigger trg_payroll_payments_fill_txn
  before insert or update of transaction_id on public.payroll_payments
  for each row execute function public.fill_transaction_id();

-- ============================================================================
-- get_my_pay() — adds phone allowance, the pay date and the cheque number
-- (client 2026-10-20). The return type changes, so it is dropped and
-- recreated; body and caller filter are 0094's.
-- ============================================================================
drop function if exists public.get_my_pay();

create function public.get_my_pay()
returns table (
  week_id uuid,
  week_start date,
  week_end date,
  status text,
  location_name text,
  gross_wages numeric,
  overtime_wages numeric,
  bonus numeric,
  holiday_pay numeric,
  misc_extra numeric,
  phone_allowance numeric,
  ei_employee numeric,
  cpp_employee numeric,
  cpp_employee2 numeric,
  income_tax numeric,
  benefit_employee_deduction numeric,
  vacation_pay numeric,
  cash_total numeric,
  net_pay numeric,
  paid numeric,
  pay_date date,
  cheque_no text
)
language sql
security definer
set search_path = public
as $$
  select
    pw.id,
    pw.week_start,
    pw.week_end,
    pw.status,
    loc.name,
    pe.gross_wages,
    pe.overtime_wages,
    pe.bonus,
    pe.holiday_pay,
    pe.misc_extra,
    pe.phone_allowance,
    pe.ei_employee,
    pe.cpp_employee,
    pe.cpp_employee2,
    pe.income_tax,
    pe.benefit_employee_deduction,
    pe.vacation_pay,
    pe.cash_total,
    pe.net_pay,
    coalesce((
      select sum(pp.amount)
        from public.payroll_payments pp
       where pp.payroll_week_id = pw.id
         and pp.employee_id = pe.employee_id
    ), 0) as paid,
    coalesce(pe.pay_date, pw.pay_date) as pay_date,
    pe.cheque_no
  from public.payroll_entries pe
  join public.payroll_weeks pw on pw.id = pe.payroll_week_id
  join public.employees e      on e.id = pe.employee_id
  left join public.locations loc on loc.id = pw.location_id
  where e.profile_id = auth.uid()
  order by pw.week_start desc;
$$;

revoke all on function public.get_my_pay() from public;
grant execute on function public.get_my_pay() to authenticated;
