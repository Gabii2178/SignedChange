/* Offered interface languages are English and French. Further packs stay unloaded until every interface string they would show is translated. Agreement text follows the agreement-language field, not this control. */
(function () {
  var KEY = 'sc_lang';
  var OFFERED = ['en', 'fr'];
  var LOCALES = OFFERED;
  var RTL = { ar: 1 };
  var ENDONYM = { en: 'English', fr: 'Français', es: 'Español', de: 'Deutsch', it: 'Italiano', pt: 'Português', ar: 'العربية', ru: 'Русский', hi: 'हिन्दी', bn: 'বাংলা', id: 'Bahasa Indonesia', tr: 'Türkçe' };
  var listeners = [];
  var missing = [];
  function pack() { return window.SC_MESSAGES || { en: {}, fr: {} }; }
  function current() {
    try {
      var s = localStorage.getItem(KEY);
      if (s === 'fr') return 'fr';
      if (s && s !== 'en') localStorage.setItem(KEY, 'en');
    } catch (e) {}
    return 'en';
  }
  function fill(s, vars) {
    if (!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] == null ? '' : String(vars[k]); });
  }
  function lookup(lang, key) {
    var all = pack();
    var table = all[lang] || {};
    if (Object.prototype.hasOwnProperty.call(table, key) && table[key]) return table[key];
    return null;
  }
  function scT(key, vars) {
    var lang = current();
    var hit = lookup(lang, key);
    if (hit == null) {
      missing.push(lang + ':' + key);
      hit = lookup('en', key);
    }
    if (hit == null) return key;
    return fill(hit, vars);
  }
  function localeTag() {
    var map = { en: 'en', fr: 'fr', es: 'es', de: 'de', it: 'it', pt: 'pt', ar: 'ar', ru: 'ru', hi: 'hi', bn: 'bn', id: 'id', tr: 'tr' };
    return map[current()] || 'en';
  }
  function scFormatDay(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) return iso || '';
    try { return new Intl.DateTimeFormat(localeTag(), { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))); }
    catch (e) { return iso; }
  }
  function scFormatMoney(amount, currency) {
    var n = Number(amount);
    if (!isFinite(n)) return String(amount);
    var cur = /^[A-Z]{3}$/.test(currency || '') ? currency : 'USD';
    try { return new Intl.NumberFormat(localeTag(), { style: 'currency', currency: cur }).format(n); }
    catch (e) { return (currency || '') + ' ' + n.toFixed(2); }
  }
  function paintLang() {
    document.querySelectorAll('#sc-lang').forEach(function (sel) {
      var v = current();
      if (sel.options.length !== LOCALES.length) {
        sel.textContent = '';
        LOCALES.forEach(function (code) {
          var o = document.createElement('option');
          o.value = code;
          o.textContent = ENDONYM[code];
          sel.appendChild(o);
        });
      }
      sel.value = v;
    });
  }
  function apply() {
    var lang = current();
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL[lang] ? 'rtl' : 'ltr';
    paintLang();
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      if (el.closest('.english-original')) return;
      if (el.querySelector('input, select, textarea, button') && el.tagName !== 'OPTION') return;
      el.textContent = scT(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('.translated-article, .source-note').forEach(function (el) { el.remove(); });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      if (el.closest('.english-original') || el.classList.contains('translated-article')) return;
      el.innerHTML = scT(el.getAttribute('data-i18n-html'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = scT(el.getAttribute('data-i18n-placeholder'));
    });
    var menu = document.getElementById('burger');
    if (menu && menu.getAttribute('data-i18n')) menu.textContent = scT('nav.menu');
    document.querySelectorAll('.english-original').forEach(function (el) {
      el.hidden = false;
      if (el.tagName === 'DETAILS') {
        el.open = true;
        var summary = el.querySelector('summary');
        if (summary) summary.hidden = true;
      }
    });
    listeners.forEach(function (fn) { try { fn(lang); } catch (e) {} });
  }
  function scSetLang(lang) {
    var next = lang === 'fr' ? 'fr' : 'en';
    try { localStorage.setItem(KEY, next); } catch (e) {}
    apply();
    return next;
  }
  function scMissing() { return missing.slice(); }
  function scCoverage() {
    var all = pack();
    var en = all.en || {};
    var gaps = {};
    LOCALES.forEach(function (code) {
      if (code === 'en') return;
      gaps[code] = Object.keys(en).filter(function (k) { return !all[code] || !all[code][k]; });
    });
    return gaps;
  }
  function scUnkeyed(root) {
    var lang = current();
    if (lang === 'en') return [];
    var out = [];
    var walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) {
      var p = n.parentElement;
      if (!p) continue;
      if (p.closest('.english-original, [data-keep], script, style, #paySub, #payLife, .payment-frozen')) continue;
      if (p.closest('[data-i18n], [data-i18n-html]')) continue;
      var t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (t.length < 4) continue;
      if (!/[A-Za-z]{4,}/.test(t)) continue;
      if (/^\$[\d,.]+$/.test(t)) continue;
      out.push(t.slice(0, 80));
    }
    return out;
  }
  window.scT = scT;
  window.scSetLang = scSetLang;
  window.scLang = current;
  window.scLocales = function () { return LOCALES.slice(); };
  window.scLocale = localeTag;
  window.scFormatDay = scFormatDay;
  window.scFormatMoney = scFormatMoney;
  window.scOnLang = function (fn) { listeners.push(fn); };
  window.scDirFor = function (lang) { return RTL[lang] ? 'rtl' : 'ltr'; };
  window.scMissing = scMissing;
  window.scCoverage = scCoverage;
  window.scUnkeyed = scUnkeyed;
  function boot() { apply(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
