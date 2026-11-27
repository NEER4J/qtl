# QTL - Client Voice Notes (Nov 26-27, 2026)

Eight WhatsApp voice notes and five pictures (transcribed automatically; Hindi/English, some parts unclear).

| # | Sent | What the client said | What we did |
|---|------|----------------------|-------------|
| 1 | Nov 26, 11:16 pm | "Is this the right link? Gurkirat made it, but the changes you mention did not happen in it." | `quicktl.netlify.app` auto-deploys `main` from NEER4J/qtl and had the latest build. Vercel is blocked ("Account is blocked."), so the old link is dead. Give him the Netlify link. |
| 2 | Nov 26, 11:53 pm | "Where did you add the transfer between locations? I can't find it." | Inventory > Transfers, top right next to Count sheet. |
| 3 | Nov 27, 6:57 am | MHSW: package has 3 filters, we add 2 extra, so quantity should be 5, not 1, and the total amount. Reporting should show how many were charged and how much. | MHSW lines now show a quantity (parts count x average, bulk oil litres x 0.06). MHSW Summary shows parts, litres and paid parts. |
| 4 | Nov 27, 7:53 pm | MHSW is not coming automatically. On New Job the engine isn't selected and the full filter list opens instead of "Original / Fleetguard". Where it works, only those two show. | Cause: the Engine list is narrowed by the vehicle's engine size with a literal match, so DET60, MP8, VOLVO D13, DETROIT 60, C13/15, CAT15 etc. found nothing (1,435 of 7,586 vehicles). New matcher in `lib/utils/engine-match.ts`; the engine is also picked automatically when exactly one fits. |
| 5 | Nov 27, 7:54 pm | "If we take a 2-minute call and you can see my computer, I will show you, otherwise you will keep searching." | Needs a quick screen-share call. |
| 6 | Nov 27, 8:43 pm (+ 2 job screenshots) | Cat C13/C15 package: the package filters did not get MHSW, only the extra filters. Volvo package worked. When making a new invoice the customer, vehicle and engine are set but the whole package list still shows. | Cause: package parts held at a fixed price carried no MHSW (Cat and Detroit packages have fixed prices, Volvo/Fleetguard did not). Every package part now carries its Sell MHSW. The full-list part is the engine shortlist fix from note 4. |
| 7 | Nov 27, 8:57 pm | "Like I am saying, it works in some and not in others." | Same cause as note 6, plus the database update (0169) not being applied. |
| 8 | Nov 27, 9:02 pm (+ DD15 screenshot) | The DD15 job has no MHSW either. Find on which jobs it comes and why it does not on the others. | DD15 package parts are fixed price (note 6). Also no bulk oil MHSW line on any job: the live database has no `mhsw_oil_per_litre` column, so migration 0169 is not applied. |

## Notes on #4

- 16 of the 36 active engines have **no filter options** (only a labour package): Cummins 5.9/6.7, ISB, ISC/ISL, ISM, ISX/X15, M11, N14, Detroit DD8, Duramax, Ford F-series, International (Inter, Navistar, S13, Vista), Mercedes Sprinter, Paccar Small. For these the Filter box doesn't appear, because there is only one package. The other 20 have an Original / Fleetguard style choice.
- Still not matched after the fix: "6 AXLES", "2 AXLES", "C3406E", "MB4000" (not engine names or typos); 256 vehicles have a blank engine size.
- MHSW lines only appear once migration 0169 is applied **and** the parts have a selling MHSW entered (the client is entering these himself).

## Notes on #6 to #8 (Nov 27 evening)

- **Migration 0169 is not applied in the live database.** Checked directly: `app_settings` has no `mhsw_oil_per_litre`, and `sales_jobs` has no `mhsw_parts_waived` / `mhsw_oil_waived`. Effects: no "MHSW - bulk oil" line is ever added, the "MHSW - parts" line is saved as a plain line (not automatic), part prices still include their MHSW, and the invoice totals read the lines wrongly. Staff are adding the "MHSW QTL1011" lines by hand to make up for it (invoice 332066 has them). Apply 0169 first; everything else depends on it.
- Until it is applied, the job form no longer adds the separate MHSW lines (they would charge MHSW twice, once inside the price and once on the line).
- Invoice picture (332066), handwritten by the client:
  - "No need to show description on invoice, only part number", pointing at the highlighted descriptions ("Same as LF3620", "Chev Starplex EP2 (Red)", "Same as FS19624"). Done on the printed invoice.
  - "Still show separate": read as the package items still print on their own lines. Kept as is.
  - Yellow highlights on the date (Nov 27, 2026), the package amount (204.83) and the oil amount (190.76) have no note. Meaning not known.
- A package labour line printed as "0" on every oil-change package (52 packages hold the text 0 as the labour description). Prints as "Labor" now.
- Total Parts showed -1.50 on 332066 (a part sold at $0 with MHSW 1.50). Fixed.
