# QTL — Phase 2 owner questions

Questions pulled from the 2026-04 voice note that must be answered **before**
Phase 2 schema is written. Each item is scoped to one decision; a yes/no or
short answer is enough. Anything marked ⛔ blocks schema work until resolved.

Please reply inline (write answers directly below each question) and send
back. Expected turnaround: ~30 minutes.

---

## 1. Expense categories & vendors

### 1a. Bank sub-categories — model as vendors, not sub-categories? ⛔

Today "Bank" has two sub-categories: *Loan Interest* and *Credit Card Cost*.
You mentioned needing more granularity (multiple loans, credit-card service
charges, EFT/bank fees).

**Proposal:** keep the two existing sub-categories; model the granularity as
**vendors** — e.g. a vendor called "TD Bank – Loan A", "TD Bank – Loan B",
"BDC – Loan 1", "Stripe – CC fees". That way the P&L still groups cleanly
under "Loan Interest" / "Credit Card Cost" but you can drill down per
vendor.

Alternative: add new sub-categories *EFT Fee*, *Service Charge*, *Wire Fee*,
etc.

> **Answer:**

> **Which names to create, in each case:**

---

### 1b. Lease / Rent — promote to its own top-level category? ⛔

Today rent sits under `Misc › Land Lease`. You indicated it may deserve its
own top-level category.

- If yes: new category name? ("Rent"? "Lease & Rent"?)
- Any sub-categories under it? (e.g. *Ayr Premises*, *Fort Erie Premises*,
  *Napanee Premises* — or keep it flat and use vendors per landlord?)
- Migration: should existing "Misc › Land Lease" rows be moved to the new
  category automatically?

> **Answer:**

---

### 1c. Any other category or sub-category changes you want locked in now?

Easier to do this once at the start of Phase 2 than drip-feed them. Scan the
list below and flag anything missing or mis-filed.

Current set:

- **Advertisement** — Radio, Truck Show, IT/Digital, Graphic Design
- **Cleaning** — Grass Cutting/Snow Removal, Uniform
- **Repair** — Door, Equipment, Plugs
- **Utility** — Electricity, Heating, Alarm
- **Misc** — Insurance, Land Lease, Pro Tax, Phone, Internet, Fuel, Legal Fee, Accountant Fee, Official Exp
- **Bank** — Loan Interest, Credit Card Cost
- **Purchase** — Filter, Oil, Supply
- **Others** — (none)

> **Additions / removals / renames:**

---

## 2. Payroll schema

All of the below affects table columns or calculation rules, so decisions are
needed before we start Phase 2.

### 2a. Bonus column — separate from Hours × Rate ⛔

Confirm: `bonus` is a standalone `numeric(12,2)` column, **added to gross
pay** but **not** derived from hours or rate.

- Is bonus taxed & deducted like regular pay (EI, CPP, income tax apply)?
- Or is bonus outside the statutory deduction base (like 2b)?

> **Answer:**

---

### 2b. Misc / Extra column — outside EI/CPP base ⛔

You said this one is additive to gross pay but **sits outside the EI/CPP
calculation**. Confirm:

- Column name: `misc_extra` / `non_statutory` / something else?
- Is this a one-off per pay period, or recurring?
- Typical examples (expense reimbursements, tool allowance, tips, etc.)?
- Does it count toward income tax? (EI/CPP exempt but income-tax taxable is
  the usual Canadian treatment.)

> **Answer:**

---

### 2c. Two payroll types: employee vs management ⛔

You described two tracks:

- **Employee** — normal hourly/weekly cycle, single pay event per week.
- **Management** — has a **cheque** sub-type *and* a **cash** sub-type with
  **daily** tracking.

Questions:

1. Does "daily tracking" mean we record a cash payment per working day, then
   roll up to a weekly total?
2. Are the cash entries shown on the same payroll record as the cheque
   portion, or are they two separate records that share a person + week?
3. Who can see management pay records? Owner-only? (If owner-only, we model
   it under the `private` column convention — other roles can't even see
   that the row exists.)
4. Do accountants need to see management pay for HST/tax returns?

> **Answer (1):**

> **Answer (2):**

> **Answer (3):**

> **Answer (4):**

---

### 2d. Benefits — split into employee deduction vs employer contribution ⛔

Confirm two separate columns:

- `benefit_employee_deduction` `numeric(12,2)` — subtracted from net pay
- `benefit_employer_contribution` `numeric(12,2)` — employer cost, shown on
  the P&L / payroll report but does **not** affect the employee's pay

Any other benefit buckets we should track separately (health, RRSP match,
etc.)? Or is a single pair of columns enough?

> **Answer:**

---

### 2e. Pay week starts Monday

Default in `app_settings.pay_week_start` is `1` (Monday, Mon–Sun week).
Confirm or change.

- Start day: Mon / Sun / other?
- Pay cycle: weekly / bi-weekly / semi-monthly?
- Pay date: same week end (e.g. paid Fri for Mon–Fri worked) or lag (paid
  the following Fri)?

> **Answer:**

---

### 2f. Statutory rates — manual vs automatic

EI and CPP rates change annually (federal). Two options:

- **Data-driven**: we ship a small `statutory_rates(year, type, value)` table
  and the payroll calc reads the rate for the pay week's year. You (or the
  accountant) edit it once a year.
- **Manual**: every paystub enters EI/CPP as a typed-in amount.

Canadian convention and less error-prone is data-driven. Accept?

> **Answer:**

---

### 2g. Employee roster — what data to keep per person?

We already have a `profiles` table for login accounts. Payroll employees are
*sometimes* login users (e.g. a staff member), but often not — drivers on
payroll may never touch the app.

Proposal: new `employees` table (name, SIN on `private` column, hire date,
rate, location, active). Link to `profiles.id` optionally for those who also
log in.

Confirm scope:

- Fields needed: [] full name, [] SIN, [] hire date, [] termination date,
  [] default rate, [] location, [] role/title, [] address, [] phone,
  [] email, [] bank info (cheque deposit).
- Is SIN stored at all? (It's nice for T4 filing but a liability — we can
  keep it off the app and keep it in your accountant's system instead.)

> **Answer:**

---

## 3. Phase 2 priorities

Confirm order of delivery within Phase 2 so we know what to ship first:

1. Invoice PDFs (with partial-payment breakdown) + email send
2. Payroll (tables, weekly cycle, paystub PDFs)
3. Customer / vendor profile pages with full history
4. Audit-log UI for owners
5. Outstanding alerts (>30 days)

Is this the right order, or should something move up?

> **Answer:**

---

## 4. Anything we missed

Open mic — anything else that changes schema or affects how Phase 2 rolls
out?

> **Answer:**
