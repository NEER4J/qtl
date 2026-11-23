# QTL - WhatsApp update to the client (Nov 23, 2026)

Reply to the client's check-in of 23 Nov ("of what we discussed last week, has something been updated?"). Covers the Nov 19 call and the Nov 20 voice notes and invoice sheets.

**Before sending:** deploy `main` (commit `27c4c8c` and later) and apply the four database updates, in order, in the Supabase SQL editor: `0164_mhsw_not_stock`, `0165_reverse_payment_permission`, `0166_expense_items_mhsw`, `0167_stock_transfers`. Without 0166, saving an expense with MHSW fails; without 0167 the Transfers page shows a "not switched on yet" notice; without 0165 only owners can reverse payments.

Plain text, no emoji, WhatsApp `*bold*`. Copy everything inside the box.

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

## Still open on our side (not in the message)

- Gallon sizes per oil, package total with the tier folded in, the two "Included" oil sub-rows: waiting on questions 1, 2 and 4.
- Outstanding-only customer statement: waiting on question 6.
- Parts editing for the part manager: waiting on question 7.
- Free grease and "oil did not fill in on New Job": not investigated yet; question 5 gives us an example job.
- The one payroll item: question 8.
