(function () {
  var k = 'sc_theme';
  function apply(v) {
    if (v === 'light' || v === 'dark') document.documentElement.setAttribute('data-theme', v);
    else document.documentElement.removeAttribute('data-theme');
  }
  try { apply(localStorage.getItem(k) || ''); } catch (e) {}
  window.scSetTheme = function (v) {
    try { localStorage.setItem(k, v); } catch (e) {}
    apply(v === 'system' ? '' : v);
    document.querySelectorAll('#sc-theme, #themePick').forEach(function (sel) { if (sel.value !== v) sel.value = v; });
  };
  function bind() {
    var stored = 'system';
    try { stored = localStorage.getItem(k) || 'system'; } catch (e) {}
    document.querySelectorAll('#sc-theme, #themePick').forEach(function (sel) {
      sel.value = stored === 'light' || stored === 'dark' ? stored : 'system';
      sel.addEventListener('change', function () { window.scSetTheme(sel.value); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
