-- 0090_audit_coverage_and_visibility.sql
-- Two fixes for the audit log:
--   1. Visibility: listAuditLog() allows owner/co_owner/accountant, but
--      audit_log had no SELECT policy for accountant (only owner+manager in
--      0007, is_owner in 0067, cross-loc manager in 0061). So an accountant saw
--      zero rows. Add an accountant SELECT policy. (owner/co_owner already see
--      everything via the existing policies.)
--   2. Coverage: the pricing catalogue tables had no audit_row() trigger, so
--      price/catalogue/stock changes (incl. part deactivations) weren't logged.
--      Attach the existing public.audit_row() trigger to them.

-- 1. Accountant can read the audit log -----------------------------------------
drop policy if exists audit_log_accountant_select on public.audit_log;
create policy audit_log_accountant_select on public.audit_log
  for select to authenticated
  using (private.current_role() = 'accountant');

-- 2. Audit triggers on the pricing catalogue -----------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'parts',
    'oil_types',
    'engine_types',
    'service_costs',
    'part_categories',
    'part_brands',
    'part_location_stock'
  ]
  loop
    -- Only attach if the table exists (defensive across environments).
    if exists (
      select 1 from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = t and c.relkind = 'r'
    ) then
      execute format('drop trigger if exists trg_%I_audit on public.%I', t, t);
      execute format(
        'create trigger trg_%I_audit after insert or update or delete on public.%I '
        'for each row execute function public.audit_row()',
        t, t
      );
    end if;
  end loop;
end $$;
