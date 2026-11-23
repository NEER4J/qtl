-- 0166_expense_items_mhsw.sql
--
-- MHSW on the buying side (client voice note + Cummins sample bill,
-- 2026-11-20): "exactly like GST/HST — when we buy we pay it, when we sell we
-- collect it, so the expense side needs an MHSW column too." Vendor bills
-- print it as an "ENVIRONMENTAL CHARGE" line under each part ($1.14 on some
-- filters, $0.48 on others on the same bill), so it is entered per line.
--
-- expense_items.mhsw_unit = MHSW per unit on that line. line_total (generated,
-- qty x unit_cost) is unchanged, so part costs and "last buying price" stay
-- the part's own price. The expense form adds qty x mhsw_unit into the bill's
-- sub total, and the MHSW report (/reports/mhsw) sums it as MHSW paid.

alter table public.expense_items
  add column if not exists mhsw_unit numeric(12,2) not null default 0;

alter table public.expense_items
  drop constraint if exists expense_items_mhsw_unit_check;
alter table public.expense_items
  add constraint expense_items_mhsw_unit_check check (mhsw_unit >= 0);

comment on column public.expense_items.mhsw_unit is
  'MHSW (environmental charge) the vendor billed per unit on this line. Kept apart from unit_cost; reported as MHSW paid.';
