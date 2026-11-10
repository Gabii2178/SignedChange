# Review and signing

Two screens share the document sheet. The invited page has no account, no price table, and no “Try free” block above or beside the sheet. The current `sign.html` card “Made with SignedChange – try free” moves below the completion state only, or off the review view entirely.

## Creator review

Step 4 of the wizard, specified in the workflow. The creator is already in the app. They may edit. They have not signed yet.

## Invited review

Route shape stays `sign.html#d={id}&t={token}`. The fragment is not a query string.

On load, `GET /doc/get`.

| Result | Screen |
|---|---|
| 200 | The sheet: title, parties, description, amounts, schedule, payment terms, photos, the creator signature, the agreement sentence, expiry date |
| 410 `used`, `declined`, `cancelled`, `expired` | The matching status page. If this browser stored `sc_signed_{id}`, offer the saved view link. Do not show the form |
| 404 | “This signing link is not valid.” |
| 503 | “We can’t confirm this document right now.” Retry reloads `GET /doc/get` |
| 409 on sign | “The document changed or could not be checked. Reload the page.” Reload refetches `GET /doc/get` and replaces `hash` |

The sheet is the review. Under it: full name (prefilled from `client`, editable, max 120), signature canvas, consent checkbox, primary “Sign and agree”. Decline is a disclosure under that, not a second primary button: a reason of at least 3 characters, then “Decline and send my reason”.

Signing posts `POST /doc/sign` with `d`, `t`, `sig`, `name`, `agree: true`, `hash`, `tz`, and `typed` when the name was typed. That is the current body.

Decline posts `POST /doc/decline` with `d`, `t`, `reason`, `name`, `tz`.

Completion: “Signed” and “Download signed PDF” using `#d=&v=` from `viewKey`. Tell the signer to keep that page. The view key is not emailed.

## What signing means in the product

The checkbox label is: “I agree to the statement above and sign this change electronically.” The statement on the sheet is `agreeText` from the server, not a longer legal warranty. Do not add “legally binding” or “qualified signature”.

## Errors and retries

| Action | Failure | What the person sees | Retry |
|---|---|---|---|
| Open | 503 | Can’t confirm | Reload |
| Open | 410 | The terminal state in words | None, unless a saved view link exists |
| Sign | 400 | Name, signature, or consent missing | Fix and submit again. The link is still open |
| Sign | 409 | Reload | Reload, then sign with the new hash |
| Sign | 410 | Already finished or no longer signable | No second signature |
| Sign | 503 | Can’t confirm | The same submit is safe to retry. Milestone 1 returns the same view key if the first attempt had already been decided and the body write is finished by the retry |
| Decline | 400 | Reason too short | Edit the reason |
| Decline | 410 | The link is already closed | No |
| PDF | 404 | Not available | The owner can still download with the account key |
| PDF | 409 | Doesn’t match the stored record | Do not offer a partial PDF |
| PDF | 503 | Can’t confirm | Retry |

## Creator after send

The app may poll `GET /doc/status` as it does now. Map status to the badge. If the poll returns `503`, show “Can’t confirm yet” and keep polling. Do not flip the badge to pending just because the body has not caught up.

Cancel and delete stay on the creator’s document screen. Repeated cancel is `409`. Repeated delete is `404`. The UI treats both as “already done” and returns to the list.
