# QTL - Client Voice Notes (Nov 24, 2026)

Twelve WhatsApp voice notes from the client, 24 Nov 2026, 6:24-6:45 pm (files `WhatsApp Audio 2026-11-24 at 18.24.42.opus` ... `18.45.54.opus` in Downloads). They answer the questions sent on 23 Nov (`doc/QTL - WhatsApp Update to Client (Nov 23 2026).md`) and add three new items.

Transcribed automatically (Whisper, Hindi/English) and translated. **[unclear]** marks what could not be made out.

## Answers to our questions

| Our question | Client's answer | Note |
|---|---|---|
| 1. Gallon sizes | Every brand differs: **Chevron 3.78 L, Mobil 4 L, Shell 5 L**, and it can change (new oils coming in January). The jug size must be **selectable / editable per oil**, not fixed. (6:24) | `oil_types.litres_per_gallon` already exists per oil. Check it is editable in Oil types and holds the right values (default 4.546). |
| 2. Package price | **One line: package + oil + tier totalled together** at the top. The tier must **not** print as its own line, and not as an "extra" underneath. The oil brand/grade used still prints. (6:26, 6:30) | Today the oil and tier are folded into one line but the two "Included" sub-rows (oil, Volume tier premium) still print. Customers argue about the tier line. |
| 2b. Tier must stay correct | "Make sure" the tier price does not **jump** when a 35-40 L engine takes extra oil. If the tier line is hidden, nobody can see what is charged, so it must be right. (6:31) | The Nov 16 cap at engine capacity is meant to fix this. Re-test before hiding the line. |
| 3. MHSW rates | The rate can differ per part or be the same. **Not only oil and fuel filters: coolant filters, DEF filters etc. too.** Parts already have a purchase and a selling MHSW. Oil: **gallon $1.50 per jug, bulk $0.06 per litre**. The rates must be **selectable/editable**, they may change. (6:28) | So MHSW comes from each part's / oil's own sell MHSW setting, not a fixed list of categories. |
| 3b. MHSW lines on the invoice | (6:28, 6:37) **One MHSW line for all the parts' MHSW** (package filters + extra filters, and gallon jugs), and **one separate line for bulk oil MHSW** ("Oil environment MHSW") covering every litre: package oil, extra oil, and Trans & Diff packages. | Today staff add QTL1010 / QTL1011 by hand. This asks for them to be added automatically from the parts and oil on the job. |
| 4. "Remove" on the oil | Yes: remove the tier line (see 2). | |
| 5. Free grease example | Not answered. | |
| 6. Customer statement | Not answered. | |
| 7. Part manager | Needs a **permission**: parts **visible and editable** for whoever the Admin gives it to. (6:44) | Today Pricing Catalogue > Parts is Admin only, in the app and in the database. |
| 8. Payroll | **Benefit column missing** from the pay-week spreadsheet and its PDF / Excel. It is entered on the entry but not reported. (6:33) | Confirmed: the pay-week page and print show no benefit amounts. The CSV has a `benefit_deduction` column. |

## Other points in the notes

- **New Job: Bulk as the default container** (6:35). 80-90% of jobs are bulk. Today the Container box starts empty (`oil_container: ""`), so staff pick it every time.
- **MHSW column on expenses** (6:38): "it was missing; if it's done, it has to add in there too". Built on 23 Nov but **not live until migration 0166 is applied** (and the deploy).
- **Transfers need a record, like an invoice** (6:42): a transfer between locations should create a document (a transfer note) to keep on file. The end of the note is cut off **[unclear]**. Today Transfers keeps a history list only, and is not live until migration 0167.
- **"With service / without service" price setting is missing** (6:45): "the important one we discussed 2-3 times". **[unclear what is missing]**: the part picker on a job already offers With Service / Without Service / Over the Counter, and All filter sell price shows them. Needs one example of where he expects it.

## Change list from these notes

1. Bulk as the default container on New Job. Small, clear.
2. Invoice: drop the oil and tier "Included" sub-rows. Keep one line with the oil brand/grade and the total of package + oil + tier.
3. Payroll: add the benefit amounts (employee deduction, employer contribution) to the pay-week page, the print/PDF register and stubs, and confirm they're in the Excel/CSV.
4. Gallon size per oil: make sure it is editable in Oil types and set to 3.78 / 4 / 5 per brand.
5. Automatic MHSW lines on a job: one line for parts + gallon jugs (from each item's sell MHSW), one line for bulk litres at the per-litre rate. Rates editable. This replaces adding QTL1010 / QTL1011 by hand. Needs a design pass: where the per-litre rate lives, and how it works with parts whose list price already includes sell MHSW.
6. Parts permission: let the Admin give parts view + edit to a user (app checks and database rules for parts).
7. Transfers: a printable transfer note per transfer.
8. Re-test the tier jump with extra oil on a 35-40 L engine before hiding the tier line.

## Still open with the client

- Where is the "with service / without service" setting missing? One example screen or job.
- Free grease example job (question 5) and the customer statement (question 6) were not answered.
- Migrations 0164-0167 must be applied before he checks MHSW on expenses and transfers.

## Done on 24 Nov (not committed yet)

| # | Change | Where | Migration |
|---|---|---|---|
| 1 | New jobs start on **Bulk**. An edited job keeps its saved container. The container is only saved when an oil is picked. | `components/sales/sales-job-form.tsx` | none |
| 2 | Printed invoice: **package + oil + tier on one line**. The oil grade prints under it as "Included", there is no tier line, and Miscellaneous no longer repeats the tier. Invoice #23023 now shows the Detroit package at 499.80 (265 + 234.80), with the same total of $855.61. The job screen still shows the tier for staff. | `components/pdf/InvoicePdf.tsx` | none |
| 3 | Payroll: **Benefit** (employee) and **Er benefit** (employer) columns on the pay week and the printed register, with totals. The stub and the CSV already had them. | `app/(app)/payroll/[weekId]/page.tsx`, `.../print/page.tsx` | none |
| 7 | **Transfer note**: a printable note per transfer (TR- number, shops, item, qty, cost, value, who, signature lines). There's a "Note" link in the history and "Print note" on the success message. | `app/(app)/inventory/transfers/[id]` | needs 0167 |
| 6 | **Parts permission**: the Admin can give Pricing Catalogue > Parts (view + edit) to any user. App checks and RLS were tested on a throwaway database: a granted manager can edit, an ungranted one can't. | `lib/permissions/registry.ts`, `lib/actions/pricing.ts` | **0168** (needs 0165 first) |
| 4 | Jug size per oil was already editable in Oil types. The New Job option now reads "Gallon (jug size set per oil)" instead of "Imperial gallon". | sales form, oil type form | none |

**Live data to check (not changed):**
- Mobil 15W40 / 10W30 HDEO bulk = 3.89 L but the Gallon rows = 4 L.
- Petro DURON SHP 15W40 = 4.546 L but its Gallon row = 4 L.
- Total 10W30 Rubia = 4.546 L.

The client said Mobil is 4 L.

**Not done, needs a decision: automatic MHSW lines (#5).** On the call the client said Sell MHSW must not be added into the list price. Today it is (migration 0082), but only 2 parts have a Sell MHSW set: A0000903651 at $1.50 and MV 1878 at $0.50. The shop adds QTL1010 / QTL1011 by hand instead. The plan:
- Stop folding Sell MHSW into list price.
- Put a per-jug MHSW on oil types, and a per-litre bulk rate in Pricing settings ($0.06).
- Have the job add one "MHSW" line (parts + jugs) and one "Oil MHSW" line (bulk litres) automatically, editable like the tier line.

For this to charge anything, every filter needs its Sell MHSW filled in. Seeding $1.50 on the filter categories (oil, fuel, coolant, DEF...) is a client decision.
