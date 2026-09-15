# QTL Tasks

## 1. Fix filter cost / oil cost mismatch on Oil detail

**Status:** Open  
**Area:** Pricing → Oil detail (vs packages / standard job sheet)

### Problem
Filter cost and oil cost on Oil detail do not match the sheet (Standard Job List).

- Same filter can appear twice in oil details (duplicate columns / double-counted).
- Fuel, grease, and labour already come from packages, but filter pricing does not seem to follow the same package path.
- Item quantities (counts) from the package are likely not applied (e.g. LF17503 qty 2 should be $18.12 × 2).
- **Categories** matter: package line items must be grouped by part category (filter, oil, fuel, grease, etc.) so each cost column gets the right total.

### Expected
- Pull filter (and related) pricing from **Packages**, same as fuel / grease / labour.
- Use **part categories** to decide what goes into filter cost vs oil cost vs fuel / grease (do not mix categories).
- Respect package item **qty** when computing each category total.
- Avoid double-counting the same filter.

### Example (Volvo With Fleetguard)
Package shows:
- LF17502 × 1 @ $21.01
- LF17503 × 2 @ $18.12 → $36.24
- FF4212800 × 1 @ $29.66

Sheet / oil details currently can list the same oil filter twice and sum both, so totals diverge.

### Refs
- `doc/tasks/refs/01-standard-job-list-filter-cost.png` — Excel Standard Job List (duplicate filter columns, SUM)
- `doc/tasks/refs/02-package-parts-qty.png` — Package parts with qty (e.g. LF17503 qty 2)
- `doc/tasks/refs/03-oil-detail-filter-oil-cost.png` — Oil detail page filter / oil cost columns

## 2. Cannot delete unlinked engine type

**Status:** Open  
**Area:** Settings → Pricing → Engine types

### Problem
Cannot delete an engine type that has **Labour package: Not linked** (e.g. inactive Cummins ISC/ISL/ISB duplicate).

**Blocker shown:** `"This engine has been used on a sales job and can't be deleted — deactivate it instead."`

So delete is blocked because the engine is tied to a past sales job, even when labour package is Not linked / the row is a duplicate the user wants removed.

### Expected
Clarify / fix delete rules for unused or duplicate engines (Not linked). If it truly was used on a sales job, document that deactivate is the only path; if the check is wrong for duplicates / unlinked rows, allow delete.

### Refs
- `doc/tasks/refs/04-engine-types-cannot-delete-unlinked.png` — Engine types list showing Not linked + inactive row
- `doc/tasks/refs/05-engine-delete-blocked-sales-job.png` — Delete error: used on sales job

## 3. Sales dropdowns are slow (packages + other items)

**Status:** Open  
**Area:** Sales — add package / item dropdowns

### Problem
Adding packages on a sales job is very slow in the dropdown. Same lag for other item dropdowns too.

### Expected
Make package and related item pickers faster (load / search / open feel snappy).

## 4. Missing tier price when adding oil on sales

**Status:** Open  
**Area:** Sales → Add oil (vs Volume tiers / Oil-change grid)

### Problem
When adding oil on a sales job, the **tier premium** (volume tier price) is not applied. Oil shows only the base unit price (e.g. Delo 400XLE 10W30 SYN Blend bulk @ $5.12/LTR) with no Tier+.

Oil-change grid already shows **Tier+** per engine (e.g. $25 / $30), and Volume tiers settings define premiums by min litres (e.g. 21L → $25, 39L → $30 for 257000).

### Expected
Sales oil pricing should include the volume **tier premium** the same way Oil-change grid / Computed selling does (based on litres / engine capacity).

### Refs
- `doc/tasks/refs/06-sales-oil-missing-tier.png` — Sales line items: oil at base unit price only
- `doc/tasks/refs/07-oil-change-grid-tier-plus.png` — Oil-change grid with Tier+ column
- `doc/tasks/refs/08-volume-tiers-settings.png` — Volume tiers premiums for Delo 400XLE 10W30

## 5. Oil group: highest-price oil drives group pricing

**Status:** Open  
**Area:** Settings → Pricing → Oil groups (Edit oil group)

### Problem / Need
Oil groups currently have manual **Bulk price $/L** and **Gallon price $/container**. Need a **highest pricing oil** concept for the group.

### Expected
- Identify / use the highest-priced oil among oils in the group.
- When any oil price in the group changes, **update group pricing** from that highest price.
- Apply for **both bulk ($/L) and gallon ($/container)**.

### Refs
- `doc/tasks/refs/09-oil-group-highest-price.png` — Edit oil group modal (bulk / gallon + member oils)

## 6. "Bundled in a package" no longer zeros With Service

**Status:** Open  
**Area:** Parts / catalog pricing (Edit part)

### Problem
**Bundled in a package** is not working correctly anymore. It used to make **With Service $0** (the “time” / with-service charge). Now it does not — regression; it used to work fine.

UI copy still says: adding the part alone should offer With Service at $0 because the package already covered it.

### Expected
Restore prior behaviour: when Bundled in a package is set, With Service price is **$0**.

### Refs
- `doc/tasks/refs/10-bundled-in-package-not-zero.png` — Part edit: Bundled checkbox + With Service still calculated

## 7. Extra fee when job is grease-only (no oil / big job)

**Status:** Open  
**Area:** Sales invoice + Settings (new controllable price)

### Problem / Need
If a customer comes **only for greasing** (truck and/or trailer) — no oil change or other big job — add an **extra charge** on the invoice.

### Expected
- Detect grease-only jobs (greasing present, no oil / other major services).
- Apply a configurable **extra pricing** amount.
- Controllable in **Settings** (admin can set the amount).
- Show clearly on the **invoice**.

### Refs
- `doc/tasks/refs/11-grease-only-extra-pricing.png` — Sales: Trailer Grease package only (example grease-only job)

## 8. "Not enough quantity" when adding oil purchase in expenses

**Status:** Open  
**Area:** Expenses → Add oil purchase

### Problem
When adding an **oil purchase** on an expense, the app shows something like **"not enough quantity"**. Expenses should **increase** on-hand stock, so a stock-shortage check should not block oil purchases.

### Expected
Allow adding oil purchases on expenses without a "not enough quantity" error (purchases add inventory, they don't consume it).

### Refs
- `doc/tasks/refs/12-expenses-oil-purchase-qty-error.png` — Expense form: Add oil purchase

## 9. Analytics: show all deck types / options

**Status:** Open  
**Area:** Analytics

### Problem / Need
Need analytics visibility into **decks** — all deck types / options — so we can see what is happening with the decks (e.g. related to Upper tech / Lower tech on the job).

### Expected
Analytics should surface **all deck options/types** and make deck activity clear (what’s happening per deck).

### Refs
- `doc/tasks/refs/13-job-upper-lower-tech-decks.png` — Job form: Upper tech / Lower tech fields

## 10. Settings → Users page server error

**Status:** Fixed (code) — still apply migration 0140 on prod DB  
**Area:** `/settings/users`

### Problem
Application error / server-side exception on Users page. Digest matched local:
`column profiles.allowed_actions does not exist` (Postgres 42703). Migration 0140 not applied; `listUsers` selected that column and threw.

### Fix
`listUsers` retries without `allowed_actions` when the column is missing (same survival path as `getCurrentProfile`).

### Follow-up
Run `supabase/migrations/0140_page_action_permissions.sql` on production so action permissions work for real.

### Refs
- `doc/tasks/refs/14-settings-users-server-error.png` — Production Users page crash

## 11. Payroll: make CPP / CPP2 / EI (etc.) manual, not auto

**Status:** Open  
**Area:** Payroll → Add / edit payroll entry

### Problem / Need
CPP, CPP2, EI and similar options are calculated **automatically** on save (toggles under “What applies this period”). Rates change often, so auto calc is unreliable.

### Expected
Enter **CPP, CPP2, EI** (and related employer/other amounts as needed) **manually** on the payroll entry instead of auto-calculating from toggles.

### Refs
- `doc/tasks/refs/15-payroll-manual-cpp-ei.png` — Add payroll entry modal (auto-calc note + EI/CPP toggles)
