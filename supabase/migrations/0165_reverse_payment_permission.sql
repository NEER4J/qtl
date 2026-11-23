-- 0165_reverse_payment_permission.sql
--
-- Reversing a payment becomes a permission the Admin can give (client call
-- 2026-11-19: "the reverse option is only in Admin; make it a permission").
-- Owners keep it as before (0153; co_owner is aliased to owner by
-- private.current_role(), 0124). Anyone else may delete a sales_payments row
-- when their profile's allowed_actions holds 'sales.reverse_payment', the
-- action key in lib/permissions/registry.ts. The app checks the same rule in
-- canReversePayments() (lib/permissions/check.ts).
--
-- The removed row stays in audit_log via trg_sales_payments_audit.

create or replace function private.has_action(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select p_key = any(coalesce(p.allowed_actions, array[]::text[]))
       from public.profiles p
      where p.id = auth.uid() and p.active = true),
    false
  );
$$;

revoke all on function private.has_action(text) from public;
grant execute on function private.has_action(text) to authenticated;

drop policy if exists sales_payments_delete_owner on public.sales_payments;
create policy sales_payments_delete_owner on public.sales_payments
  for delete to authenticated
  using (
    private.current_role() = 'owner'
    or private.has_action('sales.reverse_payment')
  );
