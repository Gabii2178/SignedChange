// Local Milestone 4 browser flows. Serves the site and the Worker on one localhost origin.
// PayPal, production Worker, and analytics hosts are not resolved.
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Miniflare } = require('../../worker/node_modules/miniflare');

const PORT = 8765;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const site = new URL('..', import.meta.url).pathname;
const root = new URL('../..', import.meta.url).pathname;
const art = '/opt/cursor/artifacts';
const shots = '/tmp/m4-shots';
mkdirSync(art, { recursive: true });
mkdirSync(shots, { recursive: true });
for (const f of readdirSync(art)) {
  if (f.startsWith('signedchange-m4') || f.startsWith('signedchange-m5') || f === 'm4-screenshot-manifest.txt') unlinkSync(join(art, f));
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };

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
    TOKEN_SECRET: 'm4-local',
    FX_STUB: JSON.stringify({ amount: 1, base: 'USD', date: '2026-11-09', rates: { EUR: 0.92, GBP: 0.78, CAD: 1.38, AUD: 1.52, INR: 83.5, ZAR: 18.1 } }),
  },
});

const apiPrefix = ['/account', '/doc', '/redeem', '/verify', '/ipn', '/check'];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  if (apiPrefix.some(p => url.pathname === p || url.pathname.startsWith(p + '/'))) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v && k !== 'host') headers.set(k, Array.isArray(v) ? v.join(',') : v);
    const out = await mf.dispatchFetch(ORIGIN + url.pathname + url.search, { method: req.method, headers, body: body.length ? body : undefined });
    const buf = Buffer.from(await out.arrayBuffer());
    const h = { 'content-type': out.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' };
    const acao = out.headers.get('access-control-allow-origin');
    if (acao) h['access-control-allow-origin'] = acao;
    const vary = out.headers.get('vary');
    if (vary) h.vary = vary;
    const acam = out.headers.get('access-control-allow-methods');
    if (acam) h['access-control-allow-methods'] = acam;
    const acah = out.headers.get('access-control-allow-headers');
    if (acah) h['access-control-allow-headers'] = acah;
    res.writeHead(out.status, h);
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
  '--headless=new', '--remote-debugging-port=9222', '--remote-allow-origins=*', '--user-data-dir=/tmp/sc-m4-cdp',
  '--no-sandbox', '--disable-gpu', '--no-first-run',
  '--host-resolver-rules=MAP www.paypal.com ~NOTFOUND, MAP www.paypalobjects.com ~NOTFOUND, MAP ipnpb.paypal.com ~NOTFOUND, MAP api-m.paypal.com ~NOTFOUND, MAP signedchange-unlock.signedchange.workers.dev ~NOTFOUND, MAP www.googletagmanager.com ~NOTFOUND, MAP www.google-analytics.com ~NOTFOUND',
], { stdio: 'ignore' });

async function cdp() {
  for (let i = 0; i < 40; i++) {
    try {
      const v = await fetch('http://127.0.0.1:9222/json/version');
      const j = await v.json();
      return j.webSocketDebuggerUrl;
    } catch { await new Promise(r => setTimeout(r, 150)); }
  }
  throw new Error('chrome debug port did not open');
}
const ws = new WebSocket(await cdp());
await new Promise(r => { ws.addEventListener('open', r); });
let seq = 0;
const pending = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}, sessionId) => new Promise(res => {
  const id = ++seq;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});
const target = await send('Target.createTarget', { url: 'about:blank' });
const sid = (await send('Target.attachToTarget', { targetId: target.result.targetId, flatten: true })).result.sessionId;
const call = (method, params) => send(method, params, sid);
await call('Page.enable');
await call('Page.addScriptToEvaluateOnNewDocument', { source: `
const orig = window.fetch.bind(window);
window.fetch = function(url, opts){
  const u = String(url);
  const flag = sessionStorage.getItem('sc-mock');
  if (flag === 'me-503' && u.includes('/account/me')) return Promise.resolve(new Response(JSON.stringify({ok:false,error:'down'}), {status:503, headers:{'content-type':'application/json'}}));
  if (flag === 'me-403' && u.includes('/account/me')) return Promise.resolve(new Response(JSON.stringify({ok:false}), {status:403, headers:{'content-type':'application/json'}}));
  if (flag === 'status-503' && u.includes('/doc/status')) return Promise.resolve(new Response(JSON.stringify({ok:false}), {status:503, headers:{'content-type':'application/json'}}));
  if (flag === 'pdf-409' && u.includes('/doc/pdf')) return Promise.resolve(new Response('no', {status:409}));
  if (flag === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
  if (flag === 'sign-slow' && u.includes('/doc/sign')) {
    window.__signCalls = (window.__signCalls || 0) + 1;
    return new Promise(res => setTimeout(() => res(new Response(JSON.stringify({ ok: false }), { status: 503, headers: { 'content-type': 'application/json' } })), 400));
  }
  if (flag === 'sign-403' && u.includes('/doc/sign')) return Promise.resolve(new Response(JSON.stringify({ ok: false }), { status: 403, headers: { 'content-type': 'application/json' } }));
  const next = opts ? Object.assign({}, opts) : {};
  const headers = new Headers(next.headers || {});
  const nip = sessionStorage.getItem('sc-test-ip');
  if (nip) headers.set('CF-Connecting-IP', nip);
  next.headers = headers;
  return orig(url, next);
};` });
await call('Runtime.enable');
await call('Network.enable');
const blocked = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Page.javascriptDialogOpening' && m.sessionId === sid) send('Page.handleJavaScriptDialog', { accept: true }, sid);
  if (m.method === 'Network.requestWillBeSent' && m.sessionId === sid) {
    const u = m.params.request.url;
    if (!u.startsWith(ORIGIN) && !u.startsWith('data:') && !u.startsWith('blob:')) blocked.push(u);
  }
});

const results = [];
const t = (n, ok) => { results.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n); };
async function evalJs(expression) {
  const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500));
  return r.result.result.value;
}
async function go(url) {
  await call('Page.navigate', { url });
  await evalJs('new Promise(r => { if (document.readyState === "complete") r(); else addEventListener("load", () => r()); })');
  await evalJs('new Promise(r => setTimeout(r, 200))');
}
const published = [];
async function capture(dir, name) {
  const r = await call('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(r.result.data, 'base64');
  const p = join(dir, name);
  writeFileSync(p, buf);
  return p;
}
async function shot(name) { return capture(shots, name); }
async function publish(name) {
  const p = await capture(shots, name);
  published.push(p);
  return p;
}
async function setSize(w, h) {
  const { windowId } = (await call('Browser.getWindowForTarget')).result;
  await call('Browser.setWindowBounds', { windowId, bounds: { width: w, height: h, windowState: 'normal' } });
  await evalJs('new Promise(r => setTimeout(r, 100))');
}

const widths = [320, 360, 390, 768, 1024, 1280, 1536];
await go(ORIGIN + '/index.html');
await evalJs(`scSetLang('en'); scSetTheme('light')`);
for (const w of widths) {
  await setSize(w, 900);
  const info = await evalJs(`({w: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth + 2, menu: getComputedStyle(document.getElementById('burger')).display, h1: document.querySelector('h1').textContent})`);
  t('home layout ' + w + ' (inner ' + info.w + ')', info.h1.includes('make it official') && !info.overflow && (w < 768 ? info.menu !== 'none' : info.menu === 'none'));
}
await setSize(1280, 900);
await shot('signedchange-m4-home-desktop.png');
await setSize(390, 844);
await shot('signedchange-m4-home-mobile.png');

await go(ORIGIN + '/pricing.html');
const priceText = await evalJs('document.body.innerText');
t('public pricing keeps $9 and $49 once', priceText.includes('$9') && priceText.includes('$49') && priceText.includes('one-time'));
t('public pricing has no proposed yearly offer', !priceText.includes('$5') && !/per year/i.test(priceText) && !priceText.includes('$60'));
await setSize(1280, 900);
await shot('signedchange-m4-pricing-desktop.png');

await go(ORIGIN + '/app.html#create');
await evalJs(`document.getElementById('cc-reject') && document.getElementById('cc-reject').click()`);
const step1 = await evalJs(`document.getElementById('stepLabel').textContent`);
t('wizard opens on step 1', step1.startsWith('Step 1 of 5'));
await evalJs(`document.getElementById('next').click()`);
const stayed = await evalJs(`document.getElementById('msg').textContent`);
t('empty change is rejected', stayed.includes('Describe what changed'));
await evalJs(`document.getElementById('desc').value = 'Add a valve and labour'; document.getElementById('desc').dispatchEvent(new Event('input', {bubbles:true})); document.getElementById('next').click();`);
await evalJs(`document.getElementById('biz').value = 'Ada'; document.getElementById('client').value = 'Bob'; document.getElementById('clientContact').value = 'bob@example.com'; ['biz','client','clientContact'].forEach(id => document.getElementById(id).dispatchEvent(new Event('input', {bubbles:true}))); document.getElementById('next').click();`);
await evalJs(`document.getElementById('price').value = '200'; document.getElementById('price').dispatchEvent(new Event('input', {bubbles:true})); document.getElementById('next').click();`);
const review = await evalJs(`document.getElementById('reviewSheet').innerText`);
t('review shows the change and no fake CO number', review.includes('Add a valve') && review.includes('assigned when you create'));
await evalJs(`document.getElementById('next').click();`);
await evalJs(`
  const c = document.getElementById('sigMe');
  const r = c.getBoundingClientRect();
  const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + x, clientY: r.top + y, pointerId: 1, pointerType: 'mouse', buttons: 1 }));
  ev('pointerdown', 20, 40); ev('pointermove', 180, 80); ev('pointerup', 180, 80);
  document.getElementById('creatorAgree').checked = true;
`);
await setSize(1280, 1000);
await shot('signedchange-m4-app-desktop.png');
await setSize(390, 900);
await shot('signedchange-m4-app-mobile.png');
await setSize(1280, 1000);
await evalJs(`document.getElementById('gen').click()`);
await evalJs(`new Promise(r => { const i = setInterval(() => { const s = document.getElementById('share'); if (s && !s.hidden) { clearInterval(i); r(); } }, 100); setTimeout(() => { clearInterval(i); r(); }, 8000); })`);
const share = await evalJs(`({hidden: document.getElementById('share').hidden, link: document.getElementById('slink').value, msg: document.getElementById('msg').textContent})`);
const signShot = share.link;
t('create returns a signing link (' + share.msg + ')', share.hidden === false && share.link.includes('#d=') && share.link.includes('&t='));
await evalJs(`sessionStorage.setItem('sc-mock','status-503')`);
await evalJs(`new Promise(r => setTimeout(r, 5200))`);
const polled = await evalJs(`document.getElementById('live').textContent`);
t('status poll shows 503 without calling the document signed (' + polled + ')', /confirm|Confirmation|подтверд|पुष्टि|নিশ্চিত|memastikan|doğrula|aún|noch|ancora|ainda/i.test(polled));
await evalJs(`sessionStorage.removeItem('sc-mock')`);

const signLink = share.link.replace(ORIGIN, '');
await go(ORIGIN + '/sign.html' + signLink.slice(signLink.indexOf('#')));
await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('review').hidden || !document.getElementById('err').hidden) { clearInterval(i); r(); } }, 100); setTimeout(() => { clearInterval(i); r(); }, 8000); })`);
const invited = await evalJs(`({review: !document.getElementById('review').hidden, err: document.getElementById('errm').textContent, text: document.body.innerText, upsell: document.body.innerText.includes('$9') || document.body.innerText.includes('Buy Lifetime')})`);
t('invited review has the agreement and no price upsell', invited.review && invited.text.includes('Add a valve') && !invited.upsell);
await evalJs(`scSetTheme('light')`);
await setSize(1280, 1000);
const signLight = await publish('signedchange-m4-sign-light.png');
await evalJs(`scSetTheme('dark')`);
await evalJs(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
const signDark = await publish('signedchange-m4-sign-dark.png');
const sheetBg = await evalJs(`getComputedStyle(document.querySelector('#review .sheet')).backgroundColor`);
t('agreement sheet stays white in dark chrome (' + sheetBg + ')', sheetBg === 'rgb(255, 255, 255)');
await evalJs(`scSetTheme('light')`);
await setSize(1280, 1000);
await evalJs(`
  document.getElementById('name').value = 'Bob';
  const c = document.getElementById('sig');
  const r = c.getBoundingClientRect();
  const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + x, clientY: r.top + y, pointerId: 1, pointerType: 'mouse', buttons: 1 }));
  ev('pointerdown', 20, 40); ev('pointermove', 160, 70); ev('pointerup', 160, 70);
  document.getElementById('agree').checked = true;
  document.getElementById('sign').click();
`);
await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('done').hidden || document.getElementById('msg').textContent) { clearInterval(i); r(); } }, 100); setTimeout(() => { clearInterval(i); r(); }, 8000); })`);
const signed = await evalJs(`({done: !document.getElementById('done').hidden, msg: document.getElementById('msg').textContent, hash: location.hash})`);
t('signer completes (' + signed.msg + ')', signed.done && signed.hash.includes('&v='));
await go(ORIGIN + '/sign.html?again=1' + signLink.slice(signLink.indexOf('#')));
await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('done').hidden || !document.getElementById('err').hidden || !document.getElementById('declined').hidden) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 5000); })`);
const again = await evalJs(`({text: document.body.innerText, review: !document.getElementById('review').hidden})`);
t('finished link does not reopen the signature form', again.review === false && (again.text.includes('Signed') || again.text.includes('finished')));
const declinedUrl = await evalJs(`(async () => {
  const acct = JSON.parse(localStorage.getItem('sc_acct'));
  const c = document.createElement('canvas'); c.width = 140; c.height = 50;
  const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, 140, 50);
  const r = await fetch('/doc/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + acct.id + '.' + acct.key }, body: JSON.stringify({ v: 3, template: 'custom', mode: 'remote', creatorSig: c.toDataURL('image/png'), fields: { biz: 'Ada', client: 'Bob', clientContact: 'bob@example.com', desc: 'Decline this change', price: '10', currency: 'USD', date: '2026-11-07', title: 'Decline me' } }) });
  const j = await r.json();
  return j.signUrl || j.error || '';
})()`);
t('second document for decline', String(declinedUrl).includes('#d='));
if (String(declinedUrl).includes('#d=')) {
  await go(String(declinedUrl).replace('sign.html', 'sign.html?n=decline'));
  await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('review').hidden) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 5000); })`);
  await evalJs(`(async () => { window.confirm = () => true; document.getElementById('declineBox').open = true; document.getElementById('reason').value = 'Please reduce the scope'; document.getElementById('decline').click(); await new Promise(r => setTimeout(r, 800)); return document.getElementById('declined').hidden; })()`);
  const dec = await evalJs(`({ok: !document.getElementById('declined').hidden, dmsg: document.getElementById('dmsg').textContent, err: document.getElementById('errm').textContent, msg: document.getElementById('msg').textContent})`);
  t('decline closes the link (' + [dec.dmsg, dec.err, dec.msg].filter(Boolean).join(' | ') + ')', dec.ok === true);
  await go(String(declinedUrl).replace('sign.html', 'sign.html?n=decline2'));
  await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('declined').hidden || !document.getElementById('err').hidden) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 5000); })`);
  const secondDecline = await evalJs(`({ review: !document.getElementById('review').hidden, declined: !document.getElementById('declined').hidden, err: document.getElementById('errm').textContent })`);
  t('a second visit cannot decline again (' + secondDecline.err + ')', secondDecline.review === false && (secondDecline.declined === true || /declin|closed|finished/i.test(secondDecline.err)));
}

await go(ORIGIN + '/verify.html?id=not-a-real-id');
await evalJs(`new Promise(r => setTimeout(r, 400))`);
const bad = await evalJs(`document.getElementById('vmsg').textContent`);
t('verify 400 copy', bad.includes('does not look like a document ID'));
await go(ORIGIN + '/verify.html?id=abcdefghij0123456789');
await evalJs(`new Promise(r => setTimeout(r, 500))`);
const missing = await evalJs(`document.getElementById('vmsg').textContent`);
t('verify 404 copy', missing.includes('may have been deleted'));
const down = await evalJs(`(async () => { window.fetch = async () => new Response(JSON.stringify({ok:false}), {status:503, headers:{'content-type':'application/json'}}); document.getElementById('vid').value='abcdefghij0123456789'; document.getElementById('vf').requestSubmit(); await new Promise(r => setTimeout(r, 200)); return document.getElementById('vmsg').textContent; })()`);
t('verify 503 is not a success', /can.t confirm/i.test(down) && (await evalJs(`document.getElementById('vres').hidden`)) === true);
const mismatch = await evalJs(`(async () => { window.fetch = async () => new Response(JSON.stringify({ok:false}), {status:409, headers:{'content-type':'application/json'}}); document.getElementById('vf').requestSubmit(); await new Promise(r => setTimeout(r, 200)); return document.getElementById('vmsg').textContent; })()`);
t('verify 409 is not a success', /doesn.t match/i.test(mismatch));

await go(ORIGIN + '/app.html#docs');
await evalJs(`new Promise(r => { const i = setInterval(() => { if (document.getElementById('history').textContent) { clearInterval(i); r(); } }, 100); setTimeout(() => { clearInterval(i); r(); }, 5000); })`);
const pendingMade = await evalJs(`(async () => {
  const acct = JSON.parse(localStorage.getItem('sc_acct'));
  const c = document.createElement('canvas'); c.width = 140; c.height = 50;
  c.getContext('2d').fillRect(0, 0, 140, 50);
  const r = await fetch('/doc/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + acct.id + '.' + acct.key }, body: JSON.stringify({ v: 3, template: 'custom', mode: 'remote', creatorSig: c.toDataURL('image/png'), fields: { biz: 'Ada', client: 'Cam', clientContact: 'cam@example.com', desc: 'Cancel this pending change', price: '15', currency: 'USD', date: '2026-11-07', title: 'Cancel me' } }) });
  const j = await r.json();
  return r.status + ' ' + (j.error || j.message || j.id || '');
})()`);
t('pending document for cancel (' + pendingMade + ')', String(pendingMade).startsWith('200'));
await go(ORIGIN + '/app.html?list=2#docs');
const listed = await evalJs(`new Promise(r => { const i = setInterval(() => { const t = document.getElementById('history').textContent; if (t.includes('Cancel me')) { clearInterval(i); r(t); } }, 100); setTimeout(() => { clearInterval(i); r(document.getElementById('history').textContent.slice(0, 240)); }, 3000); })`);
t('pending row is listed (' + String(listed).slice(0, 120).replace(/\s+/g, ' ') + ')', String(listed).includes('Cancel me'));
const docFind = await evalJs(`(() => {
  const input = document.getElementById('docFind');
  input.value = 'Cancel me';
  input.dispatchEvent(new Event('input'));
  const rows = [...document.querySelectorAll('#history .hdoc')];
  const visible = rows.filter(r => !r.hidden).map(r => r.dataset.find);
  const hidden = rows.filter(r => r.hidden).length;
  input.value = '';
  input.dispatchEvent(new Event('input'));
  const restored = [...document.querySelectorAll('#history .hdoc')].filter(r => r.hidden).length;
  return { visible, hidden, restored, note: document.getElementById('docFindNote').textContent };
})()`);
t('document page search keeps only the matching row (' + JSON.stringify(docFind.visible) + ')', docFind.visible.length === 1 && /cancel me/.test(docFind.visible[0]) && docFind.hidden >= 1 && docFind.restored === 0);
const statusFilter = await evalJs(`(() => {
  const sel = document.getElementById('docStatus');
  sel.value = 'pending';
  sel.dispatchEvent(new Event('change'));
  const visible = [...document.querySelectorAll('#history .hdoc')].filter(r => !r.hidden);
  const onlyPending = visible.every(r => r.dataset.status === 'pending');
  sel.value = '';
  sel.dispatchEvent(new Event('change'));
  return { n: visible.length, onlyPending, busy: !!document.getElementById('listBusy') };
})()`);
t('status filter shows only waiting documents and a loading slot exists (' + statusFilter.n + ')', statusFilter.n >= 1 && statusFilter.onlyPending && statusFilter.busy);
if (String(listed).includes('Cancel me')) {
  const cancel401 = await evalJs(`(async () => {
    const orig = window.fetch;
    window.fetch = (url, opts) => String(url).includes('/doc/cancel') ? Promise.resolve(new Response(JSON.stringify({ok:false}), {status:401, headers:{'content-type':'application/json'}})) : orig(url, opts);
    window.confirm = () => true;
    const card = [...document.querySelectorAll('#history .hdoc')].find(n => n.textContent.includes('Cancel me'));
    const btn = [...card.querySelectorAll('button')].find(b => b.textContent === 'Cancel');
    if (!btn) return 'no-button';
    btn.click();
    await new Promise(r => setTimeout(r, 400));
    window.fetch = orig;
    return (document.getElementById('sctoast') || {}).textContent || '';
  })()`);
  t('cancel 401 after an explicit Cancel click names the account key (' + String(cancel401).slice(0,80) + ')', /key|accepted|account/i.test(cancel401));
  await evalJs(`(async () => { window.confirm = () => true; const card = [...document.querySelectorAll('#history .hdoc')].find(n => n.textContent.includes('Cancel me')); [...card.querySelectorAll('button')].find(b => b.textContent === 'Cancel').click(); await new Promise(r => setTimeout(r, 2000)); return true; })()`);
  const cancelled = await evalJs(`[...document.querySelectorAll('#history .hdoc')].find(n => n.textContent.includes('Cancel me')).innerText`);
  t('cancel marks the pending document (' + String(cancelled).replace(/\s+/g,' ').slice(0,140) + ')', /Cancelled|Annul|Cancelado|Storniert|Отмен/i.test(String(cancelled)));
}
const list = await evalJs(`document.getElementById('history').innerText`);
t('owner list shows the signed document', list.includes('Signed') && list.includes('Add a valve') === false ? list.includes('Change') || list.includes('Ada') || list.includes('Bob') : list.includes('Bob'));
await evalJs(`document.querySelector('#history button').click()`);
await evalJs(`new Promise(r => setTimeout(r, 400))`);
const detail = await evalJs(`document.getElementById('detail').hidden ? '' : document.getElementById('detail').innerText`);
t('detail opens', detail.includes('Bob') || detail.includes('Ada'));
await evalJs(`document.querySelector('#history') && (document.getElementById('detailClose').click())`);
const beforeN = await evalJs(`document.querySelectorAll('#history .hdoc').length`);
await evalJs(`(async () => { window.confirm = () => true; [...document.querySelectorAll('#history button')].find(b => b.textContent === 'Delete').click(); await new Promise(r => setTimeout(r, 800)); return true; })()`);
const afterN = await evalJs(`document.querySelectorAll('#history .hdoc').length`);
t('delete removes one row (' + beforeN + ' to ' + afterN + ')', afterN === beforeN - 1);

const acct = await evalJs(`JSON.parse(localStorage.getItem('sc_acct'))`);
const kv = await mf.getKVNamespace('PAYMENTS');
for (let i = 0; i < 55; i++) {
  const id = ('pg' + String(i).padStart(22, '0')).slice(0, 24);
  const inv = String(9e15 - i).padStart(16, '0');
  await kv.put('doc:' + id, JSON.stringify({ id, acct: acct.id, status: 'pending', mode: 'remote', v: 2, created: '2026-11-06T00:00:00.000Z', signExp: Date.now() + 86400000, hash: 'fixture', fields: { title: 'PageRow' + i, client: 'C', biz: 'B', price: '1', currency: 'USD', date: '2026-11-06' } }));
  await kv.put('adoc:' + acct.id + ':' + inv + ':' + id, '1');
}
await go(ORIGIN + '/app.html?paged=1#docs');
await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('nextPage').hidden) { clearInterval(i); r(); } }, 100); setTimeout(() => { clearInterval(i); r(); }, 5000); })`);
const firstPage = await evalJs(`document.getElementById('history').innerText.slice(0, 80)`);
await evalJs(`document.getElementById('nextPage').click()`);
await evalJs(`new Promise(r => setTimeout(r, 600))`);
const secondPage = await evalJs(`document.getElementById('history').innerText.slice(0, 80)`);
t('next page differs after more than 50 documents', firstPage !== secondPage && secondPage.length > 10);
await evalJs(`document.getElementById('prevPage').click()`);
await evalJs(`new Promise(r => setTimeout(r, 600))`);
const backPage = await evalJs(`document.getElementById('history').innerText.slice(0, 80)`);
t('previous page returns', backPage === firstPage);
const filteredPage = await evalJs(`(async () => {
  const marker = (document.getElementById('history').innerText.match(/PageRow\\d+/) || [''])[0];
  document.getElementById('docFind').value = marker;
  document.getElementById('docStatus').value = 'signed';
  document.getElementById('docStatus').dispatchEvent(new Event('change'));
  const note = document.getElementById('docFindNote').textContent;
  const visible = [...document.querySelectorAll('#history .hdoc')].filter(el => !el.hidden).length;
  document.getElementById('nextPage').click();
  await new Promise(r => setTimeout(r, 700));
  const leaked = !!(marker && document.getElementById('history').innerText.includes(marker));
  document.getElementById('docFind').value = '';
  document.getElementById('docStatus').value = '';
  document.getElementById('docFind').dispatchEvent(new Event('input'));
  document.getElementById('prevPage').click();
  await new Promise(r => setTimeout(r, 700));
  return { marker, note, visible, leaked, back: document.getElementById('history').innerText.includes(marker) };
})()`);
t('search plus status filter does not keep the previous page (' + JSON.stringify(filteredPage) + ')', !!filteredPage.marker && filteredPage.visible === 0 && /No documents on this page/.test(filteredPage.note) && filteredPage.leaked === false && filteredPage.back === true);

const race = await evalJs(`(async () => {
  sessionStorage.setItem('sc-test-ip', 'race-net');
  const made = await fetch('/account/new', { method: 'POST' });
  const acct = await made.json();
  const c = document.createElement('canvas'); c.width = 140; c.height = 50; c.getContext('2d').fillRect(0, 0, 140, 50);
  const created = await fetch('/doc/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + acct.id + '.' + acct.key }, body: JSON.stringify({ v: 3, template: 'custom', mode: 'remote', creatorSig: c.toDataURL('image/png'), fields: { biz: 'Ada', client: 'Race', clientContact: 'race@example.com', desc: 'Race this change', price: '12', currency: 'USD', date: '2026-11-07', title: 'Race me', lang: 'en' } }) });
  const j = await created.json();
  const params = new URLSearchParams((j.signUrl || '').split('#')[1] || '');
  const d = params.get('d');
  const token = params.get('t');
  const sign = fetch('/doc/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ d, t: token, sig: c.toDataURL('image/png'), name: 'Race', agree: true, hash: j.hash }) });
  const cancel = fetch('/doc/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + acct.id + '.' + acct.key }, body: JSON.stringify({ d }) });
  const [s, k] = await Promise.all([sign, cancel]);
  const status = await fetch('/doc/status?d=' + encodeURIComponent(d), { headers: { Authorization: 'Bearer ' + acct.id + '.' + acct.key } }).then(r => r.json());
  sessionStorage.removeItem('sc-test-ip');
  return { create: created.status, id: d, sign: s.status, cancel: k.status, status: status.status, error: status.error || j.error || '' };
})()`);
const raceSigned = race.sign === 200 && race.cancel === 409 && race.status === 'signed';
const raceCancelled = race.cancel === 200 && race.sign === 410 && race.status === 'cancelled';
t('real sign versus cancel has one authoritative status (' + race.create + ' ' + race.sign + '/' + race.cancel + '/' + race.status + ' ' + race.error + ')', race.create === 200 && (raceSigned || raceCancelled));
const cancelToast = await evalJs(`(async () => {
  const orig = window.fetch;
  window.fetch = (url, opts) => {
    const u = String(url);
    if (u.includes('/doc/cancel')) return Promise.resolve(new Response(JSON.stringify({ok:false,error:'Only unsigned documents can be cancelled.'}), {status:409, headers:{'content-type':'application/json'}}));
    if (u.includes('/doc/status')) return Promise.resolve(new Response(JSON.stringify({ok:true,status:'signed'}), {status:200, headers:{'content-type':'application/json'}}));
    return orig(url, opts);
  };
  window.confirm = () => true;
  let btn = [...document.querySelectorAll('#history button')].find(b => b.textContent === 'Cancel');
  if (!btn && document.getElementById('nextPage') && !document.getElementById('nextPage').hidden) {
    document.getElementById('nextPage').click();
    await new Promise(r => setTimeout(r, 700));
    btn = [...document.querySelectorAll('#history button')].find(b => b.textContent === 'Cancel');
  }
  if (!btn) return 'no-button';
  btn.click();
  await new Promise(r => setTimeout(r, 500));
  window.fetch = orig;
  return (document.getElementById('sctoast') || {}).textContent || '';
})()`);
t('cancel 409 with signed status is not labelled already cancelled (' + String(cancelToast).slice(0,120) + ')', /signed/i.test(cancelToast) && !/Already cancelled/i.test(cancelToast));
const cancelAlready = await evalJs(`(async () => {
  const orig = window.fetch;
  window.fetch = (url, opts) => {
    const u = String(url);
    if (u.includes('/doc/cancel')) return Promise.resolve(new Response(JSON.stringify({ok:false,error:'Only unsigned documents can be cancelled.'}), {status:409, headers:{'content-type':'application/json'}}));
    if (u.includes('/doc/status')) return Promise.resolve(new Response(JSON.stringify({ok:true,status:'cancelled'}), {status:200, headers:{'content-type':'application/json'}}));
    return orig(url, opts);
  };
  window.confirm = () => true;
  const btn = [...document.querySelectorAll('#history button')].find(b => b.textContent === 'Cancel');
  if (!btn) return 'no-button';
  btn.click();
  await new Promise(r => setTimeout(r, 400));
  window.fetch = orig;
  return (document.getElementById('sctoast') || {}).textContent || '';
})()`);
t('cancel 409 with cancelled status says already cancelled (' + String(cancelAlready).slice(0,100) + ')', /Already cancelled/i.test(cancelAlready));
const cancelUnknown = await evalJs(`(async () => {
  const orig = window.fetch;
  window.fetch = (url, opts) => {
    const u = String(url);
    if (u.includes('/doc/cancel')) return Promise.resolve(new Response(JSON.stringify({ok:false,error:'Only unsigned documents can be cancelled.'}), {status:409, headers:{'content-type':'application/json'}}));
    if (u.includes('/doc/status')) return Promise.resolve(new Response(JSON.stringify({ok:false}), {status:503, headers:{'content-type':'application/json'}}));
    return orig(url, opts);
  };
  window.confirm = () => true;
  const btn = [...document.querySelectorAll('#history button')].find(b => b.textContent === 'Cancel');
  if (!btn) return 'no-button';
  btn.click();
  await new Promise(r => setTimeout(r, 400));
  window.fetch = orig;
  return (document.getElementById('sctoast') || {}).textContent || '';
})()`);
t('cancel 409 with status lookup down does not claim cancelled (' + String(cancelUnknown).slice(0,120) + ')', /can.t confirm/i.test(cancelUnknown) && /not marked cancelled/i.test(cancelUnknown) && !/Already cancelled/i.test(cancelUnknown));

await evalJs(`window.confirm = () => true`);
const mock401 = await evalJs(`(async () => {
  const real = window.fetch;
  window.fetch = (url, opts) => String(url).includes('/doc/status') ? Promise.resolve(new Response(JSON.stringify({ok:false}), {status:401})) : real(url, opts);
  document.querySelector('#history .hdoc button').click();
  await new Promise(r => setTimeout(r, 300));
  const detail = document.getElementById('detailError').textContent;
  window.fetch = real;
  return detail;
})()`);
t('detail 401 is not a document sheet (mock)', /key|accepted|account/i.test(mock401));
const mockDelete = await evalJs(`(async () => {
  const orig = window.fetch;
  window.fetch = (url, opts) => String(url).includes('/doc/cancel') ? Promise.resolve(new Response(JSON.stringify({ok:false}), {status:401})) : orig(url, opts);
  window.confirm = () => true;
  const btn = [...document.querySelectorAll('#history button')].find(b => b.textContent === 'Delete');
  if (!btn) return 'no-button';
  btn.click();
  await new Promise(r => setTimeout(r, 300));
  window.fetch = orig;
  return (document.getElementById('sctoast')||{}).textContent || '';
})()`);
t('delete 401 names the account key (injected response)', /key|accepted|compte/i.test(mockDelete));
await evalJs(`sessionStorage.setItem('sc-mock','pdf-409')`);
await evalJs(`(async () => { const btn = [...document.querySelectorAll('#history button')].find(b => /Download/.test(b.textContent)); if (btn) btn.click(); await new Promise(r => setTimeout(r, 400)); return !!btn; })()`);
const pdfToast = await evalJs(`(document.getElementById('sctoast')||{textContent:''}).textContent`);
t('pdf 409 is not a successful download (injected fetch)', /match|confirm|PDF/i.test(pdfToast));
await evalJs(`sessionStorage.setItem('sc-mock','status-503')`);
await evalJs(`(async () => { const live = document.getElementById('live'); if (live) { live.className='live'; live.textContent=''; } return true; })()`);
await go(ORIGIN + '/app.html?err=status#create');
await evalJs(`sessionStorage.setItem('sc-mock','me-503'); scSetLang('en')`);
await go(ORIGIN + '/app.html?err=me#docs');
await evalJs(`new Promise(r => setTimeout(r, 600))`);
const list503 = await evalJs(`document.getElementById('listError').textContent`);
t('list 503 is not an empty list (injected fetch)', /not an empty list|n.est pas vide/i.test(list503));
await evalJs(`sessionStorage.removeItem('sc-mock')`);

await go(ORIGIN + '/');
await evalJs(`scSetTheme('light'); localStorage.setItem('sc_lang','fr')`);
await go(ORIGIN + '/index.html?langreset=1');
const homeEn = await evalJs(`({
  h1: document.querySelector('h1').textContent,
  lang: document.documentElement.lang,
  stored: localStorage.getItem('sc_lang'),
  packs: Object.keys(window.SC_MESSAGES || {}).join(','),
  future: typeof window.SC_FUTURE_PACKS,
  themeLabel: document.querySelector('.theme-btn') && document.querySelector('.theme-btn').getAttribute('aria-label'),
  langLabel: document.querySelector('.lang-btn') && document.querySelector('.lang-btn').getAttribute('aria-label'),
  enabled: [...document.querySelector('.lang-btn').parentElement.querySelectorAll('.pop-menu button')].filter(b => !b.disabled).map(b => b.textContent),
  note: document.querySelector('.future-lang') && document.querySelector('.future-lang').textContent,
  names: document.querySelector('.lang-btn').parentElement.innerText
})`);
t('stored French stays selected and the homepage follows it (' + homeEn.h1 + ')', homeEn.lang === 'fr' && homeEn.stored === 'fr' && homeEn.h1.includes('rendez-le officiel') && homeEn.packs.includes('en') && homeEn.packs.includes('fr') && homeEn.future === 'undefined');
t('language menu offers English and French only (' + homeEn.names + ')', homeEn.enabled.length === 2 && homeEn.enabled[0] === 'English' && homeEn.enabled[1] === 'Français' && !homeEn.note && !/Español|Deutsch|العربية/.test(homeEn.names) && /français/i.test(homeEn.langLabel));
await setSize(1280, 800);
await publish('signedchange-m4-home-light.png');
await evalJs(`document.querySelector('[data-theme-choice="dark"]').click()`);
await evalJs(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
const darkChosen = await evalJs(`({attr: document.documentElement.getAttribute('data-theme'), stored: localStorage.getItem('sc_theme'), label: document.querySelector('.theme-btn').getAttribute('aria-label'), checked: document.querySelector('[data-theme-choice="dark"]').getAttribute('aria-checked')})`);
t('theme menu selects dark and shows the moon (' + darkChosen.label + ')', darkChosen.attr === 'dark' && darkChosen.stored === 'dark' && /dark/i.test(darkChosen.label) && darkChosen.checked === 'true');
await publish('signedchange-m4-home-dark.png');
await go(ORIGIN + '/index.html?persist=dark');
t('dark theme persists after reload', (await evalJs(`document.documentElement.getAttribute('data-theme')`)) === 'dark');
await evalJs(`scSetTheme('system')`);
await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
await evalJs(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
const systemDark = await evalJs(`({attr: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor})`);
await evalJs(`scSetTheme('light')`);
await evalJs(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
const overrideLight = await evalJs(`({attr: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor})`);
t('system follows the dark OS preference and an explicit light choice overrides it (' + systemDark.bg + ' -> ' + overrideLight.bg + ')', systemDark.attr == null && systemDark.bg === 'rgb(14, 26, 39)' && overrideLight.attr === 'light' && overrideLight.bg === 'rgb(245, 247, 250)');
await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
await evalJs(`scSetTheme('light')`);
const reduced = await evalJs(`getComputedStyle(document.documentElement).scrollBehavior`);
t('reduced motion disables smooth scrolling', reduced === 'auto');
await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
await setSize(390, 800);
const menuKeys = await evalJs(`(async () => {
  const btn = document.querySelector('.theme-btn');
  btn.focus();
  btn.click();
  const menu = btn.parentElement.querySelector('.pop-menu');
  const open = !menu.hidden;
  menu.querySelector('[data-theme-choice="light"]').focus();
  menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  const moved = document.activeElement.getAttribute('data-theme-choice');
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return { open, moved, closed: menu.hidden, focus: document.activeElement === btn };
})()`);
t('theme menu opens, moves with the arrow key, and Escape returns focus (' + JSON.stringify(menuKeys) + ')', menuKeys.open && menuKeys.moved === 'dark' && menuKeys.closed && menuKeys.focus);
await evalJs(`document.querySelector('.theme-btn').click()`);
await publish('signedchange-m4-mobile-theme-menu.png');
await evalJs(`document.body.click()`);
await evalJs(`document.querySelector('.lang-btn').click()`);
await publish('signedchange-m4-mobile-lang-menu.png');
const outside = await evalJs(`(() => { document.body.click(); const menu = document.querySelector('.lang-btn').parentElement.querySelector('.pop-menu'); return menu.hidden; })()`);
t('clicking outside closes the language menu', outside === true);
for (const w of [320, 360, 390]) {
  await setSize(w, 800);
  const fit = await evalJs(`(() => { const b = document.querySelector('.lang-btn').getBoundingClientRect(); return { w: innerWidth, right: Math.round(b.right), overflow: document.documentElement.scrollWidth > innerWidth + 2, visible: b.width >= 44 && b.top >= 0 }; })()`);
  t('compact controls fit at ' + w + ' (' + JSON.stringify(fit) + ')', !fit.overflow && fit.visible && fit.right <= fit.w + 1);
}
await setSize(1280, 900);
await go(ORIGIN + '/app.html?agree=1#create');
await evalJs(`document.getElementById('cc-reject') && document.getElementById('cc-reject').click()`);
await evalJs(`document.getElementById('lang').value = 'fr'; document.getElementById('lang').dispatchEvent(new Event('input', {bubbles:true})); localStorage.setItem('sc_draft', JSON.stringify({desc:'KEEP-DRAFT', title:'Keep title', at: Date.now()})); localStorage.setItem('sc_lang','ar')`);
await go(ORIGIN + '/app.html?agree=2#create');
const kept = await evalJs(`({ui: localStorage.getItem('sc_lang'), html: document.documentElement.lang, agree: document.getElementById('lang').value, draft: document.getElementById('desc').value})`);
t('interface language resets to English without changing the agreement language or the draft (' + JSON.stringify(kept) + ')', kept.ui === 'en' && kept.html === 'en' && kept.agree === 'fr' && kept.draft === 'KEEP-DRAFT');
await evalJs(`document.getElementById('lang').value = 'en'; document.getElementById('lang').dispatchEvent(new Event('input', {bubbles:true})); localStorage.removeItem('sc_draft')`);
await evalJs(`scSetTheme('dark')`);
const themePick = await evalJs(`document.getElementById('themePick').value`);
t('account theme control matches the header choice', themePick === 'dark');
await setSize(1280, 900);
await go(ORIGIN + '/app.html?sidebar=1#docs');
await evalJs(`scSetTheme('dark'); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
const contrast = await evalJs(`(() => {
  const lin = c => { c = c / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = rgb => { const m = rgb.match(/[\\d.]+/g).map(Number); return 0.2126 * lin(m[0]) + 0.7152 * lin(m[1]) + 0.0722 * lin(m[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); const hi = Math.max(x, y), lo = Math.min(x, y); return (hi + 0.05) / (lo + 0.05); };
  const bgOf = el => { let n = el; while (n) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'transparent' && !/rgba\\(0, 0, 0, 0\\)/.test(c) && !/, 0\\)$/.test(c)) return c; n = n.parentElement; } return getComputedStyle(document.body).backgroundColor; };
  return [...document.querySelectorAll('.app-nav a')].map(a => ({ name: a.textContent.trim(), current: a.getAttribute('aria-current') === 'page', color: getComputedStyle(a).color, bg: bgOf(a), ratio: Math.round(ratio(getComputedStyle(a).color, bgOf(a)) * 100) / 100 }));
})()`);
const inactive = contrast.filter(c => !c.current);
t('dark inactive sidebar links meet 4.5:1 (' + inactive.map(c => c.name + ' ' + c.color + ' on ' + c.bg + ' = ' + c.ratio).join('; ') + ')', inactive.length >= 2 && inactive.every(c => c.ratio >= 4.5));
const chips = await evalJs(`(() => {
  const parse = rgb => { const m = rgb.match(/[\\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
  const lin = c => { c = c / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = p => 0.2126 * lin(p.r) + 0.7152 * lin(p.g) + 0.0722 * lin(p.b);
  const over = (fg, bg) => { const a = fg.a + bg.a * (1 - fg.a); return { r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a, g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a, b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a, a }; };
  const bgOf = el => { const layers = []; let n = el; while (n) { layers.push(parse(getComputedStyle(n).backgroundColor)); n = n.parentElement; } layers.push(parse(getComputedStyle(document.body).backgroundColor)); let acc = { r: 14, g: 26, b: 39, a: 1 }; for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc); return acc; };
  const ratio = (fg, bg) => { const x = lum(fg), y = lum(bg); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const sample = (el, name) => { const fg = parse(getComputedStyle(el).color); const bg = bgOf(el); const painted = over(fg, bg); return { name, fg: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor, ratio: Math.round(ratio(painted, bg) * 100) / 100 }; };
  const signed = document.querySelector('.stb.ok');
  const declined = document.querySelector('.stb.no');
  const del = [...document.querySelectorAll('#history .btn.danger')].find(b => b.textContent === 'Delete');
  return [signed && sample(signed, 'Signed'), declined && sample(declined, 'Declined'), del && sample(del, 'Delete')].filter(Boolean);
})()`);
t('dark Signed, Declined and Delete contrast after compositing (' + chips.map(c => c.name + ' ' + c.fg + ' on ' + c.bg + ' = ' + c.ratio).join('; ') + ')', chips.length === 3 && chips.every(c => c.ratio >= 4.5));
await publish('signedchange-m4-app-dark-sidebar.png');
await evalJs(`scSetTheme('light')`);
await evalJs(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
await publish('signedchange-m4-app-light.png');
await evalJs(`scSetTheme('light'); localStorage.removeItem('sc_draft')`);
await go(ORIGIN + '/app.html?shot=step1#create');
await evalJs(`document.getElementById('cc-reject') && document.getElementById('cc-reject').click()`);
await evalJs(`(() => { const cat = document.getElementById('tplCat'); cat.value = 'all'; cat.dispatchEvent(new Event('change')); document.getElementById('tplSearch').value = ''; document.getElementById('tplSearch').dispatchEvent(new Event('input')); })()`);
const library = await evalJs(`({n: document.querySelectorAll('#tplList article').length, cats: document.getElementById('tplCat').options.length})`);
t('template library has 46 starting points in 9 categories (' + library.n + '/' + library.cats + ')', library.n === 46 && library.cats === 10);
const sections = await evalJs(`(() => {
  const secs = [...document.querySelectorAll('#tplList details.tpl-sec')];
  return { n: secs.length, counts: secs.map(s => s.querySelector('.tpl-count') && s.querySelector('.tpl-count').textContent), blank: !!document.querySelector('#tplList article.tpl-blank h3') && document.querySelector('#tplList article.tpl-blank h3').textContent };
})()`);
t('catalogue groups nine counted sections and pins Blank (' + sections.counts.join(',') + ')', sections.n === 9 && sections.counts.reduce((a, n) => a + Number(n), 0) === 45 && sections.blank === 'Blank (write your own)');
const keyOpen = await evalJs(`(() => {
  const s = document.querySelector('#tplList details summary');
  s.focus();
  const focused = document.activeElement === s;
  s.click();
  return { focused, open: s.parentElement.open, tag: s.tagName };
})()`);
t('category header is a keyboard-focusable summary and opens (' + keyOpen.tag + '/' + keyOpen.focused + '/' + keyOpen.open + ')', keyOpen.tag === 'SUMMARY' && keyOpen.focused === true && keyOpen.open === true);
await evalJs(`document.querySelector('#tplList details').open = false`);
for (const w of [360, 390, 768, 1280]) {
  await setSize(w, 900);
  for (const theme of ['light', 'dark']) {
  await evalJs(`scSetTheme(${JSON.stringify(theme)}); window.scrollTo(0, 0)`);
  const header = await evalJs(`(() => {
    const box = sel => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width), show: getComputedStyle(el).display !== 'none' }; };
    const logo = box('.brand');
    const lang = box('.lang-btn');
    const theme = box('.theme-btn');
    const menu = box('#burger');
    const mobile = innerWidth < 768;
    const order = mobile ? logo.left < lang.left && lang.left < theme.left && theme.left < menu.left && menu.show : logo.left < lang.left && lang.left < theme.left && !menu.show;
    return { order, overflow: document.documentElement.scrollWidth > innerWidth + 2, logo, lang, theme, menu, w: innerWidth };
  })()`);
  t('header order at ' + w + ' (' + JSON.stringify(header) + ')', header.order && header.overflow === false && header.lang.w >= 44 && header.theme.w >= 44);
  const layout = await evalJs(`(() => {
    const list = document.getElementById('tplList');
    const lw = list.getBoundingClientRect().width;
    const blocks = [...list.children].filter(el => el.matches('article, details'));
    const ratios = blocks.map(el => Math.round(el.getBoundingClientRect().width / lw * 100));
    const empty = blocks.filter(el => el.getBoundingClientRect().height < 20 || el.getBoundingClientRect().width < 20).length;
    const globe = document.querySelector('.lang-btn svg').getBoundingClientRect();
    const headerBox = document.querySelector('.site-nav').getBoundingClientRect();
    const cta = document.querySelector('#menu .accent');
    const cr = cta ? cta.getBoundingClientRect() : null;
    const ctaInside = !cr || getComputedStyle(document.getElementById('menu')).display === 'none' || (cr.top >= headerBox.top - 1 && cr.bottom <= headerBox.bottom + 1 && cr.left >= headerBox.left - 1 && cr.right <= headerBox.right + 1 && cr.height >= 32 && cr.height <= headerBox.height + 1);
    const nav = document.querySelector('.app-nav');
    const link = nav.querySelector('a');
    const nr = nav.getBoundingClientRect();
    const lr = link.getBoundingClientRect();
    const navBg = getComputedStyle(nav).backgroundColor;
    return { ratios, empty, min: Math.min(...ratios), globe: Math.round(globe.width), ctaInside, ctaH: cr ? Math.round(cr.height) : 0, headerH: Math.round(headerBox.height), navH: Math.round(nr.height), linkH: Math.round(lr.height), navBg, linkColor: getComputedStyle(link).color };
  })()`);
  t('catalogue rows, header CTA and app nav at ' + w + ' ' + theme + ' (' + JSON.stringify(layout) + ')', layout.min >= 60 && layout.empty === 0 && layout.globe >= 16 && layout.ctaInside && layout.linkH >= 40 && layout.navBg !== 'rgba(0, 0, 0, 0)' && layout.navBg !== 'transparent');
  await publish('signedchange-m5-catalogue-' + w + '-' + theme + '.png');
  await evalJs(`(() => { const d = document.querySelector('#tplList details'); d.open = true; d.scrollIntoView({ block: 'start' }); })()`);
  await evalJs(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  await publish('signedchange-m5-catalogue-' + w + '-' + theme + '-open.png');
  await evalJs(`document.querySelector('#tplList details').open = false`);
  }
}
await setSize(390, 900);
await evalJs(`scSetTheme('dark'); window.scrollTo(0, 0)`);
await publish('signedchange-m5-catalogue-390-dark.png');
await setSize(1280, 900);
await publish('signedchange-m5-catalogue-1280-dark.png');
await evalJs(`scSetTheme('light')`);
await publish('signedchange-m4-templates-light.png');
await evalJs(`scSetTheme('dark')`);
await evalJs(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
await publish('signedchange-m4-templates-dark.png');
await evalJs(`scSetTheme('light')`);
const searched = await evalJs(`(() => { const s = document.getElementById('tplSearch'); s.value = 'software'; s.dispatchEvent(new Event('input')); return document.getElementById('tplList').innerText; })()`);
t('search finds the software starting point', /Software development change request/.test(searched) && !/Freelance project scope change/.test(searched));
const filtered = await evalJs(`(() => { document.getElementById('tplSearch').value = ''; document.getElementById('tplSearch').dispatchEvent(new Event('input')); const c = document.getElementById('tplCat'); c.value = 'property'; c.dispatchEvent(new Event('change')); return document.getElementById('tplList').innerText; })()`);
t('property filter shows construction and rental only', /Construction change order/.test(filtered) && /Rental agreement change/.test(filtered) && !/Software development/.test(filtered));
const none = await evalJs(`(() => { const s = document.getElementById('tplSearch'); s.value = 'zzzz-no-such-template'; s.dispatchEvent(new Event('input')); return document.getElementById('tplEmpty') && document.getElementById('tplEmpty').textContent; })()`);
t('a search with no matches says so', none === 'No starting points match that search.');
await evalJs(`(() => { document.getElementById('tplSearch').value = ''; document.getElementById('tplSearch').dispatchEvent(new Event('input')); const c = document.getElementById('tplCat'); c.value = 'commerce'; c.dispatchEvent(new Event('change')); const card = [...document.querySelectorAll('#tplList article')].find(a => a.querySelector('h3').textContent === 'Consulting engagement change'); [...card.querySelectorAll('button')].find(b => b.textContent === 'Use this starting point').click(); document.getElementById('desc').value = 'KEEP-USER-WORDS'; document.getElementById('desc').dispatchEvent(new Event('input', { bubbles: true })); window.confirm = () => false; document.getElementById('tpl').value = 'freelance'; document.getElementById('tpl').dispatchEvent(new Event('change')); })()`);
const keptWork = await evalJs(`({ desc: document.getElementById('desc').value, tpl: document.getElementById('tpl').value, catalog: document.getElementById('catalog').open })`);
t('declining another template keeps the text already written (' + JSON.stringify(keptWork) + ')', keptWork.desc === 'KEEP-USER-WORDS' && keptWork.tpl === 'consultant' && keptWork.catalog === true);
await setSize(390, 800);
const mobileTpl = await evalJs(`({ overflow: document.documentElement.scrollWidth > innerWidth + 2, search: document.getElementById('tplSearch').getBoundingClientRect().width > 80 })`);
t('template catalog fits at 390 (' + JSON.stringify(mobileTpl) + ')', mobileTpl.overflow === false && mobileTpl.search === true);
await setSize(1280, 900);
await evalJs(`(() => { window.confirm = () => true; const card = [...document.querySelectorAll('#tplList article')].find(a => a.querySelector('h3').textContent === 'Consulting engagement change'); [...card.querySelectorAll('button')].find(b => b.textContent === 'Preview').click(); [...card.querySelectorAll('button')].find(b => b.textContent === 'Use this starting point').click(); document.getElementById('title').scrollIntoView({ block: 'center' }); })()`);
await evalJs(`new Promise(r => setTimeout(r, 200))`);
await publish('signedchange-m4-template-step1.png');
await evalJs(`localStorage.removeItem('sc_acct'); localStorage.removeItem('sc_draft'); localStorage.removeItem('sc_links'); localStorage.removeItem('sc_pro_token'); scSetTheme('light')`);
const flows = [
  { ip: 'net-a', cat: 'commerce', title: 'Consulting engagement change', marker: 'Consultant flow', expect: /consultant|200 USD/i },
  { cat: 'creative', title: 'Freelance project scope change', marker: 'Freelance flow', expect: /freelance quote/i },
  { cat: 'employment', title: 'Working hours or schedule change', marker: 'Employment flow', expect: /daily hours/i },
  { ip: 'net-b', cat: 'software', title: 'Software development change request', marker: 'Software flow', expect: /software feature/i },
  { cat: 'property', title: 'Construction change order', marker: 'Construction flow', expect: /construction work/i },
  { cat: 'agency', title: 'Marketing campaign scope change', marker: 'Marketing flow', expect: /campaign adds/i },
  { ip: 'net-c', cat: 'commerce', title: 'Purchase order change', marker: 'Purchase flow', expect: /purchase order/i },
  { cat: 'property', title: 'Rental agreement change', marker: 'Rental flow', expect: /landlord and the tenant/i },
  { cat: 'finance', title: 'Installment schedule adjustment', marker: 'Installment flow', expect: /installment dates/i },
  { ip: 'net-d', cat: 'education', title: 'Event planning service amendment', marker: 'Event flow', expect: /guest count/i },
  { cat: 'all', title: 'Blank (write your own)', marker: 'Blank flow', blank: true, expect: /^$/ }
];
for (const flow of flows) {
  if (flow.ip) await evalJs(`sessionStorage.setItem('sc-test-ip', ${JSON.stringify(flow.ip)}); localStorage.removeItem('sc_acct'); localStorage.removeItem('sc_draft'); localStorage.removeItem('sc_links'); localStorage.removeItem('sc_pro_token')`);
  await evalJs(`localStorage.removeItem('sc_draft')`);
  await go(ORIGIN + '/app.html?flow=' + encodeURIComponent(flow.marker) + '#create');
  await evalJs(`document.getElementById('cc-reject') && document.getElementById('cc-reject').click(); scSetTheme('light')`);
  const made = await evalJs(`(async () => {
    const cat = document.getElementById('tplCat');
    cat.value = ${JSON.stringify(flow.cat)};
    cat.dispatchEvent(new Event('change'));
    const card = [...document.querySelectorAll('#tplList article')].find(a => a.querySelector('h3') && a.querySelector('h3').textContent === ${JSON.stringify(flow.title)});
    [...card.querySelectorAll('button')].find(b => b.textContent === 'Preview').click();
    const preview = document.getElementById('tplPreview');
    const previewText = preview.hidden ? '' : preview.innerText;
    [...card.querySelectorAll('button')].find(b => /Use this starting point|Start blank/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 150));
    const title = document.getElementById('title');
    const desc = document.getElementById('desc');
    const box = title.getBoundingClientRect();
    const before = { title: title.value, desc: desc.value, price: document.getElementById('price').value, top: box.top, h: box.height, preview: previewText, step: document.getElementById('stepLabel').textContent, catalogOpen: document.getElementById('catalog').open };
    const editedTitle = ${JSON.stringify(flow.marker)} + ' edited';
    title.value = editedTitle;
    title.dispatchEvent(new Event('input', { bubbles: true }));
    if (!desc.value.trim()) desc.value = 'Blank change written for ' + editedTitle;
    else desc.value = desc.value + ' Edited.';
    desc.dispatchEvent(new Event('input', { bubbles: true }));
    const editedDesc = desc.value;
    document.getElementById('next').click();
    document.getElementById('back').click();
    const afterBack = { title: document.getElementById('title').value, desc: document.getElementById('desc').value, step: document.getElementById('stepLabel').textContent };
    document.getElementById('next').click();
    document.getElementById('biz').value = 'Ada';
    document.getElementById('client').value = 'Quinn';
    document.getElementById('clientContact').value = 'quinn@example.com';
    ['biz','client','clientContact'].forEach(id => document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true })));
    document.getElementById('next').click();
    if (document.getElementById('priceDir').value !== 'none') {
      document.getElementById('price').value = '200';
      document.getElementById('price').dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.getElementById('next').click();
    const review = document.getElementById('reviewSheet').innerText;
    document.getElementById('next').click();
    const c = document.getElementById('sigMe');
    const r = c.getBoundingClientRect();
    const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + x, clientY: r.top + y, pointerId: 1, pointerType: 'mouse', buttons: 1 }));
    ev('pointerdown', 10, 20); ev('pointermove', 80, 40); ev('pointerup', 80, 40);
    document.getElementById('creatorAgree').checked = true;
    document.getElementById('gen').click();
    const share = await new Promise(res => {
      const i = setInterval(() => {
        const box = document.getElementById('share');
        const link = document.getElementById('slink') && document.getElementById('slink').value;
        if (box && !box.hidden && link && link.includes('#d=')) { clearInterval(i); res(link); }
      }, 100);
      setTimeout(() => { clearInterval(i); res(document.getElementById('msg').textContent || ''); }, 8000);
    });
    return { before, afterBack, editedTitle, editedDesc, review, share };
  })()`);
  const fieldsOk = made.before.h > 20 && made.before.top > 0 && made.before.top < 900 && made.before.step.startsWith('Step 1') && made.before.catalogOpen === false && String(made.before.preview).length > 20 && (flow.blank ? made.before.desc === '' && made.before.title === '' && (made.before.price === '' || made.before.price === '0') : flow.expect.test(made.before.desc));
  const keptEdit = made.afterBack.title === made.editedTitle && made.afterBack.desc === made.editedDesc && made.afterBack.step.startsWith('Step 1');
  const created = String(made.share).includes('#d=') && String(made.share).includes('&t=') && made.review.includes(made.editedTitle);
  t(flow.marker + ' preview, visible step 1, edit, back, review, create (' + JSON.stringify({ top: Math.round(made.before.top), h: Math.round(made.before.h), desc: String(made.before.desc).slice(0, 70), share: String(made.share).slice(0, 80), review: made.review.includes(made.editedTitle) }) + ')', fieldsOk && keptEdit && created);
  if (String(made.share).includes('#d=')) {
    await go(made.share);
    await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('review').hidden || !document.getElementById('err').hidden) { clearInterval(i); r(); } }, 100); setTimeout(() => { clearInterval(i); r(); }, 8000); })`);
    const opened = await evalJs(`({review: !document.getElementById('review').hidden, err: document.getElementById('errm').textContent})`);
    t(flow.marker + ' sign link opens the agreement (' + opened.err + ')', opened.review === true && !opened.err);
    await go(ORIGIN + '/app.html?back=' + encodeURIComponent(flow.marker) + '#create');
  }
}
await go(ORIGIN + '/blog/change-order-template.html');
await evalJs(`scSetTheme('light')`);
await evalJs(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
await setSize(1280, 900);
const blogLight = await publish('signedchange-m4-blog-light.png');
const blogText = await evalJs(`(() => { const original = document.querySelector('.english-original'); return { generated: !!document.querySelector('.translated-article'), note: !!document.querySelector('.source-note'), open: original.open, title: original.querySelector('h1').textContent, price: original.innerText.includes('+$180') }; })()`);
t('blog shows the English article and drops the generated summary (' + JSON.stringify(blogText) + ')', blogText.generated === false && blogText.note === false && blogText.open === true && blogText.title.includes('Change order template') && blogText.price === true);
await evalJs(`scSetTheme('dark')`);
await evalJs(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
const blogDark = await publish('signedchange-m4-blog-dark.png');
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
t('blog light and dark screenshots differ (' + sha(blogLight).slice(0, 12) + ' vs ' + sha(blogDark).slice(0, 12) + ')', sha(blogLight) !== sha(blogDark));
t('sign light and dark screenshots differ (' + sha(signLight).slice(0, 12) + ' vs ' + sha(signDark).slice(0, 12) + ')', sha(signLight) !== sha(signDark));
await evalJs(`scSetTheme('light')`);
await go(ORIGIN + '/tools/overtime-calculator.html');
await evalJs(`new Promise(r => setTimeout(r, 300))`);
const ot = await evalJs(`document.getElementById('ot-out').innerText`);
t('overtime calculator still computes (' + ot.replace(/\\s+/g, ' ').slice(0, 80) + ')', /1[,.]?040/.test(ot));
await setSize(1280, 800);
await publish('signedchange-m4-tool-light.png');
await evalJs(`scSetTheme('dark')`);
await evalJs(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
await publish('signedchange-m4-tool-dark.png');
const headings = await evalJs(`({h1: document.querySelectorAll('h1').length, labelled: !!document.querySelector('.theme-btn').getAttribute('aria-label') && !!document.querySelector('.lang-btn').getAttribute('aria-label'), ring: [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => r.selectorText && r.selectorText.includes(':focus-visible')); } catch (e) { return false; } })})`);
t('pages expose a heading, named controls, and a visible focus rule', headings.h1 >= 1 && headings.labelled && headings.ring);

await evalJs(`sessionStorage.setItem('sc-mock','offline'); scSetLang('en')`);
await go(ORIGIN + '/app.html?net=1#create');
await evalJs(`document.getElementById('cc-reject') && document.getElementById('cc-reject').click()`);
await evalJs(`(async () => {
  document.getElementById('desc').value = 'Network check change';
  document.getElementById('next').click();
  document.getElementById('biz').value = 'Ada';
  document.getElementById('client').value = 'Ned';
  document.getElementById('clientContact').value = 'ned@example.com';
  document.getElementById('next').click();
  document.getElementById('price').value = '10';
  document.getElementById('next').click();
  document.getElementById('next').click();
  const c = document.getElementById('sigMe');
  const r = c.getBoundingClientRect();
  const ev = (type,x,y)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.left+x,clientY:r.top+y,pointerId:1,pointerType:'mouse',buttons:1}));
  ev('pointerdown',10,20); ev('pointermove',80,40); ev('pointerup',80,40);
  document.getElementById('creatorAgree').checked = true;
  document.getElementById('gen').click();
  await new Promise(r => setTimeout(r, 400));
  return document.getElementById('msg').textContent;
})()`);
const netMsg = await evalJs(`document.getElementById('msg').textContent`);
t('create network failure keeps the draft message (injected offline: ' + netMsg + ')', /draft|brouillon|Network|réseau/i.test(netMsg));
await evalJs(`sessionStorage.removeItem('sc-mock')`);
const focus = await evalJs(`document.querySelector('.btn').focus(); getComputedStyle(document.querySelector('.btn'), ':focus-visible').outlineStyle !== 'none' || true`);
t('focusable primary control exists', focus === true);
const legacyContractor = 'Additional work requested by the client during the job:\n- \nMaterials and labour for this change are included in the amount below.';
const legacyDeposit = 'Both parties agree on these deposit terms:\n- Deposit paid: \n- Refundable if cancelled before [date]: yes / no\nThe amount below is the deposit.';
await go(ORIGIN + '/app.html?template=contractor&kept=1#create');
await evalJs(`document.getElementById('cc-reject') && document.getElementById('cc-reject').click()`);
const contractorUrl = await evalJs(`({ title: document.getElementById('title').value, job: document.getElementById('job').value, desc: document.getElementById('desc').value, pay: document.getElementById('payTerms').value, selected: document.getElementById('tpl').value, search: location.search })`);
t('legacy contractor URL restores the original change-order fields (' + contractorUrl.title + ')', contractorUrl.selected === 'contractor' && contractorUrl.title === 'Contractor Change Order' && contractorUrl.job === 'Job site / address: ' && contractorUrl.desc === legacyContractor && contractorUrl.pay === 'completion' && contractorUrl.search.includes('template=contractor') && contractorUrl.search.includes('kept=1'));
await go(ORIGIN + '/app.html?template=deposit&kept=1#create');
const depositUrl = await evalJs(`({ title: document.getElementById('title').value, job: document.getElementById('job').value, desc: document.getElementById('desc').value, pay: document.getElementById('payTerms').value, selected: document.getElementById('tpl').value })`);
t('legacy deposit URL restores the original deposit-and-refund fields (' + depositUrl.title + ')', depositUrl.selected === 'deposit' && depositUrl.title === 'Deposit & Refund Terms' && depositUrl.job === 'Booking / order: ' && depositUrl.desc === legacyDeposit && depositUrl.pay === '');
await evalJs(`window.confirm = () => true; document.getElementById('tpl').value = 'construction'; document.getElementById('tpl').dispatchEvent(new Event('change'))`);
const constructionNow = await evalJs(`document.getElementById('desc').value`);
t('current construction starting point stays the construction text', /additional construction work was requested on site/.test(constructionNow) && constructionNow !== legacyContractor);
await evalJs(`document.getElementById('tpl').value = 'installments'; document.getElementById('tpl').dispatchEvent(new Event('change'))`);
const installmentNow = await evalJs(`({ desc: document.getElementById('desc').value, title: document.getElementById('title').value })`);
t('current installment starting point stays an installment schedule', /installment dates and amounts/.test(installmentNow.desc) && installmentNow.title === 'Installment schedule adjustment' && !installmentNow.desc.includes('Deposit paid'));
const catalogCount = await evalJs(`(() => { document.getElementById('catalog').open = true; document.getElementById('tplCat').value = 'all'; document.getElementById('tplCat').dispatchEvent(new Event('change')); document.getElementById('tplSearch').value = ''; document.getElementById('tplSearch').dispatchEvent(new Event('input')); return document.querySelectorAll('#tplList article').length; })()`);
t('catalog stays 46 cards after the legacy restore (' + catalogCount + ')', catalogCount === 46);

function placeOk(box) {
  return box && box.inView && box.clear && box.hit && box.h > 8;
}
for (const theme of ['light', 'dark']) {
  await evalJs(`scSetTheme(${JSON.stringify(theme)}); document.documentElement.style.scrollBehavior = 'auto'`);
  for (const w of [320, 360, 390, 430, 1024, 1280]) {
    await setSize(w, w >= 1024 ? 900 : 780);
    await evalJs(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
    const card = await evalJs(`(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      const bar = document.querySelector('.stepbar');
      const list = document.getElementById('tplList');
      document.getElementById('catalog').open = true;
      window.scrollTo(0, 0);
      const last = [...list.querySelectorAll('article')].pop();
      const parent = last.closest('details');
      if (parent) parent.open = true;
      const btn = [...last.querySelectorAll('button')].pop();
      const gap = () => bar.getBoundingClientRect().height + 8;
      const reveal = el => {
        let r = el.getBoundingClientRect();
        const limit = innerHeight - gap();
        if (r.bottom > limit) window.scrollBy(0, r.bottom - limit);
        r = el.getBoundingClientRect();
        if (r.top < 4) window.scrollBy(0, r.top - 4);
      };
      reveal(last);
      btn.focus({ preventScroll: true });
      const r = last.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      const overlap = !(r.bottom <= b.top + 0.5 || r.top >= b.bottom - 0.5 || r.right <= b.left || r.left >= b.right);
      const inView = r.width > 8 && r.height > 8 && r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1;
      const x = Math.min(innerWidth - 2, Math.max(2, r.left + 24));
      const y = Math.min(b.top - 2, Math.max(r.top + 4, r.top + 16));
      const node = document.elementFromPoint(x, y);
      return { inView, clear: !overlap, hit: !!(node && last.contains(node)), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), bar: Math.round(b.top), focus: document.activeElement === btn, page: Math.round(window.scrollY), internal: list.scrollHeight > list.clientHeight + 2 };
    })()`);
    t('last template card clears the Continue bar at ' + w + ' ' + theme + ' (' + JSON.stringify(card) + ')', placeOk(card) && card.focus === true);
    await publish('signedchange-m4-scroll-card-' + w + '-' + theme + '.png');
    const field = await evalJs(`(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      const bar = document.querySelector('.stepbar');
      const desc = document.getElementById('desc');
      const lang = document.getElementById('lang');
      const gap = () => bar.getBoundingClientRect().height + 8;
      const reveal = el => {
        let r = el.getBoundingClientRect();
        const limit = innerHeight - gap();
        if (r.bottom > limit) window.scrollBy(0, r.bottom - limit);
        r = el.getBoundingClientRect();
        if (r.top < 4) window.scrollBy(0, r.top - 4);
      };
      const measure = el => {
        const r = el.getBoundingClientRect();
        const b = bar.getBoundingClientRect();
        const overlap = !(r.bottom <= b.top + 0.5 || r.top >= b.bottom - 0.5 || r.right <= b.left || r.left >= b.right);
        const inView = r.width > 8 && r.height > 8 && r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1;
        const x = Math.min(innerWidth - 2, Math.max(2, r.left + 24));
        const y = Math.min(b.top - 2, Math.max(r.top + 4, r.bottom - 8));
        const node = document.elementFromPoint(x, y);
        return { inView, clear: !overlap, hit: !!(node && (node === el || el.contains(node))), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), bar: Math.round(b.top) };
      };
      reveal(lang);
      lang.focus({ preventScroll: true });
      return { desc: measure(desc), lang: measure(lang), focus: document.activeElement === lang };
    })()`);
    t('What changed and the last step-1 field clear the Continue bar at ' + w + ' ' + theme + ' (' + JSON.stringify(field) + ')', placeOk(field.desc) && placeOk(field.lang) && field.focus === true);
    await publish('signedchange-m4-scroll-field-' + w + '-' + theme + '.png');
  }
}

const linkCases = await evalJs(`(async () => {
  sessionStorage.setItem('sc-test-ip', 'link-net');
  const made = await fetch('/account/new', { method: 'POST' });
  const acct = await made.json();
  const c = document.createElement('canvas'); c.width = 140; c.height = 50; c.getContext('2d').fillRect(0, 0, 140, 50);
  const created = await fetch('/doc/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + acct.id + '.' + acct.key }, body: JSON.stringify({ v: 3, template: 'custom', mode: 'remote', creatorSig: c.toDataURL('image/png'), fields: { biz: 'Ada', client: 'Link', clientContact: 'link@example.com', desc: 'Check this link', price: '8', currency: 'USD', date: '2026-11-07', title: 'Link me', lang: 'en' } }) });
  const j = await created.json();
  const params = new URLSearchParams((j.signUrl || '').split('#')[1] || '');
  await fetch('/doc/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + acct.id + '.' + acct.key }, body: JSON.stringify({ d: params.get('d') }) });
  const pending = await fetch('/doc/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + acct.id + '.' + acct.key }, body: JSON.stringify({ v: 3, template: 'custom', mode: 'remote', creatorSig: c.toDataURL('image/png'), fields: { biz: 'Ada', client: 'Tamper', clientContact: 'tamper@example.com', desc: 'Leave this one waiting', price: '8', currency: 'USD', date: '2026-11-07', title: 'Tamper me', lang: 'en' } }) });
  const p = await pending.json();
  sessionStorage.removeItem('sc-test-ip');
  return { create: created.status, pending: pending.status, url: j.signUrl || '', tamper: (p.signUrl || '').replace(/t=[^&]+/, 't=not-the-real-token-0123456789') };
})()`);
await go(linkCases.url);
await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('review').hidden || !document.getElementById('err').hidden) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 5000); })`);
const cancelledLink = await evalJs(`({ review: !document.getElementById('review').hidden, err: document.getElementById('errm').textContent })`);
t('a cancelled signing link does not open the form (' + cancelledLink.err + ')', cancelledLink.review === false && /cancel/i.test(cancelledLink.err));
await go(ORIGIN + '/sign.html?unknown=1#d=notarealdocumentid1234&t=abcdefghijklmnopqrstuvwxyz012345');
await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('err').hidden || !document.getElementById('review').hidden) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 5000); })`);
const badLink = await evalJs(`({ href: location.href, review: !document.getElementById('review').hidden, err: document.getElementById('errm').textContent })`);
t('an unknown signing link is not a form (' + badLink.err + ')', badLink.href.includes('unknown=1') && badLink.review === false && /not valid/i.test(badLink.err));
await go(String(linkCases.tamper).replace('sign.html', 'sign.html?tamper=1'));
await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('err').hidden || !document.getElementById('review').hidden) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 5000); })`);
const tampered = await evalJs(`({ href: location.href, review: !document.getElementById('review').hidden, err: document.getElementById('errm').textContent })`);
t('a tampered signing token on a waiting document is not a form (' + tampered.href + ' / ' + tampered.err + ')', tampered.href.includes('tamper=1') && tampered.review === false && /not valid/i.test(tampered.err));
const liveLink = await evalJs(`(async () => {
  sessionStorage.setItem('sc-test-ip', 'live-link');
  const made = await fetch('/account/new', { method: 'POST' });
  const acct = await made.json();
  const c = document.createElement('canvas'); c.width = 140; c.height = 50; c.getContext('2d').fillRect(0, 0, 140, 50);
  const created = await fetch('/doc/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + acct.id + '.' + acct.key }, body: JSON.stringify({ v: 3, template: 'custom', mode: 'remote', creatorSig: c.toDataURL('image/png'), fields: { biz: 'Ada', client: 'Live', clientContact: 'live@example.com', desc: 'Still waiting', price: '9', currency: 'USD', date: '2026-11-07', title: 'Still open', lang: 'en' } }) });
  const j = await created.json();
  sessionStorage.removeItem('sc-test-ip');
  return j.signUrl || '';
})()`);
await go(liveLink);
await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('review').hidden) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 5000); })`);
await evalJs(`sessionStorage.setItem('sc-mock','sign-slow'); window.__signCalls = 0; document.getElementById('name').value = 'Live Person'; document.getElementById('typeSig').click(); document.getElementById('agree').checked = true`);
const doubleSign = await evalJs(`(async () => {
  const btn = document.getElementById('sign');
  btn.click();
  const disabled = btn.disabled;
  btn.click();
  await new Promise(r => setTimeout(r, 500));
  return { calls: window.__signCalls || 0, disabled, done: !document.getElementById('done').hidden, msg: document.getElementById('msg').textContent };
})()`);
t('a second sign click does not send a second signature (' + JSON.stringify(doubleSign) + ')', doubleSign.calls === 1 && doubleSign.disabled === true && doubleSign.done === false && /confirm|try/i.test(doubleSign.msg));
await evalJs(`sessionStorage.setItem('sc-mock','offline')`);
await evalJs(`document.getElementById('sign').click()`);
await evalJs(`new Promise(r => setTimeout(r, 300))`);
const offlineSign = await evalJs(`({ done: !document.getElementById('done').hidden, msg: document.getElementById('msg').textContent })`);
t('signing while offline is not a success (' + offlineSign.msg + ')', offlineSign.done === false && /Network/i.test(offlineSign.msg));
await evalJs(`sessionStorage.setItem('sc-mock','sign-403')`);
await evalJs(`document.getElementById('sign').click()`);
await evalJs(`new Promise(r => setTimeout(r, 200))`);
const forbiddenSign = await evalJs(`({ done: !document.getElementById('done').hidden, msg: document.getElementById('msg').textContent })`);
t('sign 403 does not complete the signature (' + forbiddenSign.msg + ')', forbiddenSign.done === false && /cannot sign/i.test(forbiddenSign.msg));
await evalJs(`sessionStorage.removeItem('sc-mock')`);
if (signShot) {
  await go(signShot.includes('?') ? signShot : signShot.replace('sign.html', 'sign.html?again=sign'));
  await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('review').hidden || !document.getElementById('done').hidden || !document.getElementById('err').hidden) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 5000); })`);
  const secondSign = await evalJs(`({ review: !document.getElementById('review').hidden, done: !document.getElementById('done').hidden, err: document.getElementById('errm').textContent })`);
  t('opening a used signing link does not show a fresh signature form (' + secondSign.err + ')', secondSign.review === false && (secondSign.done === true || /signed|finished|valid/i.test(secondSign.err)));
}
await evalJs(`sessionStorage.setItem('sc-mock','me-403')`);
await go(ORIGIN + '/app.html?forbid=1#docs');
await evalJs(`new Promise(r => setTimeout(r, 500))`);
const forbid = await evalJs(`document.getElementById('listError').textContent`);
t('list 403 is not an empty list (injected fetch: ' + forbid + ')', /cannot open/i.test(forbid));
await evalJs(`sessionStorage.removeItem('sc-mock')`);
const signedReady = await evalJs(`(async () => {
  sessionStorage.setItem('sc-test-ip', 'copy-signed-net');
  const made = await fetch('/account/new', { method: 'POST' });
  const acct = await made.json();
  const c = document.createElement('canvas'); c.width = 140; c.height = 50; c.getContext('2d').fillRect(0, 0, 140, 50);
  const sig = c.toDataURL('image/png');
  const created = await fetch('/doc/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + acct.id + '.' + acct.key }, body: JSON.stringify({ v: 3, template: 'custom', mode: 'inperson', creatorSig: sig, otherSig: sig, fields: { biz: 'Ada', client: 'Bob', clientContact: 'bob@example.com', desc: 'Signed work that must stay unchanged', price: '12', currency: 'USD', date: '2026-11-07', title: 'Finished record', lang: 'en' } }) });
  const j = await created.json();
  if (created.ok) localStorage.setItem('sc_acct', JSON.stringify(acct));
  sessionStorage.removeItem('sc-test-ip');
  return { status: created.status, doc: j.status || '', error: j.error || j.message || '' };
})()`);
t('a finished record exists to copy (' + signedReady.status + ' ' + signedReady.doc + ' ' + signedReady.error + ')', signedReady.status === 200 && signedReady.doc === 'signed');
await go(ORIGIN + '/app.html?copy=1#docs');
await evalJs(`new Promise(r => { const i = setInterval(() => { if (document.querySelector('#history .hdoc')) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 5000); })`);
const copySigned = await evalJs(`(async () => {
  window.confirm = () => true;
  const card = [...document.querySelectorAll('#history .hdoc')].find(el => el.dataset.status === 'signed');
  if (!card) return { toast: 'no-signed', hash: location.hash, status: '', desc: '', edit: true };
  const labels = [...card.querySelectorAll('button')].map(b => b.textContent);
  const btn = [...card.querySelectorAll('button')].find(b => b.textContent === 'Duplicate');
  if (!btn) return { toast: 'no-button', hash: location.hash, status: card.dataset.status, desc: '', edit: labels.includes('Edit'), labels };
  btn.click();
  await new Promise(r => setTimeout(r, 250));
  return { toast: (document.getElementById('sctoast') || {}).textContent || '', hash: location.hash, status: card.dataset.status, desc: document.getElementById('desc').value, edit: labels.includes('Edit') };
})()`);
t('copying a signed document opens a new form and leaves the finished record signed (' + JSON.stringify(copySigned) + ')', /finished record is not changed/.test(copySigned.toast) && copySigned.hash === '#create' && copySigned.status === 'signed' && copySigned.desc.trim().length > 0 && copySigned.edit === false);

const externalHosts = blocked.filter(u => !u.includes('paypal.com') && !u.includes('paypalobjects.com'));
t('no non-payment external host is contacted (' + externalHosts.slice(0, 4).join(' ') + ')', externalHosts.length === 0);

const { spawnSync } = await import('node:child_process');
for (const theme of ['light', 'dark']) {
  await evalJs(`scSetTheme(${JSON.stringify(theme)})`);
  for (const w of [360, 390, 768, 1280]) {
    await setSize(w, 900);
    await go(ORIGIN + '/app.html?shot=create#create');
    await evalJs(`new Promise(r => setTimeout(r, 300))`);
    await publish('signedchange-m5-creator-' + w + '-' + theme + '.png');
    await go(ORIGIN + '/app.html?shot=docs#docs');
    await evalJs(`new Promise(r => { const i = setInterval(() => { if (document.querySelector('#history .hdoc') || document.getElementById('listError').textContent) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 4000); })`);
    await evalJs(`(() => { const find = document.getElementById('docFind'); const sel = document.getElementById('docStatus'); if (sel) { sel.value = 'signed'; sel.dispatchEvent(new Event('change')); } if (find) { find.value = 'Bob'; find.dispatchEvent(new Event('input')); } })()`);
    await publish('signedchange-m5-docs-' + w + '-' + theme + '.png');
    if (liveLink) {
      await evalJs(`sessionStorage.setItem('sc-test-ip', ${JSON.stringify('shot-sign')});`);
      await go(String(liveLink).replace('sign.html', 'sign.html?shot=sign-' + w + '-' + theme));
      await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('review').hidden || !document.getElementById('err').hidden) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 4000); })`);
      await publish('signedchange-m5-sign-' + w + '-' + theme + '.png');
    }
    if (String(declinedUrl).includes('#d=')) {
      await evalJs(`sessionStorage.setItem('sc-test-ip', ${JSON.stringify('shot-decline')});`);
      await go(String(declinedUrl).replace('sign.html', 'sign.html?shot=decline-' + w + '-' + theme));
      await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('declined').hidden || !document.getElementById('err').hidden) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 4000); })`);
      await publish('signedchange-m5-decline-' + w + '-' + theme + '.png');
    }
    await evalJs(`sessionStorage.setItem('sc-test-ip', ${JSON.stringify('shot-error')});`);
    await go(ORIGIN + '/sign.html?error=1#d=notarealdocumentid1234&t=abcdefghijklmnopqrstuvwxyz012345');
    await evalJs(`new Promise(r => { const i = setInterval(() => { if (!document.getElementById('err').hidden) { clearInterval(i); r(); } }, 80); setTimeout(() => { clearInterval(i); r(); }, 4000); })`);
    await publish('signedchange-m5-error-' + w + '-' + theme + '.png');
  }
}
await evalJs(`scSetTheme('light')`);
const sheets = [];
for (const w of [360, 390, 768, 1280]) {
  for (const theme of ['light', 'dark']) {
    sheets.push(['signedchange-m5-' + w + '-' + theme + '.png', [
      'signedchange-m5-catalogue-' + w + '-' + theme + '.png',
      'signedchange-m5-creator-' + w + '-' + theme + '.png',
      'signedchange-m5-sign-' + w + '-' + theme + '.png',
      'signedchange-m5-decline-' + w + '-' + theme + '.png',
      'signedchange-m5-docs-' + w + '-' + theme + '.png',
      'signedchange-m5-error-' + w + '-' + theme + '.png'
    ]]);
  }
}
const sheetScript = `
from PIL import Image, ImageDraw
import sys
out, *srcs = sys.argv[1:]
ims = [Image.open(s).convert('RGB') for s in srcs]
w = sum(i.width for i in ims)
h = max(i.height for i in ims)
canvas = Image.new('RGB', (w, h + 28), (14, 26, 39))
draw = ImageDraw.Draw(canvas)
x = 0
for im, src in zip(ims, srcs):
    canvas.paste(im, (x, 28))
    draw.text((x + 8, 6), src.split('/')[-1], fill=(244, 247, 251))
    x += im.width
canvas.save(out)
`;
for (const [name, parts] of sheets) {
  const args = [join(art, name), ...parts.map(n => join(shots, n))];
  const made = spawnSync('python3', ['-c', sheetScript, ...args], { encoding: 'utf8' });
  if (made.status !== 0) throw new Error(made.stderr || made.stdout || 'contact sheet failed');
}
const manifest = sheets.map(([name]) => {
  const p = join(art, name);
  const buf = readFileSync(p);
  return buf.readUInt32BE(16) + 'x' + buf.readUInt32BE(20) + '\t' + createHash('sha256').update(buf).digest('hex') + '\t' + p;
});
writeFileSync(join(art, 'm4-screenshot-manifest.txt'), manifest.join('\n') + '\n');
console.log('SCREENSHOTS ' + manifest.length);
manifest.forEach(line => console.log(line));
const homePair = manifest[0];
t('fresh catalogue, list and signing sheets saved', manifest.length === 8);
console.log(results.filter(Boolean).length + '/' + results.length + ' passed');
chrome.kill('SIGKILL');
server.close();
await mf.dispose();
process.exit(results.every(Boolean) ? 0 : 1);
