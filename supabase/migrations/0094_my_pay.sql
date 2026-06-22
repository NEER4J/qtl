-- 0094_my_pay.sql
-- Staff-facing "My Pay": a payroll employee who is linked to a login user
-- (employees.profile_id = auth.uid()) can see THEIR OWN pay, even though the
-- payroll RLS otherwise hides payroll from staff/technician entirely.
--
-- Rather than open up table-level RLS (which is sensitive and easy to get
-- wrong), expose a tightly-scoped SECURITY DEFINER function that only ever
-- returns rows for the calling user's own linked employee. The function runs
-- with the definer's privileges so it can read the payroll tables, but the
-- WHERE clause pins every row to auth.uid().
--
-- employees.profile_id already exists (0012) — it's the nullable FK to
-- auth.users used to wire an employee record to a login. The new Employees
-- management screen sets it.

create or replace function public.get_my_pay()
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
  ei_employee numeric,
  cpp_employee numeric,
  cpp_employee2 numeric,
  income_tax numeric,
  benefit_employee_deduction numeric,
  vacation_pay numeric,
  cash_total numeric,
  net_pay numeric,
  paid numeric
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
    ), 0) as paid
  from public.payroll_entries pe
  join public.payroll_weeks pw on pw.id = pe.payroll_week_id
  join public.employees e      on e.id = pe.employee_id
  left join public.locations loc on loc.id = pw.location_id
  where e.profile_id = auth.uid()
  order by pw.week_start desc;
$$;

revoke all on function public.get_my_pay() from public;
grant execute on function public.get_my_pay() to authenticated;
