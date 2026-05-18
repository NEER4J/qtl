-- 0056_expense_items_last_buying_price.sql
-- Snapshot the part's most-recent prior unit_cost at the moment a user picks
-- it from the catalog in the expense Items section. The picker computes this
-- value live (from older expense_items) and writes it onto the row so that
-- reopening an expense for edit still shows the drift indicator next to the
-- current unit_cost. Null means the part had no prior buying history when the
-- row was created, or the row predates this feature.

alter table public.expense_items
  add column if not exists last_buying_price_snapshot numeric(12,2);
