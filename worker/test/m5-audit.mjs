// Milestone 5 audit findings. No payment calls.
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
const png = 'data:image/png;base64,' + readFileSync(new URL('./sig.png', import.meta.url)).toString('base64');
const O = 'https://signedchange.com';
const res = [];
const t = (n, ok) => { res.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n); };
const mf = new Miniflare({
  scriptPath: 'dist/worker.js', modules: true, kvNamespaces: ['PAYMENTS'],
  durableObjects: { GIFT_LOCK: 'GiftLock' },
  bindings: { SITE_ORIGIN: O, RECEIVER_EMAIL: 'termschange@gmail.com', PRICE: '49.00', SUB_PRICE: '9.00', CURRENCY: 'USD', PAYPAL_VERIFY_URL: 'http://127.0.0.1:1/', TOKEN_SECRET: 'm5audit' },
});
const J = async r => { try { return { status: r.status, body: await r.json() }; } catch { return { status: r.status, body: {} }; } };
const req = (p, o = {}) => mf.dispatchFetch('http://w' + p, { method: o.method || 'GET', body: o.body, headers: { Origin: O, 'Content-Type': 'application/json', 'CF-Connecting-IP': o.ip || 'm5', ...(o.headers || {}) } });
const fields = (extra = {}) => ({ biz: 'Ada', client: 'Bob', clientContact: 'bob@example.com', desc: 'The agreed change', price: '10.00', currency: 'USD', date: '2026-11-07', title: 'Change', job: 'Kitchen', ...extra });
const linkOf = (url) => { const u = new URL(String(url || 'http://x/#d=&t=').replace('#', '?')); return { d: u.searchParams.get('d'), t: u.searchParams.get('t') }; };
async function account(ip) { return (await J(await req('/account/new', { method: 'POST', ip }))).body; }
async function create(a, ip, body) { return J(await req('/doc/create', { method: 'POST', ip, headers: { Authorization: 'Bearer ' + a.id + '.' + a.key }, body: JSON.stringify(body) })); }
const auth = a => ({ Authorization: 'Bearer ' + a.id + '.' + a.key });

const owner = await account('audit');
const zzz = await create(owner, 'zzz', { v: 3, template: 'custom', mode: 'remote', creatorSig: png, fields: fields({ currency: 'ZZZ' }) });
t('1 currency ZZZ is rejected', zzz.status === 400 && zzz.body.field === 'currency' && !zzz.body.id);
const xaf = await create(owner, 'xaf', { v: 3, template: 'custom', mode: 'remote', creatorSig: png, fields: fields({ currency: 'XAF' }) });
t('2 currency XAF is accepted', xaf.status === 200 && !!xaf.body.id);

const zeroInc = await create(owner, 'z1', { v: 3, template: 'freelance', mode: 'remote', creatorSig: png, fields: fields({ priceDir: 'inc', price: '0', title: 'Scope', job: 'Project' }) });
t('3 a zero increase is rejected', zeroInc.status === 400 && zeroInc.body.field === 'price');
const zeroNone = await create(owner, 'z2', { v: 3, template: 'freelance', mode: 'remote', creatorSig: png, fields: fields({ priceDir: 'none', price: '0', title: 'Scope', job: 'Project' }) });
t('4 no price change may be zero', zeroNone.status === 200 && !!zeroNone.body.id);
const scheduleZero = await create(owner, 'z3', { v: 3, template: 'jobschedule', mode: 'remote', creatorSig: png, fields: fields({ priceDir: 'inc', price: '0', title: 'Dates', job: 'Site', newDate: '2026-12-01' }) });
t('5 a schedule starting point may use a zero amount', scheduleZero.status === 200);
const scheduleDate = await create(owner, 'z4', { v: 3, template: 'deadline', mode: 'remote', creatorSig: png, fields: fields({ priceDir: 'none', price: '0', title: 'Deadline', job: 'Invoice' }) });
t('6 a deadline without the new date is rejected', scheduleDate.status === 400 && scheduleDate.body.field === 'newDate');
const durationDate = await create(owner, 'z5', { v: 3, template: 'duration', mode: 'remote', creatorSig: png, fields: fields({ title: 'Term', job: 'Engagement', price: '20' }) });
t('7 a duration change without the new date is rejected', durationDate.status === 400 && durationDate.body.field === 'newDate');

const catalogue = await J(await req('/doc/templates', { ip: 'cat' }));
const byId = Object.fromEntries((catalogue.body.templates || []).map(row => [row.id, row.required]));
t('8 schedule, duration and money starting points do not share one required list',
  catalogue.status === 200
  && byId.jobschedule && byId.jobschedule.includes('newDate') && !byId.jobschedule.includes('price')
  && byId.duration && byId.duration.includes('newDate') && byId.duration.includes('price')
  && byId.freelance && byId.freelance.includes('price') && !byId.freelance.includes('newDate')
  && byId.custom && !byId.custom.includes('title'));

const signer = await account('leak');
const made = await create(signer, 'leak', { v: 3, template: 'custom', mode: 'remote', creatorSig: png, fields: fields({ desc: 'Already signed body' }) });
const L = linkOf(made.body.signUrl);
const signed = await J(await req('/doc/sign', { method: 'POST', ip: 'leak-sign', body: JSON.stringify({ d: L.d, t: L.t, sig: png, name: 'Bob', agree: true, hash: made.body.hash }) }));
const wrong = await J(await req('/doc/get?d=' + L.d + '&t=not-the-real-signing-token-0001', { ip: 'leak-wrong' }));
const right = await J(await req('/doc/get?d=' + L.d + '&t=' + L.t, { ip: 'leak-right' }));
const wrongText = JSON.stringify(wrong.body).toLowerCase();
t('9 a wrong link to a signed document does not reveal that it was signed (' + wrong.status + ')', signed.status === 200 && wrong.status === 404 && !wrongText.includes('signed') && !wrongText.includes('already'));
t('10 the real signing link can still see that signing finished', right.status === 410 && /signed/i.test(right.body.error || ''));

const closer = await account('close');
const open = await create(closer, 'close', { v: 3, template: 'custom', mode: 'remote', creatorSig: png, fields: fields({ desc: 'Will cancel' }) });
const C = linkOf(open.body.signUrl);
const cancelled = await J(await req('/doc/cancel', { method: 'POST', ip: 'close-c', headers: auth(closer), body: JSON.stringify({ d: C.d }) }));
const realCancel = await J(await req('/doc/get?d=' + C.d + '&t=' + C.t, { ip: 'close-real' }));
const fakeCancel = await J(await req('/doc/get?d=' + C.d + '&t=another-wrong-signing-token-0002', { ip: 'close-fake' }));
t('11 the real link explains that the sender cancelled', cancelled.status === 200 && realCancel.status === 410 && /cancelled/i.test(realCancel.body.error || ''));
t('12 a wrong link to a cancelled document does not reveal that status', fakeCancel.status === 404 && !/cancel/i.test(JSON.stringify(fakeCancel.body)));

const waiting = await create(closer, 'stale', { v: 3, template: 'custom', mode: 'remote', creatorSig: png, fields: fields({ desc: 'Still waiting' }) });
const W = linkOf(waiting.body.signUrl);
const stale = await J(await req('/doc/counter', { method: 'POST', ip: 'stale', headers: auth(closer), body: JSON.stringify({ d: W.d, baseHash: 'not-the-current-hash', template: 'custom', fields: fields({ desc: 'Too late' }) }) }));
t('13 a stale counterproposal says what to do next', stale.status === 409 && /reload/i.test(stale.body.error || '') && /version/i.test(stale.body.error || ''));

console.log(res.filter(Boolean).length + '/' + res.length);
if (res.some(ok => !ok)) process.exit(1);
await mf.dispose();
