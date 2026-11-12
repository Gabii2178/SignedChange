// The three approval-blocking defects. No payment calls.
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
const pngBuf = readFileSync(new URL('./sig.png', import.meta.url));
const altBuf = Buffer.from(pngBuf);
altBuf[altBuf.length - 20] ^= 0xff;
const png = 'data:image/png;base64,' + pngBuf.toString('base64');
const png2 = 'data:image/png;base64,' + altBuf.toString('base64');
const O = 'https://signedchange-app.surge.sh';
const res = [];
const t = (n, ok) => { res.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n); };
const mf = new Miniflare({
  scriptPath: 'dist/worker.js', modules: true, kvNamespaces: ['PAYMENTS'],
  durableObjects: { GIFT_LOCK: 'GiftLock' },
  bindings: { SITE_ORIGIN: O, RECEIVER_EMAIL: 'termschange@gmail.com', PRICE: '49.00', SUB_PRICE: '9.00', CURRENCY: 'USD', PAYPAL_VERIFY_URL: 'http://127.0.0.1:1/', TOKEN_SECRET: 'three' },
});
const J = async r => { try { return { status: r.status, body: await r.json() }; } catch { return { status: r.status, body: {} }; } };
const req = (p, o = {}) => mf.dispatchFetch('http://w' + p, { method: o.method || 'GET', body: o.body, headers: { Origin: O, 'Content-Type': 'application/json', 'CF-Connecting-IP': o.ip || 'three', ...(o.headers || {}) } });
const fields = (extra = {}) => ({ biz: 'Ada', client: 'Bob', clientContact: 'bob@example.com', desc: 'Add a valve and labour', price: '10.00', currency: 'USD', date: '2026-11-07', title: 'Change', job: 'Kitchen', ...extra });
const linkOf = (url) => { const u = new URL(String(url || 'http://x/#d=&t=').replace('#', '?')); return { d: u.searchParams.get('d'), t: u.searchParams.get('t') }; };
async function account(ip) { return (await J(await req('/account/new', { method: 'POST', ip }))).body; }
async function create(a, ip, body) { return J(await req('/doc/create', { method: 'POST', ip, headers: { Authorization: 'Bearer ' + a.id + '.' + a.key }, body: JSON.stringify(body) })); }
const auth = a => ({ Authorization: 'Bearer ' + a.id + '.' + a.key });
const kv = await mf.getKVNamespace('PAYMENTS');

const owner = await account('tpl');
const missingBare = await create(owner, 'tpl-a', { v: 3, mode: 'remote', creatorSig: png, fields: { biz: 'Ada', client: 'Bob', clientContact: 'bob@example.com', desc: 'No title', price: '10', currency: 'USD', date: '2026-11-07' } });
t('1 missing template and missing title is rejected (' + missingBare.status + ')', missingBare.status === 400);
const missingValid = await create(owner, 'tpl-b', { v: 3, mode: 'remote', creatorSig: png, fields: fields() });
t('2 missing template with otherwise valid fields is rejected (' + missingValid.status + ')', missingValid.status === 400 && !missingValid.body.id);
const blank = await create(owner, 'tpl-c', { v: 3, template: 'custom', mode: 'remote', creatorSig: png, fields: { biz: 'Ada', client: 'Bob', clientContact: 'bob@example.com', desc: 'Blank terms', price: '10', currency: 'USD', date: '2026-11-07' } });
t('3 explicit Blank succeeds (' + blank.status + ')', blank.status === 200 && blank.body.template === 'custom');
const blankBad = await create(owner, 'tpl-d', { v: 3, template: 'custom', mode: 'remote', creatorSig: png, fields: { biz: 'Ada', client: 'Bob', price: '10', currency: 'USD', date: '2026-11-07' } });
t('4 explicit Blank missing its description is rejected (' + blankBad.status + ')', blankBad.status === 400);
const unknown = await create(owner, 'tpl-e', { v: 3, template: 'nope', mode: 'remote', creatorSig: png, fields: fields() });
t('5 unknown template is rejected (' + unknown.status + ')', unknown.status === 400);
const legacyId = 'legacyKeep000000000001';
const legacy = JSON.stringify({ id: legacyId, acct: owner.id, status: 'pending', mode: 'remote', v: 2, created: '2026-11-01T00:00:00.000Z', hash: 'legacy', fields: { title: 'Old', biz: 'Ada', client: 'Bob', desc: 'Old', price: '5', currency: 'USD', date: '2026-11-01' } });
await kv.put('doc:' + legacyId, legacy);
await req('/doc/verify?id=' + legacyId, { ip: 'legacy' });
t('6 a legacy record without a template is not rewritten', (await kv.get('doc:' + legacyId)) === legacy);

const signer = await account('sign');
const made = await create(signer, 'sign', { v: 3, template: 'custom', mode: 'remote', creatorSig: png, fields: fields({ desc: 'Retry me' }) });
const L = linkOf(made.body.signUrl);
const payload = { d: L.d, t: L.t, sig: png, name: 'Bob', agree: true, hash: made.body.hash };
const first = await J(await req('/doc/sign', { method: 'POST', ip: 'A', body: JSON.stringify(payload) }));
const before = JSON.parse(await kv.get('doc:' + L.d));
const retry = await J(await req('/doc/sign', { method: 'POST', ip: 'A2', body: JSON.stringify(payload) }));
const after = JSON.parse(await kv.get('doc:' + L.d));
t('A and E exact retry returns the completed record (' + first.status + '/' + retry.status + ')', first.status === 200 && retry.status === 200 && retry.body.viewKey === first.body.viewKey && retry.body.finalHash === first.body.finalHash && after.finalHash === before.finalHash && after.signedAt === before.signedAt && after.otherSig === before.otherSig);
const conflict = await J(await req('/doc/sign', { method: 'POST', ip: 'B', body: JSON.stringify({ ...payload, sig: png2 }) }));
const kept = JSON.parse(await kv.get('doc:' + L.d));
t('B a different signature is rejected and the original remains', conflict.status !== 200 && kept.otherSig === before.otherSig && kept.finalHash === before.finalHash && kept.signedAt === before.signedAt, String(conflict.status));
t('C the owner signature and the invited signature are both kept', !!kept.creatorSig && !!kept.otherSig && kept.hash === made.body.hash);

const other = await account('both');
const made2 = await create(other, 'both', { v: 3, template: 'custom', mode: 'remote', creatorSig: png, fields: fields({ desc: 'Two parties', title: 'Two', job: 'Job' }) });
const L2 = linkOf(made2.body.signUrl);
const proposed = await J(await req('/doc/counter', { method: 'POST', ip: 'prop', body: JSON.stringify({ d: L2.d, t: L2.t, baseHash: made2.body.hash, template: 'custom', fields: fields({ desc: 'Revised terms', title: 'Two', job: 'Job', price: '8.00' }) }) }));
const L2b = linkOf(proposed.body.signUrl);
const [acc, sgn] = await Promise.all([
  J(await req('/doc/accept', { method: 'POST', ip: 'acc', headers: auth(other), body: JSON.stringify({ d: L2.d, hash: proposed.body.hash, sig: png2 }) })),
  J(await req('/doc/sign', { method: 'POST', ip: 'sgn', body: JSON.stringify({ d: L2b.d, t: L2b.t, sig: png, name: 'Bob', agree: true, hash: proposed.body.hash }) })),
]);
let finalDoc = JSON.parse(await kv.get('doc:' + L2.d));
if (finalDoc.status !== 'signed') {
  await req('/doc/accept', { method: 'POST', ip: 'acc2', headers: auth(other), body: JSON.stringify({ d: L2.d, hash: proposed.body.hash, sig: png2 }) });
  await req('/doc/sign', { method: 'POST', ip: 'sgn2', body: JSON.stringify({ d: L2b.d, t: L2b.t, sig: png, name: 'Bob', agree: true, hash: proposed.body.hash }) });
  finalDoc = JSON.parse(await kv.get('doc:' + L2.d));
}
t('D concurrent parties leave one signed record with both signatures (' + acc.status + '/' + sgn.status + '/' + finalDoc.status + ')', finalDoc.status === 'signed' && !!finalDoc.ownerSig && !!finalDoc.otherSig && finalDoc.hash === proposed.body.hash);
const original = JSON.parse(await kv.get('doc:' + L2.d));
const verifyOk = await J(await req('/doc/verify?id=' + L2.d, { ip: 'v1' }));
t('fingerprint accepts the original signatures (' + verifyOk.status + ')', verifyOk.status === 200 && verifyOk.body.finalHash === original.finalHash);
const swappedOwner = { ...original, ownerSig: png };
await kv.put('doc:' + L2.d, JSON.stringify(swappedOwner));
const badOwner = await J(await req('/doc/verify?id=' + L2.d, { ip: 'v2' }));
t('altering only the sender approval image fails verification (' + badOwner.status + ')', badOwner.status === 409);
await kv.put('doc:' + L2.d, JSON.stringify(original));
const restored = await J(await req('/doc/verify?id=' + L2.d, { ip: 'v3' }));
t('restoring the sender approval image verifies again (' + restored.status + ')', restored.status === 200);
const swappedInvite = { ...original, otherSig: png2 };
await kv.put('doc:' + L2.d, JSON.stringify(swappedInvite));
const badInvite = await J(await req('/doc/verify?id=' + L2.d, { ip: 'v4' }));
t('altering only the invited signature fails verification (' + badInvite.status + ')', badInvite.status === 409);
await kv.put('doc:' + L2.d, JSON.stringify(original));
const swappedTerms = { ...original, fields: { ...original.fields, desc: 'Tampered terms' } };
await kv.put('doc:' + L2.d, JSON.stringify(swappedTerms));
const badTerms = await J(await req('/doc/verify?id=' + L2.d, { ip: 'v5' }));
t('altering the agreement terms fails verification (' + badTerms.status + ')', badTerms.status === 409);
await kv.put('doc:' + L2.d, JSON.stringify(original));
const still = JSON.parse(await kv.get('doc:' + L2.d));
t('the original signed record is unchanged after the checks', still.finalHash === original.finalHash && still.signedAt === original.signedAt && still.hash === original.hash && still.status === 'signed');

console.log(res.filter(Boolean).length + '/' + res.length + ' passed');
await mf.dispose();
process.exit(res.every(Boolean) ? 0 : 1);
