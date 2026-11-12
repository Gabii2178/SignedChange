// Display currency and optional identity. Network rates are stubbed. Does not call a payment provider.
import { MockAgent } from 'undici';
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';

const png = 'data:image/png;base64,' + readFileSync(new URL('./sig.png', import.meta.url)).toString('base64');
const O = 'https://signedchange-app.surge.sh';
const SECRET = 'trust-test-secret';
const res = [];
const t = (n, ok) => { res.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n); };
const FRESH = { amount: 1, base: 'USD', date: '2026-11-09', rates: { EUR: 0.92, GBP: 0.78, CAD: 1.38, AUD: 1.52, INR: 83.5, ZAR: 18.1 } };
const STALE = { amount: 1, base: 'USD', date: '2020-01-01', rates: { EUR: 0.9, GBP: 0.7 } };

function agentWith(handler) {
  const agent = new MockAgent();
  agent.disableNetConnect();
  const pool = agent.get('https://api.frankfurter.app');
  pool.intercept({ path: '/latest?from=USD', method: 'GET' }).reply(handler).persist();
  return agent;
}
function mf(fetchMock, extra = {}) {
  return new Miniflare({
    scriptPath: 'dist/worker.js', modules: true, kvNamespaces: ['PAYMENTS'],
    durableObjects: { GIFT_LOCK: 'GiftLock' },
    fetchMock,
    bindings: { SITE_ORIGIN: O, RECEIVER_EMAIL: 'termschange@gmail.com', PRICE: '49.00', SUB_PRICE: '9.00', CURRENCY: 'USD', PAYPAL_VERIFY_URL: 'http://127.0.0.1:1/', TOKEN_SECRET: SECRET, ...extra },
  });
}
const J = async r => { try { return await r.json(); } catch { return {}; } };
const req = (m, p, o = {}) => m.dispatchFetch('http://w' + p, { method: o.method || 'GET', body: o.body, cf: o.cf, headers: { Origin: O, 'Content-Type': 'application/json', ...(o.headers || {}) } });
const fields = { biz: 'Ada', contact: 'ada@x.com', client: 'Bob', clientContact: 'bob@example.com', job: 'Kitchen', desc: 'Add a valve', price: '10.00', currency: 'USD', date: '2026-11-06', title: 'Change' };
async function hmac(accountId, status, nonce, exp) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode([accountId, status, nonce, exp].join('|')));
  return [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
}

let calls = 0;
const live = mf(agentWith(() => {
  calls += 1;
  if (calls === 1) return { statusCode: 200, data: JSON.stringify(FRESH), responseOptions: { headers: { 'content-type': 'application/json' } } };
  return { statusCode: 500, data: 'down' };
}));

const spoof = await J(await req(live, '/fx/suggest', { cf: { country: 'XX' }, headers: { 'CF-IPCountry': 'CM', 'X-Forwarded-For': '203.0.113.8', 'X-Country': 'CM' } }));
t('client country headers are not a country (' + spoof.reason + ' ' + spoof.country + ')', spoof.ok && spoof.reason === 'missing' && spoof.currency === 'USD' && spoof.country == null && !('ip' in spoof));
const cm = await J(await req(live, '/fx/suggest', { cf: { country: 'CM' } }));
t('Cameroon suggests XAF', cm.ok && cm.country === 'CM' && cm.currency === 'XAF' && cm.suggested === true && cm.reason === 'country');
const fr = await J(await req(live, '/fx/suggest', { cf: { country: 'FR' } }));
t('France suggests EUR', fr.currency === 'EUR' && fr.suggested === true);
const jp = await J(await req(live, '/fx/suggest', { cf: { country: 'JP' } }));
t('an unmapped country stays on USD', jp.country === 'JP' && jp.currency === 'USD' && jp.suggested === false && jp.reason === 'unsupported');
const ng = await J(await req(live, '/fx/suggest', { cf: { country: 'NG' } }));
t('Nigeria suggests NGN', ng.currency === 'NGN' && ng.suggested === true);
const none = await J(await req(live, '/fx/suggest', { cf: { country: 'T1' } }));
t('missing country metadata keeps the default (' + none.reason + ' ' + none.country + ')', none.reason === 'missing' && none.currency === 'USD' && none.suggested === false);

const made = await J(await req(live, '/account/new', { method: 'POST' }));
t('account still opens without identity', made.ok === true);
const auth = { Authorization: 'Bearer ' + made.id + '.' + made.key };
const created = await req(live, '/doc/create', { method: 'POST', headers: auth, body: JSON.stringify({ v: 3, template: 'custom', fields, creatorSig: png, mode: 'remote' }) });
const doc = await J(created);
const link = new URL(String(doc.signUrl || 'http://x/#d=&t=').replace('#', '?'));
const before = JSON.parse(await (await live.getKVNamespace('PAYMENTS')).get('doc:' + link.searchParams.get('d')));
const quoted = await J(await req(live, '/fx/rates'));
const again = JSON.parse(await (await live.getKVNamespace('PAYMENTS')).get('doc:' + link.searchParams.get('d')));
t('rates name Frankfurter and the ECB date', quoted.ok === true && /Frankfurter/.test(quoted.source) && quoted.date === '2026-11-09' && quoted.approximate === true && quoted.stale === false);
t('XAF is the euro peg, and NGN is not invented', Math.abs(quoted.rates.XAF - Math.round(0.92 * 655.957 * 1e6) / 1e6) < 1e-6 && quoted.rates.NGN == null && /655\.957/.test(quoted.pegs.XAF));
t('a quote does not change the agreement or its fingerprint', before.hash === again.hash && before.fields.currency === 'USD' && again.fields.currency === 'USD' && before.fields.price === again.fields.price && before.fields.price === '10.00');
const cached = await J(await req(live, '/fx/rates'));
t('a second quote uses the cache and does not fetch again (' + calls + ')', calls === 1 && cached.fromCache === true && cached.date === '2026-11-09');

const signed = await req(live, '/doc/sign', { method: 'POST', body: JSON.stringify({ d: link.searchParams.get('d'), t: link.searchParams.get('t'), sig: png, name: 'Bob', agree: true, hash: doc.hash }) });
const signedBody = await J(signed);
const kv = await live.getKVNamespace('PAYMENTS');
const signedDoc = JSON.parse(await kv.get('doc:' + link.searchParams.get('d')));
await req(live, '/fx/rates');
await req(live, '/fx/suggest', { cf: { country: 'CM' } });
const afterFx = JSON.parse(await kv.get('doc:' + link.searchParams.get('d')));
t('signed fingerprint stays after currency calls (' + signed.status + ')', signed.status === 200 && signedDoc.finalHash && afterFx.finalHash === signedDoc.finalHash && afterFx.hash === signedDoc.hash && afterFx.fields.currency === 'USD' && afterFx.fields.price === '10.00');
const pub = await J(await req(live, '/doc/verify?id=' + link.searchParams.get('d')));
t('public verify has no IP, country, or identity status', pub.ok === true && pub.hash === afterFx.hash && !('ip' in pub) && !('country' in pub) && !('identity' in pub) && pub.currency == null);

const id0 = await J(await req(live, '/account/identity', { headers: auth }));
t('identity starts as not started', id0.status === 'NOT_STARTED');
const noConsent = await req(live, '/account/identity/start', { method: 'POST', headers: auth, body: JSON.stringify({}) });
t('identity start requires consent (' + noConsent.status + ')', noConsent.status === 400);
const forged = await req(live, '/account/identity/start', { method: 'POST', headers: auth, body: JSON.stringify({ consent: true, status: 'VERIFIED' }) });
const still = await J(await req(live, '/account/identity', { headers: auth }));
t('the browser cannot submit a verified status (' + forged.status + ' / ' + still.status + ')', forged.status === 400 && still.status === 'NOT_STARTED');
const pending = await J(await req(live, '/account/identity/start', { method: 'POST', headers: auth, body: JSON.stringify({ consent: true }) }));
t('a consented check is pending and stores no mock nonce here', pending.status === 'PENDING' && pending.mockNonce == null && pending.storesDocuments === false);
const closed = await req(live, '/account/identity/provider', { method: 'POST', body: JSON.stringify({ accountId: made.id, status: 'VERIFIED', nonce: 'x', exp: Date.now() + 1000, sig: 'nope' }) });
t('a provider callback is closed when no provider is configured (' + closed.status + ')', closed.status === 404);
const stillPending = await J(await req(live, '/account/identity', { headers: auth }));
const createdToo = await req(live, '/doc/create', { method: 'POST', headers: auth, body: JSON.stringify({ v: 3, template: 'custom', fields: { ...fields, title: 'Still allowed', desc: 'Another change' }, creatorSig: png, mode: 'remote' }) });
t('a pending account can still create a document (' + createdToo.status + ' / ' + stillPending.status + ')', createdToo.status === 200 && stillPending.status === 'PENDING');
const second = await J(createdToo);
const secondLink = new URL(String(second.signUrl || 'http://x/#d=&t=').replace('#', '?'));
const guest = await req(live, '/doc/get?d=' + secondLink.searchParams.get('d') + '&t=' + secondLink.searchParams.get('t'));
const guestBody = await J(guest);
t('invited signing still needs no account (' + guest.status + ')', guest.status === 200 && guestBody.ok === true && guestBody.fields.currency === 'USD');

const kvLive = await live.getKVNamespace('PAYMENTS');
const saved = JSON.parse(await kvLive.get('fx:ecb:v1'));
saved.fetchedAt = Date.now() - 7 * 3600 * 1000;
await kvLive.put('fx:ecb:v1', JSON.stringify(saved));
const fallback = await J(await req(live, '/fx/rates'));
t('a failed refresh uses the last rate and keeps its date', fallback.ok === true && fallback.fallback === true && fallback.date === '2026-11-09' && fallback.stale === false);
saved.date = '2020-01-01';
saved.fetchedAt = Date.now() - 7 * 3600 * 1000;
await kvLive.put('fx:ecb:v1', JSON.stringify(saved));
const tooOld = await J(await req(live, '/fx/rates'));
t('a stale saved rate is not presented as current', tooOld.ok === false && tooOld.stale === true && tooOld.date === '2020-01-01' && tooOld.rates == null);

const staleOnly = mf(agentWith(() => ({ statusCode: 200, data: JSON.stringify(STALE), responseOptions: { headers: { 'content-type': 'application/json' } } })));
const stale = await J(await req(staleOnly, '/fx/rates'));
t('a stale source date is rejected', stale.ok === false && stale.error === 'stale' && stale.rates == null);
const down = mf(agentWith(() => ({ statusCode: 503, data: 'no' })));
const unavailable = await J(await req(down, '/fx/rates'));
t('a source failure with no cache does not invent a rate (' + unavailable.error + ')', unavailable.ok === false && unavailable.error === 'unavailable' && unavailable.rates == null);

const mock = mf(agentWith(() => ({ statusCode: 200, data: JSON.stringify(FRESH) })), { IDENTITY_MOCK: 'test-only' });
const person = await J(await req(mock, '/account/new', { method: 'POST' }));
const mockAuth = { Authorization: 'Bearer ' + person.id + '.' + person.key };
const opened = await J(await req(mock, '/account/identity/start', { method: 'POST', headers: mockAuth, body: JSON.stringify({ consent: true, document: 'should-not-be-stored', idNumber: '123' }) }));
t('mock start stays pending', opened.status === 'PENDING' && typeof opened.mockNonce === 'string');
const bad = await req(mock, '/account/identity/provider', { method: 'POST', body: JSON.stringify({ accountId: person.id, status: 'VERIFIED', nonce: opened.mockNonce, exp: Date.now() + 60000, sig: '0'.repeat(64) }) });
t('a bad provider signature is rejected (' + bad.status + ')', bad.status === 401);
const exp = Date.now() + 60000;
const goodSig = await hmac(person.id, 'VERIFIED', opened.mockNonce, exp);
const good = await J(await req(mock, '/account/identity/provider', { method: 'POST', body: JSON.stringify({ accountId: person.id, status: 'VERIFIED', nonce: opened.mockNonce, exp, sig: goodSig, idNumber: '123', image: 'raw' }) }));
const stored = JSON.parse(await (await mock.getKVNamespace('PAYMENTS')).get('idv:' + person.id));
t('only an authenticated mock result can verify', good.status === 'VERIFIED' && good.provider === 'mock' && stored.status === 'VERIFIED' && stored.idNumber == null && stored.image == null && stored.document == null);
const seen = await J(await req(mock, '/account/identity', { headers: mockAuth }));
t('the account reads the verified status back', seen.status === 'VERIFIED');
const replay = await req(mock, '/account/identity/provider', { method: 'POST', body: JSON.stringify({ accountId: person.id, status: 'VERIFIED', nonce: opened.mockNonce, exp, sig: goodSig }) });
t('a provider nonce cannot be replayed (' + replay.status + ')', replay.status === 409);
const expired = await req(mock, '/account/identity/provider', { method: 'POST', body: JSON.stringify({ accountId: person.id, status: 'VERIFIED', nonce: opened.mockNonce, exp: Date.now() - 1000, sig: await hmac(person.id, 'VERIFIED', opened.mockNonce, Date.now() - 1000) }) });
t('an expired provider callback is rejected (' + expired.status + ')', expired.status === 401);
const distant = Date.now() + 60 * 60 * 1000;
const distantRes = await req(mock, '/account/identity/provider', { method: 'POST', body: JSON.stringify({ accountId: person.id, status: 'VERIFIED', nonce: opened.mockNonce, exp: distant, sig: await hmac(person.id, 'VERIFIED', opened.mockNonce, distant) }) });
t('a long-lived provider callback is rejected (' + distantRes.status + ')', distantRes.status === 401);

const badDate = mf(agentWith(() => ({ statusCode: 200, data: JSON.stringify({ amount: 1, base: 'USD', date: '2026-02-31', rates: { EUR: 0.9 } }) })));
const invalidDate = await J(await req(badDate, '/fx/rates'));
t('an impossible rate date is rejected (' + invalidDate.error + ')', invalidDate.ok === false && invalidDate.rates == null);
const badCache = mf(agentWith(() => ({ statusCode: 503, data: 'no' })));
await (await badCache.getKVNamespace('PAYMENTS')).put('fx:ecb:v1', JSON.stringify({ source: 'European Central Bank reference rates via Frankfurter (api.frankfurter.app)', base: 'USD', date: '2026-11-09', fetchedAt: Date.now(), rates: { USD: 1, EUR: -1 } }));
const ignored = await J(await req(badCache, '/fx/rates'));
t('a malformed cached rate is not displayed', ignored.ok === false && ignored.rates == null);
const catalogue = await J(await req(live, '/doc/templates'));
const ids = (catalogue.templates || []).map(x => x.id);
const named = Object.values(catalogue.catalogue || {}).flat();
t('the schema lists all 45 catalogue templates plus Blank', catalogue.ok && named.length === 45 && named.every(id => ids.includes(id)) && ids.includes('custom') && ids.includes('contractor') && ids.includes('deposit'));
const incomplete = await req(live, '/doc/create', { method: 'POST', headers: auth, body: JSON.stringify({ v: 3, template: 'construction', mode: 'remote', creatorSig: png, fields: { biz: 'Ada', client: 'Bob', clientContact: 'bob@example.com', desc: 'A wall', price: '10', currency: 'USD', date: '2026-11-07' } }) });
t('a named template rejects a missing job (' + incomplete.status + ')', incomplete.status === 400);
const scheduleIds = new Set(['jobschedule', 'deadline', 'deliverydate', 'course']);
const specFor = id => (catalogue.templates || []).find(item => item.id === id);
const money = named.filter(id => {
  const spec = specFor(id);
  return spec && !scheduleIds.has(id) && spec.required.includes('title') && spec.required.includes('job') && spec.required.includes('desc') && spec.required.includes('price') && spec.required.includes('currency');
});
const dated = named.filter(id => {
  const spec = specFor(id);
  return scheduleIds.has(id) && spec && spec.required.includes('title') && spec.required.includes('newDate') && !spec.required.includes('price');
});
t('41 catalogue templates require a price and 4 schedule templates require the new date (' + money.length + '/' + dated.length + ')', money.length === 41 && dated.length === 4 && specFor('duration').required.includes('newDate') && specFor('duration').required.includes('price'));
let rejected = 0;
for (const id of named) {
  const r = await req(live, '/doc/create', { method: 'POST', headers: { ...auth, 'CF-Connecting-IP': 'tpl-' + id }, body: JSON.stringify({ v: 3, template: id, mode: 'remote', creatorSig: png, fields: { biz: 'Ada', client: 'Bob', desc: 'Work', price: '10', currency: 'USD', date: '2026-11-07' } }) });
  if (r.status === 400) rejected += 1;
}
t('all 45 templates reject an incomplete submission on the server (' + rejected + ')', rejected === 45);
const unknownTpl = await req(live, '/doc/create', { method: 'POST', headers: auth, body: JSON.stringify({ v: 3, template: 'not-a-template', mode: 'remote', creatorSig: png, fields }) });
t('an unknown template is rejected (' + unknownTpl.status + ')', unknownTpl.status === 400);
const extraField = await req(live, '/doc/create', { method: 'POST', headers: auth, body: JSON.stringify({ v: 3, template: 'custom', mode: 'remote', creatorSig: png, fields: { ...fields, secret: 'no' } }) });
t('an unknown field is rejected (' + extraField.status + ')', extraField.status === 400);
const badDay = await req(live, '/doc/create', { method: 'POST', headers: auth, body: JSON.stringify({ v: 3, template: 'custom', mode: 'remote', creatorSig: png, fields: { ...fields, date: '2026-02-31' } }) });
t('an impossible agreement date is rejected (' + badDay.status + ')', badDay.status === 400);
const validTpl = await req(live, '/doc/create', { method: 'POST', headers: auth, body: JSON.stringify({ v: 3, template: 'construction', mode: 'remote', creatorSig: png, fields: { ...fields, title: 'Wall', job: 'Site', desc: 'Add a wall' } }) });
const validBody = await J(validTpl);
t('a complete construction template is accepted (' + validTpl.status + ')', validTpl.status === 200 && validBody.template === 'construction' && validBody.version === 1);
const madeLink = new URL(String(validBody.signUrl || 'http://x/#d=&t=').replace('#', '?'));
const oldToken = madeLink.searchParams.get('t');
const countered = await J(await req(live, '/doc/counter', { method: 'POST', body: JSON.stringify({ d: madeLink.searchParams.get('d'), t: oldToken, baseHash: validBody.hash, template: 'construction', fields: { ...fields, title: 'Wall', job: 'Site', desc: 'A smaller wall', price: '8.00' } }) }));
t('an invited counterproposal creates version 2', countered.ok === true && countered.version === 2 && countered.signUrl && countered.hash !== validBody.hash);
const oldLink = await req(live, '/doc/get?d=' + madeLink.searchParams.get('d') + '&t=' + oldToken);
t('the old signing link cannot open the new version (' + oldLink.status + ')', oldLink.status === 404);
const newLink = new URL(String(countered.signUrl).replace('#', '?'));
const tooSoon = await req(live, '/doc/sign', { method: 'POST', body: JSON.stringify({ d: newLink.searchParams.get('d'), t: newLink.searchParams.get('t'), sig: png, name: 'Bob', agree: true, hash: countered.hash }) });
t('the invited person cannot sign before the sender approves this version (' + tooSoon.status + ')', tooSoon.status === 409);
const accepted = await J(await req(live, '/doc/accept', { method: 'POST', headers: auth, body: JSON.stringify({ d: newLink.searchParams.get('d'), hash: countered.hash, sig: png }) }));
t('the sender can approve the same version', accepted.ok === true);
const signedVersion = await J(await req(live, '/doc/sign', { method: 'POST', body: JSON.stringify({ d: newLink.searchParams.get('d'), t: newLink.searchParams.get('t'), sig: png, name: 'Bob', agree: true, hash: countered.hash }) }));
t('both parties sign version 2', signedVersion.ok === true && signedVersion.finalHash);
const staleCounter = await req(live, '/doc/counter', { method: 'POST', headers: auth, body: JSON.stringify({ d: newLink.searchParams.get('d'), baseHash: validBody.hash, template: 'construction', fields: { ...fields, title: 'Wall', job: 'Site', desc: 'Too late', price: '1' } }) });
t('a stale counterproposal does not overwrite history (' + staleCounter.status + ')', staleCounter.status === 409 || staleCounter.status === 410);
const history = await J(await req(live, '/doc/history?d=' + newLink.searchParams.get('d'), { headers: auth }));
const hashes = (history.history || []).map(v => v.hash);
t('version history keeps both fingerprints', history.ok && hashes.includes(validBody.hash) && hashes.includes(countered.hash) && new Set(hashes).size >= 2);
const pubAfter = await J(await req(live, '/doc/verify?id=' + newLink.searchParams.get('d')));
t('public verify hides the negotiation', pubAfter.ok === true && pubAfter.history == null && pubAfter.finalHash === signedVersion.finalHash);
await badDate.dispose();
await badCache.dispose();

await live.dispose();
await staleOnly.dispose();
await down.dispose();
await mock.dispose();
console.log(res.filter(Boolean).length + '/' + res.length + ' passed');
process.exit(res.every(Boolean) ? 0 : 1);
