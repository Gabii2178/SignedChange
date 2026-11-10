// Milestone 2. Local Miniflare only. No PayPal and no production host.
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
const png = 'data:image/png;base64,' + readFileSync(new URL('./sig.png', import.meta.url)).toString('base64');
const O = 'https://signedchange-app.surge.sh';
const res = [];
const t = (n, ok) => { res.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n); };
const mf = (bindings = {}) => new Miniflare({
  scriptPath: 'dist/worker.js', modules: true, kvNamespaces: ['PAYMENTS'], durableObjects: { GIFT_LOCK: 'GiftLock' },
  bindings: { SITE_ORIGIN: O, RECEIVER_EMAIL: 'termschange@gmail.com', PRICE: '49.00', SUB_PRICE: '9.00', CURRENCY: 'USD', PAYPAL_VERIFY_URL: 'http://127.0.0.1:1/', TOKEN_SECRET: 't', ...bindings },
});
const J = async r => { try { return await r.json(); } catch { return {}; } };
const req = (m, p, o = {}) => m.dispatchFetch('http://w' + p, { ...o, headers: { Origin: O, 'Content-Type': 'application/json', ...(o.headers || {}) } });
const fields = { biz: 'Ada', contact: 'ada@x.com', client: 'Bob', clientContact: 'bob@example.com', job: 'Kitchen', desc: 'Add a valve', price: '10.00', currency: 'USD', date: '2026-11-06', title: 'Change' };
const A = a => ({ Authorization: `Bearer ${a.id}.${a.key}` });
async function acct(m) { return J(await req(m, '/account/new', { method: 'POST' })); }
async function create(m, a, f = {}) {
  const r = await req(m, '/doc/create', { method: 'POST', headers: A(a), body: JSON.stringify({ v: 3, fields: { ...fields, ...f }, creatorSig: png, mode: 'remote' }) });
  const j = await J(r);
  const u = new URL(String(j.signUrl || 'http://x/#d=&t=').replace('#', '?'));
  return { r, j, d: u.searchParams.get('d'), tk: u.searchParams.get('t') };
}
const m = mf();
const owner = await acct(m); t('owner account', owner.ok);
let c = await create(m, owner); t('pending doc', c.r.status === 200 && c.d);
let v = await J(await req(m, '/doc/verify?id=' + c.d));
t('verify pending agrees with the body', v.ok && v.status === 'pending' && v.hash === c.j.hash);
let st = await J(await req(m, '/doc/status?d=' + c.d, { headers: A(owner) }));
t('owner status pending', st.ok && st.status === 'pending');
const stranger = await acct(m);
t('other account cannot read status', (await req(m, '/doc/status?d=' + c.d, { headers: A(stranger) })).status === 404);
t('anonymous status is not found', (await req(m, '/doc/status?d=' + c.d)).status === 404);
t('verify bad id stays 400', (await req(m, '/doc/verify?id=short')).status === 400);

const signed = await J(await req(m, '/doc/sign', { method: 'POST', body: JSON.stringify({ d: c.d, t: c.tk, sig: png, name: 'Bob', agree: true, hash: c.j.hash }) }));
t('sign once', signed.ok && signed.viewKey);
v = await J(await req(m, '/doc/verify?id=' + c.d));
t('verify signed fingerprints', v.ok && v.status === 'signed' && v.finalHash === signed.finalHash);
const pdf = await req(m, `/doc/pdf?d=${c.d}&v=${signed.viewKey}`);
t('pdf still renders for the signer', pdf.status === 200 && Buffer.from(await pdf.arrayBuffer()).slice(0, 5).toString() === '%PDF-');

const kv = await m.getKVNamespace('PAYMENTS');
const raw = JSON.parse(await kv.get('doc:' + c.d));
raw.fields.desc = 'tampered';
await kv.put('doc:' + c.d, JSON.stringify(raw));
t('tampered body is not verified', (await req(m, '/doc/verify?id=' + c.d)).status === 409);
t('tampered body is not a pdf', (await req(m, `/doc/pdf?d=${c.d}&v=${signed.viewKey}`)).status === 409);
t('tampered body is not owner status', (await req(m, '/doc/status?d=' + c.d, { headers: A(owner) })).status === 409);
raw.fields.desc = 'Add a valve';
await kv.put('doc:' + c.d, JSON.stringify(raw));

// Stale pending body must not outrank a terminal life record.
{
  const b = await acct(m);
  const made = await create(m, b);
  const pending = await kv.get('doc:' + made.d);
  t('cancel', (await req(m, '/doc/cancel', { method: 'POST', headers: A(b), body: JSON.stringify({ d: made.d }) })).status === 200);
  await kv.put('doc:' + made.d, pending);
  const after = await J(await req(m, '/doc/verify?id=' + made.d));
  const body = JSON.parse(await kv.get('doc:' + made.d));
  t('stale pending cannot verify as pending (' + after.status + ')', after.ok && after.status === 'cancelled' && body.status === 'cancelled');
  const declined = await create(m, b, { job: 'Other job' });
  await req(m, '/doc/decline', { method: 'POST', body: JSON.stringify({ d: declined.d, t: declined.tk, reason: 'Too much', name: 'Bob' }) });
  const old = await kv.get('doc:' + declined.d);
  const parsed = JSON.parse(old); parsed.status = 'pending'; parsed.signHash = 'stale';
  await kv.put('doc:' + declined.d, JSON.stringify(parsed));
  const dv = await J(await req(m, '/doc/verify?id=' + declined.d));
  t('stale body cannot hide a decline', dv.ok && dv.status === 'declined');
  await req(m, '/doc/cancel', { method: 'POST', headers: A(b), body: JSON.stringify({ d: declined.d, action: 'delete' }) });
  await kv.put('doc:' + declined.d, old);
  t('deleted document does not verify', (await req(m, '/doc/verify?id=' + declined.d)).status === 404);
  t('deleted body is not left in place', !(await kv.get('doc:' + declined.d)));
  const me = await J(await req(m, '/account/me', { headers: A(b) }));
  t('deleted id is absent from the owner list', me.ok && !me.docs.some(d => d.id === declined.d));
}

// Coordination down: do not publish the KV body.
{
  const down = mf({ SC_TEST_FAULT: 'do-down' });
  const b = await acct(down);
  const made = await create(down, b);
  t('create does not need the document coordinator', made.r.status === 200 && made.d);
  t('verify fails closed without the coordinator', (await req(down, '/doc/verify?id=' + made.d)).status === 503);
  t('status fails closed without the coordinator', (await req(down, '/doc/status?d=' + made.d, { headers: A(b) })).status === 503);
  t('list fails closed without the coordinator', (await req(down, '/account/me', { headers: A(b) })).status === 503);
  await down.dispose();
}

// Unacked sign must not be published as the old pending body.
{
  const slow = mf({ SC_TEST_FAULT: 'kv-put-fail' });
  const b = await acct(slow);
  const made = await create(slow, b);
  const first = await req(slow, '/doc/sign', { method: 'POST', body: JSON.stringify({ d: made.d, t: made.tk, sig: png, name: 'Bob', agree: true, hash: made.j.hash }) });
  t('sign write failure is 503', first.status === 503);
  const published = await J(await req(slow, '/doc/verify?id=' + made.d));
  t('unacked sign is not published as pending', published.status !== 'pending');
  await slow.dispose();
}

// Pagination. Fixture rows avoid the free-document cap and keep newest-first key order.
{
  const b = await acct(m);
  const ids = [];
  for (let i = 0; i < 55; i++) {
    const id = ('pg' + String(i).padStart(22, '0')).slice(0, 24);
    ids.push(id);
    const inv = String(9e15 - i).padStart(16, '0');
    await kv.put('doc:' + id, JSON.stringify({ id, acct: b.id, status: 'pending', mode: 'remote', v: 2, created: '2026-11-06T00:00:00.000Z', signExp: Date.now() + 86400000, hash: 'fixture', fields: { title: 'T' + i, client: 'C', biz: 'B', price: '1', currency: 'USD', date: '2026-11-06' } }));
    await kv.put(`adoc:${b.id}:${inv}:${id}`, '1');
  }
  const full = await J(await req(m, '/account/me', { headers: A(b) }));
  t('default page stays 50 and exposes the rest', full.ok && full.docs.length === 50 && !!full.nextCursor && full.freeLeft === 3);
  t('invalid limit rejected', (await req(m, '/account/me?limit=0', { headers: A(b) })).status === 400 && (await req(m, '/account/me?limit=51', { headers: A(b) })).status === 400 && (await req(m, '/account/me?limit=abc', { headers: A(b) })).status === 400);
  t('invalid cursor rejected', (await req(m, '/account/me?cursor=not-a-cursor', { headers: A(b) })).status === 400);
  t('cursor is refused for another account', (await req(m, '/account/me?limit=50&cursor=' + encodeURIComponent(full.nextCursor), { headers: A(owner) })).status === 400);
  const seen = [];
  let cursor = '', guard = 0;
  while (guard++ < 10) {
    const page = await J(await req(m, '/account/me?limit=20' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), { headers: A(b) }));
    if (!page.ok) { t('page failed', false); break; }
    seen.push(...page.docs.map(d => d.id));
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  const unique = new Set(seen);
  t('pages cover every fixture once (' + seen.length + ')', seen.length === 55 && unique.size === 55);
  t('page order matches the default first page', seen.slice(0, 50).join() === full.docs.map(d => d.id).join());
  t('unauthorized list stays 401', (await req(m, '/account/me')).status === 401);
}

// Concurrent lifecycle still has a single winner.
{
  const b = await acct(m);
  const made = await create(m, b, { job: 'Race' });
  const [s, d] = await Promise.all([
    req(m, '/doc/sign', { method: 'POST', body: JSON.stringify({ d: made.d, t: made.tk, sig: png, name: 'Bob', agree: true, hash: made.j.hash }) }),
    req(m, '/doc/decline', { method: 'POST', body: JSON.stringify({ d: made.d, t: made.tk, reason: 'No thanks', name: 'Bob' }) }),
  ]);
  const body = JSON.parse(await kv.get('doc:' + made.d));
  const view = await J(await req(m, '/doc/verify?id=' + made.d));
  t('concurrent sign/decline stays consistent (' + s.status + '/' + d.status + '/' + body.status + ')', view.ok && view.status === body.status && ((s.status === 200 && d.status === 410 && body.status === 'signed') || (d.status === 200 && s.status === 410 && body.status === 'declined')));
}

await m.dispose();
console.log(`${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
