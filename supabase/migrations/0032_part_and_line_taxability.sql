-- 0032_part_and_line_taxability.sql
-- Per-part HST taxability. is_taxable is denormalised onto sales_job_items so
-- historical invoices stay stable if a part's taxability is later toggled
-- (same reasoning as keeping hst persisted on sales_jobs rather than recomputed).

alter table public.parts
  add column if not exists is_taxable boolean not null default true;

alter table public.sales_job_items
  add column if not exists is_taxable boolean not null default true;
