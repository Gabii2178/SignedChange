// Local document-lifecycle races. Does not call PayPal or the production Worker.
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
import { rmSync } from 'node:fs';
const png = 'data:image/png;base64,' + readFileSync(new URL('./sig.png', import.meta.url)).toString('base64');
const O = 'https://signedchange-app.surge.sh';
const res = [];
const t = (n, ok) => { res.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n); };
function mf(opts = {}) {
  return new Miniflare({
    scriptPath: 'dist/worker.js', modules: true, kvNamespaces: ['PAYMENTS'],
    durableObjects: { GIFT_LOCK: 'GiftLock' },
    bindings: { SITE_ORIGIN: O, RECEIVER_EMAIL: 'termschange@gmail.com', PRICE: '49.00', SUB_PRICE: '9.00', CURRENCY: 'USD', PAYPAL_VERIFY_URL: 'http://127.0.0.1:1/', TOKEN_SECRET: 't', ...(opts.bindings || {}) },
    kvPersist: opts.kvPersist, durableObjectsPersist: opts.doPersist,
  });
}
const J = async r => { try { return await r.json(); } catch { return {}; } };
const req = (m, p, o = {}) => m.dispatchFetch('http://w' + p, { ...o, headers: { Origin: O, 'Content-Type': 'application/json', ...(o.headers || {}) } });
const fields = { biz: 'Ada', contact: 'ada@x.com', client: 'Bob', clientContact: 'bob@example.com', job: 'Kitchen', desc: 'Add a valve', price: '10.00', currency: 'USD', date: '2026-11-06', title: 'Change' };
async function acct(m) { return J(await req(m, '/account/new', { method: 'POST' })); }
const A = a => ({ Authorization: `Bearer ${a.id}.${a.key}` });
async function create(m, a) {
  const r = await req(m, '/doc/create', { method: 'POST', headers: A(a), body: JSON.stringify({ v: 3, template: 'custom', fields, creatorSig: png, mode: 'remote' }) });
  const j = await J(r);
  const u = new URL(String(j.signUrl || 'http://x/#d=&t=').replace('#', '?'));
  return { r, j, d: u.searchParams.get('d'), tk: u.searchParams.get('t') };
}
const sign = (m, d, tk, extra = {}) => req(m, '/doc/sign', { method: 'POST', body: JSON.stringify({ d, t: tk, sig: png, name: 'Bob', agree: true, hash: extra.hash, ...extra }) });
const cancel = (m, a, d, action) => req(m, '/doc/cancel', { method: 'POST', headers: A(a), body: JSON.stringify({ d, action }) });

const m = mf();
const a = await acct(m); t('account', a.ok && a.id && a.key);
let c = await create(m, a); t('10 existing pending link created', c.r.status === 200 && /sign\.html#d=.+&t=/.test(c.j.signUrl));
const hash = c.j.hash;
let g = await J(await req(m, `/doc/get?d=${c.d}&t=${c.tk}`)); t('10 signer can open the existing link', g.ok && g.hash === hash);

// 1. simultaneous sign
{
  const two = await Promise.all([0, 1].map(() => sign(m, c.d, c.tk, { hash })));
  const st = [];
  const bodies = [];
  for (const r of two) { st.push(r.status); bodies.push(await J(r)); }
  st.sort((x, y) => x - y);
  const wins = bodies.filter(b => b.viewKey);
  const sameDecision = new Set(wins.map(b => b.viewKey)).size === 1 && new Set(wins.map(b => b.finalHash)).size === 1;
  t('1 simultaneous sign is one signature (' + st.join(',') + ')', wins.length >= 1 && sameDecision && st.every(s => s === 200 || s === 410));
  const wj = wins[0];
  const again = await sign(m, c.d, c.tk, { hash });
  const againBody = await J(again);
  t('1 exact retry returns the completed signature (' + again.status + ')', again.status === 200 && againBody.viewKey === wj.viewKey && againBody.finalHash === wj.finalHash);
  const kv = await m.getKVNamespace('PAYMENTS');
  const doc = JSON.parse(await kv.get('doc:' + c.d));
  t('1 one signed body', doc.status === 'signed' && doc.finalHash === wj.finalHash);
  const pdf = await req(m, `/doc/pdf?d=${c.d}&v=${wj.viewKey}`);
  t('10 view bookmark still downloads', pdf.status === 200 && Buffer.from(await pdf.arrayBuffer()).slice(0, 5).toString() === '%PDF-');
}

// 2. sign versus cancel
{
  c = await create(m, a);
  const [s, k] = await Promise.all([sign(m, c.d, c.tk, { hash: c.j.hash }), cancel(m, a, c.d)]);
  const kv = await m.getKVNamespace('PAYMENTS');
  const doc = JSON.parse(await kv.get('doc:' + c.d));
  const signWon = s.status === 200 && k.status === 409 && doc.status === 'signed';
  const cancelWon = k.status === 200 && s.status === 410 && doc.status === 'cancelled' && !doc.signHash;
  t('2 sign versus cancel has one terminal result (' + s.status + '/' + k.status + '/' + doc.status + ')', signWon || cancelWon);
  const later = await sign(m, c.d, c.tk, { hash: c.j.hash });
  const laterBody = await J(later);
  const after = JSON.parse(await kv.get('doc:' + c.d));
  const recovered = doc.status === 'signed' ? later.status === 200 && laterBody.finalHash === doc.finalHash : later.status === 410;
  t('2 later sign does not flip the winner (' + later.status + ')', recovered && after.status === doc.status && after.finalHash === doc.finalHash && after.signedAt === doc.signedAt);
}

// 3. sign versus delete, then resurrection attempt
{
  c = await create(m, a);
  const kv = await m.getKVNamespace('PAYMENTS');
  const pending = await kv.get('doc:' + c.d);
  const [s, d] = await Promise.all([sign(m, c.d, c.tk, { hash: c.j.hash }), cancel(m, a, c.d, 'delete')]);
  let body = await kv.get('doc:' + c.d);
  const gone = !body, signed = !!body && JSON.parse(body).status === 'signed';
  t('3 sign versus delete ends deleted or signed, not both (' + s.status + '/' + d.status + ')', (gone || signed) && (d.status !== 200 || gone) && (s.status === 200 || gone));
  if (body && JSON.parse(body).status === 'signed') {
    const removed = await cancel(m, a, c.d, 'delete');
    body = await kv.get('doc:' + c.d);
    t('3 owner can still delete a signed document', removed.status === 200 && !body);
  } else t('3 delete won the race', !body);
  await kv.put('doc:' + c.d, pending);
  const resurrect = await sign(m, c.d, c.tk, { hash: c.j.hash });
  t('3 stale body cannot be signed after the tombstone (' + resurrect.status + ')', resurrect.status !== 200 && !(await kv.get('doc:' + c.d)));
}

// 4. sign versus decline
{
  const b = await acct(m); t('4 account', b.ok);
  c = await create(m, b);
  const dec = req(m, '/doc/decline', { method: 'POST', body: JSON.stringify({ d: c.d, t: c.tk, reason: 'Price is wrong', name: 'Bob' }) });
  const [s, d] = await Promise.all([sign(m, c.d, c.tk, { hash: c.j.hash }), dec]);
  const doc = JSON.parse(await (await m.getKVNamespace('PAYMENTS')).get('doc:' + c.d));
  const signWon = s.status === 200 && d.status === 410 && doc.status === 'signed';
  const declineWon = d.status === 200 && s.status === 410 && doc.status === 'declined';
  t('4 sign versus decline has one winner (' + s.status + '/' + d.status + '/' + doc.status + ')', signWon || declineWon);
}

// 5 and 6. repeated cancel and delete
{
  const b = await acct(m); t('5 account', b.ok);
  c = await create(m, b);
  const first = await cancel(m, b, c.d);
  const second = await cancel(m, b, c.d);
  const doc = JSON.parse(await (await m.getKVNamespace('PAYMENTS')).get('doc:' + c.d));
  t('5 repeated cancel stays cancelled', first.status === 200 && second.status === 409 && doc.status === 'cancelled' && !doc.signHash);
  const del1 = await cancel(m, b, c.d, 'delete');
  const del2 = await cancel(m, b, c.d, 'delete');
  t('6 repeated delete does not resurrect', del1.status === 200 && del2.status === 404 && !(await (await m.getKVNamespace('PAYMENTS')).get('doc:' + c.d)));
}

// 7. DO unavailable
{
  const down = mf({ bindings: { SC_TEST_FAULT: 'do-down' } });
  const b = await acct(down);
  // Account creation does not use the document coordinator. Create uses KV only,
  // but the fault flag is on this isolate for every request. Create must still work.
  const made = await create(down, b);
  t('7 create still works when only document coordination is disabled', made.r.status === 200 && made.d);
  const blocked = await sign(down, made.d, made.tk, { hash: made.j.hash });
  const body = JSON.parse(await (await down.getKVNamespace('PAYMENTS')).get('doc:' + made.d));
  t('7 sign fails closed and leaves the pending body (' + blocked.status + ')', blocked.status === 503 && body.status === 'pending' && body.signHash);
  await down.dispose();
}

// 8 and 9. KV failure, then uncertain retry. Second isolate keeps the fault so a lost
// Durable Object would fail the put again; success proves the stored decision survived.
{
  rmSync('/tmp/sc-m1-kv', { recursive: true, force: true });
  rmSync('/tmp/sc-m1-do', { recursive: true, force: true });
  const opts = { bindings: { SC_TEST_FAULT: 'kv-put-fail' }, kvPersist: '/tmp/sc-m1-kv', doPersist: '/tmp/sc-m1-do' };
  const p1 = mf(opts);
  const u = await acct(p1);
  const made = await create(p1, u);
  const first = await sign(p1, made.d, made.tk, { hash: made.j.hash });
  const mid = JSON.parse(await (await p1.getKVNamespace('PAYMENTS')).get('doc:' + made.d));
  t('8 first sign fails closed when the KV write fails (' + first.status + ')', first.status === 503 && mid.status === 'pending');
  await p1.dispose();
  const p2 = mf(opts);
  const second = await sign(p2, made.d, made.tk, { hash: made.j.hash });
  const sj = await J(second);
  const done = JSON.parse(await (await p2.getKVNamespace('PAYMENTS')).get('doc:' + made.d));
  t('9 retry after restart finishes one signed body (' + second.status + ')', second.status === 200 && sj.viewKey && done.status === 'signed' && done.lifeGen > 0);
  const third = await sign(p2, made.d, made.tk, { hash: made.j.hash });
  const tj = await J(third);
  const done2 = JSON.parse(await (await p2.getKVNamespace('PAYMENTS')).get('doc:' + made.d));
  t('9 settled retry returns the same completed signature (' + third.status + ')', third.status === 200 && tj.viewKey === sj.viewKey && tj.finalHash === sj.finalHash && done2.finalHash === done.finalHash && done2.signedAt === done.signedAt);
  await p2.dispose();
}

// Stale KV read must not override a cancel.
{
  const stale = mf({ bindings: { SC_TEST_FAULT: 'stale-get' } });
  const u = await acct(stale);
  const made = await create(stale, u);
  const k = await cancel(stale, u, made.d);
  const late = await sign(stale, made.d, made.tk, { hash: made.j.hash });
  const doc = JSON.parse(await (await stale.getKVNamespace('PAYMENTS')).get('doc:' + made.d));
  t('stale read cannot sign a cancelled document (' + k.status + '/' + late.status + '/' + doc.status + ')', k.status === 200 && late.status === 410 && doc.status === 'cancelled' && !doc.signHash);
  await stale.dispose();
}

await m.dispose();
console.log(`${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
