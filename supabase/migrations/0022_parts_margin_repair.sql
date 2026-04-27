-- 0022_parts_margin_repair.sql
-- Repair rows from the initial margin backfill where list_price was zero or
-- margin became negative, and harden the trigger logic.

create or replace function public.set_part_list_price()
returns trigger
language plpgsql
as $$
declare
  computed_margin numeric(10,2);
begin
  new.margin_value := greatest(new.margin_value, 0);

  computed_margin :=
    case
      when new.margin_type = 'percent' then round((new.cost * new.margin_value) / 100.0, 2)
      else new.margin_value
    end;

  new.list_price := round(new.cost + new.mhsw_fee + computed_margin, 2);
  return new;
end;
$$;

update public.parts
set
  margin_type = margin_type,
  margin_value = greatest(margin_value, 0)
where
  margin_value < 0
  or list_price is distinct from round(
    cost + mhsw_fee +
    case
      when margin_type = 'percent' then round((cost * greatest(margin_value, 0)) / 100.0, 2)
      else greatest(margin_value, 0)
    end,
    2
  );

alter table public.parts
  drop constraint if exists parts_margin_value_nonnegative;

alter table public.parts
  add constraint parts_margin_value_nonnegative
  check (margin_value >= 0);
