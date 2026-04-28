-- 0030_sales_job_items_package_label.sql
-- Tag each sales-job line with the name of the package it was expanded from,
-- so the UI and printed invoice can show "(from Standard Oil Change)" next to
-- the parts that came in as a bundle. Stored as a denormalised snapshot —
-- renaming or deleting a package later does not retroactively change
-- historical invoices.

alter table public.sales_job_items
  add column if not exists package_label text;
