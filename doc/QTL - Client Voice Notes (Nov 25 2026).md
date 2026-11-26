# QTL - Client Voice Notes (Nov 25, 2026)

Seven WhatsApp voice notes from the client to Neeraj, sent 25 November 2026 between 5:39 pm and 6:48 pm. They reply to our update message ("Done (please check) 1-6 / Next / Questions 1-3").

**How these were made:** transcribed automatically (Whisper large-v3, Hindi) and then translated to English. Automatic transcription of Hindi/English mixed speech can get words wrong, so the original audio is the source of truth. Places where the audio was unclear are marked **[unclear]**.

Source files (on the Desktop): `WhatsApp Ptt 2026-11-25 at 17.39.44.ogg`, `... 17.40.29.ogg`, `... 17.42.32.ogg`, `... 17.43.30.ogg`, `... 17.45.25.ogg`, `... 17.46.24.ogg`, `... 18.48.27.ogg`.

## Summary

| # | Sent | Area | What the client said |
|---|------|------|----------------------|
| 1 | 5:39 pm | Invoice (Done #2) | **Not working.** Package + oil + tier is still shown the old way |
| 2 | 5:40 pm | New job on Bulk (Done #1) | **OK.** Bulk comes in by itself |
| 3 | 5:42 pm | MHSW on jobs; Parts list price | MHSW line is not added to jobs. Also remove Sell MHSW from the part's list price |
| 4 | 5:43 pm | MHSW per part (answers Question 1) | The client will enter MHSW on each part themselves, once it no longer affects list price |
| 5 | 5:45 pm | MHSW on bulk oil | Bulk oil MHSW is per litre (6 cents/L), separate from the filter MHSW ($1.50) |
| 6 | 5:46 pm | Which link is live | The old link went down yesterday; Gurkirat made a new one. Our updates may be on our link but not theirs |
| 7 | 6:48 pm | Users > Owner | Remove the email on the Owner user too, if possible |

**Important (note 6):** the client may be testing on a different deployment from the one we updated. That would explain why Invoice (note 1) and MHSW (note 3) "are not working". Check which link the client is using before changing any code.

---

## 1. Invoice: package + oil + tier still shown the old way (5:39 pm, about 37 sec)

**Original (as transcribed)**

> Good morning Neeraj, thank you for all updates, मैं अभी चेक करना शुरू किया था, जो दूसरा number done, आपने लिखा है, invoice package, plus oil, plus tier, एक ही line में है, और tier नहीं है, नहीं, वो हमारे यहाँ पर काम नहीं कर रहा है, जो पहले था, वैसा का वैसा ही है। बाकी मैं चेक करके धीरे धीरे आपको message करता रहता हूँ, लेकिन वो जो number दो है, invoice package, plus oil, plus tier, वैसे का वैसा ही है।

**English**

> Good morning Neeraj, thank you for all the updates. I just started checking. Number 2 under Done, where you wrote "invoice: package + oil + tier in one line, no tier line": that is not working on our side. It is exactly the same as before. I will keep checking the rest and message you bit by bit, but number 2 (invoice package + oil + tier) is the same as before.

**What the client wants**
- Done #2 is not working for them: the invoice still shows the tier as before, not one combined line.
- Check first whether they are on the updated link (see note 6).

---

## 2. New job starts on Bulk: OK (5:40 pm, about 7 sec)

**Original (as transcribed)**

> Done list में number one है, वो ठीक है, वो वहाँ पे बल्क आ रहा है।

**English**

> Number one on the Done list is fine. Bulk is coming in there.

**What the client wants**
- Nothing. Done #1 is confirmed.

---

## 3. MHSW line is not added; remove Sell MHSW from list price (5:42 pm, about 32 sec)

**Original (as transcribed)**

> और MHSW का भी जो है ना, वो line add कुछ नहीं हो रही, और might be आपकी side में कुछ ना कुछ update करने वाला होगा, कुछ नहीं हो रहा है। लेकिन उसमें करने से पहले आपको एक चीज और करनी पड़ेगी। वो क्या है कि जब पार्ट्स में जाते हैं न, वहां पे वो सेल पे MHSW है ना, वहाँ पे वो list price में add हो रहा है, तो उसको भी हटाना पड़ेगा।

**English**

> And about MHSW: no line is being added. Maybe something still has to be updated on your side; nothing is happening. But before doing that, you need to do one more thing. When we go to Parts, the Sell MHSW there is being added into the list price. That has to be removed too.

**What the client wants**
- MHSW should appear as its own line on the job. Today no MHSW line is added. (We listed this under "Next", so this is expected, but it confirms they want it.)
- In Parts, Sell MHSW must **not** be added into the list price. Today the Parts page says *List price = cost + MHSW fee + margin*; the client wants *List price = cost + margin*, with MHSW charged separately on the job.
- Order: remove MHSW from list price first, then add the MHSW line to jobs.

---

## 4. Client will enter MHSW on each part (5:43 pm, about 49 sec) - answers Question 1

**Original (as transcribed)**

> सबसे पहले आप जब वो सेल MHSW लिस्ट में से हटा देंगे, तो मैं वहां पे फिर जिन जिन की भी कोई भी पार्ट्स हो, चाहे वो oil, fuel, coolant, कोई भी filter होगा, कोई भी पार्ट्स होगा, तो मैं फिर यहां से वहां पे उनकी price सेट कर दूँगा कि [उस]में कोई डॉलर है, कोई 1.50 या 2 डॉलर है, क्या है, उनकी यहां से। अब मैं इसलिए नहीं कर पा रहा हूँ क्योंकि वो मेरी लिस्ट प्राइस को इंपैक्ट कर रही है। तो मेरे को मैसेज छोड़ देना कि वह सेल लिस्ट में से बंद हो गया, तो मैं वहां पर फिर उसकी सेलिंग डालना शुरू कर दूंगा।

**English**

> First, once you remove Sell MHSW from the list price, I will go there and, for every part (oil, fuel, coolant, any filter, any part), set its MHSW amount myself: a dollar, 1.50, 2 dollars, whatever it is. I can't do it now because it affects my list price. So leave me a message once Sell MHSW no longer goes into the list price, and then I will start entering the selling MHSW.

**What the client wants**
- Answer to our Question 1: **they will enter MHSW per part themselves.** We should not bulk-set $1.50.
- They are waiting on us: tell them as soon as Sell MHSW no longer changes the list price.

---

## 5. Bulk oil has its own MHSW, per litre (5:45 pm, about 27 sec)

**Original (as transcribed)**

> बल्क ऑयल पे भी जो MHSW होता है, वो अलग होता है। जैसे लास्ट टाइम मैंने example दी थी कि अब oil filter पे $1.50 है, लेकिन बल्क ऑयल में वो per litre 6 cent है। तो एक line sale पे order पे ऑयल की होगी और एक पार्ट की होगी।

**English**

> Bulk oil also has an MHSW, and it is different. As in the example I gave last time: the oil filter has $1.50, but on bulk oil it is 6 cents per litre. So on the sale/order there will be one MHSW line for the oil and one for the part.

**What the client wants**
- Bulk oil MHSW = **$0.06 per litre** × litres used.
- A job can have two MHSW lines: one for the oil (per litre) and one for the parts (per part, e.g. $1.50 for an oil filter).

---

## 6. Old link went down; changes may not be on their link (5:46 pm, about 19 sec)

**Original (as transcribed)**

> ऐसा तो नहीं है कि ये जो लिंक है ना, कल बंद हो गया था पूरा, वो भी आपको पता ही होगा, और गुरकीरत ने एक और क्रिएट किया था, कि जो आपके लिंक में है वो अपडेट हो गया है, यहां पर नहीं है? तो उसके बारे में भी मेरे को प्लीज एक बार अपडेट कर देना।

**English**

> Could it be that, since this link went completely down yesterday (you probably know) and Gurkirat created another one, the updates are on your link but not here? Please let me know about that too.

**What the client wants**
- Confirm which link they should use, and that our latest changes are live on it.
- This may be why notes 1 and 3 look "not working".

---

## 7. Remove the email on the Owner user (6:48 pm, about 12 sec)

**Original (as transcribed)**

> नीरज, वो जो user में है न, owner पे भी अगर email हट सकती है, तो please उसको हटा देना। Thank you.

**English**

> Neeraj, in Users, if the email can be removed on the Owner as well, please remove it. Thank you.

**What the client wants**
- On the Users page, remove the email from the Owner user as well (as was apparently done for other users).
- **[unclear]** Whether "remove" means hide the email column/field, or clear the owner's email. The owner logs in with an email, so confirm before changing anything.

---

## Our questions: what got answered

| Our question | Answer |
|---|---|
| 1. MHSW: we set $1.50 on all filters, or you enter each? | **Client enters each part** (note 4), after Sell MHSW is removed from list price. Bulk oil is $0.06/L (note 5). |
| 2. With / without service: where is it missing? | Not answered yet; no screenshot. |
| 3. Free grease: first 30 days per truck, or 30 days after a full service? | Not answered yet. |

## Done items: status from the client

| Done item | Status |
|---|---|
| 1. New job starts on Bulk | Confirmed OK (note 2) |
| 2. Invoice package + oil + tier on one line | Not working for them (note 1); check the link first (note 6) |
| 3. Payroll benefits | Not checked yet |
| 4. Transfer printable note | Not checked yet |
| 5. Parts permission | Not checked yet |
| 6. Gallon size per oil | Not checked yet |

## To do

1. Find out which link the client is on and make sure the latest build is deployed there (note 6). Then ask them to recheck the invoice (note 1).
2. Parts: stop adding Sell MHSW to the list price (List = cost + margin). Tell the client when it's done so they can enter MHSW per part (notes 3 and 4).
3. Jobs: add MHSW lines automatically: per part from the part's Sell MHSW, and per litre ($0.06/L) for bulk oil (notes 3 and 5).
4. Users: confirm what "remove the email on Owner" means, then do it (note 7).
5. Still waiting on answers to Questions 2 and 3.

## Done on 26 Nov

- **MHSW own lines** (notes 3, 4, 5): built on the PC on 25 Nov and merged into main on 26 Nov. Migration renumbered **0169** (main's 0164 is `mhsw_not_stock`). Sell MHSW leaves the part list price, jobs get "MHSW - parts" and "MHSW - bulk oil" lines automatically, and the invoice and MHSW Summary report follow the new lines. The client can now enter MHSW on each part.
- **Invoice not changed on the client's side** (note 1): likely the other link (note 6). Confirm which link he uses.
- Still open: note 7 (Owner email), with/without service, free grease rule.
