-- 0160_sales_search_vin_phone_trgm.sql
--
-- PERFORMANCE ONLY. The sales list can now search one chosen column, and VIN
-- and phone are new searchable columns (client 2026-10-20 — "make the search
-- faster, pick the field, add VIN"). Same reasoning as 0120: a `%term%` match
-- needs a trigram index to avoid reading the whole table, and the "All fields"
-- OR needs one on every arm. pg_trgm's GIN indexes also serve the
-- case-insensitive regex the phone search uses (contact_no ~* '4\D*1\D*6…').
--
-- Built non-concurrently (Supabase wraps migrations in a transaction); about
-- ten thousand jobs today, so the lock is brief.

create extension if not exists pg_trgm;

create index if not exists sales_jobs_vin_trgm
  on public.sales_jobs using gin (vin gin_trgm_ops);
create index if not exists sales_jobs_contact_no_trgm
  on public.sales_jobs using gin (contact_no gin_trgm_ops);
