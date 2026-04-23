-- 0013_customer_portal.sql
-- Phase 4 — Customer portal.
-- Trucking-company customers can log in and view their own invoices.
-- We add a new `portal_customer` role and a link table connecting auth users
-- to customer records. RLS lets that role see only its own data.

-- ============================================================================
-- Extend user_role enum
-- ============================================================================
alter type user_role add value if not exists 'portal_customer';

-- ============================================================================
-- customer_portal_access — one row per (auth user -> customer) mapping.
-- A single customer record can have multiple portal users (e.g. dispatcher
-- and office manager from the same trucking company).
-- ============================================================================
create table if not exists public.customer_portal_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (profile_id, customer_id)
);

create index if not exists idx_cpa_customer on public.customer_portal_access(customer_id);
create index if not exists idx_cpa_profile  on public.customer_portal_access(profile_id);

alter table public.customer_portal_access enable row level security;

drop policy if exists cpa_select_own on public.customer_portal_access;
create policy cpa_select_own on public.customer_portal_access for select to authenticated
  using (
    private.current_role() in ('owner', 'manager')
    or profile_id = auth.uid()
  );

drop policy if exists cpa_write_admin on public.customer_portal_access;
create policy cpa_write_admin on public.customer_portal_access for all to authenticated
  using (private.current_role() in ('owner', 'manager'))
  with check (private.current_role() in ('owner', 'manager'));

-- ============================================================================
-- Helper: returns the customer_id set the portal user can access.
-- ============================================================================
create or replace function private.portal_customer_ids()
returns uuid[]
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select coalesce(array_agg(customer_id), '{}'::uuid[])
    from public.customer_portal_access
   where profile_id = auth.uid();
$$;

revoke all on function private.portal_customer_ids() from public;
grant execute on function private.portal_customer_ids() to authenticated;

-- ============================================================================
-- Extend sales_jobs RLS to permit portal_customer read on their own rows.
-- ============================================================================
-- Note: `private.current_role()::text` (not the enum literal) — the new enum
-- value 'portal_customer' was just added above in this same transaction, and
-- Postgres refuses to resolve it as an enum literal until that ALTER commits
-- (SQLSTATE 55P04). Comparing via text sidesteps the resolution entirely and
-- gives the same semantics.
drop policy if exists sales_jobs_portal_select on public.sales_jobs;
create policy sales_jobs_portal_select on public.sales_jobs for select to authenticated
  using (
    private.current_role()::text = 'portal_customer'
    and customer_id is not null
    and customer_id = any(private.portal_customer_ids())
    and deactivated_at is null
  );

-- Portal customers can also see the payments attached to their invoices.
drop policy if exists sales_payments_portal_select on public.sales_payments;
create policy sales_payments_portal_select on public.sales_payments for select to authenticated
  using (
    private.current_role()::text = 'portal_customer'
    and exists (
      select 1 from public.sales_jobs sj
      where sj.id = sales_payments.sales_job_id
        and sj.customer_id = any(private.portal_customer_ids())
    )
  );
