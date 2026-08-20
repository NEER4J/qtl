-- 0131_oil_types_single_base.sql
-- Lock "Base grade" to exactly one oil type.
--
-- The app has always assumed a single base grade — every consumer picks it with
-- `oilTypes.find(o => o.is_base)`, so a second base row is silently ignored and
-- which one wins depends on sort order. This makes that assumption a rule.

-- 1. Demote any extra bases, keeping one winner: 15W40 if it is flagged,
--    otherwise the oldest row. (No sort_order tiebreak — 0089 dropped that
--    column from oil_types; the list is ordered by name in the app.)
with ranked as (
  select
    id,
    row_number() over (
      order by (code = '15W40') desc, created_at, id
    ) as rn
  from public.oil_types
  where is_base
)
update public.oil_types o
   set is_base = false
  from ranked r
 where o.id = r.id
   and r.rn > 1;

-- 2. At most one row may carry is_base = true from here on.
--    (All indexed values are `true`, so a second base row violates uniqueness.)
create unique index if not exists oil_types_one_base_idx
  on public.oil_types (is_base)
  where is_base;
