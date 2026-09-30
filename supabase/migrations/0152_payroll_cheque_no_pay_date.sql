-- 0152_payroll_cheque_no_pay_date.sql
-- Cheque number and pay date on each payroll entry.
-- (client 2026-09-30 — "we need to add check no. add option in the payroll
-- and a pay date")
--
-- The pay statement is what the employee keeps, and it had neither: the cheque
-- number only existed as the reference on a separately recorded payment, and
-- the date paid not at all — just the pay period. Both now sit on the entry,
-- so they are filled in with the rest of the pay and print on the stub and the
-- register.
--
-- Both optional. pay_date is when the employee is paid, which is usually after
-- the period ends, so it is not tied to the week's dates. payroll_payments is
-- unchanged: it still records the money actually going out.

alter table public.payroll_entries
  add column if not exists cheque_no text,
  add column if not exists pay_date date;

comment on column public.payroll_entries.cheque_no is
  'Number of the cheque this pay was issued on. NULL when paid another way or not yet written (0152).';
comment on column public.payroll_entries.pay_date is
  'Date the employee is paid for this period. NULL until set (0152).';
