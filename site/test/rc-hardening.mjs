// Release-candidate checks for the customer app. Local Miniflare only.
// PayPal, analytics, and production hosts are pinned to 127.0.0.1 so this test does not contact them.
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
const keys = ['poll.confirm', 'poll.signed', 'poll.signedToast', 'sign.network', 'sign.invalid', 'session.rejected', 'session.signedout', 'create.same', 'status.confirming', 'verify.missing', 'verify.down', 'verify.l.content', 'review.from'];
t('1 i18n keys exist in English and French and the French is not a copy', keys.every(key => en[key] && fr[key] && fr[key] !== en[key] && fr[key] !== key));
t('1 confirming status is a sentence, not the raw key', en['poll.confirm'] !== 'poll.confirm' && !en['poll.confirm'].includes('poll.'));

const PORT = 8774;
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
    TOKEN_SECRET: 'rc-local',
  },
});
const apiPrefix = ['/account', '/doc', '/fx'];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  if (apiPrefix.some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + '/'))) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    headers.set('CF-Connecting-IP', '203.0.113.14');
    const response = await mf.dispatchFetch(ORIGIN + url.pathname + url.search, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks) });
    const body = Buffer.from(await response.arrayBuffer());
    const out = { 'content-type': response.headers.get('content-type') || 'application/json' };
    res.writeHead(response.status, out);
    res.end(body);
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
  '--remote-debugging-port=9348', '--remote-allow-origins=*',
  '--user-data-dir=/tmp/sc-rc-chrome-' + process.pid,
  '--host-resolver-rules=MAP www.paypal.com 127.0.0.1, MAP www.paypalobjects.com 127.0.0.1, MAP www.googletagmanager.com 127.0.0.1, MAP static.cloudflareinsights.com 127.0.0.1, MAP www.google-analytics.com 127.0.0.1',
], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function cdpUrl() {
  for (let i = 0; i < 40; i++) {
    try { return (await (await fetch('http://127.0.0.1:9348/json/version')).json()).webSocketDebuggerUrl; }
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
  if (message.result.exceptionDetails) throw new Error(message.result.exceptionDetails.text || 'evaluate failed');
  return message.result.result.value;
}
async function open(url) {
  await call('Page.navigate', { url });
  for (let i = 0; i < 80; i++) {
    await sleep(100);
    const href = await evaluate('location.href').catch(() => '');
    const state = await evaluate('document.readyState').catch(() => '');
    if (String(href).startsWith(url.split('#')[0]) && state === 'complete') { await sleep(250); return; }
  }
  throw new Error('timeout ' + url);
}
async function shot(name, width, height) {
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
  await sleep(200);
  const image = await call('Page.captureScreenshot', { format: 'png' });
  const file = join(art, name);
  writeFileSync(file, Buffer.from(image.result.data, 'base64'));
  return file;
}
async function overflow() {
  return evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2');
}

let browserNote = 'not-run';
try {
  const bad = JSON.stringify({ id: 'notarealaccount000000', key: 'k'.repeat(43) });
  const injected = await call('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('sc_lang','en');localStorage.setItem('sc_acct',${JSON.stringify(bad)});}catch(e){}` });
  await open(ORIGIN + '/app.html');
  const rejected = await evaluate(`(async () => { for (let i = 0; i < 30; i++) { const el = document.getElementById('listError'); if (el && !el.hidden && /not accepted/i.test(el.textContent)) return { error: el.textContent, count: document.getElementById('count').textContent, key: localStorage.getItem('sc_acct') }; await new Promise(r => setTimeout(r, 150)); } return { error: (document.getElementById('listError')||{}).textContent || '', count: (document.getElementById('count')||{}).textContent || '', key: localStorage.getItem('sc_acct') }; })()`);
  t('2 a rejected account key signs the browser out and says so', /not accepted/i.test(rejected.error) && /signed out/i.test(rejected.count) && rejected.key == null && !/first 3 documents are free/i.test(rejected.count));
  await shot('v2-rc-session-mobile-en.png', 390, 844);
  t('11 session screen does not overflow at 390px', await overflow());
  await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected.result.identifier });

  await evaluate(`localStorage.clear(); localStorage.setItem('sc_lang','en');`);
  await open(ORIGIN + '/app.html#create');
  await shot('v2-rc-create-desktop-en.png', 1280, 800);
  t('11 create screen does not overflow at 1280px', await overflow());
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await shot('v2-rc-create-mobile-en.png', 390, 844);
  t('11 create screen does not overflow at 390px', await overflow());
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  const created = await Promise.race([evaluate(`(async () => {
    window.confirm = () => false;
    const $ = id => document.getElementById(id);
    const set = (id, value) => { const el = $(id); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    $('tpl').value = 'custom';
    $('tpl').dispatchEvent(new Event('change', { bubbles: true }));
    set('title', 'Extra valve');
    set('job', 'Kitchen');
    set('desc', 'Move the sink and add one valve.');
    set('biz', 'Ada Builds');
    set('client', 'Bob Client');
    set('clientContact', 'bob@example.com');
    set('price', '120.00');
    for (let n = 0; n < 4; n++) { $('next').click(); await new Promise(r => setTimeout(r, 50)); }
    $('creatorAgree').checked = true;
    window.dispatchEvent(new Event('sc-step'));
    $('typeMe').click();
    $('gen').click();
    for (let i = 0; i < 40; i++) {
      const link = $('slink');
      if (link && link.value.includes('sign.html')) return { ok: true, link: link.value, msg: $('msg').textContent };
      await new Promise(r => setTimeout(r, 150));
    }
    return { ok: false, msg: $('msg').textContent, step: $('stepLabel').textContent };
  })()`), sleep(20000).then(() => { throw new Error('create timed out'); })]);
  t('3 and 4 a validated agreement is created from the form', created.ok === true);
  const again = await evaluate(`(async () => {
    document.getElementById('gen').click();
    await new Promise(r => setTimeout(r, 200));
    const acct = JSON.parse(localStorage.getItem('sc_acct'));
    const me = await fetch('/account/me', { headers: { Authorization: 'Bearer ' + acct.id + '.' + acct.key } }).then(r => r.json());
    return { msg: document.getElementById('msg').textContent, docs: me.docs.length };
  })()`);
  t('4 the same form is not submitted twice', /already created/i.test(again.msg) && again.docs === 1);
  const id = new URL(created.link.replace('#', '?'), ORIGIN).searchParams.get('d');
  await evaluate(`location.hash = '#docs'`);
  await sleep(300);
  const opened = await evaluate(`(async () => {
    const button = document.querySelector('#history .hdoc button');
    if (!button) return { open: false };
    button.click();
    await new Promise(r => setTimeout(r, 300));
    return { open: document.getElementById('detail').hidden === false && document.getElementById('history').hidden === true, title: document.getElementById('detailTitle').textContent };
  })()`);
  t('5 opening a document shows its detail', opened.open === true && /valve/i.test(opened.title || ''));
  const back = await evaluate(`(async () => {
    document.getElementById('nav-docs').click();
    await new Promise(r => setTimeout(r, 100));
    return { detail: document.getElementById('detail').hidden, list: document.getElementById('history').hidden };
  })()`);
  t('5 Documents returns from the detail to the list', back.detail === true && back.list === false);
  await shot('v2-rc-docs-desktop-en.png', 1280, 800);
  await shot('v2-rc-docs-mobile-en.png', 390, 844);
  t('11 document list does not overflow at 390px', await overflow());

  const removed = await evaluate(`(async () => {
    const acct = JSON.parse(localStorage.getItem('sc_acct'));
    const response = await fetch('/doc/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + acct.id + '.' + acct.key }, body: JSON.stringify({ d: ${JSON.stringify(id)}, action: 'delete' }) });
    return response.status;
  })()`);
  t('8 delete request is accepted by the local API', removed === 200);
  await evaluate(`localStorage.setItem('sc_lang','fr')`);
  await open(ORIGIN + '/verify.html?id=' + encodeURIComponent(id));
  const missing = await evaluate(`(async () => { for (let i = 0; i < 30; i++) { const text = document.getElementById('vmsg').textContent; if (text) return text; await new Promise(r => setTimeout(r, 100)); } return ''; })()`);
  t('7 and 8 and 10 a deleted document is explained in French', /supprim/i.test(missing));
  await shot('v2-rc-verify-desktop-fr.png', 1280, 800);
  await shot('v2-rc-verify-mobile-fr.png', 390, 844);
  t('11 verify screen does not overflow at 390px', await overflow());

  await open(ORIGIN + '/sign.html#d=aaaaaaaaaaaaaaaaaaaa&t=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  const invalid = await evaluate(`(async () => { for (let i = 0; i < 30; i++) { const el = document.getElementById('errm'); if (el && el.textContent) return el.textContent; await new Promise(r => setTimeout(r, 100)); } return ''; })()`);
  t('6 and 10 an invalid signing link is explained in French', /lien de signature/i.test(invalid) && /valide/i.test(invalid));
  await shot('v2-rc-sign-mobile-fr.png', 390, 844);
  t('11 sign screen does not overflow at 390px', await overflow());
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await shot('v2-rc-sign-desktop-fr.png', 1280, 800);
  browserNote = 'headless /opt/google/chrome/chrome rendered the local app at 1280x800 and 390x844; PayPal and analytics hosts were pinned to 127.0.0.1';
} catch (error) {
  browserNote = 'browser check failed: ' + error.message;
  t('browser harness (' + error.message + ')', false);
}
t('11 browser method: ' + browserNote, browserNote.startsWith('headless'));

try { ws.close(); } catch { /* already closed */ }
chrome.kill('SIGKILL');
server.close();
await mf.dispose();
console.log(results.filter(Boolean).length + '/' + results.length);
process.exit(results.some(ok => !ok) ? 1 : 0);
