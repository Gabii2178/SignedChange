// PayPal REST: Smart Subscribe verification + webhooks. Fails closed if credentials are missing.
import * as D from './docs.js';
const DAY = 86400e3, BUFFER = 3 * DAY, MAX_AHEAD = 40 * DAY;
let tokCache = null; // {tok, exp}
const api = env => env.PAYPAL_API || 'https://api-m.paypal.com';
const configured = env => !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.SUB_PLAN_ID);
async function accessToken(env) {
  if (tokCache && tokCache.exp > Date.now() + 60e3 && tokCache.id === env.PAYPAL_CLIENT_ID) return tokCache.tok;
  const r = await fetch(api(env) + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + btoa(env.PAYPAL_CLIENT_ID + ':' + env.PAYPAL_CLIENT_SECRET), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  if (!r.ok) { let e = ''; try { e = (await r.json()).error || ''; } catch {} throw new Error('paypal auth ' + r.status + ' ' + e); }
  const j = await r.json(); if (!j.access_token) throw new Error('paypal auth');
  tokCache = { tok: j.access_token, exp: Date.now() + (j.expires_in || 300) * 1000, id: env.PAYPAL_CLIENT_ID };
  return j.access_token;
}
async function getSub(env, id) {
  const r = await fetch(api(env) + '/v1/billing/subscriptions/' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + await accessToken(env), 'Content-Type': 'application/json' } });
  if (r.status === 404 || r.status === 400 || r.status === 422) return null;
  if (!r.ok) throw new Error('paypal sub ' + r.status);
  return r.json();
}
const SUBID = /^I-[A-Z0-9]{8,24}$/;
// Apply the authoritative PayPal state to our record. Never changes the linked account once set.
async function sync(env, id, ps, acctHint) {
  const key = 'sub:' + id;
  const sub = (await env.PAYMENTS.get(key, 'json')) || { status: 'new', paidThrough: 0, created: new Date().toISOString(), src: 'rest' };
  if (ps.plan_id !== env.SUB_PLAN_ID) return { sub, ok: false, why: 'plan' };
  if (!sub.acct && acctHint && ps.custom_id === acctHint) sub.acct = acctHint;
  if (sub.acct && ps.custom_id !== sub.acct) return { sub, ok: false, why: 'acct' };
  const st = ps.status;
  if (st === 'ACTIVE') {
    const nb = Date.parse(ps.billing_info && ps.billing_info.next_billing_time);
    if (Number.isFinite(nb)) sub.paidThrough = Math.min(Math.max(sub.paidThrough || 0, nb + BUFFER), Date.now() + MAX_AHEAD);
    if (!sub.revoked) { sub.status = 'active'; sub.valid = true; }
  } else if (st === 'CANCELLED') { sub.status = 'cancelled'; sub.cancelledAt = sub.cancelledAt || new Date().toISOString(); } // keeps paid period
  else if (st === 'SUSPENDED' || st === 'EXPIRED') { sub.status = 'ended'; sub.paidThrough = 0; }
  if (!sub.payer_email && ps.subscriber && ps.subscriber.email_address) sub.payer_email = String(ps.subscriber.email_address).toLowerCase().slice(0, 200);
  sub.ppStatus = st; sub.synced = new Date().toISOString();
  await env.PAYMENTS.put(key, JSON.stringify(sub));
  return { sub, ok: true };
}
// POST /account/paypal-sub {subscriptionID} — called after onApprove; the browser's claim is only a hint.
export async function claimSub(req, env, h, acct, json) {
  if (!configured(env)) return json({ ok: false, error: 'Card subscriptions are being set up. Your payment is safe; Pro will be unlocked shortly, or email termschange@gmail.com.' }, 503, h);
  let b; try { b = await req.json(); } catch { return json({ ok: false }, 400, h); }
  const id = String((b && b.subscriptionID) || '').trim();
  if (!SUBID.test(id)) return json({ ok: false, error: 'Invalid subscription ID.' }, 400, h);
  const prev = await env.PAYMENTS.get('sub:' + id, 'json');
  if (prev && prev.acct && prev.acct !== acct.id) return json({ ok: false, error: 'This subscription is already linked to another account.' }, 403, h);
  let ps; try { ps = await getSub(env, id); } catch (e) { return json({ ok: false, error: 'Could not reach PayPal, please try again.', code: String(e && e.message || '').slice(0, 60) }, 502, h); }
  if (!ps) return json({ ok: false, error: 'Subscription not found.' }, 404, h);
  if (ps.status === 'APPROVAL_PENDING' || ps.status === 'APPROVED') return json({ ok: false, pending: true, error: 'PayPal is still activating your subscription…' }, 409, h);
  if (ps.plan_id !== env.SUB_PLAN_ID || ps.custom_id !== acct.id) return json({ ok: false, error: 'This subscription does not match your account.' }, 403, h);
  if (ps.status !== 'ACTIVE') return json({ ok: false, error: 'Subscription is not active.' }, 402, h);
  const r = await sync(env, id, ps, acct.id);
  if (!r.ok || r.sub.acct !== acct.id || !(r.sub.paidThrough > Date.now()) || r.sub.revoked) return json({ ok: false, error: 'Subscription could not be verified.' }, 403, h);
  await D.grantPro(env, acct.id, { type: 'sub', ref: id });
  return json({ ok: true, pro: await D.proStatus(env, { pro: { type: 'sub', ref: id } }) }, 200, h);
}
// POST /paypal-webhook — signature verified by PayPal; state re-read from PayPal REST (never trusted from the body).
export async function webhook(req, env) {
  const ok = () => new Response('', { status: 200 });
  const raw = await req.text();
  if (raw.length > 50000) return new Response('too large', { status: 413 });
  if (!configured(env) || !env.PAYPAL_WEBHOOK_ID) return new Response('not configured', { status: 503 }); // PayPal retries later
  let ev; try { ev = JSON.parse(raw); } catch { return new Response('bad', { status: 400 }); }
  const H = n => req.headers.get(n) || '';
  try {
    const v = await fetch(api(env) + '/v1/notifications/verify-webhook-signature', { method: 'POST', headers: { Authorization: 'Bearer ' + await accessToken(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_algo: H('paypal-auth-algo'), cert_url: H('paypal-cert-url'), transmission_id: H('paypal-transmission-id'), transmission_sig: H('paypal-transmission-sig'), transmission_time: H('paypal-transmission-time'), webhook_id: env.PAYPAL_WEBHOOK_ID, webhook_event: ev }) });
    const vj = v.ok ? await v.json() : {};
    if (vj.verification_status !== 'SUCCESS') return new Response('', { status: 400 });
  } catch { return new Response('', { status: 500 }); }
  const t = ev.event_type || '', res = ev.resource || {};
  if (ev.id && await env.PAYMENTS.get('wh:' + ev.id)) return ok();
  const done = async () => { if (ev.id) await env.PAYMENTS.put('wh:' + ev.id, '1', { expirationTtl: 30 * 86400 }); return ok(); };
  if (t.startsWith('PAYMENT.CAPTURE.')) { try { await captureEvent(env, t, res); } catch { return new Response('', { status: 500 }); } return done(); }
  let subId = t.startsWith('BILLING.SUBSCRIPTION.') ? res.id : res.billing_agreement_id;
  if (t === 'PAYMENT.SALE.REFUNDED' || t === 'PAYMENT.SALE.REVERSED') {
    const saleId = res.sale_id || res.parent_payment || res.id;
    subId = subId || (saleId && await env.PAYMENTS.get('sale:' + saleId));
    if (subId && SUBID.test(subId)) { const sk = 'sub:' + subId; const s = await env.PAYMENTS.get(sk, 'json'); if (s) await env.PAYMENTS.put(sk, JSON.stringify({ ...s, revoked: t, paidThrough: 0, status: 'ended' })); }
    return done();
  }
  if (!subId || !SUBID.test(subId)) return ok();
  if (t === 'PAYMENT.SALE.COMPLETED' && res.id) await env.PAYMENTS.put('sale:' + res.id, subId);
  try { const ps = await getSub(env, subId); if (ps) { const r = await sync(env, subId, ps, ps.custom_id); if (r.ok && r.sub.acct && r.sub.valid && !r.sub.revoked && r.sub.paidThrough > Date.now()) await D.grantPro(env, r.sub.acct, { type: 'sub', ref: subId }); } }
  catch { return new Response('', { status: 500 }); }
  return done();
}

// ---------- Pro Lifetime ($49 one-time) via Smart Buttons: order created AND captured server-side ----------
const ORDID = /^[A-Z0-9]{10,24}$/;
const lifeCfg = env => configured(env);
async function pp(env, method, path, body) {
  const r = await fetch(api(env) + path, { method, headers: { Authorization: 'Bearer ' + await accessToken(env), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch {}
  return { s: r.status, j };
}
// POST /account/paypal-order — server fixes amount/currency/custom_id; the browser cannot change them.
export async function createOrder(req, env, h, acct, json) {
  if (!lifeCfg(env)) return json({ ok: false, error: 'Card checkout is temporarily unavailable. Please try again shortly.' }, 503, h);
  let o; try { o = await pp(env, 'POST', '/v2/checkout/orders', { intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: env.CURRENCY || 'USD', value: env.PRICE || '49.00' }, custom_id: acct.id, description: 'SignedChange Pro Lifetime' }], application_context: { brand_name: 'SignedChange', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' } }); }
  catch (e) { return json({ ok: false, error: 'Could not reach PayPal, please try again.' }, 502, h); }
  if (o.s !== 201 && o.s !== 200 || !o.j.id) return json({ ok: false, error: 'Could not start checkout, please try again.' }, 502, h);
  await env.PAYMENTS.put('ord:' + o.j.id, JSON.stringify({ acct: acct.id, created: new Date().toISOString() }), { expirationTtl: 30 * 86400 });
  return json({ ok: true, id: o.j.id }, 200, h);
}
function cap0(o) { const pu = (o.purchase_units || [])[0] || {}; return { pu, c: ((pu.payments || {}).captures || [])[0] }; }
// POST /account/paypal-capture {orderID}
export async function captureOrder(req, env, h, acct, json) {
  if (!lifeCfg(env)) return json({ ok: false, error: 'Card checkout is temporarily unavailable.' }, 503, h);
  let b; try { b = await req.json(); } catch { return json({ ok: false }, 400, h); }
  const id = String((b && b.orderID) || '').trim();
  if (!ORDID.test(id)) return json({ ok: false, error: 'Invalid order ID.' }, 400, h);
  const rec = await env.PAYMENTS.get('ord:' + id, 'json');
  if (!rec || rec.acct !== acct.id) return json({ ok: false, error: 'This order does not belong to your account.' }, 403, h);
  let o;
  try {
    o = await pp(env, 'POST', '/v2/checkout/orders/' + id + '/capture');
    if (o.s === 422 || o.s === 409 || o.s === 400) o = await pp(env, 'GET', '/v2/checkout/orders/' + id); // already captured / retry
  } catch { return json({ ok: false, error: 'Could not reach PayPal, please try again.' }, 502, h); }
  if (o.s === 404) return json({ ok: false, error: 'Order not found.' }, 404, h);
  if (o.s >= 500) return json({ ok: false, error: 'PayPal is busy, please try again.' }, 502, h);
  const { pu, c } = cap0(o.j);
  const amt = c && c.amount || {};
  if (o.j.status !== 'COMPLETED' || !c || c.status !== 'COMPLETED') return json({ ok: false, error: 'Payment was not completed.' + (o.j.status === 'APPROVED' || (c && c.status === 'PENDING') ? ' If PayPal charged you, Pro unlocks automatically once it clears.' : '') }, 402, h);
  if (amt.value !== (env.PRICE || '49.00') || amt.currency_code !== (env.CURRENCY || 'USD') || (pu.custom_id || c.custom_id) !== acct.id) return json({ ok: false, error: 'This payment does not match your account.' }, 403, h);
  if (!ORDID.test(c.id)) return json({ ok: false, error: 'Payment could not be verified.' }, 403, h);
  const key = 'txn:' + c.id, prev = await env.PAYMENTS.get(key, 'json');
  if (prev && prev.acct && prev.acct !== acct.id) return json({ ok: false, error: 'This payment is already linked to another account.' }, 403, h);
  if (prev && prev.revoked) return json({ ok: false, error: 'This payment was refunded.' }, 403, h);
  if (!prev) await env.PAYMENTS.put(key, JSON.stringify({ payer_email: ((o.j.payer || {}).email_address || '').toLowerCase(), date: new Date().toISOString(), acct: acct.id, order: id, src: 'rest' }));
  await env.PAYMENTS.put('ord:' + id, JSON.stringify({ ...rec, capture: c.id }), { expirationTtl: 400 * 86400 });
  await D.grantPro(env, acct.id, { type: 'life', ref: c.id });
  return json({ ok: true, pro: await D.proStatus(env, { pro: { type: 'life', ref: c.id } }) }, 200, h);
}
// Webhook helper: refunds / reversals of a lifetime capture revoke it.
export async function captureEvent(env, t, res) {
  let capId = null;
  if (t === 'PAYMENT.CAPTURE.COMPLETED') { // buyer closed the page before we confirmed: verify via REST and grant
    const oid = res.supplementary_data && res.supplementary_data.related_ids && res.supplementary_data.related_ids.order_id;
    if (!oid || !ORDID.test(oid)) return;
    const rec = await env.PAYMENTS.get('ord:' + oid, 'json'); if (!rec) return;
    const o = await pp(env, 'GET', '/v2/checkout/orders/' + oid); if (o.s >= 500) throw new Error('pp');
    const { pu, c } = cap0(o.j), amt = (c && c.amount) || {};
    if (o.j.status !== 'COMPLETED' || !c || c.status !== 'COMPLETED' || !ORDID.test(c.id) || amt.value !== (env.PRICE || '49.00') || amt.currency_code !== (env.CURRENCY || 'USD') || (pu.custom_id || c.custom_id) !== rec.acct) return;
    const k = 'txn:' + c.id, prev = await env.PAYMENTS.get(k, 'json');
    if (prev && (prev.revoked || (prev.acct && prev.acct !== rec.acct))) return;
    if (!prev) await env.PAYMENTS.put(k, JSON.stringify({ payer_email: ((o.j.payer || {}).email_address || '').toLowerCase(), date: new Date().toISOString(), acct: rec.acct, order: oid, src: 'webhook' }));
    await D.grantPro(env, rec.acct, { type: 'life', ref: c.id }); return;
  }
  if (t === 'PAYMENT.CAPTURE.REFUNDED') { const up = (res.links || []).find(l => l.rel === 'up'); capId = up && String(up.href).split('/').pop(); }
  else if (t === 'PAYMENT.CAPTURE.REVERSED') capId = res.id;
  if (!capId || !ORDID.test(capId)) return;
  const k = 'txn:' + capId, rec = await env.PAYMENTS.get(k, 'json');
  if (rec && !rec.sub) await env.PAYMENTS.put(k, JSON.stringify({ ...rec, revoked: t }));
}
