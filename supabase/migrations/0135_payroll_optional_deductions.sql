-- 0135_payroll_optional_deductions.sql
-- Client 2026-08-31: EI / CPP / CPP2 / income tax / vacation / WSIB must be
-- switchable per person, not applied to everyone unconditionally.
--
-- Real cases this covers in a family-run shop:
--   * non-arm's-length employees (owner's spouse, children) are EI-exempt;
--   * an employee under 18 or over 70, or one who filed a CPT30, is CPP-exempt
--     (and therefore CPP2-exempt with it);
--   * a subcontractor-style payee on the register with no source deductions;
--   * vacation paid out each cheque instead of accrued;
--   * a worker not covered by the shop's WSIB account.
--
-- Two levels, both defaulting to TRUE so nothing changes for existing rows:
--   employees.*       — the person's normal treatment, used to seed a new entry
--   payroll_entries.* — what actually drives the math for THIS pay period, so a
--                       one-off (e.g. a cheque with no tax withheld) never has
--                       to be fixed on the employee record afterwards.
--
-- The math lives in lib/actions/payroll.ts (buildEntryPayload): a false flag
-- zeroes the employee-side amount AND the matching employer-side amount — an
-- EI-exempt employee costs the employer no employer EI either.

-- ============================================================================
-- employees — payroll defaults for new entries
-- ============================================================================
alter table public.employees
  add column if not exists apply_ei          boolean not null default true,
  add column if not exists apply_cpp         boolean not null default true,
  add column if not exists apply_cpp2        boolean not null default true,
  add column if not exists apply_income_tax  boolean not null default true,
  add column if not exists apply_vacation    boolean not null default true,
  add column if not exists apply_wsib        boolean not null default true;

comment on column public.employees.apply_ei is
  'Default for new payroll entries: deduct employee EI (and pay employer EI).';
comment on column public.employees.apply_cpp is
  'Default for new payroll entries: deduct CPP tier 1. Off also disables CPP2.';
comment on column public.employees.apply_cpp2 is
  'Default for new payroll entries: deduct CPP tier 2 (earnings above YMPE).';
comment on column public.employees.apply_income_tax is
  'Default for new payroll entries: withhold income tax.';
comment on column public.employees.apply_vacation is
  'Default for new payroll entries: accrue vacation pay at the shop rate.';
comment on column public.employees.apply_wsib is
  'Default for new payroll entries: charge employer WSIB premium.';

-- ============================================================================
-- payroll_entries — what applies to this pay period
-- ============================================================================
alter table public.payroll_entries
  add column if not exists apply_ei          boolean not null default true,
  add column if not exists apply_cpp         boolean not null default true,
  add column if not exists apply_cpp2        boolean not null default true,
  add column if not exists apply_income_tax  boolean not null default true,
  add column if not exists apply_vacation    boolean not null default true,
  add column if not exists apply_wsib        boolean not null default true;

comment on column public.payroll_entries.apply_ei is
  'When false, ei_employee and ei_employer are forced to 0 for this entry.';
comment on column public.payroll_entries.apply_cpp is
  'When false, cpp_employee/cpp_employer are 0 — and CPP2 with them, since a CPP-exempt employee is CPP2-exempt.';
comment on column public.payroll_entries.apply_cpp2 is
  'When false, cpp_employee2 and cpp_employer2 are forced to 0 for this entry.';
comment on column public.payroll_entries.apply_income_tax is
  'When false, income_tax is stored as 0 regardless of what was typed.';
comment on column public.payroll_entries.apply_vacation is
  'When false, vacation_pay accrues 0 for this entry (e.g. vacation paid out each cheque).';
comment on column public.payroll_entries.apply_wsib is
  'When false, wsib_employer is 0 for this entry.';
