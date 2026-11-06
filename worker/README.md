# SignedChange — automatic Pro unlock (phone-friendly)

How it works: buyer pays on PayPal → PayPal tells our free Cloudflare Worker ("IPN") → worker double-checks with PayPal ($49.00 USD, Completed, paid to you) and saves it → buyer returns to the app (or types transaction ID + PayPal email in "Restore Pro") → worker gives a signed unlock code → Pro unlocks. Refunds automatically remove Pro.

## What you do (about 10 minutes)
1. Go to **dash.cloudflare.com/sign-up** and create a free account (termschange@gmail.com is fine). Confirm the email.
2. In Cloudflare open **Workers & Pages** once, so it gives you a free `something.workers.dev` subdomain. Tell me that subdomain.
3. Make an API token: profile icon → **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template** (it includes Workers Scripts + Workers KV Storage edit). Create it and send me the token. Also send your **Account ID** (on the Workers & Pages page, right side).
4. After I deploy, turn on IPN in PayPal: **Account Settings → Notifications → Instant payment notifications → Update → Choose IPN settings**. Paste this URL and select **Receive IPN messages (Enabled)**, then Save:
   `https://signedchange-unlock.<your-subdomain>.workers.dev/ipn`
5. Optional but nice: PayPal **Account Settings → Website payments → Website preferences**: turn **Auto return ON** (return URL `https://signedchange-app.surge.sh/app.html?paid=1`) and **Payment data transfer ON**. Then buyers are sent back and unlocked with no typing.

## What I do after you send the token
`wrangler kv namespace create PAYMENTS` → put id in wrangler.toml → `wrangler secret put TOKEN_SECRET` (random) → `wrangler deploy` → replace `WORKERS_SUBDOMAIN` in the site (build.py, app_body.html, site/app.js) → rebuild → deploy site → test a real $49 flow or PayPal IPN Simulator.

## Endpoints
- `POST /ipn` — PayPal IPN listener (verifies with ipnpb.paypal.com, stores txn_id → {payer_email, date}, ignores duplicates, revokes on Refunded/Reversed)
- `GET /verify?tx=&email=` — returns signed token (CORS: site only, 20 req/min/IP)
- `GET /check?token=` — confirms a token is genuine and not refunded

Local tests: `npm i && node test/run.mjs` (mocked PayPal, 18 checks).
