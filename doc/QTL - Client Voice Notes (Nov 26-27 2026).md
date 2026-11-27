# QTL - Client Voice Notes (Nov 26-27, 2026)

Five WhatsApp voice notes (transcribed automatically; Hindi/English, some parts unclear).

| # | Sent | What the client said | What we did |
|---|------|----------------------|-------------|
| 1 | Nov 26, 11:16 pm | "Is this the right link? Gurkirat made it, but the changes you mention did not happen in it." | `quicktl.netlify.app` auto-deploys `main` from NEER4J/qtl and had the latest build. Vercel is blocked ("Account is blocked."), so the old link is dead. Give him the Netlify link. |
| 2 | Nov 26, 11:53 pm | "Where did you add the transfer between locations? I can't find it." | Inventory > Transfers, top right next to Count sheet. |
| 3 | Nov 27, 6:57 am | MHSW: package has 3 filters, we add 2 extra, so quantity should be 5, not 1, and the total amount. Reporting should show how many were charged and how much. | MHSW lines now show a quantity (parts count x average, bulk oil litres x 0.06). MHSW Summary shows parts, litres and paid parts. |
| 4 | Nov 27, 7:53 pm | MHSW is not coming automatically. On New Job the engine isn't selected and the full filter list opens instead of "Original / Fleetguard". Where it works, only those two show. | Cause: the Engine list is narrowed by the vehicle's engine size with a literal match, so DET60, MP8, VOLVO D13, DETROIT 60, C13/15, CAT15 etc. found nothing (1,435 of 7,586 vehicles). New matcher in `lib/utils/engine-match.ts`; the engine is also picked automatically when exactly one fits. |
| 5 | Nov 27, 7:54 pm | "If we take a 2-minute call and you can see my computer, I will show you, otherwise you will keep searching." | Needs a quick screen-share call. |

## Notes on #4

- 16 of the 36 active engines have **no filter options** (only a labour package): Cummins 5.9/6.7, ISB, ISC/ISL, ISM, ISX/X15, M11, N14, Detroit DD8, Duramax, Ford F-series, International (Inter, Navistar, S13, Vista), Mercedes Sprinter, Paccar Small. For these the Filter box doesn't appear, because there is only one package. The other 20 have an Original / Fleetguard style choice.
- Still not matched after the fix: "6 AXLES", "2 AXLES", "C3406E", "MB4000" (not engine names or typos); 256 vehicles have a blank engine size.
- MHSW lines only appear once migration 0169 is applied **and** the parts have a selling MHSW entered (the client is entering these himself).
