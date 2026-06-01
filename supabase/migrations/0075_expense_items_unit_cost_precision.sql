-- 0075_expense_items_unit_cost_precision.sql
--
-- Allow sub-cent unit costs on expense / purchase line items. Real-world
-- per-litre and per-unit buying prices carry more than 2 decimals (e.g.
-- 1.3712), and the previous numeric(12,2) silently rounded them — making the
-- saved line total disagree with what the form showed. Widen unit_cost (and
-- the last-buying-price snapshot that mirrors it) to numeric(12,6).
--
-- line_total stays numeric(14,2): it's a dollar amount, rounded to the cent.
-- Because line_total is a GENERATED column over unit_cost and Postgres forbids
-- altering the type of a column a generated column depends on, we drop and
-- re-create line_total around the type change. It recomputes from existing
-- rows automatically (stored generated column), so no data is lost.

alter table public.expense_items drop column if exists line_total;

alter table public.expense_items
  alter column unit_cost type numeric(12,6);

alter table public.expense_items
  alter column last_buying_price_snapshot type numeric(12,6);

alter table public.expense_items
  add column line_total numeric(14,2)
    generated always as ((quantity * unit_cost)::numeric(14,2)) stored;
