-- 0029_part_package_items_unit_price.sql
-- Adds the optional per-part price override on packages. Idempotent: if 0028
-- was applied on a DB before unit_price was introduced, this back-fills the
-- column; on a fresh DB where 0028 already includes it, this is a no-op.

alter table public.part_package_items
  add column if not exists unit_price numeric(12,2);

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'part_package_items_unit_price_check'
       and conrelid = 'public.part_package_items'::regclass
  ) then
    alter table public.part_package_items
      add constraint part_package_items_unit_price_check
      check (unit_price is null or unit_price >= 0);
  end if;
end$$;
