// Browser checks for display currency and optional identity. Rates are stubbed. No payment page is opened.
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Miniflare } = require('../../worker/node_modules/miniflare');

const PORT = 8766;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const site = new URL('..', import.meta.url).pathname;
const root = new URL('../..', import.meta.url).pathname;
const art = '/opt/cursor/artifacts';
mkdirSync(art, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const mf = new Miniflare({
  scriptPath: join(root, 'worker/dist/worker.js'),
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
    TOKEN_SECRET: 'trust-browser',
    FX_STUB: JSON.stringify({ amount: 1, base: 'USD', date: '2026-11-09', rates: { EUR: 0.92, GBP: 0.78, CAD: 1.38, AUD: 1.52, INR: 83.5, ZAR: 18.1 } }),
  },
});
const apiPrefix = ['/account', '/doc', '/fx'];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  if (apiPrefix.some(p => url.pathname === p || url.pathname.startsWith(p + '/'))) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v && k !== 'host') headers.set(k, Array.isArray(v) ? v.join(',') : v);
    const testCountry = headers.get('x-sc-test-cf-country');
    headers.delete('x-sc-test-cf-country');
    const cf = testCountry && /^[A-Za-z]{2}$/.test(testCountry) ? { country: testCountry.toUpperCase() } : { country: 'XX' };
    const out = await mf.dispatchFetch(ORIGIN + url.pathname + url.search, { method: req.method, headers, body: body.length ? body : undefined, cf });
    const buf = Buffer.from(await out.arrayBuffer());
    res.writeHead(out.status, { 'content-type': out.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' });
    res.end(buf);
    return;
  }
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(site, path));
  if (!file.startsWith(site) || !existsSync(file)) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn('google-chrome', [
  '--headless=new', '--remote-debugging-port=9333', '--remote-allow-origins=*', '--user-data-dir=/tmp/sc-trust-cdp',
  '--no-sandbox', '--disable-gpu', '--no-first-run',
  '--host-resolver-rules=MAP api.frankfurter.app ~NOTFOUND, MAP www.paypal.com ~NOTFOUND',
], { stdio: 'ignore' });
async function cdp() {
  for (let i = 0; i < 40; i++) {
    try { return (await (await fetch('http://127.0.0.1:9333/json/version')).json()).webSocketDebuggerUrl; }
    catch { await new Promise(r => setTimeout(r, 150)); }
  }
  throw new Error('chrome debug port did not open');
}
const ws = new WebSocket(await cdp());
await new Promise(r => ws.addEventListener('open', r));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}, sessionId) => new Promise(res => {
  const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params, sessionId }));
});
const target = await send('Target.createTarget', { url: 'about:blank' });
const sid = (await send('Target.attachToTarget', { targetId: target.result.targetId, flatten: true })).result.sessionId;
const call = (method, params) => send(method, params, sid);
await call('Page.enable');
await call('Runtime.enable');
await call('Page.addScriptToEvaluateOnNewDocument', { source: `
const orig = window.fetch.bind(window);
window.fetch = function(url, opts){
  const next = opts ? Object.assign({}, opts) : {};
  const headers = new Headers(next.headers || {});
  const country = sessionStorage.getItem('sc-cf-country');
  if (country) headers.set('x-sc-test-cf-country', country);
  next.headers = headers;
  return orig(url, next);
};` });
const results = [];
const t = (n, ok) => { results.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n); };
async function evalJs(expression) {
  const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (!r.result) throw new Error(JSON.stringify(r).slice(0, 300));
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500));
  return r.result.result.value;
}
async function go(url) {
  await call('Page.navigate', { url });
  await evalJs('new Promise(r => { if (document.readyState === "complete") r(); else addEventListener("load", () => r()); })');
  await evalJs('new Promise(r => setTimeout(r, 250))');
}
async function shot(name) {
  const r = await call('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(art, name), Buffer.from(r.result.data, 'base64'));
}
async function setSize(w, h) {
  const { windowId } = (await call('Browser.getWindowForTarget')).result;
  await call('Browser.setWindowBounds', { windowId, bounds: { width: w, height: h, windowState: 'normal' } });
  await evalJs('new Promise(r => setTimeout(r, 100))');
}

await go(ORIGIN + '/app.html?trust=1#account');
await evalJs(`sessionStorage.setItem('sc-cf-country','CM'); localStorage.removeItem('sc_display_ccy'); localStorage.removeItem('sc_acct')`);
const made = await evalJs(`(async () => { const r = await fetch('/account/new', { method: 'POST' }); const j = await r.json(); if (j.ok) localStorage.setItem('sc_acct', JSON.stringify({ id: j.id, key: j.key })); return j.ok === true; })()`);
t('browser account exists', made === true);
await go(ORIGIN + '/app.html?trust=2#account');
await evalJs(`new Promise(r => { const i = setInterval(() => { const box = document.getElementById('fxSuggest'); if (box && !box.hidden) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 4000); })`);
const suggested = await evalJs(`({ text: document.getElementById('fxSuggestText').textContent, hidden: document.getElementById('fxSuggest').hidden, display: document.getElementById('displayCcy').value, agreement: document.getElementById('currency').value })`);
t('Cameroon suggestion is offered and the agreement currency stays USD (' + suggested.text + ')', suggested.hidden === false && /XAF/.test(suggested.text) && suggested.display === 'USD' && suggested.agreement === 'USD');
await evalJs(`(() => { const b = document.getElementById('cc-reject'); if (b) b.click(); })()`);
await setSize(360, 900);
await evalJs(`(() => { document.documentElement.style.scrollBehavior = 'auto'; const el = document.getElementById('fxSuggest'); scrollTo(0, Math.max(0, el.getBoundingClientRect().top + scrollY - 16)); })()`);
await evalJs('new Promise(r => setTimeout(r, 100))');
await shot('signedchange-currency-360.png');
await setSize(1280, 900);
await evalJs(`(() => { const el = document.getElementById('displayCcy'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 16); })()`);
await evalJs('new Promise(r => setTimeout(r, 200))');
await shot('signedchange-currency-1280.png');
await evalJs(`document.getElementById('fxAccept').click()`);
const accepted = await evalJs(`({ display: document.getElementById('displayCcy').value, pref: localStorage.getItem('sc_display_ccy'), agreement: document.getElementById('currency').value })`);
t('accepting the suggestion stores it without changing the agreement currency', accepted.display === 'XAF' && /"XAF"/.test(accepted.pref) && /"chosen":true/.test(accepted.pref) && accepted.agreement === 'USD');
await evalJs(`sessionStorage.setItem('sc-cf-country','US')`);
await go(ORIGIN + '/app.html?trust=3#account');
await evalJs(`new Promise(r => setTimeout(r, 400))`);
const kept = await evalJs(`({ display: document.getElementById('displayCcy').value, hidden: document.getElementById('fxSuggest').hidden })`);
t('a later country does not replace the chosen display currency', kept.display === 'XAF' && kept.hidden === true);
await evalJs(`document.getElementById('displayCcy').value = 'EUR'; document.getElementById('displayCcy').dispatchEvent(new Event('change'))`);
await evalJs(`sessionStorage.setItem('sc-cf-country','CM')`);
await go(ORIGIN + '/app.html?trust=4#account');
await evalJs(`new Promise(r => setTimeout(r, 400))`);
const manual = await evalJs(`document.getElementById('displayCcy').value`);
t('a manual display currency stays EUR', manual === 'EUR');
await evalJs(`document.getElementById('displayCcy').value = 'XAF'; document.getElementById('displayCcy').dispatchEvent(new Event('change'))`);
await go(ORIGIN + '/app.html?trust=5#create');
await evalJs(`document.getElementById('desc').value = 'Add a valve'; document.getElementById('desc').dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('next').click();`);
await evalJs(`document.getElementById('biz').value = 'Ada'; document.getElementById('client').value = 'Bob'; document.getElementById('clientContact').value = 'bob@example.com'; ['biz','client','clientContact'].forEach(id => document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true }))); document.getElementById('next').click();`);
await evalJs(`document.getElementById('price').value = '10'; document.getElementById('currency').value = 'USD'; document.getElementById('price').dispatchEvent(new Event('input', { bubbles: true }));`);
await evalJs(`new Promise(r => setTimeout(r, 300))`);
const approx = await evalJs(`({ note: document.getElementById('fxApprox').textContent, price: document.getElementById('price').value, currency: document.getElementById('currency').value })`);
t('the preview names an approximate XAF amount and leaves USD 10 (' + approx.note + ')', /Approximate/.test(approx.note) && /2026-11-09/.test(approx.note) && /agreement stays USD/.test(approx.note) && /XAF/.test(approx.note) && approx.price === '10' && approx.currency === 'USD');
await go(ORIGIN + '/app.html?trust=6#account');
await evalJs(`new Promise(r => setTimeout(r, 300))`);
const before = await evalJs(`document.getElementById('idvStatus').textContent`);
t('identity is not started (' + before + ')', /Not started/.test(before));
await evalJs(`document.getElementById('idvConsent').checked = true; document.getElementById('idvStart').click();`);
await evalJs(`new Promise(r => setTimeout(r, 400))`);
const after = await evalJs(`({ status: document.getElementById('idvStatus').textContent, msg: document.getElementById('idvMsg').textContent, buttons: [...document.querySelectorAll('#idv button')].map(b => b.textContent) })`);
t('starting the check stays pending and the page cannot mark it verified (' + after.status + ' / ' + after.msg + ')', /Pending/.test(after.status) && /cannot become verified/.test(after.msg) && after.buttons.length === 1 && after.buttons[0] === 'Start optional check');
await evalJs(`(() => { const b = document.getElementById('cc-reject'); if (b) b.click(); })()`);
await setSize(360, 900);
const place = await evalJs(`(() => {
  document.documentElement.style.scrollBehavior = 'auto';
  const el = document.getElementById('idvStatus');
  const y = Math.max(0, el.getBoundingClientRect().top + scrollY - 24);
  scrollTo(0, y);
  return { y, after: scrollY, text: el.textContent.slice(0, 40) };
})()`);
console.log('IDENTITY PLACE ' + JSON.stringify(place));
await evalJs('new Promise(r => setTimeout(r, 250))');
await shot('signedchange-identity-360.png');
await setSize(1280, 900);
await evalJs(`(() => { const el = document.getElementById('idv'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 16); })()`);
await evalJs('new Promise(r => setTimeout(r, 200))');
await shot('signedchange-identity-1280.png');

await evalJs(`document.getElementById('displayCcy').value = 'NGN'; document.getElementById('displayCcy').dispatchEvent(new Event('change'))`);
await go(ORIGIN + '/app.html?trust=7#create');
await evalJs(`document.getElementById('desc').value = 'Add a valve'; document.getElementById('desc').dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('next').click();`);
await evalJs(`document.getElementById('biz').value = 'Ada'; document.getElementById('client').value = 'Bob'; document.getElementById('clientContact').value = 'bob@example.com'; ['biz','client','clientContact'].forEach(id => document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true }))); document.getElementById('next').click();`);
await evalJs(`document.getElementById('price').value = '10'; document.getElementById('currency').value = 'USD'; document.getElementById('price').dispatchEvent(new Event('input', { bubbles: true }));`);
await evalJs(`new Promise(r => setTimeout(r, 400))`);
const none = await evalJs(`document.getElementById('fxApprox').textContent`);
t('NGN says no conversion is available (' + none + ')', /No conversion is currently available for NGN/.test(none) && /Nothing was converted/.test(none) && /agreement stays USD/.test(none));
const stillUsd = await evalJs(`document.getElementById('currency').value === 'USD' && document.getElementById('price').value === '10'`);
t('the agreement amount is still USD 10', stillUsd === true);
await setSize(1280, 900);
await evalJs(`(() => { document.documentElement.style.scrollBehavior = 'auto'; const el = document.getElementById('fxApprox'); scrollTo(0, Math.max(0, el.getBoundingClientRect().top + scrollY - 80)); })()`);
await shot('signedchange-no-conversion-1280.png');
const opened = await evalJs(`(async () => {
  const acct = JSON.parse(localStorage.getItem('sc_acct'));
  const c = document.createElement('canvas'); c.width = 140; c.height = 50; c.getContext('2d').fillRect(0, 0, 140, 50);
  const r = await fetch('/doc/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + acct.id + '.' + acct.key }, body: JSON.stringify({ v: 3, template: 'custom', mode: 'remote', creatorSig: c.toDataURL('image/png'), fields: { biz: 'Ada', client: 'Bob', clientContact: 'bob@example.com', desc: 'Original terms', price: '10', currency: 'USD', date: '2026-11-07', title: 'Talk', job: 'Job' } }) });
  const j = await r.json();
  return j.signUrl || '';
})()`);
t('negotiation document opened', String(opened).includes('#d='));
if (String(opened).includes('#d=')) {
  await go(String(opened).replace('sign.html', 'sign.html?talk=1'));
  await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('review').hidden) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 4000); })`);
  await evalJs(`document.getElementById('counterBox').open = true; document.getElementById('counterDesc').value = 'A smaller change'; document.getElementById('counterPrice').value = '8';`);
  await setSize(1280, 900);
  await evalJs(`(() => { document.documentElement.style.scrollBehavior = 'auto'; const el = document.getElementById('counterBox'); scrollTo(0, Math.max(0, el.getBoundingClientRect().top + scrollY - 40)); })()`);
  await shot('signedchange-negotiation-1280.png');
  try { await evalJs(`document.getElementById('counter').click()`); } catch (e) { /* navigation replaces the page */ }
  let version = { label: '', msg: '', href: '' };
  for (let i = 0; i < 20; i++) {
    await evalJs('new Promise(r => setTimeout(r, 250))').catch(() => {});
    try {
      version = await evalJs(`({ label: (document.getElementById('verLabel') || {}).textContent || '', msg: (document.getElementById('cmsg') || {}).textContent || '', href: location.href })`);
      if (/Version 2/.test(version.label)) break;
    } catch (e) { version = { label: '', msg: String(e).slice(0, 120), href: '' }; }
  }
  t('the invited proposal is version 2 (' + JSON.stringify(version) + ')', /Version 2/.test(version.label));
  await shot('signedchange-negotiation-version-1280.png');
}

console.log(results.filter(Boolean).length + '/' + results.length + ' passed');
chrome.kill('SIGKILL');
server.close();
await mf.dispose();
process.exit(results.every(Boolean) ? 0 : 1);
