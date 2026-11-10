# Proposed pricing display

Status: **proposed preview only. Not purchasable.** These cards must not be placed on the live site or wired to the current PayPal buttons. The running source still charges the old amounts. See [17-billing-dependencies.md](17-billing-dependencies.md).

## Cards

| Plan | Cadence | Comparison figure | Prominent price | What the allowance is |
|---|---|---|---|---|
| Free | None | None | $0 | The current free allowance: 3 creates per account. The server also stops free creates from one network after 10 in a calendar month. Deleting a file does not give the slot back |
| Pro Monthly | Billed every month | $9, struck through | $5 per month | Unlimited documents while that subscription is active, same idea as today’s monthly plan. The $5 amount is not what checkout charges today |
| Pro Yearly | Billed every year | $60, struck through | $49 per year | The proposed yearly plan. It replaces Lifetime as the option this design proposes. It is not a one-time Lifetime purchase |

Three cards, in that order. Yearly may carry the words “Lower than 12 months at $5”. No countdown, no “today only”, no coupon code.

## How to read the struck prices

**$9** is the monthly price in this repository. It appears in `site/app.js` (`a3: '9.00'`, `t3: 'M'`), `worker/wrangler.toml.example` (`SUB_PRICE = "9.00"`), `site/terms.html`, the homepage pricing section, and the app purchase cards. Striking it through means “the monthly price written in the current source,” not a sale that has already started.

**$60** is **$5 × 12**. It is an arithmetic comparison so a reader can see that $49 per year is less than paying the proposed $5 every month for a year. This repository has **no** yearly product, no yearly PayPal plan, and no charge of $60. Do not write “Was $60”, “regularly $60”, or “historical yearly price”. The visible line is the struck `$60`, and the sentence next to it must say it is 12 × $5.

**$49 per year** is the proposed yearly charge. **$49 once** is the current Lifetime charge in source. Same digits, different product. The proposed card must say “per year”. It must not say “one-time”, “lifetime”, or “forever”.

## Lifetime conflict

The approved proposal does **not** keep Lifetime as an active option. The source still does. `site/app.html`, `site/index.html`, `site/app.js` (`amount: '49.00'`, item name Pro Lifetime), `worker/src/paypal-rest.js` (order description “SignedChange Pro Lifetime”, amount `env.PRICE` default `49.00`), and `proStatus` type `life` all still implement Lifetime. This design does not delete that path and does not pretend the new yearly card is that path.

People who already have `pro.type === 'life'` keep that entitlement. Nothing in this proposal converts or expires them. What to do for those accounts is an owner decision in the billing report.

## Buttons

Proposed cards have no PayPal form, no Smart Button, and no link to `/account/paypal-order`, `/ipn`, or the current app `#buy` checkout. The label on the card is “Proposed — not for sale yet.”

## Where this display is allowed

`docs/design-system/` previews and the blueprint pages updated with this note. Not `site/`, not the Worker, not production.
