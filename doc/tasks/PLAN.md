# Plan: implement doc/tasks/TASKS.md (11 tasks) without breaking what's around them

## Context
The client logged 11 issues in `doc/tasks/TASKS.md`:
- pricing mismatches: oil detail, sales oil tier, oil groups, bundled parts
- a blocked engine delete
- slow sales pickers
- a grease-only fee
- an expense oil-purchase error
- deck analytics
- a users-page crash (already fixed in code)
- manual payroll deductions

Each task was traced to its root cause. After that, three read-only audits mapped every consumer of what the plan touches, and the key claims were re-verified by hand. This plan is the recommended approach plus the guardrails those audits turned up.

## Decisions (user, 2026-09-17)
- **T4:** the tier is picked from the job's **oil-line litres** (gallons × jug size). Package oil and return lines are excluded.
- **T5:** group price = the **highest cost** among its active oils, **no markup** (profit comes from the volume tier premium, as in the Excel oil-change sheets and the owner's current manual group prices). Gallons compared **per litre**. **Opt-in per group**; Gear & Trans stays manual.
- **T6:** **show both figures**, $0 as primary with the calculated/fixed price secondary, on the editor and the price list. The job dialog stays $0. No revert.
- **T7:** **no fee** on `free_grease_applied` jobs.
- **Defaults to flag to the client:**
  - T1: "other"-bucket package items are not filter cost.
  - T9: decks = Upper and Lower.
  - T11: employer amounts pre-fill but are editable; vacation and WSIB stay automatic.

## Progress (2026-09-17)
- **Done in code (phase 0 + 1):**
  - cron login-redirect fix
  - T10 write-side 0140 message
  - T8 (0143 RLS, quantity rules, visible item errors)
  - T2 (0144 merge + dialog)
  - T6 (bundled $0 display)
  - T3 quick wins: single-query package picker, debounced Trans & Diff, opt-in picker cache, cached settings in the part picker, no duplicate credit-balance read, slim invoice refs
  - T5 oil groups (0145): opt-in "price from the most expensive oil"; bulk = highest active cost, gallons compared per litre and charged × each oil's jug size, no markup (profit comes from the volume tier); membership saved in one transaction
- **Checks run:** `tsc`, `lint` on changed files and `next build` pass. **The migrations haven't been applied anywhere yet** (no local DB running).
- **Still to do on prod:**
  - apply the migration gap plus 0143, 0144 and 0145
  - confirm FF252's tier dialog shows $0
  - get the T8 error text from the client
  - measure picker timings
- **Migration numbers:** files apply in name order, so each new migration takes the next free number when it's written. The numbers used in the per-task sections below (0143 cost_bucket, 0144 oil_change_price, …) are placeholders: phase 1 already used **0143** (expense_items RLS) and **0144** (engine merge), and T5 used **0145**, so T1 starts at **0146**.

## Sequencing
| Phase | Work |
|---|---|
| 0 Prod hygiene | Diff prod `schema_migrations` against the repo; apply the gap (0137, 0140, 0142 at minimum). Fix the cron redirect. Reproduce T8 |
| 1 Small | T8, T2, T6, T3 quick wins |
| 2 Pricing core | T1, then T4 |
| 3 Features | T7 (reuses T1 buckets + T4 auto lines), T11, T9, T3 deeper |
| Done early | T5 (decided 2026-09-17: highest member cost as-is, profit from the volume tier; suggest the client add a small tier from 1 L for top-ups) |

## Global guardrails (apply to every task)
1. **`lib/db/types.ts` is hand-maintained.** Add new columns by hand. **Never run the `db:types:*` scripts**; they overwrite the named types.
2. **The Supabase client is untyped**, and results are cast with `as unknown as`. `tsc` won't catch a wrong select string, so check each changed query by hand.
3. **No zod `.default()` on new columns in update schemas.** `updatePartCategory`, `updateOilGroup` and `updateEmployee` spread every field into the update, so a default silently resets saved values (e.g. `DeductionFlags` defaults to true, `lib/schemas/payroll.ts:10-23`).
4. **Deploy migrations before code**, and write new reads so they survive a missing column:
   - `select *` plus a check that the key exists (`pricing.ts:976-978`)
   - the 42703 retry (`lib/auth/get-profile.ts:42-57`)
   - PGRST204 → "needs migration N" (`pricing.ts:1851-1858`)
5. **`"use server"` files can export only async functions.** Put enums and constants in `lib/utils` or `lib/schemas`.
6. **Cached reference getters** (`lib/cache/reference.ts`):
   - Changing the select string doesn't change the cache key. Bump the key name (e.g. `-v2`).
   - `revalidateTag(…, "max")` is stale-while-revalidate.
   - Each entry is limited to 2 MB.
7. **PostgREST caps responses at 1000 rows;** `.limit(10000)` doesn't lift it. Page with `.range` (`inventory.ts:62-76`) or aggregate in an RPC (`dashboard.ts`).
8. **Sales and expense saves aren't transactional** (header first, then delete + insert items). Zod must reject anything a new DB CHECK would reject, or a failed save leaves a header with no lines.
9. **Backfills fire triggers** (audit, stock, `updated_at`). Scope the WHERE tightly and guard updates with `is distinct from`.
10. **SECURITY DEFINER functions** need an owner check inside (`0123:34-36`). Put helpers in `private` or revoke execute from `anon`.
11. **Opening a sales job for edit already re-totals it** (`sales-job-form.tsx:294-346, 387-411`). New automation must be **event-driven** (user changes), never on mount, or re-saving an old invoice changes its total, paid status and store credit (`settledPaidAmount`, `sales.ts:596-604`).
12. **Local `supabase db reset` has no parts, packages or categories.** Verify pricing numbers against a prod snapshot or staging.

## Per task

### T10 Users page (code fixed)
- Apply 0140 on prod.
- `getCurrentProfile`'s base select also reads `location_ids` (0137) with no fallback, so if 0137 is missing everyone is logged out. Confirm 0137 is on prod first.
- The users.ts writes (`inviteUser`, `updateUser`, `updateUserPermissions`, `applyDefaultPermissions`) have no fallback. Map PGRST204 to "needs migration 0140".

### T1 Oil detail filter cost from packages
**Approach**
- **Cause:** filter cost sums `engine_filters` (`pricing.ts:861-876`). The seed collapsed repeated filters to qty 1, so Volvo D12 Fleetguard shows $68.79 against the package's $86.91.
- **0143** `part_categories.cost_bucket` (filter / oil / fuel / grease / other):
  - Backfill fuel and grease by **exact name** (keeps today's Fuel/Grease columns unchanged); filter by `%filter%` / `%separator%`. Hand-review the prod category list.
  - Add the field to the category dialog (`FormValues`, reset, payload) and a column to the categories table. **No default on update.**
- **Per-bucket package breakdown** replaces `loadPackagesWithExtras` (`pricing.ts:147-191`). Keep the `(cost+mhsw)×qty` basis.
  - Page `part_package_items` past 1000 rows.
  - Select `part_categories(*)` and fall back to exact-name matching when `cost_bucket` is missing (deploy order).
- **Filter source:** a resolved package with **≥1 filter-bucket item** → the package total; otherwise the `engine_filters` total. **Never add both.** Return `filter_source` and render it like `extras_known` (`oil-detail/[oilCode]/page.tsx:355-376`).
- **One shared TS resolver** for filter, labour, fuel and grease, used by `getOilDetail`, `getOilChangeGrid` (which today also lacks package labour, fuel and grease) and `getPrintList`. The print list is staff-facing, including its CSV.
- **`getOilChangeDetails`** is a per-brand pivot of `engine_filters`. Add a "Package filters" column; don't replace the brand columns.
- **0144** redefines `oil_change_price` with `create or replace` and the **same signature**. It mirrors the resolver:
  - explicit `labour_package_id` (any package), else a normalised-name match against active packages
  - fixes the gallon ÷ `litres_per_gallon` regression (`0122:147-150`)
  - must land after 0143; 0130 must be on prod
- **Fix the 7 collapsed `engine_filters` qtys.** Also fix the seed file, so re-running it (it calls itself idempotent) doesn't undo them.

**Guardrails**
- **`chargesTheSame`** (`lib/utils/engine-package-match.ts:147-154`) must also compare the filter bucket; otherwise auto-link silently changes filter cost. Update its reason text.
- **`engine_sell_prices` overrides** are read with `.limit(10000)` and are really capped at 1000 (`pricing.ts:368, 785`). Page them, or the grid, detail and SQL can't agree.
- **Sales auto-price:** only re-run when the user changes engine, oil or container, not on edit-page mount. Otherwise 0144 reprices historical invoices on re-save.
- **Package edits now move oil prices.** Add `/pricing/*` to `revalidatePartPackages` and update the package editor help.
- **Package oil lines have `part_id` null,** so the "oil" bucket excludes them. That's fine: the oil column stays litres × the selected grade's rate.
- **Copy that says `engine_filters` drives the price needs updating:**
  - `settings/pricing/engine-types/page.tsx`, `engine-types/[id]/page.tsx:55-63`, `engine-types-table.tsx:33-37`
  - `settings/pricing/page.tsx`, `service-costs/page.tsx`
  - `pricing/oil-grid/page.tsx`, `oil-detail/[oilCode]/page.tsx:58,90-93,145-167,249`
  - `auto-link-dialog.tsx`
- **Snapshots:** `oil_price_lock_items` breakdown columns are write-only, so there's nothing to migrate.

### T2 Engine delete → merge
**Approach**
- **Cause:** the block is correct; `sales_jobs.engine_type_id` is the only FK without a cascade.
- **0145** `merge_engine_types(target, source)`, security definer with an owner check:
  - Reassign `sales_jobs.engine_type_id`, then delete the source.
  - Let the source's `engine_filters`, `engine_sell_prices` and `oil_price_lock_items` **cascade away**. Don't move them into the target: that would change the target's live price, since locks and overrides take precedence.
- **Action** `mergeEngineType`.
- **Table:** "Used on N jobs" in the delete confirmation, and "Merge into…" suggesting the same `baseModelName` group. Bulk delete lists the skipped rows.

**Guardrails**
- Pre-check the source's jobs against `sales_total_chk` / `sales_paid_chk` and raise a clear error, since one bad legacy row aborts the whole merge.
- The mass update fires `updated_at` (historical jobs will show "Last edited today") and one audit row per job. Accept it and document it in the confirm dialog.
- `revalidatePricing` clears the cached engine list.

### T3 Slow pickers
**Quick wins**
- **Measure first:** server timing on the picker actions, plus where middleware and functions actually run. The region pin doesn't move Edge middleware.
- **Package picker:** a **new picker-only query**, a single nested select.
  - Keep `fetchPackageItems` for `lockPartPackage` and the settings screens.
  - Select `cost` and `mhsw_fee` to derive `package_unit_price`; flatten category and unit (`pcs` default); order items by position with `referencedTable`.
- **Trans & Diff picker:** debounce it. Quote `.or()` terms in the package and trans searches.
- **`useDebouncedSearch` cache:**
  - **Opt-in only**, with an explicit `cacheKey`. Cache successful responses only, with a short TTL.
  - Use it for the package and sales part pickers **only**.
  - **Never** for `customer-combobox` (its local label cache and stale free-grease offer), `merge-customers-dialog`, `vendor-combobox` or the expense parts picker (last buying price).
- **`listPartsForPicker`:** use `getCachedAppSettings`.
- **Customer select:** stop the duplicate `fetchCustomerCreditBalance`; narrow `getCustomerSalesHistory` to the 3 columns it uses.

**Deeper**
- **Catalogue server props** (packages, trans, promotions) through `cachedReference` with new tags, cleared from `revalidatePartPackages`, `revalidateTransDiff`, `revalidatePromotions` and `revalidatePricing`.
  - Strip costs per role outside the cache.
  - The promotion picker is also used by both expense forms. The package editor's trans picker stays live.
- **IP verdict cookie** in `lib/supabase/proxy.ts`:
  - Set it on the response after `getClaims` and keep `x-pathname`.
  - **Cache allow verdicts only**; bind user + IP + expiry; HMAC with `crypto.subtle` (Edge); new `IP_VERDICT_SECRET` env var (RPC fallback when unset); cookie name must not start with `sb-`.
  - Revoking an IP takes effect within the TTL.
- **Form totals:** replace the chained effects with **one** effect that still writes `sub_total`/`hst`/`total` to the form. Payments prefill, the credit max, banners and zod all read the form values.
  - Keep the dump-truck manual-base logic (`sales-job-form.tsx:302-318`).
  - Replace render-time `form.watch` with `useWatch`, including the `getValues` in render at 793/1264.
  - `React.memo(SalesLineItems)` with memoized props (the `oilGroups = []` default creates a new array every render).

### T6 Bundled display
- **First, confirm on prod** that adding FF252 to a job offers With Service $0.
- **Part editor:** when Bundled is ticked, the placeholder reads "$0 on jobs (bundled) · calc $X". If a fixed With Service price is set, it reads "fixed $X".
- **All-filter-price:** $0 primary with the calculated figure secondary, **including the print styles** (the printed sheet was the Sept 8 complaint).
- **Fix help text:** `part-form-dialog.tsx:831` promises a "second occurrence uses Over the Counter" rule that doesn't exist in code. Also fix the stale comments in `0059`, `types.ts:874` and `schemas/pricing.ts:236`.

### T4 Sales oil tier premium
**Approach**
- **0146** `sales_job_items.oil_container` and `auto_fee` (text; the zod enum matches the DB check exactly).
- **Persist and restore the container:** schema, form payload (`sales-job-form.tsx:654-667`), `replaceJobItems` (param type and row map), edit page mapping (`sales/[id]/edit/page.tsx:79-95`).
- **Tiers:** load them cached on the new and edit pages. Pure util `lib/utils/oil-tier.ts`, using the same rule as `pricing.ts:447-457`.
- **A single `reconcileAutoLines(lines, ctx)`** runs through one `onChange` wrapper in `SalesLineItems`.
  - The free-grease banner, which calls `setLineItems` directly (`sales-job-form.tsx:926-939`), must go through it too.
  - It adds, updates or removes one "Volume tier premium — <oil> (21 L+)" line per oil type, with `part_id`/`oil_type_id` null, taxable, and **no `package_label`**.
  - The litre sum skips `package_group` rows and negative-price lines.
- **Staff editing the premium's price clears `auto_fee`,** so it becomes a normal line and the change survives reload.

**Guardrails**
- **Stock:**
  - **Don't backfill `oil_container` on historical rows.** A null container = legacy, scaled ×1, so re-saves reverse exactly what was deducted and the backfill doesn't fire the triggers.
  - The trigger scales only `oil_container='gallon'` rows **without `package_group`**, using 0132's fallback (lpg ≤ 0 → 1).
  - Ship the code that saves the container **in the same release** as the trigger change.
  - `stock-shortfalls.ts` must scale the same way (including `sales.ts:546` old items) and round its message.
- **Event-driven only:** reconcile on user line changes, never on mount, so old jobs don't gain premiums when opened.
- **Invoice PDF:** put `auto_fee` lines under **Total Miscellaneous** (hard-coded $0 today, `InvoicePdf.tsx:580-583`), not Total Labour.
- **Daily report** (`reports.ts:571-605`): label or exclude `auto_fee` lines under "Parts used".
- **Auto-line detection** uses `auto_fee` only; many other lines also have null ids.

### T5 Oil group from highest price (done in code — 0145)
- **0147** `pricing_mode` (+ markups if the client wants them).
  - A **BEFORE UPDATE trigger on `oil_groups`** assigns `NEW.*` prices in auto mode, so the dialog can't overwrite them. Don't `UPDATE` the row itself.
  - An **AFTER trigger on `oil_types`** (cost columns, `oil_group_id`, `active`; add `litres_per_gallon` if pricing is per litre) recomputes the OLD and NEW groups, with an `is distinct from` guard.
  - The recompute helper lives in `private`.
- **Payload:** strip prices in auto mode. **No `pricing_mode` default in `UpdateOilGroupInput`.**
- **Membership:** move `setOilGroupMembers` into one transactional RPC; today it's two requests, and the group can go NULL between them.
- **Price history:** widen the constraint defined in **0044** (not 0024), and fix `listPriceHistory` labels.
- **Consistency:** make the Oil types charged-rate use active groups only.

### T7 Grease-only fee
**Approach**
- **0148** `app_settings.grease_only_fee` and `sales_jobs.grease_only_fee_waived`.
  - Wire the flag through `SalesJobInput`, form values, defaults and payload, the create/update inserts (`sales.ts:386-434, 608-655`), edit `initial`, and `types.ts`.
  - Add the setting to the Pricing defaults card.
- **`lib/utils/grease-only.ts`:** a grease-bucket line exists (including package rows through `category_id`), there are no oil, filter, fuel or trans lines, and `free_grease_applied` is not set.
  - Ignore `auto_fee` lines, promos, returns, labour, and the $0 free-grease line.
- **Reconcile:** handled in T4's `reconcileAutoLines`. Deleting the fee sets waived.

**Guardrails**
- Event-driven only (no fee added to old jobs on open).
- PDF: the fee goes under Total Miscellaneous.
- The sales pages need `cost_bucket` from the cached categories (bump the key).
- Percent promos are calculated when added, so a fee added afterwards isn't discounted. Document it.

### T8 Expense oil purchase error
- **Likely causes, now including RLS:** `expense_items` has **no cross-location write policy** (`0046` covers home location only; 0137/0142 didn't add one). A multi-location manager or staff member saving at another shop gets the header saved and the items rejected.
- **Fix:**
  - **0149:** mirror 0142's policies for `expense_items`.
  - Qty input `step="any"`.
  - zod `quantity` min **0.01**, matching `numeric(10,2) > 0`.
  - Show item validation errors, which currently go to the unregistered `items.N.quantity` field and disappear (`expense-form.tsx:261-266`).
- **Still get the client's exact message** to confirm.
- **Note, not fixed here:** `updateExpense` changes the location before replacing items, so stock is reversed at the wrong shop.

### T9 Deck analytics
- **RPC aggregate** `deck_analytics(from, to, location_ids, technician)`, because of the 1000-row cap.
  - Exclude credit and return jobs (0118).
  - Join `service_type_id`.
  - Match names trimmed and lower-case against **all** technicians, including inactive (`listAllTechnicians`).
- **UI:** a "Decks" section on `analytics/jobs/page.tsx`. Technician filter through the unused `extras` prop of `analytics-filters.tsx`, parsed in both the page and `api/export/jobs-analytics`.
- **Guardrail:** the analytics export routes and actions skip the page permission. Before exposing per-technician revenue in CSV, add a permission check in the route (owner/co_owner, or a new `ACTION_REGISTRY` key).

### T11 Manual payroll deductions
**Approach**
- **`PayrollEntryInput`:** add the six amounts.
- **`buildEntryPayload`:** saves them as typed and keeps `insurable_earnings` (WSIB and vacation use it). Remove the unused import.
- **Keep `apply_ei/cpp/cpp2` as explicit "exempt" flags** set in the dialog, **not** derived from amount > 0 (that would print "No CPP2" almost everywhere). Exempt → amount disabled at 0.
- **Keep the employee-form toggles** as the defaults that seed a new entry. That avoids the `DeductionFlags` default-true wipe on employee save.
- **Dialog:**
  - Employee and employer amount pairs; employer pre-fill uses the `ei_employer_multiplier` rate (fallback 1.4) and CPP 1:1.
  - "Estimate from rates" imports `computeStatutoryDeductions` client-side and needs `week_start` + `period_weeks` passed in. Hide it for roles that can't read `statutory_rates`.

**Guardrails**
- Respect the hidden `ei_cpp` / `benefits` columns (`permissions/registry.ts`) in the dialog.
- Zod refine: net pay ≥ 0; add a sane upper bound (`numeric(12,2)`).
- Update copy:
  - `payroll-entry-dialog.tsx:262-265`
  - `payroll/[weekId]/page.tsx:182,194-201`
  - `payroll/page.tsx:106-107`
  - `payroll-settings-card.tsx:60`
  - `statutory-rates/page.tsx:56`
  - 0135 column comments
- **Note:** re-saving old entries can zero `holiday_pay` on rows 0136 couldn't split (pre-existing).

## Pre-existing bugs the audits found (not in TASKS.md)
- **Cron never runs:** `/api/cron` hits the no-user login redirect (`lib/supabase/proxy.ts:69-79`) before its IP-lock exemption, so recurring expenses aren't processed. Fix in phase 0: skip the auth redirect for `/api/cron`; the route checks `CRON_SECRET` itself.
- **Analytics** queries are silently capped at 1000 rows (sales drops the latest days).
- **Engine sell-price overrides** are capped at 1000 in TS.
- **Export routes** don't check page permissions.
- **Staff with multi-location access** can't replace sales items at an extra location (delete is filtered to 0 rows).
- **Invoice PDF:** the dump-truck surcharge doesn't appear on it.
- **Package oil** deducts qty 1 instead of its litres.
- **Picker payloads** expose part cost to staff.
- **Payroll analytics and P&L** leave out CPP2 and employer amounts.

## Verification
- **Every change:** `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `supabase db reset` applying 0143+. Check every changed select string by hand.
- **Against a prod snapshot or staging** (local has no pricing data):
  - **T1:** Volvo D12/D13 Fleetguard filter cost $86.91; 5 engines match the Excel "Filtre Cost" column; grid, detail, print list and SQL auto-price agree. Opening an old OC job for edit doesn't change its subtotal.
  - **T2:** merge moves the job count; the source is gone; engine analytics totals unchanged.
  - **T3:**
    - Reopening the package picker takes < 200 ms; first open fires 1 action.
    - Typing in Trans & Diff fires 1 action.
    - Customer combobox behaviour is unchanged.
    - 1 form render per add.
    - IP block/allow still works, including after removing an IP (within the TTL).
  - **T4:**
    - 34 L → $25 premium; 40 L → $30; removing the oil removes the premium.
    - 3 jugs deduct 3 × jug litres.
    - Re-saving a pre-release gallon job doesn't move stock.
    - Package oil adds no premium.
    - PDF shows the premium under Miscellaneous.
  - **T6:** on-screen and printed lists show $0 + calculated; job dialog shows $0.
  - **T7:**
    - Trailer Grease only → fee.
    - Add oil → fee removed.
    - Free grease → no fee.
    - Waive persists after reload.
    - Old grease jobs opened for edit are unchanged.
  - **T8:** a multi-location manager saves bulk (208 L) and gallon (3.785) oil purchases at a non-home shop; stock rises.
  - **T9:** deck totals match SQL counts over a >1000-job range; the CSV is refused for staff.
  - **T11:**
    - Typed amounts flow into net pay, week totals, print and CSV.
    - Employee edits keep exemptions.
    - "No CPP2" only shows for exempt people.
    - Hidden columns stay hidden in the dialog.
- **Cron:** trigger `/api/cron/process-recurring-expenses` with `CRON_SECRET`; it processes instead of redirecting.
