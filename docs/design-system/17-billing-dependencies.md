# Billing dependency audit

Read-only. No PayPal call was made. Live PayPal plan settings and the deployed Worker variables are **UNKNOWN**. “Go live” below means a future, separately authorized migration. This document does not perform it.

## Conflict to keep visible

Source still sells two paid products:

1. Pro Monthly, $9 USD, recurring every month.
2. Pro Lifetime, $49 USD, one time.

The proposed design replaces Lifetime with Pro Yearly at $49 USD per year, and shows Monthly at $5 with $9 struck through. Until the migration below is done, publishing the new cards would advertise prices the current buttons do not charge.

Existing Lifetime entitlements (`acct.pro.type === 'life'`) must not be converted or expired as a side effect. The owner decides later whether those accounts stay Lifetime, are grandfathered, or are offered yearly. That decision is not made here.

## What the source actually checks

| Piece | Where | Charged behavior today |
|---|---|---|
| Classic monthly button | `site/app.js` `pay()` lines 160–163 | PayPal `_xclick-subscriptions`, `a3=9.00`, `p3=1`, `t3=M`, `custom` = account id, `notify_url` = Worker `/ipn`, `return` = `SITE/app.html?paid=1` |
| Classic lifetime button | same function | `_xclick`, `amount=49.00`, item name Pro Lifetime |
| Smart monthly plan | `site/app.js` line 167 `PP_PLAN` | Public plan id `P-74K152053K411091TNLU5UCQ`. Client id is the `PP_CLIENT` constant on that line. `createSubscription` sends that plan id and `custom_id` |
| Smart lifetime order | `site/app.js` `loadSmartLife` | `POST /account/paypal-order` then `/account/paypal-capture`. The browser does not set the amount |
| Fallback buttons | `site/app.html` `#paySub`, `#payLife` | “Subscribe – $9/month” and “Buy Lifetime – $49” |
| Homepage and app cards | `site/index.html` `#pricing`, `site/app.html` `#buy` | $9 / month and $49 one-time, with links into the app checkout |
| Terms | `site/terms.html` | 3 documents per account, a network cap, $9 per month, $49 lifetime, 7-day email refund |
| Schema | `SoftwareApplication` offers on many `site/*.html` pages | `9.00` Pro Monthly and `49.00` Pro Lifetime |
| Worker vars | `worker/wrangler.toml.example` | `PRICE=49.00`, `SUB_PRICE=9.00`, `CURRENCY=USD`, `SUB_PLAN_ID` placeholder. Live values are UNKNOWN |
| IPN monthly | `worker/src/index.js` `handleIpn` | `subscr_signup` requires `amount3 === SUB_PRICE`, `period3 === '1 M'`, currency. `subscr_payment` requires `mc_gross === SUB_PRICE` |
| IPN lifetime | same function | Completed `mc_gross === PRICE` and currency, then `grantPro` type `life` |
| REST subscription | `worker/src/paypal-rest.js` `claimSub` / `sync` | Active subscription whose `plan_id` equals the single `SUB_PLAN_ID`. Amount is not re-read from a second plan |
| REST lifetime | `createOrder` / `captureOrder` | Server sets `value` to `PRICE` or `49.00`, description Pro Lifetime. Capture rejects a different amount or currency |
| Webhooks | `paypal-rest.js` `webhook` | Signature check, then re-read PayPal. Refunds and reversals clear `paidThrough` or mark the lifetime txn revoked |
| Entitlement | `worker/src/docs.js` `proStatus` | `life` if the txn is not revoked and is not a subscription payment. `sub` if `paidThrough` is in the future and status is not `ended`. `gift` if the gift record is used and not revoked |
| Free quota | `docs.js` `FREE_DOCS = 3`, `FREE_PER_IP_MONTH = 10` | Enforced in `createDoc`. Delete does not refund a slot |
| Welcome mail | `worker/src/email.js` | Copy says Pro Lifetime or Pro Monthly using `PRICE` / `SUB_PRICE` |
| Analytics events | `site/app.js` | `value: 9` or `value: 49` on begin_checkout / purchase. Display only for GA, still the old numbers |
| Canonicals | `site/*.html`, `site/CNAME`, `site/sitemap.xml` | `signedchange-app.surge.sh`, not signedchange.com. Whether production DNS matches is UNKNOWN |

There is no yearly amount, no `t3=Y`, and no second plan id in the repo. A $60 charge does not appear.

`GET /verify?ret=1` in `worker/src/index.js` accepts a transaction id without an email for two hours. It is frozen. A price migration must not casually change it.

## Required before the new prices can be charged

These are future edits. They are not authorized now.

1. PayPal dashboard, **UNKNOWN** from here: create a monthly plan at $5 USD every month and a yearly plan at $49 USD every year. Confirm currency, cycles, and whether the existing plan `P-74K152053K411091TNLU5UCQ` is $9 or something else. Do not assume the dashboard matches the button label.
2. Decide the Lifetime policy: stop selling new Lifetime purchases, and leave existing `type: 'life'` records valid. Do not map them onto yearly and do not zero `paidThrough` for them. They have no `paidThrough`.
3. Worker: `SUB_PRICE` cannot stay a single `9.00` if both $5 monthly and a different yearly gross must pass IPN. Yearly IPN uses `period3` of `1 Y` and a different `mc_gross`. Today any period other than `1 M` is ignored, and a $5 payment would not match `SUB_PRICE`.
4. REST: one `SUB_PLAN_ID` cannot name both the $5 plan and the $49 yearly plan. `claimSub` rejects every other `plan_id`.
5. Lifetime REST and IPN: if new Lifetime sales stop, `PRICE` / `createOrder` / the classic `_xclick` button must stop creating new $49 charges, while old txn ids still restore Pro. That is a behavior change in frozen files: `paypal-rest.js`, `handleIpn`, and `site/app.js`.
6. Return URL and notify URL stay until PayPal is intentionally reconfigured. Changing them is part of the migration, not branding.
7. `proStatus` may stay as it is for `life` and for a monthly `sub`. A yearly subscription still fits `type: 'sub'` only if `paidThrough` is set from the yearly billing date. The REST buffer is 3 days and the cap is 40 days ahead (`paypal-rest.js`). A yearly `next_billing_time` would be clipped to about 40 days, so yearly Pro would expire early. That cap has to change, or yearly cannot use this function unchanged.
8. IPN `subscr_payment` adds 32 days to `paidThrough`. A yearly payment would only extend a month. That formula is a required change for a yearly plan.
9. Free quota stays 3 per account and 10 per IP-hash per month unless the owner changes it. The proposed Free card does not change it.
10. Copy that still says $9, $49 once, or Lifetime: `site/index.html`, `site/app.html`, `site/terms.html`, `site/faq.html`, schema.org offers, `email.js` welcome text, and in-app analytics values. Terms and the support mailbox (`termschange@gmail.com` in source) need a deliberate edit when prices change, not before.
11. Canonicals and sitemap still point at surge.sh. Moving public copy to signedchange.com is a host cutover, separate from the price numbers, and UNKNOWN relative to live DNS.
12. Tests: `worker/test/life.mjs`, `smartsub.mjs`, `run.mjs`, `v2.mjs`, and `email.mjs` assert $49, $9, and one plan id against local mocks. They must be updated in the migration and still must not call live PayPal. A sandbox test needs a later approval. This pricing update does not run them, because no runtime file changed.
13. Rollback: keep the previous Worker script and the previous PayPal plan ids. Do not delete Lifetime KV rows to roll back.

## Keep as-is until that migration

- Gift redeem, gift key layout, and the three-account link cap.
- `GET /verify?ret=1`.
- Document lifecycle, free-slot counter semantics, and Bearer account keys.
- Current buttons and cards in `site/`. They still sell $9 monthly and $49 Lifetime.
- Existing Lifetime records. They remain valid Pro until a refund revokes the txn.

## Owner decisions still open

- Whether people who already paid $49 Lifetime stay on Lifetime forever, which the current `proStatus` already does.
- Whether the live PayPal plan id is actually $9 / month. The repo cannot prove the dashboard price.
- Whether yearly is a second Smart plan plus IPN, or REST only. Both paths are live in source today.
- When, if ever, the proposed cards replace the live cards. Not in Milestone 4 unless this list is explicitly authorized.
