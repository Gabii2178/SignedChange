// SignedChange worker: PayPal IPN (lifetime + monthly subscription) -> KV, accounts, documents, remote signing, server-side PDF.
import * as D from './docs.js';
import * as PP from './paypal-rest.js';
const enc = new TextEncoder();
const hits = new Map(); // per-isolate rate limiter: ip -> {n, t}

function rateLimited(ip, limit = 20, windowMs = 60000) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > windowMs) { hits.set(ip, { n: 1, t: now }); return false; }
  h.n++;
  if (hits.size > 5000) hits.clear();
  return h.n > limit;
}

function cors(env, req) {
  const o = req.headers.get('Origin');
  const h = { 'Vary': 'Origin', 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
  if (o === env.SITE_ORIGIN) {
    h['Access-Control-Allow-Origin'] = o;
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}
const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers });

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function makeToken(env, txn, extra = {}) {
  const payload = b64u(enc.encode(JSON.stringify({ t: txn, p: 'pro', iat: Math.floor(Date.now() / 1000), ...extra })));
  return payload + '.' + await hmac(env.TOKEN_SECRET, payload);
}
async function checkToken(env, token) {
  if (typeof token !== 'string' || token.length > 600 || !/^[\w-]+\.[\w-]+$/.test(token)) return null;
  const [payload, sig] = token.split('.');
  if (!safeEq(sig, await hmac(env.TOKEN_SECRET, payload))) return null;
  try {
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (data.p !== 'pro') return null;
    if (typeof data.t !== 'string') return null;
    if (data.t.startsWith('gift:')) { // one-time gift code, already redeemed by this token's holder
      const g = await env.PAYMENTS.get(data.t, 'json');
      return g && g.status === 'used' && !g.revoked && g.tid === data.g ? data : null;
    }
    const rec = await env.PAYMENTS.get('txn:' + data.t, 'json');
    if (!rec || rec.revoked) return null; // refunds/reversals revoke
    if (rec.sub) { const sub = await env.PAYMENTS.get('sub:' + rec.sub, 'json'); if (!sub || sub.revoked || sub.status === 'ended' || !(sub.paidThrough > Date.now())) return null; data.sub = rec.sub; }
    return data;
  } catch { return null; }
}

async function sha256hex(s) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
// Codes are stored only as SHA-256 hashes (no plaintext). Codes carry 130 bits of randomness, so hashes can't be reversed or guessed.
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
async function codeKey(env, code) { return 'gift:' + await sha256hex('gift-v1:' + code); }

// Durable Object = single-threaded, strongly consistent claim per code: exactly one redeemer can ever win.
export class GiftLock {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(req) {
    const body = await req.json();
    // Document lifecycle only. claim/use/unuse/get/revoke below are unchanged
    // and remain the payment, gift, and counter operations.
    if (body.op === 'lifecycle') return Response.json(await D.runLifecycle(this.state, this.env, body));
    if (body.op === 'claim') {
      const cur = await this.state.storage.get('claim');
      if (cur) return Response.json({ ok: false, reason: cur.revoked ? 'revoked' : 'used' });
      const claim = { tid: body.tid, at: new Date().toISOString(), who: body.who };
      await this.state.storage.put('claim', claim);
      return Response.json({ ok: true, claim });
    }
    if (body.op === 'use') { const n = (await this.state.storage.get('n')) || 0; if (body.limit != null && n >= body.limit) return Response.json({ ok: false, n }); await this.state.storage.put('n', n + 1); return Response.json({ ok: true, n: n + 1 }); }
    if (body.op === 'unuse') { const n = (await this.state.storage.get('n')) || 0; if (n > 0) await this.state.storage.put('n', n - 1); return Response.json({ ok: true }); }
    if (body.op === 'get') return Response.json({ ok: true, n: (await this.state.storage.get('n')) || 0 });
    if (body.op === 'revoke') { const cur = (await this.state.storage.get('claim')) || {}; await this.state.storage.put('claim', { ...cur, revoked: true }); return Response.json({ ok: true }); }
    return Response.json({ ok: false }, { status: 400 });
  }
}

async function handleRedeem(req, env, h, ip) {
  let code = '';
  try { const b = await req.json(); code = normCode(b && b.code); } catch {}
  const bad = () => json({ ok: false, error: 'This gift code is invalid or has already been used.' }, 403, h);
  if (code.length < 26 || code.length > 40) return bad();
  const key = await codeKey(env, code);
  const g = await env.PAYMENTS.get(key, 'json');
  if (!g || g.status !== 'unused' || g.revoked) return bad();
  const tid = crypto.randomUUID();
  const who = { ipHash: (await sha256hex('ip:' + ip)).slice(0, 16), ua: (req.headers.get('User-Agent') || '').slice(0, 120), country: req.headers.get('CF-IPCountry') || '' };
  const stub = env.GIFT_LOCK.get(env.GIFT_LOCK.idFromName(key));
  const r = await (await stub.fetch('https://lock/', { method: 'POST', body: JSON.stringify({ op: 'claim', tid, who }) })).json();
  if (!r.ok) return bad();
  await env.PAYMENTS.put(key, JSON.stringify({ ...g, status: 'used', tid, redeemedAt: r.claim.at, redeemer: who }));
  return json({ ok: true, token: await makeToken(env, key, { g: tid }) }, 200, h);
}

async function handleIpn(req, env) {
  const raw = await req.text();
  if (raw.length > 20000) return new Response('too large', { status: 413 });
  // 1) Verify with PayPal: echo back the exact body prefixed with cmd=_notify-validate
  const v = await fetch(env.PAYPAL_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'SignedChange-IPN' },
    body: 'cmd=_notify-validate&' + raw,
  });
  const verdict = (await v.text()).trim();
  if (verdict !== 'VERIFIED') return new Response('', { status: 200 }); // INVALID: ignore silently
  const f = new URLSearchParams(raw);
  const ok = () => new Response('', { status: 200 });
  const receiver = (f.get('receiver_email') || f.get('business') || '').toLowerCase();
  if (receiver !== env.RECEIVER_EMAIL.toLowerCase()) return ok();
  const type = f.get('txn_type') || '';
  const acctId = (f.get('custom') || '').trim();
  const subId = (f.get('subscr_id') || '').trim();
  // ---- monthly subscription lifecycle ----
  if (type.startsWith('subscr_')) {
    if (!/^[A-Z0-9-]{6,32}$/i.test(subId)) return ok();
    const key = 'sub:' + subId;
    const sub = (await env.PAYMENTS.get(key, 'json')) || { status: 'new', paidThrough: 0, created: new Date().toISOString() };
    if (acctId && !sub.acct) sub.acct = acctId;
    if (f.get('payer_email')) sub.payer_email = f.get('payer_email').toLowerCase();
    if (type === 'subscr_signup') {
      if (f.get('amount3') !== env.SUB_PRICE || f.get('period3') !== '1 M' || f.get('mc_currency') !== env.CURRENCY) return ok();
      sub.status = 'active'; sub.valid = true;
    } else if (type === 'subscr_payment') {
      const txn = (f.get('txn_id') || '').trim();
      if (f.get('payment_status') !== 'Completed' || f.get('mc_gross') !== env.SUB_PRICE || f.get('mc_currency') !== env.CURRENCY || !/^[A-Z0-9]{8,24}$/i.test(txn)) return ok();
      if (await env.PAYMENTS.get('txn:' + txn)) return ok(); // duplicate
      await env.PAYMENTS.put('txn:' + txn, JSON.stringify({ payer_email: sub.payer_email || '', date: new Date().toISOString(), sub: subId }));
      sub.valid = true; if (sub.status === 'new') sub.status = 'active';
      sub.paidThrough = Math.max(sub.paidThrough || 0, Date.now()) + 32 * 86400e3; sub.lastTxn = txn;
    } else if (type === 'subscr_cancel') { sub.status = 'cancelled'; sub.cancelledAt = new Date().toISOString(); } // keeps Pro until the paid month ends
    else if (type === 'subscr_eot') { sub.status = 'ended'; sub.paidThrough = 0; } // term over: Pro revoked now
    else if (type === 'subscr_failed') { sub.lastFailed = new Date().toISOString(); }
    else return ok();
    await env.PAYMENTS.put(key, JSON.stringify(sub));
    if (sub.valid && sub.acct) await D.grantPro(env, sub.acct, { type: 'sub', ref: subId });
    return ok();
  }
  const txn = (f.get('txn_id') || '').trim();
  const status = f.get('payment_status');
  if (!/^[A-Z0-9]{8,24}$/i.test(txn)) return ok();
  // Refund / reversal: revoke the original purchase (lifetime or a subscription payment)
  if (['Refunded', 'Reversed'].includes(status) && f.get('parent_txn_id')) {
    const key = 'txn:' + f.get('parent_txn_id');
    const rec = await env.PAYMENTS.get(key, 'json');
    if (rec) {
      await env.PAYMENTS.put(key, JSON.stringify({ ...rec, revoked: status }));
      if (rec.sub) { const sk = 'sub:' + rec.sub; const sub = await env.PAYMENTS.get(sk, 'json'); if (sub) await env.PAYMENTS.put(sk, JSON.stringify({ ...sub, revoked: status, paidThrough: 0 })); }
    }
    return ok();
  }
  if (status !== 'Completed' || f.get('mc_gross') !== env.PRICE || f.get('mc_currency') !== env.CURRENCY) return ok();
  const key = 'txn:' + txn;
  if (await env.PAYMENTS.get(key)) return ok(); // duplicate IPN
  await env.PAYMENTS.put(key, JSON.stringify({ payer_email: (f.get('payer_email') || '').toLowerCase(), date: new Date().toISOString(), acct: acctId || undefined }));
  if (acctId) await D.grantPro(env, acctId, { type: 'life', ref: txn });
  return ok();
}

async function linkToken(req, env, h, acct) {
  let b; try { b = await req.json(); } catch { return json({ ok: false }, 400, h); }
  const data = await checkToken(env, b && b.token);
  if (!data) return json({ ok: false, error: 'This Pro code is not valid any more.' }, 403, h);
  // a purchase / gift can be attached to at most 3 accounts (e.g. phone + laptop + new browser)
  const lk = 'links:' + data.t; const links = (await env.PAYMENTS.get(lk, 'json')) || [];
  if (!links.includes(acct.id)) { if (links.length >= 3) return json({ ok: false, error: 'This purchase is already used on 3 devices. Contact termschange@gmail.com.' }, 403, h); links.push(acct.id); await env.PAYMENTS.put(lk, JSON.stringify(links)); }
  const pro = data.t.startsWith('gift:') ? { type: 'gift', ref: data.t } : data.sub ? { type: 'sub', ref: data.sub } : { type: 'life', ref: data.t };
  await D.grantPro(env, acct.id, pro);
  return json({ ok: true, pro: await D.proStatus(env, { pro }) }, 200, h);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const ip = req.headers.get('CF-Connecting-IP') || 'local';
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname === '/ipn' && req.method === 'POST') return handleIpn(req, env);
    if (url.pathname === '/paypal-webhook' && req.method === 'POST') return PP.webhook(req, env);
    if (url.pathname === '/redeem' && req.method === 'POST') {
      if (rateLimited('r:' + ip, 5)) return json({ error: 'Too many attempts, wait a minute.' }, 429, h);
      return handleRedeem(req, env, h, ip);
    }
    const ipHash = (await sha256hex('ip:' + ip)).slice(0, 24);
    const P = url.pathname;
    if (P.startsWith('/doc/') || P.startsWith('/account/')) {
      if (rateLimited('d:' + ip, 60)) return json({ ok: false, error: 'Too many requests, wait a minute.' }, 429, h);
      if (P === '/account/new' && req.method === 'POST') return D.newAccount(env, ipHash, h);
      if (P === '/doc/get' && req.method === 'GET') { if (rateLimited('s:' + ip, 20)) return json({ ok: false, error: 'Too many attempts, wait a minute.' }, 429, h); return D.getForSigning(url, env, h); }
      if (P === '/doc/sign' && req.method === 'POST') { if (rateLimited('s:' + ip, 20)) return json({ ok: false, error: 'Too many attempts, wait a minute.' }, 429, h); return D.signDoc(req, env, h, ip, ipHash); }
      if (P === '/doc/pdf' && req.method === 'GET') return D.pdfResponse(req, url, env, h);
      if (P === '/doc/status' && req.method === 'GET') return D.docStatus(req, url, env, h);
      if (P === '/doc/decline' && req.method === 'POST') { if (rateLimited('s:' + ip, 20)) return json({ ok: false, error: 'Too many attempts, wait a minute.' }, 429, h); return D.declineDoc(req, env, h, ip, ipHash); }
      if (P === '/doc/verify' && req.method === 'GET') { if (rateLimited('vf:' + ip, 30)) return json({ ok: false, error: 'Too many attempts, wait a minute.' }, 429, h); return D.verifyDoc(url, env, h); }
      const acct = await D.auth(req, env);
      if (!acct) return json({ ok: false, error: 'auth' }, 401, h);
      if (P === '/account/me' && req.method === 'GET') return D.me(env, acct, h, url);
      if (P === '/account/link' && req.method === 'POST') { if (rateLimited('l:' + ip, 10)) return json({ ok: false, error: 'Too many attempts, wait a minute.' }, 429, h); return linkToken(req, env, h, acct); }
      if ((P === '/account/paypal-order' || P === '/account/paypal-capture') && req.method === 'POST') { if (rateLimited('o:' + ip, 10)) return json({ ok: false, error: 'Too many attempts, wait a minute.' }, 429, h); return P === '/account/paypal-order' ? PP.createOrder(req, env, h, acct, json) : PP.captureOrder(req, env, h, acct, json); }
      if (P === '/account/paypal-sub' && req.method === 'POST') { if (rateLimited('p:' + ip, 10)) return json({ ok: false, error: 'Too many attempts, wait a minute.' }, 429, h); return PP.claimSub(req, env, h, acct, json); }
      if (P === '/doc/create' && req.method === 'POST') { if (rateLimited('c:' + ip, 15)) return json({ ok: false, error: 'Too many documents too fast, wait a minute.' }, 429, h); return D.createDoc(req, env, h, ip, ipHash, acct); }
      if (P === '/doc/cancel' && req.method === 'POST') return D.cancelDoc(req, env, h, acct);
      return json({ error: 'not found' }, 404, h);
    }
    if (req.method !== 'GET') return json({ error: 'method' }, 405, h);
    if (url.pathname === '/verify' || url.pathname === '/check') {
      if (rateLimited(ip)) return json({ error: 'Too many attempts, wait a minute.' }, 429, h);
    }
    if (url.pathname === '/verify') {
      const tx = (url.searchParams.get('tx') || '').trim().toUpperCase();
      const email = (url.searchParams.get('email') || '').trim().toLowerCase();
      if (!/^[A-Z0-9]{8,24}$/.test(tx)) return json({ ok: false, error: 'Invalid transaction ID.' }, 400, h);
      const rec = await env.PAYMENTS.get('txn:' + tx, 'json');
      // Email must match; tx-only (ret=1, straight from PayPal's return page) is accepted only within 2h of payment.
      if (!rec || rec.revoked || (email ? rec.payer_email !== email : !(url.searchParams.get('ret') === '1' && Date.now() - Date.parse(rec.date) < 2 * 3600e3)))
        return json({ ok: false, error: 'Payment not found yet. If you just paid, wait a minute and try again.' }, 404, h);
      return json({ ok: true, token: await makeToken(env, tx) }, 200, h);
    }
    if (url.pathname === '/check') {
      const data = await checkToken(env, url.searchParams.get('token'));
      return json({ ok: !!data }, data ? 200 : 403, h);
    }
    return json({ error: 'not found' }, 404, h);
  },
};
