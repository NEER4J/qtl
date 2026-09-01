-- 0121_customers_plates_text.sql
--
-- Supports server-side search on the customers list (which is now paginated,
-- so filtering in the browser would only ever search the page you are on).
--
-- Plates live in TWO places and neither is a superset of the other:
--
--   * public.vehicles          — the source of truth, and what the sales-form
--                                customer combobox searches.
--   * customers.license_plates — a legacy text[] kept from before 0035. It is
--                                still written by createCustomer /
--                                updateCustomer, but adding a vehicle from the
--                                vehicles page does NOT update it, and 0035
--                                installed no reverse-sync trigger.
--
-- So a plate typed into the customer form exists only in the array, and a
-- plate added from the vehicles page exists only in vehicles. The old
-- client-side filter searched the array with a substring match; dropping that
-- would have made those customers unfindable.
--
-- PostgREST cannot express a partial match against an array element
-- (`cs` is contains-whole-element, not substring), so this flattens the array
-- into a plain text column that ilike — and a trigram index — can work on.
-- It is GENERATED, so it cannot drift from the array the way a trigger-
-- maintained column could.
--
-- The list query ORs this together with a vehicles lookup, which is what makes
-- the search cover both sources.
--
-- ----------------------------------------------------------------------------
-- Why the helper function below, instead of array_to_string() directly:
--
-- A generated column's expression has to be IMMUTABLE, and array_to_string() is
-- only STABLE. It is stable because it renders each element through that
-- element type's output function, and for some types that is genuinely not
-- immutable (a timestamptz renders differently under a different TimeZone).
-- Using it directly fails with:
--     ERROR: 42P17: generation expression is not immutable
-- concat_ws() and a plain ::text cast are stable for the same reason, so there
-- is no built-in that will do.
--
-- Pinning the argument to text[] removes the caveat: the output function for
-- text is the identity, so for THIS signature the result depends on nothing but
-- the inputs, and marking the wrapper immutable is accurate rather than a
-- convenient lie. It lives in `private` so it stays off the PostgREST API
-- surface; authenticated already has USAGE there (0003) and functions grant
-- EXECUTE to PUBLIC by default, which is what lets an ordinary insert evaluate
-- the generated column.
-- ----------------------------------------------------------------------------

create or replace function private.text_array_to_string(arr text[], sep text)
returns text
language sql
immutable
parallel safe
as $$
  select array_to_string(arr, sep);
$$;

comment on function private.text_array_to_string(text[], text) is
  'array_to_string() pinned to text[], which makes it immutable enough for a generated column. See 0121.';

alter table public.customers
  add column if not exists plates_text text
  generated always as (private.text_array_to_string(license_plates, ' ')) stored;

comment on column public.customers.plates_text is
  'Read-only flattening of license_plates for substring search. Generated — never write to it. See 0121.';

-- ----------------------------------------------------------------------------
-- Trigram index, with the operator class resolved by hand.
--
-- `using gin (plates_text gin_trgm_ops)` — what 0120 writes — fails here with:
--     ERROR: 42704: operator class "gin_trgm_ops" does not exist for access
--                   method "gin"
-- The name is only visible if the schema holding pg_trgm is on the session's
-- search_path, and on Supabase the extension lives in `extensions`, which the
-- SQL editor does not put there. So find the schema it actually landed in and
-- qualify the name, rather than assuming either `public` or `extensions`.
-- ----------------------------------------------------------------------------
create extension if not exists pg_trgm;

do $$
declare v_schema text;
begin
  select n.nspname
    into v_schema
    from pg_opclass oc
    join pg_am am on am.oid = oc.opcmethod
    join pg_namespace n on n.oid = oc.opcnamespace
   where oc.opcname = 'gin_trgm_ops'
     and am.amname = 'gin'
   limit 1;

  if v_schema is null then
    raise exception
      'pg_trgm is not installed. Run: create extension pg_trgm with schema extensions;';
  end if;

  execute format(
    'create index if not exists customers_plates_text_trgm '
    'on public.customers using gin (plates_text %I.gin_trgm_ops)',
    v_schema);
end $$;

analyze public.customers;
