'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const steps = [...document.querySelectorAll('#formbox .step')];
  const names = () => [1, 2, 3, 4, 5].map(n => window.scT ? scT('step.' + n) : String(n));
  let step = 1;
  const progress = $('progress');
  names().forEach((name, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = String(i + 1);
    b.setAttribute('aria-label', 'Step ' + (i + 1) + ', ' + name);
    b.addEventListener('click', () => { if (i + 1 < step) go(i + 1); });
    li.appendChild(b);
    progress.appendChild(li);
  });
  function go(n) {
    step = n;
    steps.forEach(s => { s.hidden = Number(s.dataset.step) !== n; });
    const nm = names();
    $('stepLabel').textContent = window.scT ? scT('step.label', { n: n, name: nm[n - 1] }) : ('Step ' + n + ' of 5 · ' + nm[n - 1]);
    [...progress.children].forEach((li, i) => {
      li.firstChild.textContent = String(i + 1);
      li.firstChild.setAttribute('aria-label', 'Step ' + (i + 1) + ', ' + nm[i]);
      const b = li.firstChild;
      b.disabled = i + 1 > n;
      if (i + 1 === n) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    $('back').hidden = n === 1;
    $('next').hidden = n === 5;
    $('gen').hidden = n !== 5;
    if ($('catalog')) $('catalog').hidden = n !== 1;
    if (n === 4) paintReview();
    if (n === 5) window.dispatchEvent(new Event('sc-step'));
  }
  function val(id) { return ($(id) && $(id).value || '').trim(); }
  function bad(id, text) {
    const el = $(id), err = $(id + '-e');
    if (el) el.setAttribute('aria-invalid', 'true');
    if (err) err.textContent = text;
    $('msg').textContent = text;
    if (el && el.focus) el.focus();
    return false;
  }
  function clearStep(n) {
    steps[n - 1].querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    steps[n - 1].querySelectorAll('.ferr').forEach(el => { el.textContent = ''; });
    $('msg').textContent = '';
  }
  const PH = /\[[^\]\n]{1,60}\]/;
  function validate(n) {
    clearStep(n);
    if (n === 1) {
      const tpl = val('tpl');
      const blank = !tpl || tpl === 'custom' || tpl.indexOf('u:') === 0;
      if (!blank && !val('title')) return bad('title', window.scT ? scT('err.title') : 'This starting point needs a title.');
      if (!blank && !val('job')) return bad('job', window.scT ? scT('err.job') : 'This starting point needs the job or contract.');
      if (!val('desc')) return bad('desc', window.scT ? scT('err.desc') : 'Describe what changed.');
      if (PH.test(val('desc')) || PH.test(val('job')) || PH.test(val('title'))) return bad('desc', window.scT ? scT('err.placeholders') : 'Replace the bracketed examples before you continue.');
    }
    if (n === 2) {
      if (!val('biz')) return bad('biz', window.scT ? scT('err.biz') : 'Please type your name.');
      if (!val('client')) return bad('client', window.scT ? scT('err.client') : "Please type the other party's name.");
    }
    if (n === 3) {
      const dir = val('priceDir');
      const price = val('price');
      const tpl = val('tpl');
      const schedule = { jobschedule: 1, deadline: 1, deliverydate: 1, course: 1 };
      const zeroOk = schedule[tpl];
      const amount = Number(String(price).replace(',', '.'));
      if (schedule[tpl] && !val('newDate')) return bad('newDate', window.scT ? scT('err.newDate') : 'This starting point needs the new date.');
      if (val('tpl') === 'duration' && !val('newDate')) return bad('newDate', window.scT ? scT('err.newDate') : 'This starting point needs the new end date.');
      if (dir !== 'none' && !/^\d{1,9}([.,]\d{1,2})?$/.test(price)) return bad('price', window.scT ? scT('err.price') : 'Amount should be a number like 250 or 250.00.');
      if (dir !== 'none' && amount === 0 && !zeroOk) return bad('price', window.scT ? scT('err.zero') : 'This starting point needs an amount greater than zero, or choose no price change.');
      if (val('origAmount') && !/^\d{1,9}([.,]\d{1,2})?$/.test(val('origAmount'))) return bad('origAmount', window.scT ? scT('err.orig') : 'Original amount should be a number like 5000.00.');
      if (val('taxRate') && !(/^\d{1,3}([.,]\d{1,3})?$/.test(val('taxRate')) && Number(val('taxRate').replace(',', '.')) <= 100)) return bad('taxRate', window.scT ? scT('err.tax') : 'Tax rate should be between 0 and 100.');
      if (val('payTerms') === 'custom' && !val('payCustom')) return bad('payCustom', window.scT ? scT('err.pay') : 'Describe the custom payment terms.');
    }
    return true;
  }
  function paintReview() {
    const sheet = $('reviewSheet');
    sheet.textContent = '';
    const h = document.createElement('h3');
    h.textContent = val('title') || 'Signed Change Record';
    sheet.appendChild(h);
    const p = document.createElement('p');
    p.textContent = window.scT ? scT('review.co') : 'The change-order number is assigned when you create this.';
    sheet.appendChild(p);
    const dl = document.createElement('dl');
    dl.className = 'rows';
    const row = (a, b) => { const dt = document.createElement('dt'); dt.textContent = a; const dd = document.createElement('dd'); dd.textContent = b || '—'; dl.append(dt, dd); };
    row('From', [val('biz'), val('bizRole'), val('bizCo')].filter(Boolean).join(', '));
    row('To', [val('client'), val('clientRole'), val('clientCo')].filter(Boolean).join(', '));
    row('Change', val('desc'));
    row('Money preview', $('totals') ? $('totals').textContent : '');
    row('Schedule', [val('newDate') && ('New date ' + val('newDate')), 'Days added ' + (val('daysAdded') || '0')].filter(Boolean).join('. '));
    row('Payment', val('payTerms') === 'custom' ? val('payCustom') : (val('payTerms') || 'Not specified'));
    row('Agreement', $('agreePrev') ? $('agreePrev').textContent : '');
    sheet.appendChild(dl);
  }
  $('formbox').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || step >= 5) return;
    e.preventDefault();
    $('next').click();
  });
  $('next').addEventListener('click', () => { if (validate(step)) go(step + 1); });
  $('back').addEventListener('click', () => { if (step > 1) go(step - 1); });
  $('gen').addEventListener('click', e => {
    if (!$('creatorAgree').checked) {
      e.stopImmediatePropagation();
      $('msg').textContent = window.scT ? scT('err.agree') : 'Tick the box to confirm you agree before creating the record.';
      $('creatorAgree').focus();
    }
  }, true);
  function showView() {
    const h = location.hash;
    const docs = $('view-docs'), create = $('view-create'), account = $('view-account');
    const mode = h === '#create' ? 'create' : (h === '#account' || h === '#buy' ? 'account' : 'docs');
    docs.hidden = mode !== 'docs';
    create.hidden = mode !== 'create';
    account.hidden = mode !== 'account';
    const cur = mode === 'account' ? 'nav-account' : 'nav-docs';
    ['nav-docs', 'nav-account'].forEach(id => { const a = $(id); if (!a) return; if (id === cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (h === '#buy' && $('buy')) $('buy').scrollIntoView();
    if (mode === 'create') window.dispatchEvent(new Event('sc-step'));
  }
  window.addEventListener('hashchange', showView);
  if ($('akey')) $('akey').type = 'password';
  if ($('revealkey')) $('revealkey').addEventListener('click', () => {
    if (!confirm('Anyone who can see this screen will be able to read your account key. Reveal it?')) return;
    $('akey').type = $('akey').type === 'password' ? 'text' : 'password';
  });
  const theme = $('themePick');
  if (theme) {
    try { theme.value = localStorage.getItem('sc_theme') || 'system'; } catch (e) {}
    theme.addEventListener('change', () => { if (window.scSetTheme) window.scSetTheme(theme.value); });
  }
  if (window.scOnLang) scOnLang(() => go(step));
  go(1);
  showView();
})();
