# SignedChange

SignedChange turns a verbal deal change into a signed PDF agreement. You write the change (extra work, a new price, hours, or scope), both sides sign, and each person can download the same dated PDF.

Live site: [https://signedchange.com](https://signedchange.com)

## Repository layout

- `site/` — static frontend (the pages served at signedchange.com).
- `worker/` — Cloudflare Worker that handles payments, accounts, documents, and signing. See `worker/README.md` and `worker/wrangler.toml.example`.

There is no committed `wrangler.toml`. Copy the example and fill in your own values locally. Do not commit PayPal secrets, Cloudflare KV ids, or gift codes.

## Preview the static site

From the repository root:

```bash
cd site
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

## Run the Worker locally

Requires [Node.js](https://nodejs.org/) and the [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/).

```bash
cd worker
cp wrangler.toml.example wrangler.toml
npm install
npx wrangler dev
```

Edit `wrangler.toml` and replace the placeholders (`YOUR_PAYPAL_RECEIVER_EMAIL`, `YOUR_PAYPAL_SUBSCRIPTION_PLAN_ID`, `YOUR_CLOUDFLARE_KV_NAMESPACE_ID`) before you rely on payment or KV routes. Put secrets in Wrangler, not in the file:

```bash
npx wrangler secret put PAYPAL_CLIENT_SECRET
npx wrangler secret put TOKEN_SECRET
```

`wrangler.toml` is gitignored. Keep using `wrangler.toml.example` as the tracked template.
