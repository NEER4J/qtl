-- 0143_expense_items_cross_location.sql
--
-- FIX: a Multiple / All-locations manager (or expense-entering staff) could
-- save an expense at a shop other than their home one, but not its line items —
-- so an oil purchase or catalogue part on that expense failed.
--
-- Same gap 0142 closed for sales_job_items. 0061 / 0137 added cross-location
-- bypass policies to public.expenses, but expense_items was never on that list;
-- its policies (0046) still gate every write on
-- `e.location_id = private.current_location()`, i.e. the HOME shop only.
--
-- What the user saw (createExpense / updateExpense are not transactional):
--   * create — the expenses INSERT passes expenses_cross_loc_insert, then the
--     items INSERT is refused by RLS, leaving an expense header with no lines.
--   * edit   — replaceExpenseItems' DELETE is silently filtered to zero rows,
--     then the INSERT is refused.
--
-- Same additive strategy as 0061 / 0137 / 0142: leave the base policies alone
-- and add one permissive bypass policy per operation. Roles mirror the matching
-- public.expenses bypass policies (0137) so items can never be written where
-- the expense itself can't:
--   insert  → manager, or staff with can_enter_expenses (expenses_cross_loc_insert)
--   update  → manager                                   (expenses_cross_loc_update)
--   delete  → manager — delete is only ever issued as part of an edit
--
-- Predicate shape is copied from 0137 on purpose — read the PERFORMANCE note
-- there before "simplifying" the coalesce / sub-select wrapping.
--
-- Idempotent — safe to run more than once.

drop policy if exists expense_items_cross_loc_insert on public.expense_items;
create policy expense_items_cross_loc_insert on public.expense_items
  for insert to authenticated
  with check (
    (
      (select private.current_role()) = 'manager'
      or (
        (select private.current_role()) = 'staff'
        and (select private.can_enter_expenses())
      )
    )
    and exists (
      select 1 from public.expenses e
       where e.id = expense_items.expense_id
         and (
           (select private.has_cross_location())
           or e.location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
         )
    )
  );

drop policy if exists expense_items_cross_loc_update on public.expense_items;
create policy expense_items_cross_loc_update on public.expense_items
  for update to authenticated
  using (
    (select private.current_role()) = 'manager'
    and exists (
      select 1 from public.expenses e
       where e.id = expense_items.expense_id
         and (
           (select private.has_cross_location())
           or e.location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
         )
    )
  )
  with check (
    (select private.current_role()) = 'manager'
    and exists (
      select 1 from public.expenses e
       where e.id = expense_items.expense_id
         and (
           (select private.has_cross_location())
           or e.location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
         )
    )
  );

drop policy if exists expense_items_cross_loc_delete on public.expense_items;
create policy expense_items_cross_loc_delete on public.expense_items
  for delete to authenticated
  using (
    (select private.current_role()) = 'manager'
    and exists (
      select 1 from public.expenses e
       where e.id = expense_items.expense_id
         and (
           (select private.has_cross_location())
           or e.location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
         )
    )
  );
