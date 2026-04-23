# QTL — Supabase

Database schema, RLS policies, and seed data for the QTL platform.

## Local development

Prerequisites: Supabase CLI (`brew install supabase/tap/supabase`) and Docker.

```bash
# Start local stack (Postgres, Auth, Studio at http://localhost:54323)
supabase start

# Apply all migrations + seed
supabase db reset

# Generate TypeScript types for the app
supabase gen types typescript --local > ../lib/db/types.ts
```

## Migration order

| File | Purpose |
|---|---|
| `0001_init.sql` | Extensions, enums, reference tables (locations, service_types, expense_categories/subcategories, app_settings), audit_log table, shared triggers |
| `0002_profiles.sql` | `profiles` table mirroring `auth.users` + auto-insert trigger |
| `0003_rls_helpers.sql` | `private` schema with security-definer helpers for RLS |
| `0004_sales.sql` | `sales_jobs`, `sales_payments`, rollup trigger |
| `0005_expenses.sql` | `expenses`, `expense_payments`, category/subcategory match trigger, rollup |
| `0006_customers_vendors.sql` | `customers`, `vendors` |
| `0007_rls_policies.sql` | Full role/location RLS matrix across every table |
| `0008_dashboard_fn.sql` | `public.location_summary()` aggregator for manager cross-location view |

## Seed data

`supabase/seed.sql` is applied automatically by `supabase db reset`. It seeds:
- 3 locations (Ayr, Fort Erie, Napanee)
- 4 service types (OC, PG, FG, MISC)
- 8 expense categories with subcategories
- 1 row of app_settings (HST 13%)
