-- 0083_sales_job_items_mhsw_unit.sql
-- Show the MHSW portion of each part on jobs & invoices. unit_price already
-- bakes MHSW in; this stores the per-unit Sell MHSW so it can be shown as its
-- own column. Snapshot at insert time (like is_taxable) so historical invoices
-- stay stable if the part's MHSW is later changed. 0 for labour / non-part /
-- package-collapsed lines.

alter table public.sales_job_items
  add column if not exists mhsw_unit numeric(10,2) not null default 0
    check (mhsw_unit >= 0);

comment on column public.sales_job_items.mhsw_unit is
  'Per-unit Sell MHSW snapshot for the linked part (already included in unit_price). Shown as the MHSW column on the job / invoice. 0 for non-part lines.';
