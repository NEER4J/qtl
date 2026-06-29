-- 0101_expense_items_allow_negative.sql
-- Allow a NEGATIVE unit_cost on an expense line so a promotion / vendor discount
-- can be entered as its own line (mirrors sales_job_items 0091). The `>= 0`
-- check added in 0046 blocked this.

alter table public.expense_items
  drop constraint if exists expense_items_unit_cost_check;
