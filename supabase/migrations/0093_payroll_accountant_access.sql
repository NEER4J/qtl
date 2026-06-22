-- 0093_payroll_accountant_access.sql
-- The accountant is a payroll/finance operator but, until now, could only READ
-- payroll (employees_select / payroll_weeks_select already include 'accountant').
-- Client 2026-06: the accountant must be able to add a new pay week and run the
-- full payroll workflow, not just view it. Give the accountant write access
-- across the payroll tables, cross-location (the accountant is a cross-location
-- role — payroll_weeks_select already lets them see every shop).
--
-- Note: payroll_entries_write and payroll_cash_daily_write are gated only by the
-- parent week being visible + in 'draft' (their USING/WITH CHECK is an EXISTS on
-- payroll_weeks, which is itself RLS-filtered). Because the accountant can SELECT
-- every week, those two already accept accountant writes — no change needed here.

-- employees — accountant may add / edit staff records used by payroll
drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees for insert to authenticated
  with check (
    private.current_role() in ('owner', 'manager', 'accountant')
  );

drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees for update to authenticated
  using (private.current_role() in ('owner', 'manager', 'accountant'))
  with check (private.current_role() in ('owner', 'manager', 'accountant'));

-- payroll_weeks — accountant may create / update any week (cross-location)
drop policy if exists payroll_weeks_write on public.payroll_weeks;
create policy payroll_weeks_write on public.payroll_weeks for all to authenticated
  using (
    private.current_role() in ('owner', 'accountant')
    or (private.current_role() = 'manager' and location_id = private.current_location())
  )
  with check (
    private.current_role() in ('owner', 'accountant')
    or (private.current_role() = 'manager' and location_id = private.current_location())
  );

-- payroll_payments — accountant may record payments
drop policy if exists payroll_payments_write on public.payroll_payments;
create policy payroll_payments_write on public.payroll_payments for all to authenticated
  using (private.current_role() in ('owner', 'manager', 'accountant'))
  with check (private.current_role() in ('owner', 'manager', 'accountant'));
