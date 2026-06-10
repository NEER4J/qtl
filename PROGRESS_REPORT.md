# QTL Platform — Development Progress Report

**Project:** Quick Truck Lube (QTL) — shop management platform
**Period covered:** 15 April 2026 → 9 June 2026
**Prepared:** 9 June 2026

---

## 1. What the platform is

QTL is a web-based management system for a multi-location truck-lube business. It replaces a set of Excel workbooks and manual processes with a single application that handles:

- **Sales / job tickets** and **invoicing** (with branded PDF invoices and a customer-facing portal)
- **Customers & vehicles** (fleet records, compliance dates, billing setup)
- **Pricing catalogue** (filters, oils, packages, transmission/differential services, labour costs)
- **Expenses, vendors & inventory**
- **Payroll** (weekly cycles, overtime, statutory holiday, vacation, employer remittances)
- **Analytics & reports** (sales, products, HST, P&L, outstanding receivables)
- **User management** with role-based permissions across multiple shop locations

Built on Next.js + Supabase (Postgres) with row-level security and a full audit log on every change.

---

## 2. Day-by-day progress

### April 2026 — Foundation & core modules

**15 April — Project foundation**
- Stood up the project: framework, database connection, UI component library.
- Built the authentication system: login, password reset, email verification.
- Created the main app shell with sidebar navigation and user profile.
- *(Scaffolding — no business features yet.)*

**23 April — Core application built out (8 modules)**
- **Sales:** record customer jobs, track payments, generate PDF invoices.
- **Expenses:** vendor bills with categories, payment status and balances.
- **Payroll:** weekly pay cycles with draft → approve → paid workflow.
- **Customers & Vendors:** directories with outstanding-balance tracking.
- **Analytics & Reports:** sales/jobs/products/expenses/payroll views, plus HST summary, P&L, and outstanding-receivables reports.
- **Settings:** user management, locations, expense categories, service types.
- **Audit log:** every change recorded.
- Seeded the database with 800+ parts and 45 engine configurations from the legacy data.

**24 April — Pricing catalogue, customer portal & support tools**
- **Pricing Catalogue admin:** oil types, engine types, parts (800+ filters with cost / list price / fees), categories & brands, labour (service) costs, and volume tiers.
- **Customer portal:** public page where customers view invoices, payment status, and download PDFs.
- **Recurring expenses:** templates that auto-generate monthly/weekly/annual vendor bills.
- **Statutory rates:** settings page for annual federal tax rates (EI/CPP).
- **In-app help system:** contextual help cards and a central help hub.
- Smart "type-to-search / create" dropdowns added throughout pricing and sales forms.

**28 April — Pricing logic, invoices & automation**
- **Part margin engine:** fixed-amount or percentage margins, with a minimum-margin threshold setting.
- **Invoices list & detail** page with filtering and export.
- **Price-history tracking:** audit page for every pricing change over time.
- **Automated recurring-expense generation** (scheduled task).
- Expanded product/service analytics with revenue breakdowns and export endpoints.
- Added company logo/branding and an app-wide loading indicator.

**29 April — Itemized jobs & part packages**
- **Line items on jobs:** jobs are now built from individual parts / free-text lines instead of a flat total.
- **Part packages:** bundle multiple parts into a pre-priced package, with an admin package editor.
- **Invoice PDF redesign:** itemized, professional layout with tax flags.
- Sales job form fully reworked around line items, package picker and part selection.

### May 2026 — Customers, pricing depth & access control

**2 May — Vehicles & richer customer profiles**
- **Vehicle records per customer:** plate, VIN, year/make/model, engine spec, plus compliance tracking (cab card, drive-clean date, license renewal) and follow-up/mileage.
- **Full billing address** on customers; **multiple locations per vendor**.
- **Daily report** with revenue/expense breakdown and charts.
- Sales form updated to select a customer's specific vehicle.

**5 May — Vendor depth & oil pricing detail**
- **Vendor invoices** (history, payments, balance) and **vendor parts** (which parts a vendor supplies, with pricing).
- **Oil-change price grid detail:** full pricing breakdown for each engine + oil combination.
- Per-customer loyalty **card number**; configurable **oil-type taxability**.

**8 May — Expense line items & package pricing controls**
- **Expense line items:** add multiple parts/materials to a bill, each with qty, unit cost and auto line total (from vendor catalogue or free-text).
- **Package price lock/unlock:** owners can lock a package's price as of a date and snapshot all underlying item prices.
- **Labour on packages:** packages now carry labour cost + labour sell price.
- **Second-unit pricing:** a part can charge a different price when it appears twice on the same job.
- **Category-conflict detection:** warns when an added part/package duplicates a category already on the job.

**12 May — Pricing reference pages & payroll expansion**
- **All Filter Sell Price** page: every filter with four price modes (With Service / Without Service / Over Counter / Customer Supplies).
- **Per-oil detail pages** and a **printable pricing list** for counter staff.
- **Payroll expansion:** overtime, statutory holiday pay, vacation accrual, and employer EI/CPP/WSIB added to pay calculations.
- **Payroll dashboard:** rolling 12-month totals (gross, deductions, net, employer cost) across all locations.
- Loaded **2026 federal EI/CPP rates**.

**18 May — Transmission & differential services**
- **Trans & Diff pricing page:** flat-priced transmission, differential, combined, specialty, and coolant-flush services, with regular vs. synthetic pricing.
- Seeded the catalogue from the May 2026 pricing workbook (Allison, DT12, I-Shift, coolant flush, etc.).

**19 May — Employee password management**
- Owner-only ability to **view, copy and reset employee passwords** from the dashboard, with a "last set" timestamp and show/hide controls.

**20 May — May 2026 cost & price import**
- Imported the **May 2026 engine sell prices and filter costs** from the Excel workbook; added oil-label tooling and sibling-oil mirroring so pricing matches the source sheet.

**21 May — Navigation consolidation**
- Reorganized the menu so all pricing/catalogue management (parts, packages, categories, brands, oils, engines, service costs, volume tiers, price history) lives in one place.

**22 May — Role-based access control overhaul**
- **Username login** for team members (e.g. "ahmad") instead of email.
- **Permissions matrix:** owner can grant/deny each user access to specific screens and hide specific columns.
- **Role defaults** (Owner / Manager / Accountant / Staff) with per-user overrides.
- **Cross-location ("all locations") access flag** for managers/staff.

**25 May — Expanded customer form & sales improvements**
- Customer form expanded to capture multiple phones, mailing vs. billing addresses, payment setup (default method, COD), discount rules, late-payment charges, HST config and notes.
- **Vehicle entry built into the customer form**; sales form auto-fills from the selected customer and supports multi-payment entry.
- Cleaned and validated the oil pricing grid data.

**26 May — Invoice numbering, technician roster & co-owner role**
- **Per-location monthly invoice numbers** (e.g. `AYR202605250001`), resetting on the 1st of each month per location.
- **Technician roster:** managed list of techs/counter staff used as dropdowns for Upper Tech / Lower Tech / Advisor on jobs (activate/deactivate without losing history).
- **Co-owner role** with full administrative access (so more than one person can administer without sharing a login).
- Database-level cross-location access rules enforced across all tables.

**28 May — Packages: transmission services, overlap handling & collapsed display**
- **Trans & Diff services inside packages** (priced with labour).
- **Overlap/merge detection:** if a package duplicates something already on the job (same category, oil, or trans service), prompt to **merge (drop duplicate)** or **add separately**; merged items show struck-through with the amount saved.
- **Collapsed package display:** packages show as one total line on jobs and invoices (items listed as "Included"), while the underlying detail is preserved for tax/cost accuracy.

### June 2026 — Roles refinement, inventory & client change rounds

**1 June — Roles, profiles & form polish**
- **Supervisor & Technician roles** added (modelled on Manager / Staff access).
- **"Apply role defaults" bulk action** on the Users page.
- Added a **12-hour time picker** for job start/end times and a customer **email** field.

**2 June — Permissions & precision fixes**
- Simplified the permissions matrix (split "apply default" controls, all pages unlockable).
- **Sub-cent unit costs** supported on expense line items.

**5 June — Admin role model, inventory & self-service profile**
- **Role model finalized:** "Admin" = co-owner (full access incl. Settings); Owner now has everything *except* Settings; managers/supervisors get all-locations.
- **Inventory module:** per-location parts stock tracking.
- **Username login for Admin** (with an optional real email kept on file).
- **Self-service Profile page:** any user can edit their own name and change their own password.
- Restored Pricing Catalogue shortcuts to the sidebar (Admin-only).

**6 June — Per-part pricing & payroll settings (client change round 1)**
- **Per-part Counter Premium and Customer-Supplies labour** (override the global default per part).
- **Two MHSW fees per part:** "Sell MHSW" (priced) and "Buy MHSW" (cost reference).
- **Payroll settings panel:** vacation-pay rate and WSIB moved out of Pricing into their own Payroll settings.
- **Advisor picker filtered by location**; **labour pickers** added to jobs (add a service-cost line or a free-form labour line).
- Package builder now shows Quantity / live Total / per-unit price override.
- Cleaned up the login screen (removed public sign-up — accounts are admin-provisioned).

**9 June — Invoices, vendors & pricing (client change round 2)**
- **Navigation reorder:** Dashboard → Operations → Pricing → Finance → Analytics/Reports → Settings.
- **Oil-change grid = engine oils only** (a per-oil "engine oil" toggle controls what appears).
- **MHSW math update:** Sell MHSW now folds into cost before margin, and MHSW shows as its **own column** on the job table and invoice.
- **Invoice header pulls from the job's location** (name, address, phone, fax, HST number) and shows the branch name — instead of a single hard-coded header.
- **Single invoice line-items table** (the separate "Description of Work" box was removed; packages, labour and parts all render in one table).
- **Vendor multi-accounts per location**, with an **account selector on the expense form** that fills in the account number/type automatically.
- **Free Grease** is now a real $0 line item on the job (and $0 jobs correctly count as paid, not outstanding).

---

## 3. Status note

- The platform is in active development; the most recent two weeks (late May → June) have been **client change rounds** refining pricing, invoicing and access control based on direct feedback.
- A set of database migrations from the June change rounds (`0079`–`0086`) are **prepared and pending application** to the live database — the corresponding screens go live once those are run.
- Remaining pricing items not yet mirrored from the Excel workbook: **Grease services**, the **FASS system** configs, and a **profit/sell-price summary roll-up** (Trans & Diff and the per-oil detail pages are already done).

---

*This report is reconstructed from the project's commit history; dates reflect when each set of changes was committed.*
