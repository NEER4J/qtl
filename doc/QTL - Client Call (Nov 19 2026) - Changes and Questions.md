# QTL - Client Call (Nov 19, 2026): Changes and Questions

Source material, all on the Mac:
- `~/Desktop/Purani Basti Road.m4a` - 33 min audio of a call between the client and Neeraj
- `~/Desktop/Screen Recording 2026-11-19 at 23.16.54.mov` - the same call as a screen recording (client's PC over remote desktop, 12:49-1:20 pm client time), showing the live app
- `~/Downloads/Nov 2026 Standard.xlsx`, tab **Neeraj** - the sheet the client built to explain the gallon idea

**Reliability:** the call was transcribed automatically (Whisper, Hindi/English mix) and the audio is noisy. Timestamps below are into the call. Anything marked **[unclear]** could not be made out and should be confirmed, not assumed.

---

## What the app does today (relevant parts)

| Area | Today |
|---|---|
| Oil container | New Job has a Container field: Bulk (per litre) or Gallon. Each oil has a `litres_per_gallon` (default **4.546**, Imperial). A gallon line counts jugs x that size. |
| Tier price | The volume-tier premium is added as its own auto line; litres past engine capacity become a retail "Extra oil" line. |
| MHSW | Stored per part (`mhsw_fee` sell, `mhsw_buy` buy). Sell MHSW is **folded into list price** before margin (migration 0082). Shown as a column on the invoice line (`mhsw_unit`). MHSW items (QTL1010, QTL1011) also sit in Inventory as stock. No MHSW report. |
| Free grease | Per vehicle, once, in the vehicle's first 30 days. Lines come off inventory. |
| Payment reversal | Owner only (action + RLS 0153). Not in the permission matrix. |
| Parts catalogue | Settings > Pricing Catalogue > Parts is **co_owner only**. |
| Inventory | Per-location on-hand with min/max, Export CSV, Print. No stock transfer between locations. |
| Customer statement | Monthly statement with opening balance, invoices, payments, closing balance. |
| Backup | Nothing in the app. Data lives in Supabase. |

---

## A. Changes requested

### 1. Sell oil by the gallon as well as bulk (0:41-9:20)
- The client built a **Neeraj** tab to show it. Same engine (Cat C7/10/3126), three rows:
  - **Per litre:** 25 L x (6.23 + 0.05) = 157 oil cost.
  - **Gallon (3.78 L):** 25 / 3.78 = 6.61, **rounded up to 7 gallons** x 23.56 = 164.92.
  - **5 L jug:** 25 / 5 = 5 jugs x 26.59 = 132.95.
  - Selling price of the gallon row = bulk selling price + (gallon cost - bulk cost), so the dollar margin stays the same. Tier premium by litres: 8-20 L = $10, 21-38 L = $15, 39-46 L = $20, 47+ L = $25.
- **Jug size depends on the brand:** Chevron/Delo is 3.78 L, Shell is 5 L. The app must use the right size per oil, not one number.
- Gallon and bulk are **two part numbers with separate inventory**, because gallons are also sold retail and used in service.
- Rounding up matters: an opened jug cannot be reused, so 6.61 gallons costs 7.
- Default stays **Bulk** ("90% of the time we use bulk"), but Gallon must be a choice, and it should stick so staff do not re-pick it each job.
- **Check in the app:** default `litres_per_gallon` is 4.546 (Imperial), not 3.78 or 5. Confirm each oil's value is right.

### 2. Bug seen live: oil did not auto-fill on New Job (9:38-10:19)
- On a Cat engine job the oil grade did not come in by itself ("normally it comes automatically"). Neeraj deleted everything and redid it, then it worked.
- Needs reproducing: it may be the order of selecting service, engine, filter and oil.

### 3. Package total should include the tier price (10:49-11:49)
- The client wants the three amounts the customer is quoted, **filter price + oil price + tier price, to total as one package price**. Reason: customers argue about the tier price every time; one number is simpler. Other parts stay as separate lines.
- Ties to the Nov 3 note about tier price changing when extra oil is sold.

### 4. Free grease (12:12-17:00)
- It does not always show on New Job, and the client does not understand **when and why** it appears.
- When grease is a free item (1 kg, 0.7 kg), the price should be zero and the grease should still come off inventory. The client says when making a package or part with grease the system will not let him set it to zero.
- Neeraj's view on the call: "I think it is a bug, I will check."
- Needs: a clear rule, a visible explanation on the job form, and the zero-price/inventory behaviour fixed.

### 5. MHSW must behave like a tax, not like a part (17:04-22:05, 23:22-25:20)
- On a part, MHSW has a **Buying** side and a **Selling** side. The client says MHSW on the Selling tab **must not be added into the list price**; it is a separate fee on the sale.
- On a job or package: **one MHSW line**, with quantity = number of MHSW parts (2 filters = quantity 2, 3 filters = 3). Extra parts added by hand join the same line. The same applies to oil, including gallons.
- MHSW is not stock. Inventory shows MHSW items going negative (we saw QTL1011 at -211 and -1260 at two locations). Remove them from inventory.
- **New report**, same shape as the HST summary: MHSW paid on purchases vs MHSW charged on sales, "exactly like HST".
- Rates mentioned on the call: about **$1.50 per oil filter and fuel filter, not air filters**, and a per-litre rate on oil that the audio made sound like "sixty cents". **The Nov 17 invoice (section A2) shows it is $0.06 per litre** (40 L x 0.06 = 2.40), so "six cents".

### 6. Selling extra oil at the counter (22:22-25:20)
- A customer walks in for 5 L of oil, no service. The retail price per litre must be set somewhere (the client's example: $6/L) and the sale needs a retail oil line plus its MHSW line.
- Cost side: the oil cost is per litre; MHSW only applies to oil filters and fuel filters, not air filters, plus the $0.06 per litre on oil (see A2).

### 7. Inventory printing and count (25:20-26:14)
- Each month they print the inventory list from the old program and count by hand. They want a printout with the **part number and a blank space beside it to write the count** (no min/max on the printout). The end of this sentence is cut off **[unclear]**.

### 8. Move parts between locations (29:13-29:36)
- Parts moved from one location to another should be recorded as a **transfer at cost price**. Nothing like this exists today.

### 9. Backup (26:14-28:36)
- The client wants a backup daily or every other day, in case the system crashes. Neeraj said the data is in the database, and offered **a button for the admin to download a backup to their own computer**.
- The client's old system has a daily backup and a "dump" option, and he wants the same comfort.

### 10. Customer statement: make it simple (29:42-30:48)
- Show **only what is outstanding**. Remove payments and settled invoices. Show the age (30, 60 days) and **which location** each invoice belongs to.
- Replaces today's monthly opening/closing statement.

### 11. Permissions (31:09-32:21)
- **Parts:** the part manager must be able to **see and edit** parts. Today Pricing Catalogue > Parts is co_owner only.
- **Reverse payment:** the option exists, but it must be a permission that can be given to other roles. Today it is Admin only.

### 12. Payroll: one more item, not given yet (30:48-31:09)
- The client said there is "just one thing in payroll" and left it for next time.

---

## A2. New since the call (Nov 20-23): 4 voice notes and 2 marked-up sheets

Files in `~/Downloads`: `WhatsApp Audio 2026-11-20 at 02.06.58`, `... 17.59.54`, `... 18.01.58`, `WhatsApp Audio 2026-11-23 at 17.57.12`, `WhatsApp Image 2026-11-20 at 17.58.30.jpeg`, `... 18.00.55.jpeg`.

### 13. MHSW on the expense / vendor-bill side (voice note 20 Nov 5:59 pm, image 17.58.30)
- The client sent a **real supplier invoice** (Cummins Sales and Service, AG-261012107, 2 Oct 2026, billed to the Ayr shop) as the sample. Every part line is followed by its own **"ENVIRONMENTAL CHARGE"** line, which is the MHSW we pay when we buy. He marked the part line "Price" and the charge line "MHSW" on FF2200 (19.48, MHSW 1.14 x 12 = 13.68) and FF5369 (9.50, MHSW 0.48 x 12 = 5.76), and circled other 1.14 amounts.
- His words: it works **exactly like GST/HST**. When we buy, we **pay** MHSW; when we sell to a customer, we **collect** it. So the **expense side needs an MHSW column** too, for the parts we buy, as the mirror of the sales side.
- Today MHSW exists only on the part catalogue (a per-part `mhsw_buy`, reference-only) and on sales lines. **Nothing on expenses or vendor bills.**
- Buy-side MHSW is not one flat number: this one bill has 1.14 on some filters and 0.48 on others.

### 14. Invoice PDF corrections: Fort Erie invoice #23023, 17 Nov 2026 (voice note 20 Nov 6:01 pm, image 18.00.55)
The client marked up a printed copy. Mapped to what the PDF does today (`components/pdf/InvoicePdf.tsx`):

| Marked on the sheet | What the PDF does today | Change |
|---|---|---|
| "GST 85440 9653" with "**Bold**" | Plain text under the address | Print the GST/HST number in bold. His voice note says "HST number or business number" |
| "Business #" top right, blank | Prints the label with no value | **Unclear:** fill it with the business/HST number, or drop the label |
| "**Total Parts**" with "**Only parts**" next to 133.99 and 114.99 | Total Parts = **257.38**. That includes the two MHSW lines (6.00 + 2.40), because they are catalogue parts | Total Parts = parts only = **248.98**. MHSW is "not parts" |
| "**MHSW not Parts**" under the MHSW rows | MHSW prints as two lines, "MHSW QTL1010" and "MHSW QTL1011", like parts | MHSW prints on its own, not as a part. Where it totals is not stated (see questions) |
| "**Total Labour**" with "Remove" | Shows 469.80 (the package + oil lines roll into it) | Remove this row. The subtotal (757.18) must still add up, so something has to carry the 469.80 |
| "**Remove**" beside the oil sub-rows | Under the oil line, two "Included" sub-rows: "Delo 400XLE 10W30 (bulk)" and "Volume tier premium - Delo 400XLE 40 L (39 L+ tier)" | **Best reading:** drop these sub-rows and keep the single line "Delo 400XLE 10W30 SYN Blend (bulk) x 40 L (incl. volume tier) 234.80". Confirm |
| "Printed on NOV 18, 26 at 12 36 10" with "**Move**", an arrow down, "**Move here**" | Sits under the signature line, above the terms paragraph | Move it to the **bottom of the page, below the terms text** |

- This invoice also shows what the MHSW rates are: **4 filters x $1.50 = 6.00** and **40 L oil x $0.06 = 2.40**.
- The oil and tier premium are already folded into one line, as the Nov 19 call asked for (item 3).
- Green highlighter is on the GST number, "Printed on", "Labour", the "ltr"/"pcs" units and the page-1 header. The client says there are notes "on the whole sheet"; I could not tell if green means "change this" or "this is fine". Not acted on.

### 15. Mileage field limit (voice note 20 Nov 2:06 am)
- "When we enter mileage on New Job, it lets the limit go up to six digits. Please check whether the limit is six digits."
- What the code says: the job's odometer and the vehicle's mileage both accept up to **9,999,999 (seven digits)**, and the form has no other cap. Invoice #23023 itself shows an odometer of **1,545,390, seven digits**, so the app already handled it.
- It is not clear whether he is reporting a six-digit stop or asking us to confirm a six-digit limit. Needs the exact screen and what happened.

### 16. Status check (voice note 23 Nov 5:57 pm)
- "Of what we discussed last week, has something been updated? Please let me know so I can check."
- **Nothing from the Nov 19 call list has been built.** The newest commits are the Nov 13 ones (`ff3681b`, `7ab2006`) and there is nothing new on GitHub. Suggested reply in section D.

---

## B. Questions we have

### For the client (keep to the top ones, see message below)
1. **Gallons:** which oils come in 3.78 L and which in 5 L (or other)? Do the `Gallon` tabs in the workbook (15W40 Gallon, 10W30 Gallon, T5 Gallon...) already hold the real gallon costs and part numbers?
2. **Package total:** should the customer see **one package price with the tier folded in**, or the tier still shown on its own line?
3. **MHSW:** confirm the sell rates: $1.50 per oil/fuel filter, none on air filters, $0.06 per litre of oil (read off invoice #23023). Is HST charged on top of MHSW? On the invoice, where should MHSW total: its own "Total MHSW" row, or inside Subtotal only?
4. **Free grease:** state the rule once: free once per vehicle, within 30 days of what? And give one example job where it should have appeared and did not.
5. **Statement:** outstanding invoices only, with 30/60/90 buckets and location. Is an opening and closing balance still wanted anywhere?
6. **Permissions:** which role is the "part manager", and which roles may reverse a payment?
7. **Transfers and count sheet:** does a transfer need an approval, and should the count sheet be one page per location?
8. **Backup:** is an Excel/CSV download enough, or do they expect a database file? How often would the admin press it?
9. **Payroll:** what is the one item?
10. **Invoice sheet (#23023):**
    - If "Total Labour" goes, how should the 469.80 show: as the package/oil lines only (no total row), or folded into another total?
    - Does "Remove" mean the two "Included" oil sub-rows (Delo bulk and Volume tier premium)?
    - What should "Business #" show: the HST number, or remove the label?
    - Does the green highlighter mean "change" or "keep"? (GST number, Printed on, ltr/pcs units)
11. **Supplier bills:** when we enter a vendor bill, does MHSW come from the part (its buy MHSW), or is it typed from the bill (1.14 vs 0.48 per filter)? The Cummins bill suggests it varies, so typing it per bill line looks safer.
12. **Mileage:** which screen (New Job odometer or the vehicle's mileage), what number was typed, and what happened at the seventh digit?
13. **Old open points** from the Nov 2-3 notes are still unanswered: the "last five days / same in all reports" sentence in note 3, and an example for the tier-price jump in note 5.

### For us to settle or check ourselves
- Does gallon default 4.546 break any existing gallon jobs if we change it per oil?
- Does the volume-tier table in Settings match the sheet (10 / 15 / 20 / 25)?
- Is the MHSW change a data change (zero out `mhsw_fee` from list price, remove QTL1010/QTL1011/QTL1014 stock) or only a display change? Existing invoices must not move.
- Supabase backups: which plan are we on, and what point-in-time recovery do we already have, before we build a download button?
- Migrations are applied manually by Neeraj, so each item above that touches the database needs a migration file and a note.

---

## C. Suggested order

1. **Quick bugs and invoice fixes:** oil not auto-filling, free grease zero/inventory, MHSW out of inventory, Total Parts without MHSW, bold GST number, "Printed on" moved down, mileage check.
2. **Pricing changes:** MHSW as a separate single line (sales and expense side), package total with tier, gallon sizes per oil.
3. **Permissions:** parts view/edit, reverse payment as a permission.
4. **Reports and screens:** MHSW report, outstanding-only statement, count sheet.
5. **New features:** stock transfers, backup button.

---

## D. Done on 23 Nov (not committed, not deployed)

Built in this round. Everything typechecks and `next build` passes. Invoice #23023 was re-rendered from live data to check the PDF.

| # | Change | Where | Needs migration |
|---|---|---|---|
| 14 | Invoice PDF: GST number bold, **Total Labour removed**, **Total Parts = parts only**, new **Total MHSW** row, MHSW lines print after the parts, "Printed on" moved to the bottom under the terms. #23023 now shows Total Parts 248.98, Total MHSW 8.40, subtotal unchanged 757.18. | `components/pdf/InvoicePdf.tsx`, `lib/actions/sales.ts` | no |
| 5 | MHSW is not stock: hidden from Inventory and the low-stock count, never blocks a sale as "not enough stock". In the database, stock stops moving for MHSW and the old MHSW stock rows (-211, -1260...) are deleted. | `lib/utils/mhsw.ts`, `lib/actions/inventory.ts`, `lib/actions/stock-shortfalls.ts` | **0164** (app side works without it) |
| 13 | Expense bills get an **MHSW / unit** column per line. A picked part fills it from the part's Buy MHSW, and the unit cost then drops by that amount. Editable per bill (1.14 / 0.48 on the Cummins bill). It adds into the bill's sub total; "of which MHSW" shows under the items. | `components/expenses/*`, `lib/actions/expenses.ts`, `lib/schemas/expenses.ts`, expense detail page | **0166** (saving a non-zero MHSW before it is applied errors) |
| 5 | New report **Reports > MHSW Summary**: MHSW charged on sales (MHSW-category lines + MHSW built into part prices) vs paid on vendor bills, by month and by location, like the HST summary. | `app/(app)/reports/mhsw`, `lib/actions/mhsw-report.ts` | "paid" needs **0166**, until then it shows a notice |
| 11 | **Reverse payment** is a permission (Users > permissions > Sales > "Reverse payment"). Owners keep it; the Admin can give it to anyone with Sales. | `lib/permissions/*`, `lib/actions/sales.ts`, sale page | **0165** (until applied, only owners can actually reverse) |
| 7 | **Inventory > Count sheet**: printable per location, part #, brand and description by category, with an empty Count box. Shows only what that shop stocks (or every part, by toggle), plus oils. On-hand is left off so it is a real count. | `app/(app)/inventory/count-sheet` | no |
| 8 | **Inventory > Transfers**: move parts or oil between locations at catalogue cost, checked against on-hand. Shows a history (who, when, value). Can't be edited; undo with a transfer back. Owner, Admin, managers and supervisors. | `app/(app)/inventory/transfers`, `lib/actions/stock-transfers.ts` | **0167** (page shows a notice until applied) |
| 9 | **Settings > Backup** (Admin only): "Download full backup" downloads every business table as its own CSV, streamed so big tables (130k sales lines) work. Leaves out the audit log and login secrets. | `app/(app)/settings/backup`, `app/api/export/backup`, `lib/utils/backup-tables.ts` | no |
| 15 | Mileage: no change. Both fields already take 7 digits. | none | none |

**Migrations to apply (in order):** `0164_mhsw_not_stock`, `0165_reverse_payment_permission`, `0166_expense_items_mhsw`, `0167_stock_transfers`. Each was run twice on a throwaway Postgres with stubbed tables, with these results:
- MHSW stock writes are dropped and old MHSW rows are deleted.
- A transfer moves parts and oil between locations.
- The location and whole-unit rules reject bad transfers.
- The reversal policy lets a granted manager through and refuses an ungranted one.

**Not tested in the browser:** the app login needs the shop's IP and a user account.

**Not done yet (waiting on answers or needs a bug hunt):**
- Gallon sizes per oil.
- Package total with the tier folded in.
- Removing the two "Included" oil sub-rows.
- Free grease.
- Oil not auto-filling.
- Outstanding-only statement.
- Parts editing for a part manager. This needs RLS and action changes once we know who it is.
- One automatic MHSW line per job. The rates are confirmed by the data; which part categories count still needs confirming.
- The payroll item.

---

## E. WhatsApp message to the client (short, no emoji)

Send after the deploy and the four database updates are applied.

```
Hi, good morning. Update on last week's list.

*Done (please check)*
1. Invoice: GST number in bold, Total Labour removed, Total Parts is parts only, MHSW has its own total, "Printed on" moved to the bottom.
2. MHSW is no longer stock. It is gone from Inventory and will not stop a sale.
3. Expenses: new MHSW column on each bill line, like the Environmental charge on the Cummins bill.
4. New report: Reports > MHSW Summary. MHSW charged on sales vs paid on bills, like the HST summary.
5. Inventory > Count sheet: print per location, with a blank box to write the count.
6. Inventory > Transfers: move parts or oil between locations at cost, with history.
7. Settings > Backup: download all the data to your computer.
8. Reverse payment is now a permission. Admin can give it to any user in Users > permissions > Sales.
9. Mileage: it already takes up to 7 digits.

*Questions*
1. Gallons: which oils come in 3.78 L and which in 5 L?
2. Package price: one total (filter + oil + tier together), or keep the tier on its own line?
3. MHSW: 1.50 per oil/fuel filter and 0.06 per litre of oil, none on air filters. Correct?
4. On the oil line, where you wrote "Remove": the two lines under it (Delo bulk and Volume tier premium)?
5. Free grease: please send one job where it should have shown and did not.
6. Customer statement: only outstanding invoices with 30/60/90 days and location, no opening or closing balance. OK?
7. Who is the part manager who should see and edit parts?
8. Payroll: what was the one thing?
```
