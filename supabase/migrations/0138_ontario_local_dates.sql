-- ============================================================================
-- 0138 — Ontario-local dates for every server-side "today"
--
-- The shops are in Ontario; this database is not. `current_date` resolves
-- against the *session* timezone, which on Supabase is UTC, so from 8:00 PM
-- EDT (7:00 PM EST) onward it already reports tomorrow. Shops are open then,
-- so a payment or customer created in the evening was being dated a day ahead.
--
-- Every default and trigger below is repointed at the Ontario calendar day.
-- `at time zone` handles EDT/EST automatically — no hardcoded offset.
--
-- Scope note: this deliberately does NOT change the database-wide `timezone`
-- setting. Doing that would silently alter how every existing query renders
-- timestamptz values; changing these specific defaults is the surgical fix.
--
-- Idempotent — safe to run more than once.
-- ============================================================================

-- Ontario's current calendar date. Immutable-free (depends on now()), so it is
-- marked stable and used only in defaults / trigger bodies.
create or replace function public.today_ontario()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Toronto')::date;
$$;

comment on function public.today_ontario() is
  'Current calendar date in America/Toronto. Use instead of current_date so '
  'evening activity is not dated a day ahead by the UTC session timezone.';

-- ----------------------------------------------------------------------------
-- Payment dates
-- ----------------------------------------------------------------------------
alter table public.sales_payments
  alter column paid_on set default public.today_ontario();

alter table public.expense_payments
  alter column paid_on set default public.today_ontario();

alter table public.payroll_payments
  alter column paid_on set default public.today_ontario();

-- ----------------------------------------------------------------------------
-- Free-grease window (30 days from signup)
-- ----------------------------------------------------------------------------
create or replace function public.customers_set_free_grease()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.free_grease_until is null then
    new.free_grease_until := (public.today_ontario() + interval '30 days')::date;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Recurring expenses
-- ----------------------------------------------------------------------------
-- process_recurring_expenses(as_of date default current_date) is intentionally
-- left alone. Its body is long and rewriting it here to change one parameter
-- default would risk drifting from 0014. The only caller — the Vercel cron at
-- app/api/cron/process-recurring-expenses — now passes an explicit Ontario
-- date, so the UTC default is unreachable in normal operation. It remains a
-- fallback for hand-run psql calls; pass an explicit date there.
