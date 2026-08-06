-- 0120_search_trgm_indexes.sql
--
-- PERFORMANCE ONLY. No schema or data changes.
--
-- Every search box in the app (customer combobox, part picker, package picker,
-- vendor combobox, the sales/expenses list filters) ends up as
-- `ilike '%term%'`. A leading wildcard makes an ordinary btree index useless,
-- so each of those searches was a full sequential scan — and, before 0119,
-- a scan that re-ran the RLS role lookup on every row it touched.
--
-- pg_trgm's GIN indexes are the fix: they index every 3-character substring,
-- which is exactly what a `%term%` match needs. Postgres can then go straight
-- to the candidate rows instead of reading the table.
--
-- Caveat worth knowing when reading query plans later: a search term shorter
-- than 3 characters produces no trigrams, so those queries still fall back to
-- a sequential scan. That is fine — the pickers cap results at 20-50 rows and
-- a 1-2 character search is not a search anyone waits on. It does mean you
-- should benchmark with realistic terms ("donaldson", "PH8A"), not with "a".
--
-- Built non-concurrently because Supabase runs each migration inside a
-- transaction. These tables are in the low thousands of rows, so the write
-- lock is brief; if any of them grows by an order of magnitude, rebuild with
-- CREATE INDEX CONCURRENTLY outside a migration instead.

create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- parts — the part picker on the sales job form and the expense form.
-- applyPartsSearch() ORs across all three columns per typed word, so each
-- column needs its own index; a concatenated one would not be probed.
-- ----------------------------------------------------------------------------
create index if not exists parts_part_number_trgm
  on public.parts using gin (part_number gin_trgm_ops);
create index if not exists parts_brand_trgm
  on public.parts using gin (brand gin_trgm_ops);
create index if not exists parts_description_trgm
  on public.parts using gin (description gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- customers — searchCustomers() matches name fields, and phone_search (the
-- denormalised digits-only column) with `like '%digits%'`. The existing
-- customers_phone_search_idx uses text_pattern_ops, which only helps a
-- LEFT-anchored prefix match and so never served this query.
-- ----------------------------------------------------------------------------
create index if not exists customers_billing_name_trgm
  on public.customers using gin (billing_name gin_trgm_ops);
create index if not exists customers_last_or_company_trgm
  on public.customers using gin (last_or_company gin_trgm_ops);
create index if not exists customers_phone_search_trgm
  on public.customers using gin (phone_search gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- vehicles — plate lookup is the other half of searchCustomers(), and it is
-- how the counter actually finds a repeat customer.
-- ----------------------------------------------------------------------------
create index if not exists vehicles_license_plate_trgm
  on public.vehicles using gin (license_plate gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- sales_jobs — the `q` filter on the sales list.
-- ----------------------------------------------------------------------------
create index if not exists sales_jobs_invoice_no_trgm
  on public.sales_jobs using gin (invoice_no gin_trgm_ops);
create index if not exists sales_jobs_billing_name_trgm
  on public.sales_jobs using gin (billing_name gin_trgm_ops);
create index if not exists sales_jobs_license_plate_trgm
  on public.sales_jobs using gin (license_plate gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- vendors + part_packages — the expense vendor combobox and the package picker.
-- ----------------------------------------------------------------------------
create index if not exists vendors_name_trgm
  on public.vendors using gin (name gin_trgm_ops);
create index if not exists part_packages_name_trgm
  on public.part_packages using gin (name gin_trgm_ops);
create index if not exists part_packages_description_trgm
  on public.part_packages using gin (description gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- Sales list ordering.
--
-- listSalesJobs() always sorts by (job_date desc, created_at desc) filtered to
-- deactivated_at is null, and for owner / co_owner / accountant there is no
-- location filter at all. The existing sales_location_date_idx is
-- (location_id, job_date desc) — a leading column the unfiltered query never
-- constrains, so it could not be used and every page of the sales list was a
-- full sort of the table.
--
-- This index matches the sort exactly and carries the same partial predicate,
-- so page 1 becomes a short index read instead of a scan-and-sort.
-- ----------------------------------------------------------------------------
create index if not exists sales_jobs_date_created_idx
  on public.sales_jobs (job_date desc, created_at desc)
  where deactivated_at is null;

analyze public.parts;
analyze public.customers;
analyze public.vehicles;
analyze public.sales_jobs;
analyze public.vendors;
analyze public.part_packages;
