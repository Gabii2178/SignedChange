# Five-step creation

The wizard collects the fields `readFields` already accepts for `v: 3`. It does not add legal requirements. Client checks mirror the server so a 400 is rare. The server remains the authority.

Progress is a `nav` named “Progress”: five items, the current one `aria-current="step"`. Completed steps are buttons that go back. Future steps are not links. Text is “Step 3 of 5 · Money and schedule”. A bar is optional and is not the only indicator.

Back does not discard the step. Continue validates that step only. The browser draft in `localStorage` (`sc_draft`) may still autosave. Label that “Draft on this device.” It is not a server document.

## Step 1 · The change

Purpose: say what changed, before names and money.

Fields:

| Control | API field | Rule |
|---|---|---|
| Template | none | Local templates only. Choosing one fills the form. It is not submitted as its own field |
| Title | `title` | Max 80. Default “Signed Change Record” |
| Job or contract | `job` | Max 160 |
| Original agreement date | `contractDate` | Optional. `YYYY-MM-DD` or empty |
| What changed | `desc` | Required. Max 3000. Bracket placeholders such as `[date]` are rejected |
| PDF language | `lang` | `en` or `fr` |

Error copy uses the server sentence when the API returns one. Local copy for an empty description: “Describe what changed.”

The user should understand that this text is the change both people will sign.

## Step 2 · People

Purpose: name both sides.

| Control | API field | Rule |
|---|---|---|
| Your name | `biz` | Required, max 120 |
| Company | `bizCo` | Optional, max 120 |
| Role | `bizRole` | Optional, max 60 |
| Your phone or email | `contact` | Max 120 |
| Other party’s name | `client` | Required, max 120 |
| Their company | `clientCo` | Optional, max 120 |
| Their role | `clientRole` | Optional, max 60 |
| Their email or phone | `clientContact` | Required for a link. Email shape, or a phone with at least 6 digits. Optional if they will sign on this device |

Help under the contact field: “Needed so you can send the signing link. We do not email it for you.”

## Step 3 · Money and schedule

Purpose: the numbers and dates.

| Control | API field | Rule |
|---|---|---|
| Price direction | `priceDir` | `inc`, `dec`, or `none` |
| Amount | `price` | Required unless lines exist. Number like `250` or `250.00` |
| Lines | `lines` | Optional, max 15. Each needs a description and an amount. The server replaces `price` with the line total |
| Currency | `currency` | Letters, max 8. The UI offers the current list: USD, EUR, GBP, XAF, NGN, GHS, KES, ZAR, CAD, AUD, INR |
| Tax percent | `taxRate` | Optional, 0 through 100 |
| Original amount | `origAmount` | Optional number |
| New completion date | `newDate` | Optional `YYYY-MM-DD` |
| Days added | `daysAdded` | Whole number, up to 4 digits, may be negative. Empty becomes 0 |
| Payment due | `payTerms` | Empty, completion, net7, net14, net30, custom |
| Custom terms | `payCustom` | Required when terms are custom. Max 120 |
| Payment method | `payMethod` | Optional, max 80 |
| Date of this change | `date` | `YYYY-MM-DD`. If the server finds it invalid it uses the UTC date. The UI should not send an invalid date |

Show a live total using the same arithmetic as `amounts`: direction, tax, optional new contract total. Label it “Preview”. The server recomputes it.

## Step 4 · Review

Purpose: read the whole change before any signature.

Show parties, the description, the money preview, schedule, payment terms, and the agreement sentence. The CO number is assigned when the document is created, so the preview says “CO number is assigned when you create this” rather than a fake number. The stored English sentence is built by `agreementText` and includes the job and the original date when those exist.

Edit links return to steps 1–3. Continue goes to step 5. Nothing is posted yet.

## Step 5 · Sign and share

Purpose: sign and, if remote, show the link once.

Controls:

- How they sign: “Send a link” (`mode: remote`) or “Sign on this device” (`mode: inperson`).
- Your signature. Required PNG.
- If in person, their signature. Required PNG.
- A consent checkbox. Required in the UI before Continue.
- Continue posts `POST /doc/create` with `v: 3` and the fields above. Do not add new body fields. The in-person checkbox is enforced in the page, not by a new API flag.

After 200:

- Remote: show the `signUrl` and say it is not stored on the server. Copy, WhatsApp, and the mail link are local actions. If this browser keeps `sc_links`, “Share link again” can work. Another device cannot recover the token.
- In person: offer the PDF download. Status is already `signed`.

Errors:

| HTTP | UI |
|---|---|
| 400 | Field error from `error`, `field`, `placeholders` |
| 402 | The free-limit message. Link to the existing upgrade block. Do not grant Pro in the page |
| 429 | “Too many documents too fast.” |
| 503 | “We can’t confirm this document right now.” Retry the same post only if the user asks. A retry can create a second document if the first succeeded and the response was lost. Say that |
| Network | “Network error. Your draft is still on this device.” |

The user should understand that Continue creates the record and, for a link, produces a secret URL they must keep.
