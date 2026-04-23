# Excel → Postgres migration

One-shot importer for the 2026 raw data files. Not executed automatically —
run manually when the owner is ready to cut over from Excel.

## Prerequisites

1. The Supabase migrations in `supabase/migrations/` (through `0009_*`) must
   be applied to the target database.
2. **At least one real Owner account must exist** (sign up via
   `/auth/register`). The importer creates a `import@qtl.internal` system user
   — if no profiles exist first, that system user would be promoted to Owner
   by the bootstrap trigger in `0002_profiles.sql`.
3. Drop the Excel workbooks into `scripts/migrate/data/` (this path is in
   `.gitignore`):

   ```
   scripts/migrate/data/
     2026_RawData_Sales.xlsx        # expected: ~935 rows
     2026_RawData_Expenses.xlsx     # expected: ~263 rows, 8 sheets
     # 2026_RawData_Payroll.xlsx    # Phase 2 — not imported yet
     # Apl 2026 Standard.xlsx       # Product & Pricing — Phase 2+
   ```
4. `.env.local` must contain:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   DATABASE_URL=postgresql://...         # direct Postgres connection
   ```

## Usage

```bash
npm run migrate -- --help              # show all flags
npm run migrate -- --dry-run           # default: rolls back at end
npm run migrate -- --commit            # persists
npm run migrate -- --only sales        # run a single step
npm run migrate -- --commit --allow-collisions=rename
```

Each run writes a JSON report to `scripts/migrate/reports/<timestamp>.json`
with inserted/updated counts, skipped rows (with reason), and any invoice
collisions.

## Steps

Run in this order (orchestrator does this automatically):

| # | Step | Source | Notes |
|---|------|--------|-------|
| 1 | `seed-reference` | — | Idempotent top-up of locations, services, categories, subcategories |
| 2 | `customers` | Sales sheet | Dedupe by lower(billing_name); merge plates |
| 3 | `vendors` | Expenses sheets | Dedupe by lower(name); category from sheet name |
| 4 | `sales` | Sales sheet | ~935 rows; unique per (location, invoice_no) |
| 5 | `sales-payments` | Sales sheet | Synthetic payment row for each paid/partial job |
| 6 | `expenses` | Expenses sheets | Sheet name → category; ~263 rows total |
| 7 | `expense-payments` | Expenses sheets | Synthetic payment row per paid/partial expense |

## Design rules

- **Service-role key** bypasses RLS. Never commit `.env.local`.
- **Transactions per step** via `postgres` (postgres.js). `--dry-run` forces a
  rollback at the end of every step; `--commit` commits per step so a failure
  in step 5 doesn't throw away successful inserts from steps 1–4.
- **Idempotent**: a `public.migration_source(source_file, row_hash)` table
  tracks every imported row. Reruns skip rows whose hash already exists; this
  means safe rerun after partial failure. Changing a cell in Excel produces a
  new hash, so that row will be imported as a new record (possibly triggering
  a collision — handle with `--allow-collisions=rename`).
- **System auth user** `import@qtl.internal` is created via the Supabase admin
  API on first run. All inserted rows have `created_by = importerId` so the
  audit trigger has a non-null actor. The session-local setting
  `app.actor_id` is also set per transaction for any future helper that wants
  to fall back to it.
- **Invoice collisions** (`(location, invoice_no)` already occupied by an
  active row) abort the import by default. Pass `--allow-collisions=rename` to
  suffix incoming rows with `-M<n>` and continue. All collisions appear in the
  run report.
- **Payment rollup**: sales_payments / expense_payments triggers recompute
  `paid_amount` and `payment_status` on the parent. The backfill steps
  insert exactly one synthetic payment equal to the parent's `paid_amount`,
  so the rollup produces the same value.
- **Pre/post invariants** you can spot-check after a commit:
  - `select count(*) from sales_jobs where deactivated_at is null` ≈ 935
  - `select count(*) from expenses  where deactivated_at is null` ≈ 263
  - `select count(*) from audit_log where action = 'insert'` ≈ sum of the above + customers + vendors + payment backfills
  - `select actor_id from audit_log where actor_id is null` → 0 rows

## Adjusting column mappings

Excel header wording varies. The importer normalises headers to
`snake_case` (see `utils/parse-xlsx.ts::normaliseHeader`) and expects the
normalised keys listed in `requireHeaders()` at the top of each step file.

If `requireHeaders` throws "Sheet X is missing columns Y", the error prints
the raw + normalised headers it saw — pick the matching raw header and either
(a) rename the Excel column to match, or (b) add a fallback like
`r.billing_name ?? r.customer_name` in the step file.

Location and payment-mode mappings live in `utils/normalise.ts`; add new
synonyms there as the Excel data reveals them.

## Layout

```
scripts/migrate/
  index.ts                        orchestrator
  01-seed-reference.ts
  02-customers.ts
  03-vendors.ts
  04-sales.ts
  05-sales-payments.ts
  06-expenses.ts
  07-expense-payments.ts
  utils/
    args.ts                       CLI flag parsing + help
    db.ts                         postgres.js connection + withTx()
    dedup.ts                      migration_source helpers
    hash.ts                       stable row hashing
    logger.ts                     timestamped stdout
    normalise.ts                  locations, modes, dates, money
    parse-xlsx.ts                 sheetjs wrapper + header normalisation
    report.ts                     per-run JSON report builder
    step.ts                       shared types
    supabase-admin.ts             admin client + ensureImportUser()
  reports/                        run logs (gitignored)
  data/                           raw Excel (gitignored)
```
