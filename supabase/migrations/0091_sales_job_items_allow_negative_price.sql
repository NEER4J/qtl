-- 0091_sales_job_items_allow_negative_price.sql
-- Allow a negative unit price on a sales line so discounts / credits can be
-- entered as their own line (e.g. "-50.00 goodwill credit"). The >= 0 check from
-- 0027 blocked this. line_total stays a generated column (qty * unit_price), so
-- it follows the sign automatically.

alter table public.sales_job_items
  drop constraint if exists sales_job_items_unit_price_check;
