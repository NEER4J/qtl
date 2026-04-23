-- 0014_recurring_expenses.sql
-- Phase 4 — Automated recurring expense entries.
-- E.g. monthly radio ad contract: owner configures it once, system drops an
-- expense row on the scheduled day.

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  category_id uuid not null references public.expense_categories(id),
  subcategory_id uuid references public.expense_subcategories(id),
  vendor_id uuid references public.vendors(id),

  -- Template for the generated expense row
  description text,
  amount numeric(12,2) not null check (amount > 0),
  hst_rate numeric(5,4) not null default 0.13 check (hst_rate >= 0 and hst_rate <= 1),

  -- Cadence
  frequency text not null check (frequency in ('monthly', 'weekly', 'annual')),
  day_of_month smallint check (day_of_month is null or (day_of_month between 1 and 28)),
  day_of_week  smallint check (day_of_week is null  or (day_of_week between 0 and 6)),
  start_date date not null,
  end_date date,

  -- State
  active boolean not null default true,
  last_generated_on date,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),

  constraint recurring_expenses_cadence_check check (
    (frequency = 'monthly' and day_of_month is not null and day_of_week is null) or
    (frequency = 'weekly'  and day_of_week is not null and day_of_month is null) or
    (frequency = 'annual'  and day_of_month is not null and day_of_week is null)
  )
);

create index if not exists idx_recurring_active   on public.recurring_expenses(active) where active;
create index if not exists idx_recurring_location on public.recurring_expenses(location_id);

drop trigger if exists trg_recurring_updated_at on public.recurring_expenses;
create trigger trg_recurring_updated_at
  before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

drop trigger if exists trg_recurring_audit on public.recurring_expenses;
create trigger trg_recurring_audit
  after insert or update on public.recurring_expenses
  for each row execute function public.audit_row();

alter table public.recurring_expenses enable row level security;

drop policy if exists recurring_expenses_select on public.recurring_expenses;
create policy recurring_expenses_select on public.recurring_expenses for select to authenticated
  using (
    private.current_role() in ('owner', 'accountant')
    or (private.current_role() = 'manager' and location_id = private.current_location())
  );

drop policy if exists recurring_expenses_write on public.recurring_expenses;
create policy recurring_expenses_write on public.recurring_expenses for all to authenticated
  using (
    private.current_role() = 'owner'
    or (private.current_role() = 'manager' and location_id = private.current_location())
  )
  with check (
    private.current_role() = 'owner'
    or (private.current_role() = 'manager' and location_id = private.current_location())
  );

-- ============================================================================
-- process_recurring_expenses() — generate any expense rows that are due as of
-- the given `as_of` date. Idempotent: `last_generated_on` is advanced only
-- when a row is inserted, and we never insert twice for the same (template,
-- period). Called on demand from a cron / server action.
-- ============================================================================
create or replace function public.process_recurring_expenses(as_of date default current_date)
returns table(recurring_id uuid, expense_id uuid, generated_for date)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
  v_due date;
  v_sub numeric(12,2);
  v_hst numeric(12,2);
  v_tot numeric(12,2);
  v_expense_id uuid;
begin
  for r in
    select *
      from public.recurring_expenses
     where active
       and start_date <= as_of
       and (end_date is null or end_date >= as_of)
  loop
    -- Compute the next due date strictly after last_generated_on (or start_date).
    v_due := coalesce(r.last_generated_on, r.start_date - 1);

    if r.frequency = 'monthly' then
      v_due := make_date(extract(year from v_due)::int, extract(month from v_due)::int, r.day_of_month);
      if v_due <= coalesce(r.last_generated_on, r.start_date - 1) then
        v_due := (v_due + interval '1 month')::date;
      end if;
    elsif r.frequency = 'annual' then
      v_due := make_date(extract(year from v_due)::int, extract(month from r.start_date)::int, r.day_of_month);
      if v_due <= coalesce(r.last_generated_on, r.start_date - 1) then
        v_due := (v_due + interval '1 year')::date;
      end if;
    else -- weekly
      -- advance one day at a time until we find the matching dow after last run
      v_due := coalesce(r.last_generated_on, r.start_date - 1) + 1;
      while extract(dow from v_due) <> r.day_of_week loop
        v_due := v_due + 1;
      end loop;
    end if;

    if v_due > as_of then
      continue;
    end if;

    v_sub := r.amount;
    v_hst := round(v_sub * r.hst_rate, 2);
    v_tot := v_sub + v_hst;

    insert into public.expenses (
      location_id, expense_date, category_id, subcategory_id, vendor_id,
      vendor_name_snapshot, invoice_no, sub_total, hst, total,
      paid_amount, balance, payment_status, notes, created_by, updated_by
    )
    select
      r.location_id, v_due, r.category_id, r.subcategory_id, r.vendor_id,
      v.name, null, v_sub, v_hst, v_tot,
      0, v_tot, 'outstanding',
      coalesce(r.description || ' (auto-generated)', 'auto-generated recurring expense'),
      r.created_by, r.updated_by
    from public.recurring_expenses re
    left join public.vendors v on v.id = re.vendor_id
    where re.id = r.id
    returning id into v_expense_id;

    update public.recurring_expenses
       set last_generated_on = v_due, updated_at = now()
     where id = r.id;

    recurring_id := r.id;
    expense_id := v_expense_id;
    generated_for := v_due;
    return next;
  end loop;
end;
$$;

revoke all on function public.process_recurring_expenses(date) from public;
grant execute on function public.process_recurring_expenses(date) to authenticated;
