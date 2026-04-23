# QTL — Product & Pricing Management
## Complete Software Development Plan

---

## 1. What Is This Module?

This module manages everything related to **what QTL sells and at what price**. It replaces the `Apl 2026 Standard.xlsx` workbook — a 27-sheet Excel file with over 17,500 formulas that controls:

- All filter and parts pricing (800+ parts)
- Oil change pricing across 7 oil grades × 45 engine types
- Grease service pricing
- Transmission & differential service pricing
- Profit tracking and margin management
- A print-ready price list for technicians

The business owner updates oil prices and filter costs, and the system automatically recalculates every sell price across every engine and service type.

---

## 2. Access Control

| Tab / Section | Who Can See It |
|---|---|
| Price List | All users (Staff, Manager, Accountant, Owner) |
| All Filter Sell Price | All users |
| Print List | All users |
| Oil Price | All users |
| Everything else (cost sources, profit sheets, margin data, oil cost breakdowns) | Admin (Owner) only |

This means:
- **Staff and Managers** see what to charge customers — sell prices and filter prices
- **Owner** sees the full picture — costs, margins, profit per job, profit vs. last month

---

## 3. Core Concepts

### 3.1 Products / Parts

QTL sells and installs filters. Each filter has:
- A part number
- A manufacturer/brand (Cat, Fleetguard, Baldwin, Donaldson)
- A category (Air Filter, Oil Filter, Fuel Filter, Coolant Filter, Cabin Filter, CV Filter, DEF Filter, Spinner, Fuel Separator, Other)
- A cost (pulled from supplier pricing with MHSW environmental fee)
- A list price (supplier's official list price)

### 3.2 Oil Types

QTL offers 7 oil grades:
1. **15W40** — Standard diesel engine oil (most common)
2. **10W30 (Delo)** — Chevron premium
3. **T5 (Shell)** — Shell 10W30 synthetic blend
4. **T6 (Shell)** — Shell 5W30 full synthetic (premium)
5. **Petro 10W30** — Petro-Canada 10W30
6. **Delo 5W30** — Chevron full synthetic
7. **Petro 5W30** — Petro-Canada 5W30 synthetic

Each oil type has **two container options**:
- **Bulk / Litre pricing** — cheaper, standard drum/bulk tank
- **Gallon pricing** — individual gallon jugs, more expensive per litre

### 3.3 Engine Types

QTL services approximately 45 different truck engine configurations:
- **Caterpillar:** C7, C10, C12, C13, C15, 3126, 3406
- **Cummins:** N14, 5.9L/6.7L, ISB, ISC, ISL, ISM, ISX/X15, M11
- **Detroit:** Series 60
- **Mack:** E7, MP7, MP8
- **Volvo:** D12, D13
- **Mercedes:** MBE900, MBE4000, Sprinter
- **Navistar/International:** MaxxForce series
- **Paccar:** MX-13
- **Ford:** 6.7L Power Stroke
- And more

Each engine has a defined oil capacity (in litres) that drives the price calculation.

### 3.4 Filter Brands Per Job

For most engine types, QTL offers the same job with a choice of filter brand:
- **Cat (OEM)** — more expensive, e.g. $265.99
- **Fleetguard** — aftermarket, cheaper, e.g. $243.99

### 3.5 Service Modes (for filters)

Every filter sale has 3 pricing options:
- **With Service** — technician provides AND installs the filter (most common)
- **Without Service / Over Counter** — customer buys the filter at the counter, no installation
- **Customer Supplies Filter** — customer brings their own filter, QTL charges labour only ($10–$20)

### 3.6 Pricing Formula

The sell price for any oil change job is calculated as:

```
Sell Price = Filter Cost + Oil Cost + Service Cost + Volume Tier Premium
```

Where:
- **Filter Cost** = pulled from Price List (part-specific)
- **Oil Cost** = Litres used × Oil Price per litre
- **Service Cost** = labour/service fee from Cost Source sheet
- **Volume Tier Premium** = flat charge based on how many litres the engine takes:
  - 8–20L: +$10 to +$15
  - 21–38L: +$15 to +$25
  - 39–46L: +$20 to +$30
  - 47L+: +$25 to +$35
  (Higher-grade synthetic oils carry higher tier premiums)
- **Display price** = ROUNDUP(raw price, 0) − $0.01 → gives the .99 pricing convention (e.g. $265.99, $378.99)

---

## 4. Module Features

---

### 4.1 Price List (Parts Catalog)

**Access: All users**

A searchable catalog of all 800+ parts.

**What users can see:**
- Part number
- Category (Air Filter, Oil Filter, Fuel Filter, etc.)
- Manufacturer / brand cross-reference (Cat, Fleetguard, Baldwin, Donaldson)
- QTL sell price (with MHSW)
- QTL sell price (without MHSW)
- List price (supplier reference)

**What Admin can also see:**
- QTL cost (what QTL pays)
- MHSW environmental fee
- Cost breakdown (% of list price)
- Discount tiers: Counter, volume ranges (1–10, 10–15, 15–20, 20+ units)

**Features:**
- Search by part number or description
- Filter by category
- Filter by brand/manufacturer
- Sort by price, category, part number
- Admin: inline price editing — change a cost and all dependent sell prices update automatically
- Export to PDF or Excel

---

### 4.2 Oil Price Management

**Access: Admin only**

The master oil cost reference. All 14 oil pricing rows (7 grades × 2 container types) with their costs and sell prices.

**Per oil type, per container:**
- Bulk/case cost (what QTL pays)
- MHSW environmental fee
- Per-litre cost (auto-calculated)
- Sell price per litre (auto-calculated: cost + margin)
- Rounded sell price
- Drum cost and per-litre cost (for T6)
- Pail cost and per-litre cost

**Features:**
- Edit any oil cost → all dependent oil change prices across all engine types recalculate instantly
- Price change preview: shows current price vs new price and profit impact before saving
- Price history log: when was oil price last changed and by how much
- Alert if oil cost increase will cause sell prices to drop below minimum margin threshold

---

### 4.3 Service Pricing (Oil Changes)

**Access: Read = All users | Edit = Admin only**

The core pricing table for all oil change jobs.

**View: Price Grid**

A table where rows = engine types and columns = oil types:

| Engine | 15W40 | 15W40 Gal | 10W30 | 10W30 Gal | T5 | T5 Gal | T6 | T6 Gal | Delo 5W30 | ... |
|---|---|---|---|---|---|---|---|---|---|---|
| C7 Cat Filter | $265.99 | $295.99 | $290.99 | $320.99 | ... | | | | | |
| C7 Fleetguard | $243.99 | $273.99 | $268.99 | ... | | | | | | |
| Cummins ISX | $378.99 | $408.99 | ... | | | | | | | |

**What all users can see:**
- Engine name
- Sell price per oil type (litre and gallon)
- Filter brand option (Cat vs Fleetguard where applicable)

**What Admin can also see:**
- Filter cost per job
- Litres used per engine
- Oil cost per job (litres × price)
- Total cost per job
- Gross profit per job ($)
- Profit margin per job (%)
- Last month's profit (comparison)
- Profit change month-over-month (+/-)
- Last month's price
- Price change month-over-month (+/-)

**Admin editing:**
- Edit litres used per engine (if oil capacity changes)
- Edit service cost/labour per job
- Edit volume tier premiums
- All sell prices recalculate automatically

---

### 4.4 Filter Sell Price Calculator

**Access: All users**

Shows the final customer-facing price for any filter in any service mode.

**Per filter (all 800+ parts):**
| Column | Description |
|---|---|
| Part # | Filter part number |
| With Service | Price when QTL supplies + installs |
| Without Service | Price when sold over counter only |
| Over Counter | Full counter sale price (includes markup) |
| Void Price | Internal reference |
| Customer Supplies Filter | Labour-only charge |

**All prices shown as rounded .99 pricing.**

**Features:**
- Search by part number
- Filter by category
- Quick reference for staff at the counter
- Admin: edit service cost and labour per filter → recalculates all 3 price columns

---

### 4.5 Print List

**Access: All users**

A clean, print-ready price card showing all oil change jobs with gallon-container pricing. This is what technicians and customers refer to at the shop.

**Columns shown:**
- Job/engine name
- Price for each of the 10 gallon oil types (all .99 pricing)
- 15W40 litre base price (for reference)

**Features:**
- "Print" button → generates a clean formatted PDF with QTL branding and effective date
- "Download PDF" button
- Effective date prominently shown (e.g. Jan 1, 2026)
- All users can print/download
- Admin: effective date updates when prices change

---

### 4.6 Transmission & Differential Pricing

**Access: Read = All users | Edit = Admin only**

Pricing for trans and diff oil change services.

**Jobs covered:**
| Job | Sell Price | Litres | Oil Type |
|---|---|---|---|
| Allison Trans 2500 | $389.99 | 16L | Allison fluid |
| Allison Trans 4500 | $549.99 | 26L | Allison fluid |
| Allison Trans 4500 (Dump) | $659.99 | 33L | Allison fluid |
| Diff Oil Change Reg (Single) | $164.99 | 15L | Gear oil |
| Diff Oil Change Reg | $275.99 | 28L | Gear oil |
| Trans & Diff Oil Change Reg | $365.99 | 43L | Gear oil |
| Trans & Single Diff Reg | $279.99 | — | Gear oil |
| Trans Oil Change Reg | $165.99 | 14L | Gear oil |
| Diff Oil Change Syn (Single) | $229.99 | 15L | Synthetic gear oil |

**Also includes coolant flush pricing:**
- Multiple coolant types: Extended Life Detroit, Extended Life Red, Green
- Part numbers and costs pulled from Price List

**Admin can see:** oil cost, profit, cost %, profit %, price per litre

---

### 4.7 Grease Service Pricing

**Access: Read = All users | Edit = Admin only**

Pricing for all greasing services.

| Job | Sell Price | Qty Used | Labour |
|---|---|---|---|
| 5th Wheel Grease | $9.99 | 0.2 kg | $8 |
| Tow Truck Slider Bar | $12.99 | 0.3 kg | $10 |
| Trailer Grease | $19.99 | 0.4 kg | $15 |
| Trailer Grease 3 Axle+ | $34.99 | 0.5 kg | $30 |
| Trailer Grease 5 Axle+ | $39.99 | 0.6 kg | $35 |
| Trailer Grease 5 Axle+ Extra Fitting | $64.99 | 1.5 kg | $50 |
| Trailer Grease 7 Axle+ | $49.99 | 1.2 kg | $40 |
| Trailer Grease (Dump) | $29.99 | 1.0 kg | $20 |
| Truck Drive Shaft Grease | $15.99 | 0.4 kg | $12 |
| Truck Grease | $39.99 | 0.8 kg | $30 |
| Truck Grease (Dump) | $44.99 | 1.0 kg | $35 |
| Auto Greaser Refill Large | $51.99 | 3.0 kg | $20 |

**Price formula:** Sell Price = (Grease cost per kg × qty used) + Labour
**Without Service** = With Service + $5

**Admin can see:** drum cost, per-kg cost, pail cost, profit per job, last month price comparison

---

### 4.8 FASS Fuel System Pricing

**Access: Admin only**

Specialty pricing for FASS fuel system filter service (high-performance diesel fuel filter systems).

**Two configurations:**
- FF5588 + FS1001 (standard FASS setup)
- FF5588 + FS1023 (alternate FASS setup)

**Per configuration:**
- With Service price (auto-calculated)
- Without Service price (auto-calculated)
- Customer Supplies Filter: $29.99 (labour only)

---

### 4.9 Profit Analytics Dashboard

**Access: Admin only**

A consolidated view of profitability across all services. Replaces the `Profit`, `Sell Price`, and `Oil Service Cost` sheets.

**Summary cards:**
- Best margin service (highest profit %)
- Worst margin service (lowest profit %)
- Average margin across all jobs
- Highest revenue job

**Charts:**
- Profit per engine type (horizontal bar) — all 14 oil types compared per engine
- Margin % by oil grade — which oil type earns the best margin
- Month-over-month profit change per job (highlights jobs where margin improved or dropped)
- Oil cost vs. sell price waterfall chart

**Table view:**
- All 45 engine × 14 oil type combinations
- Columns: Job, Oil Type, Sell Price, Cost, Profit ($), Profit (%), Last Month Profit, Change
- Sortable by any column
- Colour coded: Green = better than last month, Red = worse

**Filters:**
- Engine type / category
- Oil type
- Margin range (show only jobs below X% margin)

---

### 4.10 Price Change Workflow (Admin)

When the owner needs to update prices (e.g. new oil costs come in):

1. Go to **Oil Price** and update the cost for one or more oil types
2. System instantly recalculates all affected sell prices across all engine types
3. A **Price Change Preview** modal shows:
   - Which jobs are affected
   - Old price vs. new price per job
   - Old profit vs. new profit
   - Number of jobs where price went up / down
4. Owner reviews and either:
   - **Confirm & Publish** → new prices go live with a new effective date
   - **Cancel** → revert to previous prices
5. All price changes are logged with date, old value, new value, and who changed it

**Same workflow for:**
- Filter cost changes (updating Price List)
- Labour/service cost changes
- Volume tier premium changes
- Grease drum/pail cost changes

---

## 5. Integration With Sales Module

When a technician creates a new job in the Sales module:

- They select **Engine Type** (e.g. "Cummins ISX")
- They select **Oil Type** (e.g. "T6")
- They select **Container Type** (Litre or Gallon)
- The system **auto-fills the price** from the Product & Pricing module
- They can override the price if needed (Manager/Owner only)
- The system records what product/service was sold → feeds into Products Analytics

This creates a direct link: pricing management → job entry → analytics.

---

## 6. Products Analytics (in Sales Analytics)

Once jobs are linked to the product catalog, the analytics page can show:

- Most performed service type (OC vs PG vs FG vs Misc)
- Most popular oil type used
- Most popular engine type serviced
- Revenue per oil type
- Revenue per engine category (Cat vs Cummins vs Detroit etc.)
- Filter brand preference (Cat OEM vs Fleetguard)
- Gallon vs bulk oil usage ratio
- Average job value per service type
- Grease vs oil change volume comparison

---

## 7. Data to Migrate

From `Apl 2026 Standard.xlsx`:

| Data | Rows | Target |
|---|---|---|
| Parts catalog (Price List) | 800+ parts | Products / Parts table |
| Oil prices (Oil Price) | 14 oil types × container sizes | Oil Prices table |
| Engine list with litres | ~45 engines | Engine Types table |
| Filter costs per engine (Filter Cost) | ~100 rows | Job Definitions table |
| Service costs (Cost Source) | 800+ rows | Service Costs table |
| Grease jobs (Grease) | 13 jobs | Grease Services table |
| Trans/Diff jobs (Trans & Diff) | ~10 jobs | Trans/Diff Services table |
| FASS configs (Fass System) | 2 configs | FASS Services table |
| Volume tier premiums | 4 tiers per oil grade | Pricing Tiers table |

All formulas become **calculated fields** in the database — no more Excel formula chains.

---

## 8. Build Phases

### Phase 1 — Read-Only Access (Replace the Print List)
1. Import all parts, engines, oil prices, and service prices from Excel
2. Price List page — searchable parts catalog (all users)
3. Filter Sell Price page — filter pricing in 3 service modes (all users)
4. Oil Change Price Grid — all engines × all oil types (all users)
5. Print List — PDF-printable price card (all users)

**Deliverable:** Staff can look up prices from the app instead of Excel. No more printing and distributing updated price sheets.

### Phase 2 — Admin Pricing Management
6. Oil Price editor (Admin only)
7. Price change preview and publish workflow
8. Parts cost editor (Admin only)
9. Grease service price management (Admin only)
10. Trans & Diff price management (Admin only)
11. Price change audit log

**Deliverable:** Owner can update oil/filter costs and all prices recalculate instantly. No more editing 17,500 Excel formulas.

### Phase 3 — Profit Analytics
12. Profit analytics dashboard (Admin only)
13. Month-over-month margin comparison
14. Profit per oil type and engine type charts
15. Minimum margin alerts

### Phase 4 — Sales Integration
16. Link job entry in Sales module to Product catalog
17. Auto-fill price when technician selects engine + oil type
18. Products analytics in Sales analytics page
19. Revenue per product/service type reporting

---

## 9. Key Business Rules

1. **All sell prices end in .99** — ROUNDUP to nearest dollar, minus $0.01 (e.g. $265.99)
2. **HST (13%) is added on top** of all sell prices at invoice time (not included in price list)
3. **Oil price drives everything** — changing one oil cost recalculates all dependent prices automatically
4. **Cat OEM always costs more than Fleetguard** — same job, different filter brand, different price
5. **Gallon container always costs more than bulk/litre** — reflected in per-litre cost
6. **Volume tier premium is flat** — not per-litre, it's a fixed charge based on engine oil capacity bracket
7. **15W40 is the base** — all other oil type prices are calculated as "15W40 base price + oil cost differential + volume tier premium"
8. **MHSW (environmental fee) is included in QTL's cost** — it's a mandatory recycling fee added to filter costs
9. **Labour / service cost is per job** — varies by filter type (Air Dryer = $10, standard filter = $8, etc.)
10. **Without Service = With Service + $5** for grease jobs
11. **Price changes require Admin confirmation** — no accidental live updates

---

## 10. Open Questions to Confirm

1. Should Staff be able to manually override the auto-filled price when entering a job, or should it always be locked to the catalog price?
2. Are there any other oil types being added in 2026 beyond the current 7?
3. Is the FASS System section used at all 3 locations or only specific ones?
4. Do all 3 locations use the same price list, or does each location have different pricing?
5. Should the Print List PDF include the QTL logo and be branded for customer handouts, or is it internal-only?
6. Are there any services not currently in the Excel file that need to be added (e.g. wheel seal, brake service)?
7. What is the minimum acceptable profit margin before the system should send an alert?
8. Should the system support promotional/discount pricing for specific customers or is pricing always fixed?
