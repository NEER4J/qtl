# QTL — Milestone 1: Scope, Coverage & Pending Items

**Purpose:** Document the originally agreed scope (Milestone 1), what has been delivered, and what remains to close the milestone — for client verification and sign-off.

**Milestone 1 was defined by two documents:**
1. **QTL Software Plan** (`doc/QTL Plan.md`) — the platform modules.
2. **May 2026 Standard workbook** (`doc/May 2026 Standard.xlsx`) — the pricing catalogue to mirror.

From sign-off onward, any new additions are tracked as **change requests**.

---

## 1. Initial Discussed Requirements (Milestone 1 scope)

**A. Platform modules (QTL Plan)**
- Role-based login & user management across the 3 locations (Ayr, Fort Erie, Napanee)
- Master + per-location dashboards
- Sales / Jobs — entry, list, detail, payments
- Invoices — list, detail, partial payments, branded PDF, PDF upload
- Expenses — categorized entry, list, detail, payments
- Payroll — weekly cycle with deductions and pay stubs
- Customers — profiles, job history, vehicles, outstanding balances
- Vendors — profiles, expense history
- Analytics — sales, jobs, products, expenses, payroll
- Reports & exports — Daily, Monthly, P&L, Outstanding, HST, etc.
- Audit trail; Settings (users, locations, categories, services); Customer portal
- Data migration from the legacy Excel files

**B. Pricing catalogue (May 2026 workbook)**
- Price List · Cost Source · All Filter Sell Price · Filter Cost
- Per-oil grids: 15W40 · 10W30 · T5 · T6 · Delo 5W30 · Petro variants (+ Gallon)
- Oil Price · Oil Service Cost · Profit · Sell Price
- Print List · Trans & Diff · FASS System · Grease

---

## 2. Delivered & Covered ✅

**Platform modules**
- ✅ Role-based login & user management, 3 locations
- ✅ Master & per-location dashboards
- ✅ Sales / Jobs (entry, list, detail, payments)
- ✅ Invoices with partial payments + branded PDF + upload
- ✅ Expenses (categorized) with payments
- ✅ Payroll (weekly cycle, deductions)
- ✅ Customers (profiles, job history, vehicles, outstanding)
- ✅ Vendors (profiles, expense history)
- ✅ Analytics (sales, jobs, products, expenses, payroll) incl. year-over-year
- ✅ Reports & exports incl. HST summary
- ✅ Audit trail, Settings, Customer portal
- ✅ Legacy pricing/parts catalogue imported (full transactional import scheduled at go-live)

**Pricing catalogue**
- ✅ Price List, Cost Source, All Filter Sell Price, Filter Cost
- ✅ All per-oil grids + Gallon variants, Oil Price, Print List
- ✅ Trans & Diff pricing
- ✅ Owner-only Profit / margin visibility

---

## 3. Added Points Covered (delivered during the build, beyond the original documents)

Built at the client's request while completing Milestone 1 — listed so they're acknowledged in this delivery:

- Username login for team members; **per-user granular permissions matrix** (page- and column-level)
- Additional roles — **Admin / Co-owner, Supervisor, Technician**; cross-location ("all locations") access; bulk "apply role defaults"
- Self-service profile (edit own name / password); owner can view & reset staff passwords
- **Vehicle records** expanded with VIN + compliance dates (cab card, drive-clean, license renewal), mileage & follow-ups
- Expanded customer profile (mailing vs billing, multiple phones, discount rules, HST config, card #)
- **Part packages** (bundled, collapse to one line) with smart overlap / merge handling; **Trans & Diff usable inside packages**
- Per-part pricing controls — per-part counter premium & customer-supplies labour; **dual MHSW (Sell + Buy)**; margin-on-MHSW; price tiers (With/Without service, Over Counter)
- **Per-location monthly invoice numbering** + per-location invoice header on PDF; single line-items invoice layout; MHSW shown as its own column
- **Technician / advisor roster** (Upper/Lower tech, advisor by location)
- **Inventory module** (per-location parts stock)
- Vendor multiple accounts per location + expense account selector
- Expense line items (multi-line bills, sub-cent unit costs)
- Payroll settings panel (vacation rate, WSIB); expanded payroll (overtime, stat-holiday, employer EI/CPP/WSIB); 12-month rolling totals
- Recurring expenses; statutory rate management (2026 EI/CPP)
- Free-grease offer as a $0 invoice line; in-app contextual help

---

**Current status:** With the scope above delivered, we are now handling day-to-day change requests from the client — implementing requested changes on a daily basis.

