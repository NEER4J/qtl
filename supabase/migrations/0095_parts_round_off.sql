-- 0095_parts_round_off.sql
-- Per-part ".99 round off" flag. The global .99 round-up on sales was removed
-- 2026-06-23 (prices stored/shown exactly as entered). The client now wants it
-- back, but opt-in per part: when round_off is true, the part's unit price is
-- rounded UP to the next .99 as it is added to a sales job. Default false keeps
-- the exact price.

alter table public.parts
  add column if not exists round_off boolean not null default false;

comment on column public.parts.round_off is
  'When true, this part''s unit price is rounded up to the next .99 when added to a sales job. Default false = exact price.';
