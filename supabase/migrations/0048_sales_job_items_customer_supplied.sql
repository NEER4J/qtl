-- 0048_sales_job_items_customer_supplied.sql
-- Marks a job line as "customer brought their own part" so the customer is
-- credited (not charged) for it. The line stays on the invoice for record
-- keeping but its line_total is forced to 0.

alter table public.sales_job_items
  add column if not exists is_customer_supplied boolean not null default false;

-- Drop and re-add the generated line_total so it returns 0 for customer-supplied lines.
alter table public.sales_job_items
  drop column if exists line_total;

alter table public.sales_job_items
  add column line_total numeric(14,2)
    generated always as (
      case
        when is_customer_supplied then 0::numeric(14,2)
        else (quantity * unit_price)::numeric(14,2)
      end
    ) stored;

comment on column public.sales_job_items.is_customer_supplied is
  'True when the customer brought the part themselves; line_total forced to 0.';
