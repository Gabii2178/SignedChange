# Application blueprint

The app is the current job of `site/app.html`, `sign.html`, and `verify.html`, split into views. It still talks to the same Worker routes.

## Dashboard

This is `/account/me`, not a new analytics page.

Desktop, 1024 px and up: 240 px nav, then a 1120 px region. H1 “Documents”. Primary “New change record”. Under it, the free line the API already returns: `freeLeft` of 3, or “Pro” when `pro` is set. Do not recompute the limit in the browser.

The list is the activity component. Default request omits `limit` and `cursor` so the first 50 rows match today’s response. If `nextCursor` is present, show Next. Previous can keep the cursors in memory for the session. Do not invent page numbers.

Empty: “No documents yet” and the primary button.

`503` on the list: the error state, not an empty list. An empty list and a failed list are different.

## Document detail

H1 is the title. Status badge. Parties, change, money, schedule, agreement sentence. Actions that exist today:

- Download PDF (`GET /doc/pdf` with the bearer key).
- Cancel, only while pending.
- Delete, with a confirm dialog that quotes the title.
- Duplicate into a new wizard. That creates a new document. It does not version the old one.

If status is `409` or `503`, show that error instead of the sheet.

## Create

The five-step wizard in [11-workflow.md](11-workflow.md). Max width 720 px. Progress is “Step 2 of 5” plus the step name.

## Review

The creator’s step 4 and the invited page share the document-preview component. Specs are in [12-review-signing.md](12-review-signing.md).

## Verify

Public. One field, Document ID, and a button “Check”.

Results:

| Response | UI |
|---|---|
| 200 | Status badge, title, date, party names, fingerprints in the mono style. No email, no amount, no signature image |
| 400 | “That does not look like a document ID.” |
| 404 | “No document with this ID. It may have been deleted.” |
| 409 | “This copy doesn’t match the stored record.” |
| 503 | “We can’t confirm this document right now.” Retry |

Do not show a green seal. Do not say “legally binding”.

## Account

H1 “Account”. Explain that the key in `localStorage` (`sc_acct`) is the account. Show the masked key with Copy and a warning dialog before reveal. Paste-a-key replaces the local account only after `GET /account/me` returns 200, which is what `site/app.js` does now.

There is no password, no email login, and no recovery beyond the key. The screen must say that a lost key cannot be reset by SignedChange.

Pro status is displayed from `pro`, not from a checkout redirect. “Restore Pro” stays the existing transaction-id form. Do not redesign the PayPal calls.

## Settings

Only theme preference and cookie choice. No profile server record exists.
