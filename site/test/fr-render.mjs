// Rendered French check. Static files only. No payment routes are called.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { spawn } from 'node:child_process';
const PORT = 8771;
const site = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(site, path === '/' ? 'index.html' : path);
  if (!file.startsWith(site) || !existsSync(file)) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=9344', '--remote-allow-origins=*', '--user-data-dir=/tmp/sc-fr-cdp'], { stdio: 'ignore' });
async function cdp() {
  for (let i = 0; i < 40; i++) {
    try { return (await (await fetch('http://127.0.0.1:9344/json/version')).json()).webSocketDebuggerUrl; }
    catch { await new Promise(r => setTimeout(r, 150)); }
  }
  throw new Error('chrome did not start');
}
const ws = new WebSocket(await cdp());
await new Promise(r => ws.addEventListener('open', r));
let seq = 0; const pending = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}, sessionId) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const target = await send('Target.createTarget', { url: 'about:blank' });
const sid = (await send('Target.attachToTarget', { targetId: target.result.targetId, flatten: true })).result.sessionId;
const call = (method, params) => send(method, params, sid);
await call('Page.enable');
const expect = {
  'index.html': 'Quand un accord change',
  'about.html': 'outil pour écrire',
  'features.html': 'formulaire en cinq étapes',
  'pricing.html': '9',
  'blog/index.html': 'Guides',
  'blog/change-order-template.html': 'ordre de changement',
  'locations.html': 'navigateur',
  'stats.html': 'dérive du périmètre',
  'lp/change-order.html': 'ordre de changement',
  'tools/index.html': 'outils',
  'tools/overtime-calculator.html': 'heures supplémentaires',
  'app.html': 'Nouveau dossier',
  'sign.html': 'incomplet',
  'verify.html': 'Vérifier',
  'faq.html': 'compte',
  'how.html': 'Comment ça marche',
  'product.html': 'changement',
  'privacy.html': 'collectons',
  'terms.html': 'service',
};
let failed = 0;
for (const theme of ['light', 'dark']) {
  for (const page of Object.keys(expect)) {
    await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });
    await call('Page.navigate', { url: `http://127.0.0.1:${PORT}/${page}` });
    await new Promise(r => setTimeout(r, 300));
    await call('Runtime.evaluate', { expression: `localStorage.setItem('sc_lang','fr'); if (window.scSetTheme) scSetTheme(${JSON.stringify(theme)}); if (window.scSetLang) scSetLang('fr');`, returnByValue: true });
    await new Promise(r => setTimeout(r, 80));
    const got = await call('Runtime.evaluate', { expression: `({lang:document.documentElement.lang, stored:localStorage.getItem('sc_lang'), text:(document.body.innerText||'').slice(0,4000)})`, returnByValue: true });
    const value = got.result.result.value;
    const needle = expect[page];
    const ok = value.lang === 'fr' && value.stored === 'fr' && value.text.toLowerCase().includes(needle.toLowerCase());
    if (!ok) { failed++; console.log('FAIL', theme, page, value.lang, value.stored, value.text.slice(0, 180).replace(/\n/g, ' ')); }
    else console.log('OK', theme, page);
  }
}
for (const w of [360, 390, 700, 768, 900, 1024, 1280]) {
  await call('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 });
  await call('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
  await new Promise(r => setTimeout(r, 200));
  await call('Runtime.evaluate', { expression: `localStorage.setItem('sc_lang','fr'); if (window.scSetLang) scSetLang('fr');`, returnByValue: true });
  const box = await call('Runtime.evaluate', { expression: `({overflow:document.documentElement.scrollWidth>innerWidth+2, h1:(document.querySelector('h1')||{}).textContent||''})`, returnByValue: true });
  const v = box.result.result.value;
  if (v.overflow || !/Quand un accord/.test(v.h1)) { failed++; console.log('FAIL width', w, JSON.stringify(v)); }
  else console.log('OK width', w);
}
chrome.kill('SIGKILL');
server.close();
console.log(failed ? 'FAILED ' + failed : 'PASS rendered French');
if (failed) process.exit(1);
