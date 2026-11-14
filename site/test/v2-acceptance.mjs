// Final browser acceptance. Local site + Miniflare only.
// PayPal and analytics hosts are pinned to loopback. No new dependencies.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { Miniflare } = require('../../worker/node_modules/miniflare');
const site = new URL('..', import.meta.url).pathname;
const root = new URL('../..', import.meta.url).pathname;
const art = '/opt/cursor/artifacts';
mkdirSync(art, { recursive: true });
const results = [];
const t = (name, ok) => { results.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + name); };

const context = { window: {} };
vm.createContext(context);
vm.runInContext(readFileSync(join(site, 'i18n/messages.js'), 'utf8'), context);
vm.runInContext(readFileSync(join(site, 'i18n/fr.js'), 'utf8'), context);
const en = context.window.SC_MESSAGES.en;
const fr = context.window.SC_MESSAGES.fr;
t('French signing-sheet labels exist and are not copies of the English chrome', ['sign.row.changeInc', 'sign.row.breakdown', 'sign.co', 'sign.by', 'sign.row.change'].every(key => en[key] && fr[key] && fr[key] !== en[key]));

const PORT = 8775;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
process.chdir(join(root, 'worker'));
const mf = new Miniflare({
  scriptPath: 'dist/worker.js',
  modules: true,
  kvNamespaces: ['PAYMENTS'],
  durableObjects: { GIFT_LOCK: 'GiftLock' },
  bindings: {
    SITE_ORIGIN: ORIGIN,
    RECEIVER_EMAIL: 'termschange@gmail.com',
    PRICE: '49.00',
    SUB_PRICE: '9.00',
    CURRENCY: 'USD',
    PAYPAL_VERIFY_URL: 'http://127.0.0.1:9/',
    TOKEN_SECRET: 'v2-accept',
  },
});
const apiPrefix = ['/account', '/doc', '/fx'];
let simDown = false;
let hop = 1;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  if (url.pathname === '/__sim') {
    simDown = url.searchParams.get('down') === '1';
    res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>sim</title>'); return;
  }
  const down = simDown;
  if (down && (url.pathname === '/account/me' || url.pathname === '/doc/verify' || url.pathname === '/doc/status')) {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Document coordination is unavailable. Please try again.' }));
    return;
  }
  if (apiPrefix.some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + '/'))) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    headers.set('CF-Connecting-IP', '203.0.113.' + (hop++ % 200 + 1));
    const response = await mf.dispatchFetch(ORIGIN + url.pathname + url.search, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks) });
    res.writeHead(response.status, { 'content-type': response.headers.get('content-type') || 'application/json' });
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(site, path === '/' ? 'index.html' : path);
  if (!file.startsWith(site) || !existsSync(file)) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
const chrome = spawn('/opt/google/chrome/chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9352', '--remote-allow-origins=*',
  `--user-data-dir=/tmp/sc-v2-accept-${process.pid}`,
  '--host-resolver-rules=MAP www.paypal.com 127.0.0.1, MAP www.paypalobjects.com 127.0.0.1, MAP www.googletagmanager.com 127.0.0.1, MAP static.cloudflareinsights.com 127.0.0.1, MAP www.google-analytics.com 127.0.0.1',
], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function cdpUrl() {
  for (let i = 0; i < 40; i++) {
    try { return (await (await fetch('http://127.0.0.1:9352/json/version')).json()).webSocketDebuggerUrl; }
    catch { await sleep(150); }
  }
  throw new Error('chrome did not start');
}
const ws = new WebSocket(await cdpUrl());
await new Promise(resolve => ws.addEventListener('open', resolve));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Page.javascriptDialogOpening') {
    send('Page.handleJavaScriptDialog', { accept: true }, message.sessionId || sid);
    return;
  }
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
});
const send = (method, params = {}, sessionId) => new Promise(resolve => {
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});
const target = await send('Target.createTarget', { url: 'about:blank' });
const sid = (await send('Target.attachToTarget', { targetId: target.result.targetId, flatten: true })).result.sessionId;
const call = (method, params) => send(method, params, sid);
await call('Page.enable');
await call('Runtime.enable');
async function evaluate(expression) {
  const message = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  const details = message.result && message.result.exceptionDetails;
  if (details) throw new Error((details.exception && details.exception.description) || details.text || 'evaluate failed');
  return message.result.result.value;
}
async function open(url) {
  await call('Page.navigate', { url });
  for (let i = 0; i < 80; i++) {
    await sleep(100);
    const href = await evaluate('location.href').catch(() => '');
    const state = await evaluate('document.readyState').catch(() => '');
    if (String(href).startsWith(url.split('#')[0]) && state === 'complete') { await sleep(300); return; }
  }
  throw new Error('timeout ' + url);
}
async function openFresh(url) {
  await call('Page.navigate', { url: 'about:blank' });
  await sleep(150);
  await open(url);
}
async function expectLang(lang) {
  const got = await evaluate('document.documentElement.lang');
  if (got !== lang) throw new Error('page language is ' + got + ', expected ' + lang);
}
async function shot(name, width, height) {
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
  await sleep(200);
  const image = await call('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(art, name), Buffer.from(image.result.data, 'base64'));
}
function timed(promise, ms, label) {
  return Promise.race([promise, sleep(ms).then(() => { throw new Error('timeout ' + label); })]);
}
const createScript = `(async () => {
  window.confirm = () => true;
  const $ = id => document.getElementById(id);
  const set = (id, value) => { const el = $(id); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  $('tpl').value = 'custom';
  $('tpl').dispatchEvent(new Event('change', { bubbles: true }));
  set('title', 'Extra valve');
  set('job', 'Kitchen');
  set('desc', 'Original valve wording');
  set('biz', 'Ada Builds');
  set('client', 'Bob Client');
  set('clientContact', 'bob@example.com');
  $('addLine').click();
  const line = document.querySelector('#lines .pline');
  line.children[0].value = 'Valve';
  line.children[1].value = '120.00';
  line.children[0].dispatchEvent(new Event('input', { bubbles: true }));
  for (let n = 0; n < 4; n++) { $('next').click(); await new Promise(r => setTimeout(r, 40)); }
  $('creatorAgree').checked = true;
  window.dispatchEvent(new Event('sc-step'));
  $('typeMe').click();
  $('gen').click();
  for (let i = 0; i < 40; i++) {
    const link = $('slink');
    if (link && link.value.includes('sign.html')) return { ok: true, link: link.value, key: localStorage.getItem('sc_acct') };
    await new Promise(r => setTimeout(r, 150));
  }
  return { ok: false, msg: $('msg').textContent, step: $('stepLabel').textContent };
})()`;

let browserNote = 'not-run';
try {
  await open(ORIGIN + '/app.html#create');
  await evaluate(`localStorage.clear(); localStorage.setItem('sc_lang','en');`);
  await open(ORIGIN + '/app.html#create');
  const created = await timed(evaluate(createScript), 20000, 'create');
  t('3 browser created a pending agreement', created.ok === true);
  const again = await evaluate(`(async () => {
    document.getElementById('gen').click();
    document.getElementById('gen').click();
    await new Promise(r => setTimeout(r, 250));
    const acct = JSON.parse(localStorage.getItem('sc_acct'));
    const me = await fetch('/account/me', { headers: { Authorization: 'Bearer ' + acct.id + '.' + acct.key } }).then(r => r.json());
    return { msg: document.getElementById('msg').textContent, docs: me.docs.length };
  })()`);
  t('4 a second click does not create another copy', /already created/i.test(again.msg) && again.docs === 1);
  const originalLink = created.link;
  const originalId = new URL(originalLink.replace('#', '?'), ORIGIN).searchParams.get('d');
  const key = created.key;
  await evaluate(`location.hash='#docs'`);
  await sleep(400);
  await expectLang('en');
  await shot('v2-acceptance-docs-desktop-en.png', 1280, 800);
  const desktopFooter = await evaluate(`(() => {
    const banner = document.getElementById('cc');
    const note = document.getElementById('pageNote');
    if (!banner || banner.hidden || !note) return { present: false };
    const a = banner.getBoundingClientRect();
    const b = note.getBoundingClientRect();
    const overlap = !(a.bottom <= b.top || a.top >= b.bottom || a.right <= b.left || a.left >= b.right);
    return { present: true, overlap, note: note.innerText };
  })()`);
  t('12 desktop cookie notice does not cover the list footer', desktopFooter.present === true && desktopFooter.overlap === false && /one page at a time/i.test(desktopFooter.note || ''));
  await shot('v2-acceptance-docs-mobile-en.png', 390, 844);
  const covered = await evaluate(`(() => {
    const banner = document.getElementById('cc');
    const button = [...document.querySelectorAll('#history button')].find(el => el.textContent.trim() === 'Delete');
    const note = document.getElementById('pageNote');
    if (!banner || banner.hidden || !button || !note) return { present: false };
    const hit = (el) => { const a = banner.getBoundingClientRect(); const b = el.getBoundingClientRect(); return !(a.bottom <= b.top || a.top >= b.bottom || a.right <= b.left || a.left >= b.right); };
    return { present: true, button: hit(button), note: hit(note) };
  })()`);
  t('12 mobile cookie notice does not cover the Delete action or the list footer', covered.present === true && covered.button === false && covered.note === false);

  await open(ORIGIN + '/app.html#docs');
  const returned = await evaluate(`(async () => {
    for (let i = 0; i < 30; i++) {
      const text = document.getElementById('history').innerText;
      if (text.includes('Extra valve')) return { text, key: localStorage.getItem('sc_acct'), count: document.getElementById('count').textContent };
      await new Promise(r => setTimeout(r, 150));
    }
    return { text: document.getElementById('history').innerText, key: localStorage.getItem('sc_acct'), count: document.getElementById('count').textContent };
  })()`);
  t('1 returning reload keeps the same key and the same document', returned.key === key && returned.text.includes('Extra valve') && returned.text.includes('Bob Client'));

  const revised = await timed(evaluate(`(async () => {
    window.confirm = () => true;
    const button = [...document.querySelectorAll('#history button')].find(el => el.textContent.trim() === 'Duplicate');
    if (!button) return { ok: false, reason: 'no duplicate button', text: document.getElementById('history').innerText };
    button.click();
    await new Promise(r => setTimeout(r, 200));
    const desc = document.getElementById('desc');
    if (!desc || desc.value !== 'Original valve wording') return { ok: false, reason: 'fields not copied', value: desc && desc.value };
    desc.value = 'Revised valve wording';
    desc.dispatchEvent(new Event('input', { bubbles: true }));
    for (let n = 0; n < 4; n++) { document.getElementById('next').click(); await new Promise(r => setTimeout(r, 30)); }
    document.getElementById('creatorAgree').checked = true;
    window.dispatchEvent(new Event('sc-step'));
    document.getElementById('typeMe').click();
    document.getElementById('gen').click();
    for (let i = 0; i < 40; i++) {
      const link = document.getElementById('slink');
      if (link && link.value.includes('sign.html') && !link.value.includes(${JSON.stringify(originalId)})) return { ok: true, link: link.value };
      await new Promise(r => setTimeout(r, 150));
    }
    return { ok: false, reason: document.getElementById('msg').textContent };
  })()`), 20000, 'revise');
  t('5 Duplicate copied the original wording and a changed field created a new document', revised.ok === true);
  const revisedId = new URL(revised.link.replace('#', '?'), ORIGIN).searchParams.get('d');
  const both = await evaluate(`(async () => {
    const acct = JSON.parse(localStorage.getItem('sc_acct'));
    const me = await fetch('/account/me', { headers: { Authorization: 'Bearer ' + acct.id + '.' + acct.key } }).then(r => r.json());
    const original = me.docs.find(d => d.id === ${JSON.stringify(originalId)});
    const next = me.docs.find(d => d.id === ${JSON.stringify(revisedId)});
    return { original: original && original.fields.desc, next: next && next.fields.desc, n: me.docs.length };
  })()`);
  t('5 the original agreement text is unchanged', both.original === 'Original valve wording' && both.next === 'Revised valve wording' && both.n === 2);
  await evaluate(`location.hash='#docs'`);
  await sleep(300);
  await shot('v2-acceptance-revise-desktop-en.png', 1280, 800);
  await shot('v2-acceptance-revise-mobile-en.png', 390, 844);

  await evaluate(`localStorage.setItem('sc_lang','en')`);
  await openFresh(originalLink);
  await expectLang('en');
  const signed = await timed(evaluate(`(async () => {
    for (let i = 0; i < 30; i++) { if (!document.getElementById('review').hidden) break; await new Promise(r => setTimeout(r, 150)); }
    document.getElementById('agree').checked = true;
    window.dispatchEvent(new Event('resize'));
    document.getElementById('typeSig').click();
    let posts = 0;
    const orig = window.fetch;
    window.fetch = function (url, opts) {
      if (String(url).includes('/doc/sign') && opts && opts.method === 'POST') posts++;
      return orig.apply(this, arguments);
    };
    document.getElementById('sign').click();
    document.getElementById('sign').click();
    for (let i = 0; i < 40; i++) {
      if (!document.getElementById('done').hidden) return { ok: true, posts, status: document.querySelector('#done h1').textContent, lang: document.documentElement.lang, msg: document.getElementById('msg').textContent };
      await new Promise(r => setTimeout(r, 150));
    }
    return { ok: false, posts, msg: document.getElementById('msg').textContent, err: document.getElementById('errm').textContent };
  })()`), 20000, 'sign');
  t('6 browser consent and sign completed', signed.ok === true && signed.lang === 'en' && signed.status === 'Signed' && signed.posts === 1);
  await expectLang('en');
  await shot('v2-acceptance-sign-desktop-en.png', 1280, 800);
  await expectLang('en');
  await shot('v2-acceptance-sign-mobile-en.png', 390, 844);

  await openFresh(ORIGIN + '/verify.html?id=' + encodeURIComponent(originalId));
  await expectLang('en');
  const verified = await evaluate(`(async () => {
    for (let i = 0; i < 30; i++) {
      if (!document.getElementById('vres').hidden) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const text = document.getElementById('vrows').innerText;
    return { hidden: document.getElementById('vres').hidden, status: document.getElementById('vstat').textContent, text, msg: document.getElementById('vmsg').textContent };
  })()`);
  t('8 browser verification shows the signed identity, status, and fingerprint', verified.hidden === false && verified.status === 'Signed' && verified.text.includes(originalId) && verified.text.includes('Ada Builds') && verified.text.includes('Bob Client') && /[a-f0-9]{64}/i.test(verified.text));
  await expectLang('en');
  await shot('v2-acceptance-verify-desktop-en.png', 1280, 800);
  await expectLang('en');
  await shot('v2-acceptance-verify-mobile-en.png', 390, 844);

  await evaluate(`localStorage.setItem('sc_lang','fr')`);
  await openFresh(revised.link);
  await expectLang('fr');
  const french = await evaluate(`(async () => {
    for (let i = 0; i < 30; i++) { if (!document.getElementById('review').hidden) break; await new Promise(r => setTimeout(r, 150)); }
    const text = document.getElementById('review').innerText;
    return { text, consent: document.getElementById('agreeL').textContent };
  })()`);
  const agreementUntouched = french.text.includes('Revised valve wording');
  t('10 French signing sheet translates the chrome and leaves the agreement wording', french.text.includes('Ce changement (hausse)') && /Avenant n°\d+/.test(french.text) && !french.text.includes('{n}') && french.text.includes('Répartition du prix') && french.text.includes('Changement convenu') && french.text.includes('Affiché dans la devise') && !french.text.includes('This change (increase)') && !french.text.includes('Price breakdown') && !french.text.includes('Shown in the agreement currency') && french.consent.includes('J’accepte') && agreementUntouched);
  await expectLang('fr');
  await shot('v2-acceptance-sign-desktop-fr.png', 1280, 800);
  await expectLang('fr');
  await shot('v2-acceptance-sign-mobile-fr.png', 390, 844);

  await evaluate(`localStorage.setItem('sc_lang','en')`);
  await openFresh(revised.link);
  await expectLang('en');
  const declined = await timed(evaluate(`(async () => {
    window.confirm = () => true;
    for (let i = 0; i < 30; i++) { if (!document.getElementById('review').hidden) break; await new Promise(r => setTimeout(r, 100)); }
    document.getElementById('declineBox').open = true;
    document.getElementById('reason').value = 'Please keep the old sink.';
    document.getElementById('decline').click();
    for (let i = 0; i < 30; i++) {
      if (!document.getElementById('declined').hidden) return { ok: true, heading: document.querySelector('#declined h1').textContent };
      await new Promise(r => setTimeout(r, 150));
    }
    return { ok: false, msg: document.getElementById('dmsg').textContent, err: document.getElementById('errm').textContent };
  })()`), 20000, 'decline');
  t('7 browser decline finished without showing signed', declined.ok === true && declined.heading === 'Declined');
  await expectLang('en');
  await shot('v2-acceptance-decline-desktop-en.png', 1280, 800);
  await expectLang('en');
  await shot('v2-acceptance-decline-mobile-en.png', 390, 844);
  await open(ORIGIN + '/verify.html?id=' + encodeURIComponent(revisedId));
  const declinedVerify = await evaluate(`(async () => {
    for (let i = 0; i < 30; i++) { if (!document.getElementById('vres').hidden || document.getElementById('vmsg').textContent) break; await new Promise(r => setTimeout(r, 100)); }
    return { status: document.getElementById('vstat').textContent, hidden: document.getElementById('vres').hidden };
  })()`);
  t('7 declined verification is not shown as signed', declinedVerify.hidden === false && declinedVerify.status === 'Declined');

  const acct = JSON.parse(key);
  const removed = await mf.dispatchFetch(ORIGIN + '/doc/cancel', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', Authorization: 'Bearer ' + acct.id + '.' + acct.key, 'CF-Connecting-IP': '203.0.113.24' }, body: JSON.stringify({ d: revisedId, action: 'delete' }) });
  t('9 local delete was accepted', removed.status === 200);
  await open(ORIGIN + '/verify.html?id=' + encodeURIComponent(revisedId));
  const missing = await evaluate(`(async () => { for (let i = 0; i < 30; i++) { const text = document.getElementById('vmsg').textContent; if (text) return { text, hidden: document.getElementById('vres').hidden }; await new Promise(r => setTimeout(r, 100)); } return { text: '', hidden: false }; })()`);
  t('9 deleted verification is not a success', missing.hidden === true && /deleted/i.test(missing.text));

  await evaluate(`fetch('/__sim?down=1')`);
  await open(ORIGIN + '/verify.html?id=' + encodeURIComponent(originalId));
  const unavailable = await evaluate(`(async () => { for (let i = 0; i < 30; i++) { const text = document.getElementById('vmsg').textContent; if (text) return { text, hidden: document.getElementById('vres').hidden }; await new Promise(r => setTimeout(r, 100)); } return { text: '', hidden: false }; })()`);
  t('9 unavailable verification is not a success', unavailable.hidden === true && /can't confirm|cannot confirm/i.test(unavailable.text) && !/[a-f0-9]{64}/i.test(unavailable.text));
  await open(ORIGIN + '/app.html#docs');
  const failedList = await evaluate(`(async () => {
    for (let i = 0; i < 30; i++) {
      const el = document.getElementById('listError');
      if (el && !el.hidden && el.textContent) return { error: el.textContent, count: document.getElementById('count').textContent, key: localStorage.getItem('sc_acct') };
      await new Promise(r => setTimeout(r, 150));
    }
    return { error: '', count: document.getElementById('count').textContent, key: localStorage.getItem('sc_acct') };
  })()`);
  t('11 API failure explains the problem and does not sign the browser out', /not an empty list/i.test(failedList.error) && failedList.key === key && !/signed out/i.test(failedList.count));
  await open(ORIGIN + '/__sim?down=0');
  await open(ORIGIN + '/app.html#docs');
  await evaluate(`localStorage.setItem('sc_acct', JSON.stringify({ id: 'notarealaccount000000', key: '${'k'.repeat(43)}' }))`);
  await open(ORIGIN + '/app.html?rejected=1#docs');
  const rejected = await evaluate(`(async () => {
    let seen = '';
    for (let i = 0; i < 30; i++) {
      const el = document.getElementById('listError');
      seen = el ? el.textContent : '';
      if (el && !el.hidden && /not accepted/i.test(el.textContent)) return { error: el.textContent, count: document.getElementById('count').textContent, key: localStorage.getItem('sc_acct') };
      await new Promise(r => setTimeout(r, 150));
    }
    return { error: seen, count: document.getElementById('count').textContent, key: localStorage.getItem('sc_acct') };
  })()`);
  t('2 a rejected key is reported and does not become a free empty account', /not accepted/i.test(rejected.error) && rejected.key == null && !/first 3 documents are free/i.test(rejected.count));
  browserNote = 'headless /opt/google/chrome/chrome clicked the local app at 1280x800 and 390x844';
} catch (error) {
  browserNote = 'browser check failed: ' + (error && error.stack ? error.stack.split('\n')[0] : error);
  t('browser harness (' + browserNote + ')', false);
}
t('12 browser method: ' + browserNote, browserNote.startsWith('headless'));
try { ws.close(); } catch { /* closed */ }
chrome.kill('SIGKILL');
server.close();
await mf.dispose();
console.log(results.filter(Boolean).length + '/' + results.length);
process.exit(results.some(ok => !ok) ? 1 : 0);
