-- 0073_sales_job_items_merged_unit_price.sql
-- Marks a package line as a "merged duplicate": the item is already on the job,
-- so it's added at unit_price 0 (not billed twice) but kept visible. This column
-- stores the price that was waived, so the UI/PDF can show the item struck
-- through with a "merged — already on the job" indicator and a per-package
-- "saved $X" total. NULL = a normal (non-merged) line.

alter table public.sales_job_items
  add column if not exists merged_unit_price numeric(12,2)
    check (merged_unit_price is null or merged_unit_price >= 0);

comment on column public.sales_job_items.merged_unit_price is
  'When set, this package line is a merged duplicate billed at $0; the value is the unit price that was waived (for the "merged / saved $X" indicator).';
