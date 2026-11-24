# QTL - WhatsApp update to the client (Nov 24, 2026)

Reply to the client's twelve voice notes of 24 Nov (`doc/QTL - Client Voice Notes (Nov 24 2026).md`).

**Before sending:** deploy `main` (commit `ac846bf` or later) and apply the database updates in order in the Supabase SQL editor: `0164`, `0165`, `0166`, `0167`, `0168`. The MHSW column on expenses (0166), Transfers (0167) and the parts permission (0168) don't work until they are applied.

Plain text, no emoji, WhatsApp `*bold*`. Copy everything inside the box.

```
Hi, thanks for the voice notes. Update:

*Done (please check)*
1. New job: Container now starts on Bulk.
2. Invoice: package + oil + tier print as one line with one price. The oil grade shows under it, no tier line. On the screen the tier is still visible for staff.
3. Payroll: Benefit and employer benefit now show on the pay week and the printed register, with totals.
4. Transfers: each transfer now has a printable note (TR number, both locations, item, qty, cost, signatures) to keep on file.
5. Parts: Admin can now give any user permission to see and edit parts (Users > permissions > Pricing Catalogue > Parts).
6. Gallon size is set per oil in Settings > Pricing Catalogue > Oil types. Chevron 3.78, Shell 5. Mobil is 3.89 on the bulk oil and 4 on the gallon. Please check it is right.
7. MHSW column on expenses and Inventory > Transfers are ready, please check them now.

8. Oil not coming in by itself on New Job: it waited for Bulk/Gallon to be picked. Now Bulk is the default, so it comes in as soon as engine, filter and oil are picked.

*Next*
MHSW added automatically on every job: one line for parts and gallons, one line for bulk oil at 0.06 per litre.

*Questions*
1. MHSW per filter: should I put 1.50 on all oil, fuel, coolant and DEF filters, and you change the ones that are different? Or will you enter each part yourself?
2. With service / without service: where is it missing? Please send a screenshot or a job number.
3. Free grease: right now it shows only for a truck added in the last 30 days, once per truck. That is why it does not show on older trucks. Is that the rule, or should it be free once within 30 days after a full service oil change?
4. Customer statement: only outstanding invoices with 30/60/90 days and location, no opening or closing balance. OK?
```
