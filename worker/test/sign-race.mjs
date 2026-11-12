// Repeats the simultaneous-sign case. One fingerprint is required every time.
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
const png = 'data:image/png;base64,' + readFileSync(new URL('./sig.png', import.meta.url)).toString('base64');
const O = 'https://signedchange-app.surge.sh';
const fields = { biz: 'Ada', contact: 'ada@x.com', client: 'Bob', clientContact: 'bob@example.com', job: 'Kitchen', desc: 'Add a valve', price: '10.00', currency: 'USD', date: '2026-11-06', title: 'Change' };
const mf = new Miniflare({
  scriptPath: 'dist/worker.js', modules: true, kvNamespaces: ['PAYMENTS'],
  durableObjects: { GIFT_LOCK: 'GiftLock' },
  bindings: { SITE_ORIGIN: O, RECEIVER_EMAIL: 'termschange@gmail.com', PRICE: '49.00', SUB_PRICE: '9.00', CURRENCY: 'USD', PAYPAL_VERIFY_URL: 'http://127.0.0.1:1/', TOKEN_SECRET: 't' },
});
const J = async r => { try { return await r.json(); } catch { return {}; } };
const req = (p, o = {}) => mf.dispatchFetch('http://w' + p, { method: o.method || 'GET', body: o.body, headers: { Origin: O, 'Content-Type': 'application/json', 'CF-Connecting-IP': o.ip || 'race', ...(o.headers || {}) } });
let bad = 0;
const rounds = 20;
for (let i = 0; i < rounds; i++) {
  const ip = 'race-' + i;
  const acct = await J(await req('/account/new', { method: 'POST', ip }));
  const created = await J(await req('/doc/create', { method: 'POST', ip, headers: { Authorization: 'Bearer ' + acct.id + '.' + acct.key }, body: JSON.stringify({ v: 3, template: 'custom', fields, creatorSig: png, mode: 'remote' }) }));
  const link = new URL(String(created.signUrl || 'http://x/#d=&t=').replace('#', '?'));
  const body = JSON.stringify({ d: link.searchParams.get('d'), t: link.searchParams.get('t'), sig: png, name: 'Bob', agree: true, hash: created.hash });
  const two = await Promise.all([0, 1].map(() => req('/doc/sign', { method: 'POST', ip, body })));
  const parsed = [];
  for (const r of two) parsed.push({ status: r.status, ...(await J(r)) });
  const wins = parsed.filter(p => p.viewKey);
  const keys = new Set(wins.map(p => p.viewKey));
  const hashes = new Set(wins.map(p => p.finalHash));
  const later = await req('/doc/sign', { method: 'POST', ip, body });
  const laterBody = await J(later);
  const raw = await (await mf.getKVNamespace('PAYMENTS')).get('doc:' + link.searchParams.get('d'));
  const stored = raw ? JSON.parse(raw) : null;
  const ok = stored && wins.length >= 1 && keys.size === 1 && hashes.size === 1 && later.status === 200 && laterBody.viewKey === wins[0].viewKey && laterBody.finalHash === wins[0].finalHash && stored.status === 'signed' && stored.finalHash === wins[0].finalHash && parsed.every(p => p.status === 200 || p.status === 410);
  if (!ok) {
    bad += 1;
    console.log('FAIL round ' + i + ' create ' + JSON.stringify({ ok: created.ok, status: created.status, error: created.error, id: link.searchParams.get('d') }) + ' signs ' + JSON.stringify(parsed.map(p => p.status)) + ' later ' + later.status + ' stored ' + (stored && stored.status));
  }
}
console.log((rounds - bad) + '/' + rounds + ' simultaneous signs kept one fingerprint');
await mf.dispose();
process.exit(bad === 0 ? 0 : 1);
