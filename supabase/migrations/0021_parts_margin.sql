-- 0021_parts_margin.sql
-- Add margin settings to parts and derive list_price automatically.

alter table public.parts
  add column if not exists margin_type text not null default 'fixed'
    check (margin_type in ('fixed', 'percent')),
  add column if not exists margin_value numeric(10,2) not null default 0;

alter table public.parts
  drop constraint if exists parts_margin_value_nonnegative;

alter table public.parts
  add constraint parts_margin_value_nonnegative
  check (margin_value >= 0);

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

drop trigger if exists trg_parts_compute_list_price on public.parts;
create trigger trg_parts_compute_list_price
  before insert or update on public.parts
  for each row execute function public.set_part_list_price();

-- Preserve existing sell prices by expressing the current list price as a
-- fixed-dollar margin over cost + MHSW.
update public.parts
set
  margin_type = 'fixed',
  margin_value = greatest(round(list_price - cost - mhsw_fee, 2), 0);
