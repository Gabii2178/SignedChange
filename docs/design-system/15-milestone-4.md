# Milestone 4 — implement this system

Do not start this until Milestone 3 is accepted. Milestone 4 is the frontend. It does not reopen payment, signing rules, or storage.

## In scope

1. Load `tokens.css` values into the marketing and app pages. Remove gradient logo usage from templates by pointing at the new SVG family. Leave the old files in `site/` until the templates no longer reference them, then stop using them. Do not edit `worker/src/paypal-rest.js`, IPN, `proStatus`, prices, or `GET /verify?ret=1`.
2. Rebuild the marketing pages to the website blueprint: header, homepage sections, pricing cards with the current three amounts, FAQ, footer. Canonical copy may say `https://signedchange.com`. Do not change PayPal `return` or `notify_url`.
3. Replace the one-page `app.html` form with the five-step wizard. Submit the same `POST /doc/create` body.
4. Rebuild `sign.html` so the review has no upsell. Keep hash, token, decline, and view-key behavior.
5. Rebuild verify and the document list for `400`, `404`, `409`, `503`, `nextCursor`, and the status words in the component spec.
6. Account screen for the existing key. No password.
7. Apply focus, target size, reduced motion, and the contrast pairs. Check 320 px and 1280 px.
8. Do not add parties, teams, workspaces, server-sent mail, or a revision history.

## Exit

A person can create, share, sign or decline, download, verify, list, cancel, and delete with the current API. Free and Pro still come from the server. A failed coordinator shows “Can’t confirm”, not a stale pending badge. The invited page can be completed with no account and no upgrade prompt before the sheet.

## Suggested order

1. Tokens and logo swap in a single stylesheet, behind the existing pages, to see contrast failures.
2. Marketing pages.
3. Wizard and creator review.
4. Invited review and signing.
5. List, detail, verify, account.
6. Keyboard and small-screen pass.

Each slice stays on `Gabii2178-patch-1` and does not push unless the owner asks.
