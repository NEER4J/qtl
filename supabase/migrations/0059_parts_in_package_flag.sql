-- 0059_parts_in_package_flag.sql
--
-- Flags a part as "bundled in a package". Two effects, both in the action /
-- UI layer (no calculated columns):
--   1. The All Filter Sell Price view forces the "Without Service" column to
--      $0 — bundled parts aren't sold separately at that mode.
--   2. On a sales job, if the same part_id appears a second time (the first
--      came from a package expansion, the second is the customer asking for
--      an extra), the sales-line picker defaults the new line's unit_price
--      to over_counter_price instead of list_price.

alter table public.parts
  add column if not exists in_package boolean not null default false;

comment on column public.parts.in_package is
  'When true, the part is treated as bundled into a package: All Filter Sell Price''s "Without Service" column shows $0, and a second occurrence on the same sales job defaults to over_counter_price.';
