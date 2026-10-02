-- 0153_sales_payment_reversal.sql
-- Reverse a payment recorded against an invoice (client 2026-10-01 — "does the
-- app have a way to reverse a payment? One was applied on inv#329031 but this
-- invoice should be marked outstanding … TXN-006190").
--
-- Payments could only ever be added. The rollup trigger (0005, last redefined
-- in 0127) already re-totals paid_amount / payment_status on DELETE — its
-- comment even calls that the "owner-only path" — but no DELETE policy was
-- ever created, so RLS silently refused every attempt.
--
-- Owner only (co_owner is aliased to owner by current_role(), 0124), matching
-- sales_payments_update_owner. The removed row stays in audit_log via
-- trg_sales_payments_audit, so the reversal is traceable.

drop policy if exists sales_payments_delete_owner on public.sales_payments;
create policy sales_payments_delete_owner on public.sales_payments
  for delete to authenticated
  using (private.current_role() = 'owner');
