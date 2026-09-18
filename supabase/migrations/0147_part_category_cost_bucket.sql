-- 0147_part_category_cost_bucket.sql
-- Part categories decide which cost column a package item counts toward.
-- (client 2026-09-15 — "categories matter: package line items must be grouped
-- by part category so each cost column gets the right total")
--
-- The Oil detail page now takes an engine's filter cost from its linked
-- package, like fuel, grease and labour already were. To split a package's
-- items into Filter / Oil / Fuel / Grease the category needs to say which it
-- is; until now the code matched category NAMES, which only ever worked for the
-- exact names "Fuel" and "Grease".
--
--   filter — oil / fuel / bypass / air / coolant / cabin / DEF filters,
--            separators, spinners: the Filter cost column
--   oil    — oil sold as a part (drums, quarts): shown, never added to the Oil
--            cost column, which stays litres × the page's oil grade
--   fuel   — diesel treatment: the Fuel column
--   grease — the Grease column
--   other  — anything else; not part of those columns
--
-- Editable per category in Settings → Pricing → Part categories.
--
-- Backfill, by name — the same rule as costBucketFromName (lib/utils/cost-bucket.ts):
--   exact "fuel" / "grease" (unchanged from today, so the Fuel and Grease
--   columns don't move), then filter|separator|spinner, then the word "oil".
-- Only rows still on the default are touched, so a re-run never undoes a
-- bucket someone has set by hand. Each changed row writes one audit entry.

alter table public.part_categories
  add column if not exists cost_bucket text not null default 'other';

alter table public.part_categories
  drop constraint if exists part_categories_cost_bucket_check;
alter table public.part_categories
  add constraint part_categories_cost_bucket_check
  check (cost_bucket in ('filter', 'oil', 'fuel', 'grease', 'other'));

comment on column public.part_categories.cost_bucket is
  'Which oil-change cost column parts in this category count toward: filter / oil / fuel / grease / other (0147).';

update public.part_categories c
   set cost_bucket = b.bucket
  from (
    select id,
           case
             when lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = 'fuel'   then 'fuel'
             when lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = 'grease' then 'grease'
             when name ~* '(filter|separator|spinner)'                            then 'filter'
             when name ~* '\moil\M'                                              then 'oil'
             else 'other'
           end as bucket
      from public.part_categories
  ) b
 where c.id = b.id
   and c.cost_bucket = 'other'
   and b.bucket <> 'other';
