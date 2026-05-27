-- 0068_sales_job_items_package_group.sql
-- Group the line items that were expanded from a single package instance.
--
-- WHY: A job invoice now shows a package as ONE collapsed line (its name + the
-- combined total) instead of listing every part/oil/labour row. The individual
-- rows are still stored (so HST splits, product analytics, and cost reporting
-- stay correct) but the UI / PDF group them by this id and render a single
-- summary line. A fresh uuid is stamped per *expansion*, so adding the same
-- package twice to one job yields two independent collapsed lines.
--
-- Legacy rows keep package_group NULL; the display layer falls back to grouping
-- by the package_label snapshot for those.

alter table public.sales_job_items
  add column if not exists package_group uuid;

comment on column public.sales_job_items.package_group is
  'Groups line items expanded from one package instance so the UI/PDF can show a single collapsed line. NULL for standalone lines and pre-0068 rows.';

create index if not exists sales_job_items_package_group_idx
  on public.sales_job_items (sales_job_id, package_group)
  where package_group is not null;
