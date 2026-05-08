-- 0049_parts_duplicate_unit_price.sql
-- Adds parts.extra_price — a signed delta (can be negative) applied to an
-- existing same-category line on a sales job when this part appears in a
-- package the owner drops onto the job. Positive = upgrade fee added to
-- the original line; negative = credit subtracted.

alter table public.parts
  add column if not exists extra_price numeric(10,2) not null default 0;

comment on column public.parts.extra_price is
  'Signed delta applied to an existing same-category line when this part is added via a package. Positive = upcharge, negative = credit.';
