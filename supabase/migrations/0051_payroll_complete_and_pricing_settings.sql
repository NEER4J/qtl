-- 0051_payroll_complete_and_pricing_settings.sql
--
-- Two unrelated extensions bundled into one migration:
--
-- A) Pricing — extra app_settings fields used by the new "All Filter Sell
--    Price" page so the owner can tune the over-counter premium and the flat
--    customer-supplies labour without editing code.
--
-- B) Payroll — the original 0012 migration covered employee EI/CPP and net
--    pay, but Canadian payroll also tracks employer EI/CPP, CPP2 (tier 2),
--    vacation pay accrual, holiday pay, overtime, and WSIB. Adding those
--    columns here so the owner/accountant can produce a real T4-grade pay
--    stub and the analytics page can report total cost of labour.

-- ============================================================================
-- A) app_settings extensions
-- ============================================================================
alter table public.app_settings
  add column if not exists counter_premium numeric(10,2) not null default 10
    check (counter_premium >= 0),
  add column if not exists customer_supplies_labour numeric(10,2) not null default 20
    check (customer_supplies_labour >= 0),
  add column if not exists vacation_pay_rate numeric(6,4) not null default 0.04
    check (vacation_pay_rate >= 0 and vacation_pay_rate <= 1),
  add column if not exists wsib_rate numeric(6,4) not null default 0
    check (wsib_rate >= 0 and wsib_rate <= 1),
  add column if not exists price_list_effective_date date;

-- ============================================================================
-- B) statutory_rates — add 2026 federal rates so the engine can compute
--    entries for the current pay year.
-- ============================================================================
insert into public.statutory_rates (year, type, rate, annual_max_insurable, annual_max_pensionable, annual_max_pensionable2, basic_exemption)
values
  (2026, 'ei_employee',            0.016400, 67200.00, null,     null,     null),
  (2026, 'ei_employer_multiplier', 1.400000, null,     null,     null,     null),
  (2026, 'cpp_employee',           0.059500, null,     73200.00, null,     3500.00),
  (2026, 'cpp2_employee',          0.040000, null,     null,     84200.00, null)
on conflict (year, type) do nothing;

-- ============================================================================
-- C) payroll_entries — new columns
-- ============================================================================
alter table public.payroll_entries
  -- Overtime — kept separate so analytics can break out OT cost.
  add column if not exists overtime_hours numeric(6,2) not null default 0
    check (overtime_hours >= 0),
  add column if not exists overtime_rate  numeric(10,4) not null default 0
    check (overtime_rate >= 0),
  add column if not exists overtime_wages numeric(12,2) not null default 0,

  -- Statutory holiday pay (entered manually — varies by province + service
  -- length, so the app doesn't auto-compute).
  add column if not exists holiday_pay numeric(12,2) not null default 0
    check (holiday_pay >= 0),

  -- Vacation pay (accrued % of gross — default 4%, configurable in
  -- app_settings.vacation_pay_rate). Server action persists the computed
  -- value so historical totals stay correct if the rate changes later.
  add column if not exists vacation_pay numeric(12,2) not null default 0
    check (vacation_pay >= 0),

  -- Employer EI = ei_employee × ei_employer_multiplier (typically 1.4×).
  add column if not exists ei_employer numeric(12,2) not null default 0
    check (ei_employer >= 0),

  -- CPP2 (Canada Pension Plan tier 2 — applies to earnings between the YMPE
  -- and the YAMPE). Employer matches 1:1 for both tier 1 and tier 2.
  add column if not exists cpp_employee2 numeric(12,2) not null default 0
    check (cpp_employee2 >= 0),
  add column if not exists cpp_employer  numeric(12,2) not null default 0
    check (cpp_employer  >= 0),
  add column if not exists cpp_employer2 numeric(12,2) not null default 0
    check (cpp_employer2 >= 0),

  -- WSIB (Ontario) — employer-only safety contribution. Rate stored on
  -- app_settings; per-entry amount persisted on the row.
  add column if not exists wsib_employer numeric(12,2) not null default 0
    check (wsib_employer >= 0);
