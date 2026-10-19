-- 0155_customer_rename.sql
--
-- Renaming a customer starts a new customer record (client 2026-10-19).
-- Old invoices, sales and history stay on the old record under the name they
-- were made with; the new record carries the new name forward, linked back to
-- the old one. The vehicles staff pick (and, optionally, the store credit)
-- move across; the old record is retired so pickers offer only the new one.

alter table public.customers
  add column if not exists renamed_from_id uuid references public.customers(id);

comment on column public.customers.renamed_from_id is
  'The customer record this one replaced when the customer was renamed (0155).';

create index if not exists customers_renamed_from_idx
  on public.customers (renamed_from_id)
  where renamed_from_id is not null;

-- ----------------------------------------------------------------------------
-- rename_customer(customer, new name, vehicles to move, move store credit?)
-- Returns the new customer's id. SECURITY INVOKER: the caller's RLS applies to
-- every write, so only someone allowed to add and edit customers can rename.
-- ----------------------------------------------------------------------------
create or replace function public.rename_customer(
  p_customer uuid,
  p_name text,
  p_vehicle_ids uuid[] default '{}',
  p_move_credit boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_old public.customers%rowtype;
  v_cols text;
  v_new uuid;
  v_successor text;
  v_credit numeric(12,2);
begin
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' then
    raise exception 'The new name is required.' using errcode = '22023';
  end if;

  select * into v_old from public.customers where id = p_customer for update;
  if not found then
    raise exception 'That customer no longer exists.' using errcode = 'P0002';
  end if;
  if lower(coalesce(v_old.billing_name, v_old.last_or_company, '')) = lower(p_name) then
    raise exception 'The new name is the same as the current one.' using errcode = '22023';
  end if;

  select billing_name into v_successor
    from public.customers
   where renamed_from_id = p_customer
   limit 1;
  if found then
    raise exception 'This customer was already renamed to %. Edit that record instead.', v_successor
      using errcode = '22023';
  end if;

  -- Copy every plain column, so details added to customers later come along
  -- too. Left out: the identity (id, code — the trigger issues a new code),
  -- the name fields, the bookkeeping columns and generated columns.
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'customers'
     and is_generated = 'NEVER'
     and is_identity = 'NO'
     and column_name not in (
       'id', 'code', 'salutation', 'first_name', 'last_or_company', 'billing_name',
       'active', 'renamed_from_id', 'created_at', 'updated_at', 'created_by', 'updated_by'
     );

  execute format(
    'insert into public.customers (%1$s, billing_name, last_or_company, active, renamed_from_id, created_by, updated_by)
     select %1$s, $1, $1, true, id, auth.uid(), auth.uid() from public.customers where id = $2
     returning id',
    v_cols
  ) into v_new using p_name, p_customer;

  -- The insert trigger opens a fresh 30-day free-grease window for a new
  -- customer. A rename is the same customer, so keep whatever they had.
  update public.customers
     set free_grease_until = v_old.free_grease_until
   where id = v_new;

  update public.vehicles
     set customer_id = v_new, updated_by = auth.uid()
   where customer_id = p_customer
     and id = any(coalesce(p_vehicle_ids, '{}'));

  if p_move_credit then
    select coalesce(sum(amount), 0) into v_credit
      from public.customer_credit_ledger
     where customer_id = p_customer;
    if v_credit > 0 then
      insert into public.customer_credit_ledger (customer_id, amount, notes, created_by)
      values
        (p_customer, -v_credit, format('Moved to %s (customer renamed)', p_name), auth.uid()),
        (v_new, v_credit, format('Moved from %s (customer renamed)', coalesce(v_old.billing_name, v_old.last_or_company)), auth.uid());
    end if;
  end if;

  update public.customers
     set active = false, updated_by = auth.uid()
   where id = p_customer;

  return v_new;
end;
$$;

revoke all on function public.rename_customer(uuid, text, uuid[], boolean) from public;
grant execute on function public.rename_customer(uuid, text, uuid[], boolean) to authenticated;
