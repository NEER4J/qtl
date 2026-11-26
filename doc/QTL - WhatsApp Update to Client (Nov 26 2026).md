# QTL - WhatsApp update to the client (Nov 26, 2026)

Closing message after the client's Nov 25 notes. Covers MHSW on its own line and everything since the Nov 19 call.

**Before sending (all three):**
1. **Deploy.** Vercel says "Account is blocked." for every push to `main` since Nov 24 (GitHub status on commit `071bef8`), so nothing newer than `6fed4b4` is live on that project. Unblock the account, or deploy to the project behind the link the client now uses.
2. **Apply the database updates, in order** in the Supabase SQL editor: `0164`, `0165`, `0166`, `0167`, `0168`, `0169` (files in `supabase/migrations/`). 0169 re-prices every part (list price = cost + margin) and adds the automatic MHSW lines. 0166 is needed to save MHSW on an expense, 0167 for Transfers, 0168 for the parts permission.
3. **Ask which link he uses** and make sure it is the deployed one. He said the invoice change was not working for him (likely the old link).

Plain text, no emoji, WhatsApp `*bold*`.

```
Hi, my side is done. Everything you asked for is built. Please check on the link we use now.

*MHSW*
1. Sell MHSW is no longer in the part's list price. List price is now cost + margin. You can enter MHSW on each part now.
2. Each job adds two MHSW lines by itself: "MHSW - parts" (each part's MHSW x qty) and "MHSW - bulk oil" (litres x 0.06). You can edit or remove them like the tier line. Old jobs are not changed.
3. The invoice shows them under Total MHSW. New report: Reports > MHSW Summary.
4. Expenses have an MHSW column on each line.

*Other*
5. Invoice: package + oil + tier in one line, no tier line, no Total Labour, Total Parts is parts only, GST in bold.
6. Transfers between locations with a printable note, and a count sheet to print.
7. Payroll benefits show on the pay week and the register.
8. Admin can give any user permission to see and edit parts, and to reverse payments.
9. Settings > Backup downloads all the data.

Not changed yet: customer statement, free grease rule, with/without service, Owner email. Message me when you want these and I will do them.
```
