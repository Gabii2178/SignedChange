/* Compact theme and language controls. English is the only active interface language. */
(function () {
  function svg(name) {
    if (name === 'sun') return '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    if (name === 'moon') return '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    if (name === 'monitor') return '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 20h8M12 16v4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    return '<svg class="globe" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M5 8h14M5 16h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  function storedTheme() {
    try { return localStorage.getItem('sc_theme') || 'system'; } catch (e) { return 'system'; }
  }
  function closeAll(except) {
    document.querySelectorAll('.pop-menu').forEach(function (menu) {
      if (menu === except) return;
      menu.hidden = true;
      var b = menu.parentElement && menu.parentElement.querySelector('.icon-btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  function wireMenu(btn, menu) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.hidden;
      closeAll(open ? menu : null);
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var on = menu.querySelector('[aria-checked="true"]') || menu.querySelector('button:not(:disabled)');
        if (on) on.focus();
      }
    });
    menu.addEventListener('keydown', function (e) {
      var items = [...menu.querySelectorAll('button:not(:disabled)')];
      var i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
  }
  function paint(root) {
    var mode = storedTheme();
    root.querySelectorAll('[data-theme-choice]').forEach(function (b) {
      b.setAttribute('aria-checked', b.getAttribute('data-theme-choice') === mode ? 'true' : 'false');
    });
    var icon = mode === 'light' ? 'sun' : mode === 'dark' ? 'moon' : 'monitor';
    var themeBtn = root.querySelector('.theme-btn');
    if (themeBtn) {
      themeBtn.innerHTML = svg(icon);
      themeBtn.setAttribute('aria-label', 'Theme, ' + (mode === 'system' ? 'match this device' : mode));
    }
    var lang = 'en';
    try { lang = localStorage.getItem('sc_lang') === 'fr' ? 'fr' : 'en'; } catch (e) {}
    var langBtn = root.querySelector('.lang-btn');
    if (langBtn) {
      var tag = langBtn.querySelector('.en-tag');
      if (tag) tag.textContent = lang === 'fr' ? 'FR' : 'EN';
      langBtn.setAttribute('aria-label', lang === 'fr' ? 'Langue, français' : 'Language, English');
    }
    root.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-checked', b.getAttribute('data-lang') === lang ? 'true' : 'false');
    });
    var words = lang === 'fr' ? { light: 'Clair', dark: 'Sombre', system: 'Système' } : { light: 'Light', dark: 'Dark', system: 'System' };
    root.querySelectorAll('[data-theme-choice]').forEach(function (b) {
      var last = b.lastChild;
      var label = words[b.getAttribute('data-theme-choice')] || '';
      if (last && last.nodeType === 3) last.nodeValue = ' ' + label;
    });
  }
  function mount(host) {
    if (!host || host.dataset.compact === '1') return;
    host.dataset.compact = '1';
    host.className = 'compact-prefs';
    host.innerHTML = ''
      + '<div class="pop"><button type="button" class="icon-btn lang-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Language">' + svg('globe') + '<span class="en-tag">EN</span></button>'
      + '<div class="pop-menu" role="menu" hidden>'
      + '<button type="button" role="menuitemradio" data-lang="en">English</button>'
      + '<button type="button" role="menuitemradio" data-lang="fr">Français</button>'
      + '</div></div>'
      + '<div class="pop"><button type="button" class="icon-btn theme-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Theme"></button>'
      + '<div class="pop-menu" role="menu" hidden>'
      + '<button type="button" role="menuitemradio" data-theme-choice="light">' + svg('sun') + ' Light</button>'
      + '<button type="button" role="menuitemradio" data-theme-choice="dark">' + svg('moon') + ' Dark</button>'
      + '<button type="button" role="menuitemradio" data-theme-choice="system">' + svg('monitor') + ' System</button>'
      + '</div></div>'
      + '<span class="sr-only pref-live" aria-live="polite"></span>';
    var themeBtn = host.querySelector('.theme-btn');
    var themeMenu = themeBtn.parentElement.querySelector('.pop-menu');
    var langBtn = host.querySelector('.lang-btn');
    var langMenu = langBtn.parentElement.querySelector('.pop-menu');
    wireMenu(themeBtn, themeMenu);
    wireMenu(langBtn, langMenu);
    themeMenu.addEventListener('click', function (e) {
      var b = e.target.closest('[data-theme-choice]');
      if (!b || !window.scSetTheme) return;
      window.scSetTheme(b.getAttribute('data-theme-choice'));
      paint(host);
      themeMenu.hidden = true;
      themeBtn.setAttribute('aria-expanded', 'false');
      var live = host.querySelector('.pref-live');
      if (live) live.textContent = 'Theme set to ' + b.getAttribute('data-theme-choice');
      themeBtn.focus();
    });
    langMenu.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lang]');
      if (!b || !window.scSetLang) return;
      window.scSetLang(b.getAttribute('data-lang'));
      paint(host);
      langMenu.hidden = true;
      langBtn.setAttribute('aria-expanded', 'false');
      var live = host.querySelector('.pref-live');
      if (live) live.textContent = b.getAttribute('data-lang') === 'fr' ? 'Langue : français' : 'Language: English';
      langBtn.focus();
    });
    paint(host);
  }
  function boot() {
    try {
      var lang = localStorage.getItem('sc_lang');
      if (lang && lang !== 'en' && lang !== 'fr') localStorage.setItem('sc_lang', 'en');
    } catch (e) {}
    document.querySelectorAll('.prefs, .compact-prefs').forEach(mount);
    if (window.scOnLang) window.scOnLang(function () { document.querySelectorAll('.compact-prefs').forEach(paint); });
    if (window.scSetTheme) {
      var orig = window.scSetTheme;
      if (!orig._wrapped) {
        window.scSetTheme = function (v) { orig(v); document.querySelectorAll('.compact-prefs').forEach(paint); };
        window.scSetTheme._wrapped = true;
      }
    }
  }
  document.addEventListener('click', function () { closeAll(null); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.pop-menu').forEach(function (menu) {
      if (menu.hidden) return;
      menu.hidden = true;
      var b = menu.parentElement.querySelector('.icon-btn');
      if (b) { b.setAttribute('aria-expanded', 'false'); b.focus(); }
    });
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
