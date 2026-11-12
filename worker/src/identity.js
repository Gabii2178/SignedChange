// Optional account-holder identity status.
// A visitor cannot set VERIFIED. Only a signed provider callback can, and no real provider is connected.
// Invited signing does not call this module. Raw identity documents are not stored.

const enc = new TextEncoder();
const STATES = ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED', 'REQUIRES_REVIEW'];
const PROVIDER_STATES = ['PENDING', 'VERIFIED', 'REJECTED', 'REQUIRES_REVIEW'];
const PENDING_MS = 14 * 86400 * 1000;
const ID = /^[\w-]{20,40}$/;
const json = (o, s, h) => new Response(JSON.stringify(o), { status: s, headers: h });

async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const keyFor = id => 'idv:' + id;
function view(rec) {
  return {
    ok: true,
    status: rec && rec.status || 'NOT_STARTED',
    updatedAt: rec && rec.updatedAt || null,
    consentAt: rec && rec.consentAt || null,
    provider: rec && rec.provider || null,
    optional: true,
    storesDocuments: false
  };
}

export async function read(env, acct, h) {
  const rec = await env.PAYMENTS.get(keyFor(acct.id), 'json');
  if (!rec) return json(view(null), 200, h);
  if (rec.status === 'PENDING' && /^\d{4}-\d{2}-\d{2}T/.test(rec.updatedAt || '') && Date.now() - Date.parse(rec.updatedAt) > PENDING_MS) {
    rec.status = 'EXPIRED';
    rec.updatedAt = new Date().toISOString();
    await env.PAYMENTS.put(keyFor(acct.id), JSON.stringify(rec));
  }
  return json(view(rec), 200, h);
}

export async function start(req, env, acct, h) {
  let body = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Consent is required before an optional identity check can start.' }, 400, h); }
  if (body && Object.prototype.hasOwnProperty.call(body, 'status')) return json({ ok: false, error: 'The account holder cannot set a verification status.' }, 400, h);
  if (!body || body.consent !== true) return json({ ok: false, error: 'Consent is required before an optional identity check can start.' }, 400, h);
  const current = await env.PAYMENTS.get(keyFor(acct.id), 'json');
  if (current && (current.status === 'VERIFIED' || current.status === 'REQUIRES_REVIEW')) return json(view(current), 200, h);
  const nonce = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
  const now = new Date().toISOString();
  const rec = {
    status: 'PENDING',
    updatedAt: now,
    consentAt: now,
    provider: null,
    consent: 'optional-identity-v1',
    nonceHash: await sha256hex(nonce),
    usedNonces: current && current.usedNonces || []
  };
  await env.PAYMENTS.put(keyFor(acct.id), JSON.stringify(rec));
  const out = view(rec);
  if (env.IDENTITY_MOCK === 'test-only') out.mockNonce = nonce;
  return json(out, 200, h);
}

export async function providerResult(req, env, h) {
  if (env.IDENTITY_MOCK !== 'test-only') return json({ ok: false, error: 'No identity provider is configured.' }, 404, h);
  let body = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: 'The provider response could not be read.' }, 400, h); }
  const accountId = body.accountId;
  const status = body.status;
  const nonce = body.nonce;
  const exp = body.exp;
  const sig = body.sig;
  if (!ID.test(accountId || '') || !PROVIDER_STATES.includes(status) || typeof nonce !== 'string' || nonce.length < 16 || typeof sig !== 'string' || typeof exp !== 'number' || !Number.isFinite(exp)) {
    return json({ ok: false, error: 'The provider response is not valid.' }, 400, h);
  }
  if (exp < Date.now() || exp > Date.now() + 10 * 60 * 1000) return json({ ok: false, error: 'The provider response has expired.' }, 401, h);
  const expect = await hmacHex(env.TOKEN_SECRET, [accountId, status, nonce, exp].join('|'));
  if (!safeEq(sig, expect)) return json({ ok: false, error: 'The provider response is not authenticated.' }, 401, h);
  const rec = await env.PAYMENTS.get(keyFor(accountId), 'json');
  const nonceHash = await sha256hex(nonce);
  if (!rec || !rec.nonceHash || rec.nonceHash !== nonceHash || (rec.usedNonces || []).includes(nonceHash)) {
    return json({ ok: false, error: 'The provider response does not match an open check.' }, 409, h);
  }
  const used = (rec.usedNonces || []).concat(nonceHash).slice(-20);
  const next = { status, updatedAt: new Date().toISOString(), consentAt: rec.consentAt, provider: 'mock', consent: rec.consent, usedNonces: used };
  await env.PAYMENTS.put(keyFor(accountId), JSON.stringify(next));
  return json(view(next), 200, h);
}

export const IDENTITY_STATES = ['NOT_STARTED', ...STATES];
