-- 0134_payroll_editable.sql
-- Client 2026-08-31: "payroll needs to be editable."
--
-- Until now payroll_entries and payroll_cash_daily were writable ONLY while the
-- parent week was still 'draft' (0012). The moment a week was approved or marked
-- paid the rows froze: a wrong hour count, a mistyped income-tax figure, or a
-- payment logged against the wrong employee could never be corrected — the only
-- workaround was to create a second week and confuse the register. Real shops
-- correct payroll after the fact, so the draft gate goes away.
--
-- What replaces it is the SAME role/location rule the parent week already uses,
-- written out explicitly rather than leaning on the parent SELECT policy:
--   * owner (and co_owner, aliased to owner by 0124) — any location
--   * accountant — any location (cross-location finance role, per 0093)
--   * manager (and supervisor, aliased by 0074) — own location only
-- Staff/technician still cannot see payroll at all, so nothing widens for them.
--
-- Corrections are not silent: trg_payroll_entries_audit (0012) already records
-- every insert/update, and the app writes updated_by on each save.
--
-- DELETE comes along for free — these are `for all` policies — which is what
-- lets the app finally remove a mis-added entry, cash day, payment, or an empty
-- week created on the wrong date.
--
-- Helper calls are wrapped in (select …) so Postgres evaluates them once per
-- statement (the InitPlan pattern 0119 established) instead of once per row.

-- ============================================================================
-- payroll_entries — write at any week status
-- ============================================================================
drop policy if exists payroll_entries_write on public.payroll_entries;
create policy payroll_entries_write on public.payroll_entries for all to authenticated
  using (
    exists (
      select 1 from public.payroll_weeks pw
       where pw.id = payroll_entries.payroll_week_id
         and (
           (select private.current_role()) in ('owner', 'accountant')
           or (
             (select private.current_role()) = 'manager'
             and pw.location_id = (select private.current_location())
           )
         )
    )
  )
  with check (
    exists (
      select 1 from public.payroll_weeks pw
       where pw.id = payroll_entries.payroll_week_id
         and (
           (select private.current_role()) in ('owner', 'accountant')
           or (
             (select private.current_role()) = 'manager'
             and pw.location_id = (select private.current_location())
           )
         )
    )
  );

-- ============================================================================
-- payroll_cash_daily — write at any week status (mirrors the entry rule)
-- ============================================================================
drop policy if exists payroll_cash_daily_write on public.payroll_cash_daily;
create policy payroll_cash_daily_write on public.payroll_cash_daily for all to authenticated
  using (
    exists (
      select 1
        from public.payroll_entries pe
        join public.payroll_weeks pw on pw.id = pe.payroll_week_id
       where pe.id = payroll_cash_daily.payroll_entry_id
         and (
           (select private.current_role()) in ('owner', 'accountant')
           or (
             (select private.current_role()) = 'manager'
             and pw.location_id = (select private.current_location())
           )
         )
    )
  )
  with check (
    exists (
      select 1
        from public.payroll_entries pe
        join public.payroll_weeks pw on pw.id = pe.payroll_week_id
       where pe.id = payroll_cash_daily.payroll_entry_id
         and (
           (select private.current_role()) in ('owner', 'accountant')
           or (
             (select private.current_role()) = 'manager'
             and pw.location_id = (select private.current_location())
           )
         )
    )
  );

-- ============================================================================
-- payroll_payments — same rule, and location-scoped for managers.
-- 0093 let any manager touch any location's payments (its predicate never
-- looked at the week). Tighten that to the manager's own location while we are
-- here; owner / accountant are unchanged.
-- ============================================================================
drop policy if exists payroll_payments_write on public.payroll_payments;
create policy payroll_payments_write on public.payroll_payments for all to authenticated
  using (
    exists (
      select 1 from public.payroll_weeks pw
       where pw.id = payroll_payments.payroll_week_id
         and (
           (select private.current_role()) in ('owner', 'accountant')
           or (
             (select private.current_role()) = 'manager'
             and pw.location_id = (select private.current_location())
           )
         )
    )
  )
  with check (
    exists (
      select 1 from public.payroll_weeks pw
       where pw.id = payroll_payments.payroll_week_id
         and (
           (select private.current_role()) in ('owner', 'accountant')
           or (
             (select private.current_role()) = 'manager'
             and pw.location_id = (select private.current_location())
           )
         )
    )
  );

-- ============================================================================
-- payroll_entries.payroll_week_id was `on delete restrict`, which is right:
-- deleting a week must be a deliberate act, not a cascade nobody noticed. The
-- app's deletePayrollWeek removes payments + entries (cash days cascade off the
-- entry) first, and only then the week. Left as-is on purpose.
-- ============================================================================
