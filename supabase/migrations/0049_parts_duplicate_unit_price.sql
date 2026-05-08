-- 0049_parts_duplicate_unit_price.sql
-- Optional price applied to the 2nd+ occurrence of a part on a single sales
-- job (e.g. a discounted rate when the customer needs the same filter twice).
-- NULL = use list_price for duplicates as well.

alter table public.parts
  add column if not exists duplicate_unit_price numeric(10,2)
    check (duplicate_unit_price is null or duplicate_unit_price >= 0);

comment on column public.parts.duplicate_unit_price is
  'Price used for the 2nd+ occurrence of this part on one sales job. NULL = use list_price.';
