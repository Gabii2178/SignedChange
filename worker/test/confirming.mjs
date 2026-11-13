// Stored-record lag after a signature is accepted. No payment calls.
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
const png = 'data:image/png;base64,' + readFileSync(new URL('./sig.png', import.meta.url)).toString('base64');
const O = 'https://signedchange.com';
const res = [];
const t = (n, ok) => { res.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n); };
const mf = new Miniflare({
  scriptPath: 'dist/worker.js', modules: true, kvNamespaces: ['PAYMENTS'],
  durableObjects: { GIFT_LOCK: 'GiftLock' },
  bindings: { SITE_ORIGIN: O, RECEIVER_EMAIL: 'termschange@gmail.com', PRICE: '49.00', SUB_PRICE: '9.00', CURRENCY: 'USD', PAYPAL_VERIFY_URL: 'http://127.0.0.1:1/', TOKEN_SECRET: 'confirm' },
});
const J = async r => { try { return { status: r.status, body: await r.json() }; } catch { return { status: r.status, body: {} }; } };
const req = (p, o = {}) => mf.dispatchFetch('http://w' + p, { method: o.method || 'GET', body: o.body, headers: { Origin: O, 'Content-Type': 'application/json', 'CF-Connecting-IP': o.ip || 'confirm', ...(o.headers || {}) } });
const fields = { biz: 'Ada', client: 'Bob', clientContact: 'bob@example.com', desc: 'Confirm me', price: '10.00', currency: 'USD', date: '2026-11-07', title: 'Change', job: 'Kitchen' };
const owner = (await J(await req('/account/new', { method: 'POST', ip: 'confirm-a' }))).body;
const created = await J(await req('/doc/create', { method: 'POST', ip: 'confirm-c', headers: { Authorization: 'Bearer ' + owner.id + '.' + owner.key }, body: JSON.stringify({ v: 3, template: 'custom', mode: 'remote', creatorSig: png, fields }) }));
const link = new URL(String(created.body.signUrl).replace('#', '?'));
const d = link.searchParams.get('d');
const token = link.searchParams.get('t');
const started = Date.now();
const signed = await J(await req('/doc/sign', { method: 'POST', ip: 'confirm-s', body: JSON.stringify({ d, t: token, sig: png, name: 'Bob', agree: true, hash: created.body.hash }) }));
const fresh = await J(await req('/doc/status?d=' + d + '&v=' + signed.body.viewKey, { ip: 'confirm-st' }));
const elapsed = Date.now() - started;
t('a consistent store reports signed immediately (' + elapsed + ' ms)', signed.status === 200 && fresh.status === 200 && fresh.body.status === 'signed' && elapsed < 5000);
const kv = await mf.getKVNamespace('PAYMENTS');
const stored = JSON.parse(await kv.get('doc:' + d));
stored.status = 'pending';
await kv.put('doc:' + d, JSON.stringify(stored));
const lag = await J(await req('/doc/status?d=' + d + '&v=' + signed.body.viewKey, { ip: 'confirm-lag' }));
const pub = await J(await req('/doc/verify?id=' + d, { ip: 'confirm-v' }));
t('a lagging stored record is confirming, not signed and not an outage', lag.status === 200 && lag.body.status === 'confirming' && lag.body.status !== 'signed' && !/unavailable/i.test(lag.body.message || ''));
t('public verify does not call the lagging record signed', pub.status === 200 && pub.body.status === 'confirming' && !pub.body.finalHash && !pub.body.hash);
console.log('measured consistent sign-to-status ms', elapsed);
console.log(res.filter(Boolean).length + '/' + res.length);
if (res.some(ok => !ok)) process.exit(1);
await mf.dispose();
