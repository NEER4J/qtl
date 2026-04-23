# QTL — Phase 1 UAT checklist

Run this with the owner to sign off Phase 1 before retiring the Excel
workbooks. Expect ~1 hour end-to-end.

## Prep (30 min before the session)

- [ ] Target DB has migrations `0001_*` through `0010_*` applied.
- [ ] Owner has signed up at `/auth/register` — that account is now the
      bootstrapped Owner (first profile becomes `owner` per
      `handle_new_auth_user` trigger).
- [ ] `2026_RawData_Sales.xlsx` + `2026_RawData_Expenses.xlsx` are in
      `scripts/migrate/data/`.
- [ ] `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`,
      `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.
- [ ] Run `npm run migrate -- --dry-run`; fix any header-mapping errors.
- [ ] Run `npm run migrate -- --commit`.
- [ ] `psql "$DATABASE_URL" -f scripts/migrate/verify.sql` — confirm 0
      violations / mismatches.
- [ ] `supabase test db` — RLS smoke tests pass.

## With the owner

### 1. Account setup (5 min)

- [ ] Owner logs in, confirms their account shows role = **Owner**
      at `/settings/users`.
- [ ] Owner creates:
      - [ ] 1 Manager for Ayr
      - [ ] 1 Manager for Fort Erie
      - [ ] 1 Manager for Napanee
      - [ ] 1 Accountant
      - [ ] 2–3 Staff across the three shops (at least one with
            **can_enter_expenses = true**)

### 2. Cross-location visibility (5 min)

As Owner:
- [ ] `/dashboard` shows all 3 locations with non-zero totals.
- [ ] `/sales` filter-by-location works; totals match the verify.sql
      per-location numbers.
- [ ] `/expenses` shows rows from all 3 locations.

As Ayr Manager (incognito / different browser):
- [ ] `/dashboard` shows only Ayr numbers on the detail chart; the summary
      row still shows all 3 locations via `public.my_dashboard()` (that's
      expected — aggregates only, no row leakage).
- [ ] `/sales` list returns only Ayr rows.
- [ ] Attempt to navigate to a Fort Erie sales job's URL → 404 or
      "not found" (RLS hides it).

As Accountant:
- [ ] `/expenses` shows all 3 locations.
- [ ] `/sales` shows all 3 (read-only — no "New" button).

### 3. Data integrity spot-check against Excel (15 min)

Owner picks 3–5 invoices from Excel at random, one per location. For each:

- [ ] Open the invoice in the app — billing name, line totals, HST, total,
      payment status match.
- [ ] Payment history on the detail page equals the Excel pay-column
      (usually one synthetic row labelled "Backfilled from Excel during
      migration").

Same for 3 expenses.

### 4. Daily workflows (20 min)

As Ayr Staff:
- [ ] Create a new sales job via `/sales/new`. Check that saving redirects
      to detail and the job shows in `/sales`.
- [ ] Attempt to create a duplicate invoice number at the same location →
      error surfaced in form.
- [ ] Attempt to edit an already-submitted sales job → action blocked
      (button hidden / server action rejects).

As Ayr Manager:
- [ ] Add a partial payment to an existing sales job. Outstanding +
      payment_status update correctly.
- [ ] Mark an existing sales job as paid (bulk pay selected if multiple
      outstanding).
- [ ] Edit a sales job's comments — allowed on own location.
- [ ] Navigate to a FE invoice URL → denied.

As Accountant:
- [ ] Create a new expense for FE.
- [ ] Attempt to insert a subcategory that doesn't belong to the chosen
      category → trigger rejects with a clear error.

### 5. Owner-only actions (5 min)

- [ ] Owner deactivates one sales job (soft-delete). It disappears from
      `/sales` but stays accessible via URL if deactivated_at is shown.
- [ ] Owner reactivates it.
- [ ] Manager attempts to deactivate a job → rejected (`42501` from
      `sales_jobs_guard` trigger).

### 6. Settings (5 min)

- [ ] Owner adds a new expense category at `/settings/categories`. Confirm
      it's immediately selectable in the expense form.
- [ ] Owner toggles a staff member's `can_enter_expenses`. Staff refreshes
      — `/expenses/new` now accessible (or blocked, depending on
      direction).

### 7. Sign-off

- [ ] Owner confirms: "I can run a day's ops for all 3 shops entirely in
      this app. I don't need the Excel workbook for operations after
      today."

Archive the Excel files to cold storage; update the README to mark Phase 1
shipped.

## Known limitations (explicitly out of scope for Phase 1)

These are deferred to Phase 2+ — not bugs:

- No invoice PDF generation yet.
- No payroll module.
- No customer/vendor history pages beyond the basic list + detail.
- No audit-log UI (data exists; owner can inspect via SQL).
- No emails (overdue, weekly summary) — needs Resend wiring.
- No analytics pages beyond the dashboard summary cards and trend chart.
- No customer portal.
