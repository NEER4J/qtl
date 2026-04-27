# QTL — Quick Truck Lube & Oil
## Complete Software Development Plan

---

## 1. What Are We Building?

A full web-based business management platform for Quick Truck Lube & Oil Ltd. It replaces the current Excel system entirely and gives the owner, managers, accountants, and staff a single place to manage all 3 shop locations in real-time from any device.

**The app covers:**
- Daily job/sales entry and invoice management
- Expense tracking by category
- Weekly payroll processing
- Live dashboards and analytics
- User access management by role and location
- PDF invoice generation and upload
- Customer and vendor management

---

## 2. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Fast, SEO-ready, server + client components |
| UI Components | shadcn/ui + Tailwind CSS | Clean, consistent design system |
| Charts | Recharts or Tremor | Business analytics charts |
| Backend | Next.js API Routes / Server Actions | Same repo, no separate backend needed |
| Database | Supabase (PostgreSQL) | Real-time, auth built-in, row-level security |
| Auth | Supabase Auth | Role-based login, session management |
| File Storage | Supabase Storage | PDF uploads and generated invoices |
| PDF Generation | React-PDF or Puppeteer | Generate invoices as PDFs |
| Hosting | Vercel | Auto-deploy, edge functions, previews |
| Email | Resend | Notifications, pay stubs, invoice emails |

---

## 3. User Roles & Permissions

### Role Definitions

**Owner (Super Admin)**
- Single account, full access to all locations
- Only role that can manage users, locations, and system settings
- Can view, create, edit, and delete any record across all 3 shops
- Can see master dashboard with consolidated P&L across all locations

**Shop Manager**
- One per location (Ayr, Fort Erie, Napanee)
- Full access to their assigned location only
- Can create and edit sales and expense entries for their shop
- Can view read-only summary of other locations (no detail)
- Cannot manage users or system settings
- Cannot delete records (only Owner can delete)

**Accountant**
- Cross-location access to expenses and payroll
- Can create and edit expense entries for all locations
- Can process weekly payroll for all locations
- Read-only access to sales records
- Can export reports and data
- Cannot manage users, settings, or delete records

**Staff**
- Assigned to one location
- Can create sales/job entries for their location only
- Can create expense entries if explicitly enabled by their manager
- Cannot edit or delete after submission
- Cannot see dashboards, payroll, or other locations

**Employee**
- The most limited role
- Can only view their own weekly pay stubs
- Can update their own contact info
- No access to any business data

### Permission Matrix

| Action | Owner | Manager | Accountant | Staff | Employee |
|---|---|---|---|---|---|
| Master dashboard | Yes | No | No | No | No |
| Location dashboard | All | Own only | No | No | No |
| Sales analytics | All | Own only | No | No | No |
| Expense analytics | All | Own only | All | No | No |
| Payroll analytics | All | Own only | All | No | No |
| Create sales entry | Yes | Own only | No | Own only | No |
| Edit sales entry | Yes | Own only | No | No | No |
| Delete sales entry | Yes | No | No | No | No |
| Create expense entry | Yes | Own only | All | If enabled | No |
| Edit expense entry | Yes | Own only | All | No | No |
| Delete expense entry | Yes | No | No | No | No |
| Create payroll entry | Yes | No | All | No | No |
| Edit payroll entry | Yes | No | All | No | No |
| Delete payroll entry | Yes | No | No | No | No |
| View all payroll | Yes | Own only | All | No | Own only |
| Manage invoices | Yes | Own only | All | No | No |
| Generate PDF | Yes | Own only | All | Yes | No |
| Upload PDF | Yes | Own only | All | Yes | No |
| Manage customers | Yes | Own only | No | No | No |
| Manage vendors | Yes | Own only | All | No | No |
| Manage users | Yes | No | No | No | No |
| Manage locations | Yes | No | No | No | No |
| Manage categories | Yes | No | No | No | No |
| View audit logs | Yes | Own only | No | No | No |
| Export reports | Yes | Own only | All | No | No |

---

## 4. App Structure & Navigation

```
/login                          Login page
/dashboard                      Master dashboard (Owner only)
/dashboard/[location]           Location-specific dashboard

/sales                          Sales list view
/sales/new                      New job entry form
/sales/[id]                     View single sales record
/sales/[id]/edit                Edit sales record

/invoices                       Invoice list with payment status
/invoices/[id]                  Invoice detail + payment history
/invoices/[id]/pdf              View/download PDF invoice

/expenses                       Expense list view
/expenses/new                   New expense entry form
/expenses/[id]                  View single expense record
/expenses/[id]/edit             Edit expense record

/payroll                        Payroll list view (weekly)
/payroll/new                    New payroll entry
/payroll/[weekId]               View week's payroll
/payroll/[weekId]/[employeeId]  Employee pay stub

/customers                      Customer list
/customers/[id]                 Customer profile + job history

/vendors                        Vendor list
/vendors/[id]                   Vendor profile + expense history

/analytics                      Analytics hub
/analytics/sales                Sales & revenue analytics
/analytics/jobs                 Job duration analytics
/analytics/expenses             Expense breakdown analytics
/analytics/payroll              Payroll cost analytics
/analytics/products             Services/products analytics

/employees                      Employee list (Owner, Accountant)
/employees/[id]                 Employee profile
/employees/[id]/paystubs        Pay stub history

/settings                       System settings (Owner only)
/settings/users                 User management
/settings/locations             Location management
/settings/categories            Expense categories
/settings/services              Service types

/profile                        Current user's own profile
```

---

## 5. Module Details

---

### 5.1 Authentication & User Management

**Login Page**
- Email + password login
- "Remember me" option
- Forgot password flow (email reset)
- After login → redirect based on role (Owner → master dashboard, Staff → sales entry form)

**User Management (Owner only — /settings/users)**
- List of all users with role, location, and status (Active / Inactive)
- Create new user: name, email, role, assigned location(s), temporary password
- Edit user: change role, location assignment, activate/deactivate
- Never hard delete users — only deactivate (preserve audit history)
- User receives email invite with login link on creation

**Session & Security**
- Session timeout after inactivity
- All actions logged with user ID and timestamp
- Passwords hashed, never stored in plain text
- Role-based route protection — users cannot access URLs beyond their permission

---

### 5.2 Dashboard Module

**Master Dashboard (Owner only)**

Top-level summary cards per location + grand total:
- Total Sales (current month, YTD)
- Total Expenses (current month, YTD)
- Total Payroll (current month, YTD)
- Net Profit = Sales - Expenses - Payroll (current month, YTD)
- Percentage split per location (matches current Excel: Ayr 58%, FE 17%, NP 25%)

Charts:
- Monthly revenue trend (bar chart, all 3 locations overlaid)
- Expenses breakdown by category (pie/donut chart)
- Net profit trend over time (line chart)
- Location comparison (grouped bar chart)

Filters:
- Date range picker (this week, this month, this quarter, this year, custom)
- Location toggle (show/hide individual locations)

**Location Dashboard (Manager + Owner)**

Same layout but scoped to one location:
- Sales summary with daily breakdown
- Top customers by revenue this month
- Outstanding payments total
- Recent jobs (last 10 entries)
- Expense summary by category
- Quick-add buttons: New Job, New Expense

**At a Glance Widgets**
- Today's jobs count
- Today's revenue
- Pending outstanding invoices (count + total amount)
- This week's payroll cost
- Any data entry errors or warnings

---

### 5.3 Sales / Jobs Module

**Sales List Page (/sales)**
- Table view of all jobs for the user's location(s)
- Columns: Date, Invoice No, Customer, License Plate, Service, Bay, Total, Paid, Outstanding, Payment Mode, Status
- Filters: Date range, Location, Service Type, Payment Status (Paid/Partial/Outstanding), Bay No
- Search: by Invoice No, Customer Name, License Plate
- Sort by any column
- Colour coded status: Green = Paid, Yellow = Partial, Red = Outstanding
- Bulk actions: mark selected as paid, export selected to CSV

**New Job Entry Form (/sales/new)**

Step 1 — Customer Lookup:
- Search by Billing Name or License Plate
- If found: auto-fill customer details (contact, email)
- If new: create customer on the fly
- **Previous Pending Alert:** If the customer has any outstanding invoices, show a banner listing them before proceeding — "This customer has 3 outstanding invoices totalling $1,240. Proceed anyway?"

Step 2 — Job Details:
- Date (defaults to today)
- Location (defaults to user's assigned location, locked for Staff)
- Bay No (dropdown: 1, 2, 3, 4, etc.)
- Upper Tech (optional)
- Lower Tech (optional)
- Invoice No (auto-generated or manual entry)
- Billing Name (linked to customer)
- License Plate
- Contact No
- Email ID
- Current Odometer
- Service Type (dropdown: Oil Change, Pit Grease, Full Grease, Misc)
- Carrier Name (for OC/FG services)
- Start Time
- End Time
- Comments / Notes (free text)

Step 3 — Payment:
- Sub Total (manual entry)
- HST (auto-calculated: Sub Total × 13%)
- Total (auto-calculated: Sub Total + HST)
- Payment Mode (dropdown: Visa, Mastercard, Debit, Cash, Cheque, E-Transfer, OC, — if left blank → Outstanding)
- Paid Amount (if left blank or 0 → Outstanding)
- Outstanding (auto-calculated: Total - Paid Amount)

Validations:
- Required fields: Date, Location, Invoice No, Billing Name, Service Type, Sub Total
- Duplicate Invoice No check — block submission and show error if exists
- Warning if End Time is before Start Time

Batch Entry:
- Option to switch to batch mode: enter up to 15 jobs at once (matching current Excel workflow)
- Each row has same fields
- Submit all at once with a single Batch ID
- Shows count of records being submitted before confirming
- Today's submission count shown on the form

After Submit:
- "Last 5 Entries" preview refreshes
- Batch ID and submission time logged
- Option to immediately print/download invoice PDF

**Single Sales Record (/sales/[id])**
- Full detail view of the job
- Edit button (Manager, Owner)
- Payment history panel: every payment made against this invoice
- Add payment button: partial or full payment with date, amount, mode
- Download PDF button
- Activity log: who created it, who edited it, when

---

### 5.4 Invoice Module

**Invoice List (/invoices)**
- All invoices with payment status
- Filters: Status (Paid, Partial, Outstanding), Date, Location, Customer
- Search: Invoice No, Customer Name
- Quick view of: Invoice No, Customer, Date, Total, Paid, Balance, Status
- Colour coded status badges
- **Bulk Payment Action:**
  - User selects multiple invoices via checkboxes
  - Clicks "Pay Selected"
  - Enters payment date, amount, and mode
  - System applies payment across selected invoices (most recent first, or user-defined order)
  - Remaining balance shown per invoice after payment applied

**Invoice Detail (/invoices/[id])**
- Full invoice summary (all job details)
- Payment history table: Date, Amount, Mode, Recorded By
- Add Payment button: enter date, amount, mode → updates balance
- Outstanding balance shown prominently
- **PDF Options:**
  - "Generate PDF" button → creates a formatted PDF invoice with QTL branding, job details, HST breakdown, payment history, and balance due
  - "Upload PDF" button → attach an existing PDF file to this invoice record
  - "Download PDF" button → download whichever PDF is attached (generated or uploaded)
  - Preview PDF inline in the page

**PDF Invoice Design (Generated)**
- QTL logo and company header
- Invoice No, Date, Due Date
- Customer details (Billing Name, License Plate, Contact, Email)
- Service details (Bay, Service Type, Start/End Time, Odometer, Carrier)
- Line items: Sub Total, HST (13%), Total
- Payment history: each payment with date and mode
- Balance Due (highlighted if > 0)
- Footer: shop address, phone, email for the location

---

### 5.5 Expense Module

**Expense List (/expenses)**
- Table view of all expense records
- Columns: Date, Category, Sub Category, Vendor, Invoice No, Total, Paid Amount, Balance, Payment Status
- Filters: Date range, Location, Category, Sub Category, Vendor, Payment Status
- Search: Vendor name, Invoice No
- Colour coded payment status
- Totals row at bottom showing sum of visible records

**Expense Categories (matching current system)**
1. Advertisement (Sub: Radio, Truck Show, IT/Digital, Graphic Design)
2. Cleaning (Sub: Grass Cutting/Snow Removal, Uniform)
3. Repair (Sub: Door, Equipment, Plugs)
4. Utility (Sub: Electricity, Heating, Alarm)
5. Misc (Sub: Insurance, Land Lease, Pro Tax, Phone, Internet, Fuel, Legal Fee, Accountant Fee, Official Exp)
6. Bank (Sub: Loan Interest, Credit Card Cost)
7. Purchase (Sub: Filter, Oil, Supply)
8. Others (custom/miscellaneous)

**New Expense Entry Form (/expenses/new)**
- Expense Category (dropdown → determines sub-category options)
- Sub Category (dropdown, filtered by selected category)
- Date
- Location
- Vendor Name (searchable dropdown, linked to vendor record, or add new)
- Invoice No
- Account Type
- Account Number
- Contact No
- Email ID
- Sub Total
- HST (auto-calculated: 13%)
- Total (auto-calculated)
- Paid Amount
- Balance (auto-calculated: Total - Paid Amount)
- Payment Date
- Mode of Payment (Cash, Cheque, E-Transfer, Credit Card, Debit)
- Transaction ID
- Payment Status (Paid, Partial, Outstanding)
- Notes

Batch Entry:
- Up to 15 rows per batch (matching current Excel workflow)
- Category selector at top applies to entire batch
- Submit generates Batch ID + timestamp
- Today's count shown on form
- Last 5 entries preview shown at top

Duplicate Check:
- System checks Invoice No within same category
- Blocks submission and highlights duplicate row in red

**Single Expense Record (/expenses/[id])**
- Full detail view
- Edit button (Accountant, Manager for own location, Owner)
- Add payment entry (partial payments)
- Download/upload PDF option (for attaching vendor invoices)
- Activity log

---

### 5.6 Payroll Module

**Payroll runs on a WEEKLY cycle.**

**Payroll List (/payroll)**
- List of all payroll weeks
- Per week: Week date range, total employees, total gross pay, total deductions, total net pay, total outstanding
- Filters: Location, Employee, Year, Week
- Status per week: Draft, Processed, Partially Paid, Paid

**New Payroll Entry (/payroll/new)**
- Select week (Mon–Sun date range)
- Select location (or all)
- System pre-populates employee list for that location
- Per employee row:
  - Employee Name, ID, File No (read-only, pulled from employee profile)
  - Regular Hours (bi-weekly working hrs)
  - Overtime Hours
  - Public Holiday Hours
  - Total Hours (auto-calculated)
  - Pay Rate per Hour
  - Gross Pay (auto-calculated: Total Hours × Pay Rate)
  - EI deduction (auto-calculated based on federal rate)
  - CPP deduction (auto-calculated based on federal rate)
  - Income Tax (auto-calculated or manual override)
  - Benefits deduction
  - Total Withheld (auto-calculated: EI + CPP + Tax + Benefits)
  - Net Pay (auto-calculated: Gross - Withheld)
  - Final Paid Amount (actual amount paid out)
  - Balance (Net Pay - Final Paid Amount)
  - Payment Mode
  - Transaction ID
  - Payment Status
  - Notes

- Save as Draft or Submit/Process
- Once processed, employees can see their pay stub

**Weekly Pay Stub (Employee view)**
- Employee name, ID, location
- Week: Monday DD MMM YYYY – Sunday DD MMM YYYY
- Hours breakdown: Regular, Overtime, Public Holiday, Total
- Pay Rate
- Earnings table: Regular Pay, Overtime Pay, Holiday Pay, Gross Pay
- Deductions table: EI, CPP, Tax, Benefits, Total Withheld
- Net Pay (highlighted)
- Payment details: Date paid, mode, transaction ID
- YTD totals: Gross Pay YTD, Deductions YTD, Net Pay YTD
- Download as PDF

**Payroll Summary Reports**
- Weekly summary: total payroll cost per location
- Monthly summary: roll-up of weekly entries
- Yearly summary: full year payroll by employee and location
- Exportable to Excel and PDF

---

### 5.7 Customer Module

**Customer List (/customers)**
- All customers (trucking companies and individuals)
- Columns: Name, Contact, Email, Location, Total Jobs, Total Revenue, Outstanding Balance
- Search by name, license plate, contact
- Filter by location, outstanding balance (yes/no)
- Click row → Customer Profile

**Customer Profile (/customers/[id])**
- Customer details: Billing Name, Contact No, Email, typical License Plate(s)
- **Job History:** full list of all past jobs for this customer
  - Date, Invoice No, Service, Bay, Total, Paid, Outstanding, Status
  - Filter by date range, service type, payment status
  - Total revenue from this customer
  - Outstanding balance (total across all invoices)
- **Outstanding Invoices Panel:** highlighted list of all unpaid/partial invoices with quick "Mark as Paid" action
- **Previous Vehicles:** list of all license plates that have been associated with this customer
- Add note to customer profile

---

### 5.8 Vendor Module

**Vendor List (/vendors)**
- All expense vendors
- Columns: Vendor Name, Contact, Category, Location, Total Spent, Last Transaction
- Search and filter by name, category, location

**Vendor Profile (/vendors/[id])**
- Vendor details: Name, Contact, Email, Account No, Account Type
- **Expense History:** all expense records linked to this vendor
  - Date, Category, Sub Category, Invoice No, Total, Paid, Balance, Status
  - Filter by date range, category
  - Total spent with this vendor
  - Outstanding balance to this vendor
- Add note to vendor profile

---

### 5.9 Analytics Module

**Analytics Hub (/analytics)**
Navigation to 4 analytics sub-pages: Sales, Jobs, Expenses, Payroll, Products/Services

---

**Sales Analytics (/analytics/sales)**

Summary cards:
- Total revenue (filtered period)
- Total jobs count
- Average job value
- Outstanding collections

Charts:
- Daily revenue trend (line chart)
- Revenue by location (bar chart, side by side)
- Revenue by payment mode (pie chart: Visa, MC, Debit, Cash, Cheque, E-Transfer, OC)
- Outstanding vs Collected (stacked bar per month)
- Top 10 customers by revenue (horizontal bar)
- Monthly revenue comparison: this year vs last year

Filters: Date range, Location, Service Type, Payment Mode, Customer

---

**Job Duration Analytics (/analytics/jobs)**

This page is built entirely from Start Time and End Time data captured on each job.

Summary cards:
- Average job duration overall
- Average duration by service type
- Fastest average bay
- Busiest hour of the day

Charts:
- Average job duration per service type (OC, PG, FG, Misc) — horizontal bar chart
- Average job duration per bay — horizontal bar chart
- Jobs per hour of day — heatmap or bar chart (shows when shop is busiest: 8am, 9am, 10am...)
- Jobs per day of week — bar chart
- Job volume trend over time — line chart
- Duration distribution — how many jobs completed in 0–15 min, 15–30 min, 30–60 min, 60+ min

Table view:
- All jobs with duration calculated, sortable by duration
- Highlight unusually long jobs (outliers)

Filters: Date range, Location, Bay No, Service Type, Staff Member

---

**Products/Services Analytics (/analytics/products)**

Summary cards:
- Most performed service this month
- Highest revenue service type
- Service count YTD
- Revenue per service type

Charts:
- Service type breakdown by count (pie chart: OC vs PG vs FG vs Misc)
- Service type breakdown by revenue (pie chart)
- Service type trend over time (stacked bar or line, monthly)
- Per location service breakdown (which services are most popular at which location)

Filters: Date range, Location

---

**Expense Analytics (/analytics/expenses)**

Summary cards:
- Total expenses (period)
- Largest expense category
- Top vendor by spend
- Outstanding payables

Charts:
- Expenses by category (donut chart: Advertisement, Cleaning, Repair, Utility, Misc, Bank, Purchase)
- Expenses by location (bar chart)
- Monthly expense trend (line chart)
- Top 10 vendors by spend (horizontal bar)
- Paid vs Outstanding (stacked bar)

Filters: Date range, Location, Category, Sub Category, Vendor

---

**Payroll Analytics (/analytics/payroll)**

Summary cards:
- Total payroll cost (period)
- Total employees
- Payroll by location
- Average weekly cost per employee

Charts:
- Weekly payroll cost trend (line chart)
- Payroll by location (bar chart)
- Deductions breakdown: EI, CPP, Tax, Benefits (stacked bar per month)
- Overtime hours trend (bar chart — identifies weeks with high overtime)
- Payroll as % of revenue (key business metric)

Filters: Date range, Location, Employee

---

### 5.10 Employee Module

**Employee List (/employees)** — Owner and Accountant only
- All employees across all locations
- Columns: Name, Employee ID, File No, Location, Pay Rate, Status (Active/Inactive)
- Filter by location, status
- Click row → Employee Profile

**Employee Profile (/employees/[id])**
- Personal details: Name, Employee ID, File No, Location
- Contact info: Phone, Email
- Employment info: Start Date, Pay Rate, Status
- Bank details (encrypted storage): Bank Name, Account Type, Account Number
- Pay stub history: list of all weekly pay stubs, downloadable as PDF
- YTD summary: total gross, total deductions, total net pay

**Employee Self-Service (/profile for Employee role)**
- View own pay stubs (weekly)
- Update own contact info and bank details
- Download any pay stub as PDF

---

### 5.11 Settings Module (Owner Only)

**User Management (/settings/users)**
- Full list of all users
- Create new user with role and location assignment
- Edit user role and location
- Deactivate/reactivate users
- Reset password (sends reset email)
- View last login date per user

**Location Management (/settings/locations)**
- List of locations: Ayr, Fort Erie, Napanee
- Each location has: Name, Address, Phone, Email
- Add new location (for future expansion)
- Deactivate location

**Expense Categories (/settings/categories)**
- List of expense categories and their sub-categories
- Add, edit, reorder categories
- Deactivate categories (don't delete — preserve history)

**Service Types (/settings/services)**
- List of service types (OC, PG, FG, Misc)
- Add new service types
- Edit display names

**System Settings (/settings/system)**
- Company name and logo (used in PDF invoices)
- Default HST rate (currently 13% for Ontario)
- Fiscal year start month
- Default currency (CAD)
- Pay week start day (default: Monday)
- Invoice numbering format (auto-increment or manual)

---

### 5.12 Audit Trail & Activity Log

Every action in the system is logged:
- Who did it (user name + role)
- What they did (created, edited, deleted, viewed, exported, logged in)
- Which record was affected (with record ID and a snapshot of the old vs new values)
- When it happened (timestamp)
- What location it belonged to
- IP address (for security)

Owner can view the audit log filtered by:
- User
- Action type
- Date range
- Location
- Module (Sales, Expenses, Payroll, etc.)

Managers can view audit logs for their own location only.

---

### 5.13 Notifications

**In-App Notifications (bell icon)**
- New sales batch submitted (Manager notified)
- Outstanding invoice overdue > 30 days (Manager + Accountant)
- Large expense entered > $5,000 (Owner)
- Payroll week processed (all employees notified)
- Duplicate invoice attempted and blocked (submitter)
- New user added to the system (Owner)

**Email Notifications**
- Pay stub ready (employee email)
- Invoice PDF sent to customer (future scope)
- Weekly summary report (Owner + Managers, every Monday morning)
- Monthly P&L summary (Owner, first day of month)
- Password reset emails

---

### 5.14 Reports & Exports

**Available Reports:**
1. Daily Sales Report — all jobs for a given day per location
2. Monthly Sales Report — summary + detail
3. Expense Report — by category, by vendor, by location
4. Payroll Report — weekly or monthly, per employee or per location
5. P&L Report — Sales vs Expenses vs Payroll = Net Profit per location
6. Outstanding Invoices Report — all unpaid/partial invoices
7. Customer Statement — all transactions for a specific customer
8. Vendor Statement — all expenses for a specific vendor
9. HST Summary — total HST collected (sales) and paid (expenses) for tax filing
10. Year-End Summary — full year breakdown for accountant/CRA

**Export Formats:**
- PDF (formatted report with QTL branding)
- Excel/CSV (raw data for further analysis)

**Who can export:**
- Owner: all reports, all locations
- Manager: reports scoped to their location
- Accountant: expense, payroll, and HST reports for all locations
- Staff: cannot export

---

## 6. Key Business Rules

1. **HST is always 13%** — applied to Sales and Expenses sub-totals automatically
2. **Outstanding = Total - Paid Amount** — calculated automatically on every record
3. **If no payment mode or no paid amount → Outstanding** — auto-flagged
4. **Invoice No must be unique** — system blocks duplicate invoice numbers
5. **Payroll is weekly** — each week runs Mon–Sun
6. **Staff cannot edit after submitting** — only Manager and Owner can edit submitted records
7. **Nothing is hard deleted** — records are deactivated/archived to preserve history and audit trail
8. **Location data is strictly isolated** — staff at one location cannot see or enter data for another
9. **Batch submissions are atomic** — all records in a batch succeed or none do (no partial batch saves)
10. **Previous outstanding shown at job entry** — when a customer is selected, their unpaid balance is shown before the job is submitted

---

## 7. Data Migration

When going live, existing Excel data will be imported:
- **Sales data:** 935 records from `2026_RawData_Sales.xlsx` (Daily_Sales sheet)
- **Expense data:** 263 records from `2026_RawData_Expenses.xlsx` (8 category sheets)
- **Payroll data:** 13 employee records from `2026_RawData_Payroll.xlsx`
- **Customer list:** extracted from sales data (unique Billing Names)
- **Vendor list:** extracted from expense data (unique Vendor Names)
- **Employee list:** 13 employees with IDs A-001 to A-013

Data cleanup needed during migration:
- Standardize location names (FE → Fort Erie, NP → Napanee)
- Standardize payment modes (VISA → Visa, MC → Mastercard)
- Standardize column naming across expense sheets (Final Paid Amount vs Paid Amount)

---

## 8. Build Phases

### Phase 1 — Core System (Replace Excel)
**Goal:** Get the team off Excel entirely.

1. Project setup (Next.js, Supabase, auth, routing)
2. User auth + role management
3. Location management
4. Sales entry form (replaces Form_Sales.xlsm)
5. Sales list and detail view
6. Expense entry form (replaces Form_Expenses.xlsm)
7. Expense list and detail view
8. Basic dashboard per location
9. Master dashboard (Owner)
10. Data migration from Excel files

**Deliverable:** All 3 shops can enter and view data in real-time. Excel no longer needed.

---

### Phase 2 — Finance & Payroll
**Goal:** Full financial management in one place.

11. Invoice management with partial payments
12. PDF invoice generation
13. PDF upload and attachment
14. Weekly payroll module
15. Employee self-service pay stubs
16. Customer profiles with job history
17. Vendor profiles with expense history
18. Outstanding payment tracking and alerts
19. Audit trail and activity logs

**Deliverable:** Full accounting workflow covered. Accountant can stop using raw Excel sheets.

---

### Phase 3 — Analytics & Reporting
**Goal:** Give the owner real-time business intelligence.

20. Sales analytics page
21. Job duration analytics page
22. Products/services analytics page
23. Expense analytics page
24. Payroll analytics page
25. All export reports (PDF + Excel)
26. Email notifications (overdue invoices, pay stubs, weekly summary)
27. HST summary report

**Deliverable:** Owner can make data-driven decisions from their phone.

---

### Phase 4 — Advanced Features
**Goal:** Add capabilities the Excel system never had.

28. Customer portal (trucking companies view own invoices)
29. Mobile-optimised views for bay technicians (tablet at the bay)
30. Year-over-year analytics comparison
31. Automated recurring expense entries (e.g. monthly radio ad contracts)
32. Payroll federal rate auto-updates (EI, CPP rates change annually)
33. Multi-year support (2025, 2026, 2027 data in same system)

---

## 9. Non-Functional Requirements

**Performance**
- Dashboard loads in under 2 seconds
- Data entry form submits in under 1 second
- PDF generation completes in under 5 seconds
- System handles 10,000+ records without slowing down

**Security**
- All data encrypted in transit (HTTPS)
- Passwords hashed with bcrypt
- Row-level security in Supabase (users can only query their permitted data)
- No sensitive data (account numbers, bank info) exposed in URLs
- Session timeout after 60 minutes of inactivity
- All admin actions logged in audit trail

**Reliability**
- 99.9% uptime target
- Automatic backups daily (Supabase handles this)
- No data loss on failed submissions (atomic transactions)

**Usability**
- Works on desktop, tablet, and mobile
- Dark theme option (matching current Excel dark dashboard aesthetic)
- Forms auto-save drafts to prevent data loss
- Colour-coded status badges throughout (Green = Paid, Yellow = Partial, Red = Outstanding)
- Consistent QTL branding (logo, colour scheme)

---

## 10. Open Questions to Confirm

1. What day does the weekly payroll run? (Monday–Sunday, or different?)
2. Are EI and CPP deductions calculated automatically by the system or entered manually?
3. What is the invoice numbering format? Continue from current Excel (316975+) or restart?
4. Do managers need read-only access to other locations' dashboards, or strictly their own only?
5. Should Staff be able to edit their own entries within a time window (e.g. same day only)?
6. Is the customer portal (Phase 4) a priority or low priority for now?
7. Are there any other expense categories beyond the current 8?
8. Do you want the app to send invoice PDFs directly to customers by email?
9. What is the fiscal year start month for year-end reporting?
10. Should the system support multiple currencies (CAD only for now)?
