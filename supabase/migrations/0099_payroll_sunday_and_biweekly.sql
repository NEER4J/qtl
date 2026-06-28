-- 0099_payroll_sunday_and_biweekly.sql
-- Payroll weeks now START ON SUNDAY (was Monday) and support a BI-WEEKLY
-- (2-week) period, so an employee can be paid twice a month. (client 2026-06-28)
--   * period_weeks: 1 = weekly (Sun–Sat), 2 = bi-weekly (Sun–second Sat).
--   * week_end is regenerated to span the period.
--   * The Monday-start constraint is dropped; a Sunday-start check is added
--     NOT VALID so existing (Monday) weeks stay valid and only new/edited rows
--     must start on a Sunday. The app also snaps the picked date to Sunday.

alter table public.payroll_weeks
  add column if not exists period_weeks smallint not null default 1
    check (period_weeks in (1, 2));

-- week_end is a generated column → can't ALTER its expression; drop & re-add so
-- it spans the chosen period. (get_my_pay() resolves week_end at runtime, so it
-- keeps working; no view depends on this column.)
alter table public.payroll_weeks drop column if exists week_end;
alter table public.payroll_weeks
  add column week_end date not null
    generated always as (week_start + (period_weeks * 7 - 1)) stored;

-- Start day: Monday → Sunday. Drop the old check; add the Sunday check NOT VALID
-- so historical Monday weeks are not rejected, but new rows must be Sunday
-- (extract(dow ...) = 0).
alter table public.payroll_weeks drop constraint if exists payroll_weeks_start_is_monday;
alter table public.payroll_weeks drop constraint if exists payroll_weeks_start_is_sunday;
alter table public.payroll_weeks
  add constraint payroll_weeks_start_is_sunday
    check (extract(dow from week_start) = 0) not valid;
