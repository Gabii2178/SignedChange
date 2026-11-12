'use strict';
// Display currency and optional identity status. Neither one rewrites an agreement.
(function () {
  const KEY = 'sc_display_ccy';
  const CODES = ['USD', 'EUR', 'GBP', 'XAF', 'NGN', 'GHS', 'KES', 'ZAR', 'CAD', 'AUD', 'INR'];
  const API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? location.origin : 'https://signedchange-unlock.signedchange.workers.dev';
  const LABELS = { NOT_STARTED: 'Not started', PENDING: 'Pending', VERIFIED: 'Verified', REJECTED: 'Not verified', EXPIRED: 'Expired', REQUIRES_REVIEW: 'Needs review' };
  let rates = null;
  let offer = null;

  function pref() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function chosen() {
    const p = pref();
    return p && p.chosen === true && CODES.includes(p.code) ? p.code : '';
  }
  function save(code) {
    localStorage.setItem(KEY, JSON.stringify({ code: code, chosen: true }));
  }
  function acct() {
    try { return JSON.parse(localStorage.getItem('sc_acct') || 'null'); } catch (e) { return null; }
  }
  function displayCode() {
    const sel = document.getElementById('displayCcy');
    return (sel && CODES.includes(sel.value) && sel.value) || chosen() || 'USD';
  }
  function money(amount, currency) {
    const n = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(n)) return '';
    try { return new Intl.NumberFormat('en', { style: 'currency', currency: currency }).format(n); }
    catch (e) { return currency + ' ' + n.toFixed(2); }
  }
  function convert(amount, from, to) {
    if (!rates || !rates.ok || !rates.rates) return null;
    const table = rates.rates;
    if (!table[from] || !table[to]) return null;
    const usd = from === 'USD' ? Number(amount) : Number(amount) / table[from];
    const out = to === 'USD' ? usd : usd * table[to];
    return Number.isFinite(out) ? Math.round(out * 100) / 100 : null;
  }
  function rateSentence(amount, from) {
    const to = displayCode();
    if (!from) return '';
    if (!rates) return '';
    if (!rates.ok && rates.stale) return 'The saved exchange rate is too old to show' + (rates.date ? ' (ECB date ' + rates.date + ')' : '') + '. The agreement stays ' + from + ' ' + amount + '.';
    if (!rates.ok) return 'Exchange rates are unavailable. The agreement stays ' + from + ' ' + amount + '.';
    if (to === from) return 'Shown in the agreement currency (' + from + '). Rate date ' + rates.date + '.';
    const value = convert(amount, from, to);
    if (value == null) return 'No conversion is currently available for ' + to + '. Nothing was converted. The agreement stays ' + from + ' ' + amount + '.';
    const peg = rates.pegs && rates.pegs[to] ? ' ' + rates.pegs[to] : '';
    return 'About ' + money(value, to) + ' as of ' + rates.date + '. Approximate. ' + (rates.source || '') + '.' + peg + ' The agreement stays ' + from + ' ' + amount + '.';
  }

  function paintForm() {
    const note = document.getElementById('fxApprox');
    const currency = document.getElementById('currency');
    const price = document.getElementById('price');
    if (note && currency && price) {
      const dir = document.getElementById('priceDir');
      let amount = parseFloat(String(price.value || '').replace(',', '.'));
      if (!Number.isFinite(amount)) amount = 0;
      if (dir && dir.value === 'dec') amount = -amount;
      if (dir && dir.value === 'none') amount = 0;
      note.textContent = rateSentence(amount, currency.value || 'USD');
    }
    document.querySelectorAll('#history .hdoc').forEach(row => {
      let extra = row.querySelector('.fx-approx');
      if (!extra) {
        extra = document.createElement('p');
        extra.className = 'help fx-approx';
        row.appendChild(extra);
      }
      const from = row.dataset.currency || '';
      const amount = row.dataset.amount || '';
      extra.textContent = from ? rateSentence(amount, from) : '';
    });
  }
  function paintSign() {
    const note = document.getElementById('fxApprox');
    const root = document.documentElement.dataset;
    if (!note || !root.agreeCurrency) return;
    note.textContent = rateSentence(root.agreeAmount || '0', root.agreeCurrency);
  }
  function paint() { paintForm(); paintSign(); }
  window.scPaintFx = paint;

  function showOffer(suggestion) {
    const box = document.getElementById('fxSuggest');
    const text = document.getElementById('fxSuggestText');
    if (!box || !text) return;
    if (chosen() || !suggestion || !suggestion.suggested || suggestion.currency === displayCode()) {
      box.hidden = true;
      return;
    }
    offer = suggestion.currency;
    text.textContent = 'Suggested display currency: ' + suggestion.currency + ' (approximate country ' + (suggestion.country || 'unknown') + '). This does not change the agreement currency.';
    box.hidden = false;
  }
  function fillSelect() {
    const sel = document.getElementById('displayCcy');
    if (!sel || sel.options.length) return;
    CODES.forEach(code => {
      const o = document.createElement('option');
      o.value = code;
      o.textContent = code;
      sel.appendChild(o);
    });
    sel.value = chosen() || 'USD';
    sel.addEventListener('change', () => { save(sel.value); showOffer(null); paint(); });
  }
  async function loadRates() {
    try {
      const res = await fetch(API + '/fx/rates');
      rates = await res.json();
    } catch (e) {
      rates = { ok: false, error: 'unavailable' };
    }
    const meta = document.getElementById('fxMeta');
    if (meta) {
      if (rates && rates.ok) meta.textContent = 'Rates: ' + rates.source + '. ECB date ' + rates.date + '. Approximate' + (rates.fallback ? ', from the last saved rate' : '') + '.';
      else if (rates && rates.stale) meta.textContent = 'The exchange rate is too old to show' + (rates.date ? ' (' + rates.date + ')' : '') + '.';
      else meta.textContent = 'Exchange rates are unavailable. Agreement amounts stay as written.';
    }
    paint();
  }
  async function loadSuggest() {
    if (chosen()) { showOffer(null); return; }
    try {
      const res = await fetch(API + '/fx/suggest');
      const body = await res.json();
      showOffer(body);
    } catch (e) { showOffer(null); }
  }
  function wireSuggest() {
    const accept = document.getElementById('fxAccept');
    const dismiss = document.getElementById('fxDismiss');
    if (accept) accept.addEventListener('click', () => {
      if (!offer) return;
      save(offer);
      const sel = document.getElementById('displayCcy');
      if (sel) sel.value = offer;
      showOffer(null);
      paint();
    });
    if (dismiss) dismiss.addEventListener('click', () => {
      save(displayCode());
      showOffer(null);
    });
  }

  async function loadIdentity() {
    const status = document.getElementById('idvStatus');
    if (!status) return;
    const a = acct();
    if (!a || !a.id || !a.key) {
      status.textContent = 'Not started. This check is available after this browser has an account key, and the account works without it.';
      return;
    }
    try {
      const res = await fetch(API + '/account/identity', { headers: { Authorization: 'Bearer ' + a.id + '.' + a.key } });
      const body = await res.json();
      status.textContent = 'Status: ' + (LABELS[body.status] || 'Not started') + '.';
    } catch (e) {
      status.textContent = 'The identity status could not be loaded. The account still works.';
    }
  }
  function wireIdentity() {
    const button = document.getElementById('idvStart');
    if (!button) return;
    button.addEventListener('click', async () => {
      const msg = document.getElementById('idvMsg');
      const box = document.getElementById('idvConsent');
      const a = acct();
      if (!a || !a.id) { if (msg) msg.textContent = 'Create or restore an account key first. Documents still work without this check.'; return; }
      if (!box || !box.checked) { if (msg) msg.textContent = 'Tick the consent box first. The check stays optional.'; return; }
      try {
        const res = await fetch(API + '/account/identity/start', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + a.id + '.' + a.key }, body: JSON.stringify({ consent: true }) });
        const body = await res.json();
        if (msg) msg.textContent = body.ok ? 'The check is pending. No provider is connected, so this cannot become verified from this page.' : (body.error || 'The check did not start.');
        await loadIdentity();
      } catch (e) { if (msg) msg.textContent = 'Network error. The account is unchanged.'; }
    });
  }

  function boot() {
    fillSelect();
    wireSuggest();
    wireIdentity();
    ['currency', 'price', 'priceDir', 'taxRate', 'origAmount'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', paint);
      if (el) el.addEventListener('change', paint);
    });
    const history = document.getElementById('history');
    if (history && window.MutationObserver) new MutationObserver(() => paint()).observe(history, { childList: true });
    loadRates();
    loadSuggest();
    loadIdentity();
    window.addEventListener('hashchange', loadIdentity);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
