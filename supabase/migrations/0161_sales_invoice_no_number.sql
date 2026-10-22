-- 0161_sales_invoice_no_number.sql
--
-- Sort invoices by their number (client 2026-10-22). The manager checks the
-- day's invoices for all three shops in number order, but invoice_no is text,
-- and each shop's numbers have a different length (FE 22603, NP 74264,
-- AYR 330202), so a text sort puts 330202 before 74264.
--
-- A PostgREST computed field, not a column: `order=invoice_no_num` sorts by
-- the number, and nothing that writes sales_jobs is touched. Invoice numbers
-- that aren't plain digits ("INV-000003", "22163-VOID") give NULL and sort
-- after the numbered ones. The expression index below is the same expression,
-- so the planner can use it once the function is inlined.

create or replace function public.invoice_no_num(public.sales_jobs)
returns bigint
language sql
immutable
as $$
  select case when $1.invoice_no ~ '^[0-9]{1,18}$' then $1.invoice_no::bigint end
$$;

grant execute on function public.invoice_no_num(public.sales_jobs) to authenticated, service_role;

create index if not exists sales_jobs_invoice_no_num_idx
  on public.sales_jobs ((case when invoice_no ~ '^[0-9]{1,18}$' then invoice_no::bigint end));

notify pgrst, 'reload schema';
