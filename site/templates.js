'use strict';
(function () {
  const CATS = [
    ['creative', 'Freelancers and creative work', ['freelance', 'designrev', 'webbuild', 'writing', 'photovideo', 'freelancemilestone']],
    ['software', 'Software, IT and digital services', ['software', 'sitemaint', 'saaschange', 'itsupport', 'techconsult']],
    ['property', 'Construction, engineering and property', ['construction', 'materials', 'renovation', 'propmaint', 'landlord', 'jobschedule']],
    ['employment', 'Employment and human resources', ['duties', 'employment', 'compensation', 'rolechange', 'duration']],
    ['agency', 'Agencies, marketing and media', ['campaign', 'social', 'adbudget', 'branding', 'agency']],
    ['commerce', 'Business operations and commerce', ['supplier', 'purchase', 'deliverydate', 'partner', 'consultant', 'smallbiz']],
    ['finance', 'Finance and payment arrangements', ['installments', 'deadline', 'paymiles', 'balance']],
    ['education', 'Education, training and events', ['training', 'course', 'event', 'eventbudget']],
    ['logistics', 'Logistics and professional services', ['transport', 'servicemaint', 'hospitality', 'agriculture']]
  ];
  const $ = id => document.getElementById(id);
  function tpl(key) { return (window.SC_TPL && window.SC_TPL[key]) || null; }
  function shown(key) {
    const t = tpl(key);
    if (!t) return null;
    if (window.scLang && scLang() === 'fr' && window.SC_TPL_FR && SC_TPL_FR[key]) return Object.assign({}, t, SC_TPL_FR[key]);
    return t;
  }
  function titleFor(key) {
    const t = shown(key);
    if (!t) return key;
    return t.blank ? (window.scT ? scT('tpl.custom') : 'Blank (write your own)') : (t.title || key);
  }
  function showPreview(key) {
    const box = $('tplPreview');
    const t = shown(key);
    if (!box || !t) return;
    box.hidden = false;
    box.textContent = '';
    const h = document.createElement('h3');
    h.textContent = window.scT ? scT('tpl.preview') : 'Preview';
    const use = document.createElement('p');
    use.textContent = t.use || '';
    const title = document.createElement('p');
    title.textContent = t.blank ? 'Title, job, description and amount stay empty until you write them.' : (t.title || '');
    const body = document.createElement('p');
    body.textContent = t.blank ? 'Blank starting point.' : (t.desc || '');
    const note = document.createElement('p');
    note.textContent = window.scT ? scT('tpl.advice') : 'Starting point, not legal advice. Review it before anyone signs, and get professional advice when the change matters.';
    box.append(h, use, title, body, note);
  }
  function useTemplate(key) {
    showPreview(key);
    const sel = $('tpl');
    if (!sel) return;
    sel.value = key;
    sel.dispatchEvent(new Event('change'));
    if (sel.value !== key) return;
    const box = document.getElementById('catalog');
    if (box && box.tagName === 'DETAILS') box.open = false;
    const title = $('title');
    if (title) title.scrollIntoView({ block: 'center' });
  }
  function row(key, name) {
    const t = shown(key);
    if (!t) return null;
    const card = document.createElement('article');
    card.className = 'tpl-row' + (t.blank ? ' tpl-blank' : '');
    const copy = document.createElement('div');
    const h = document.createElement('h3');
    h.textContent = titleFor(key);
    const p = document.createElement('p');
    p.className = 'small';
    p.textContent = t.use || name || '';
    copy.append(h, p);
    const actions = document.createElement('div');
    actions.className = 'tpl-actions';
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'btn ghost';
    preview.textContent = window.scT ? scT('tpl.preview') : 'Preview';
    preview.addEventListener('click', () => showPreview(key));
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn secondary';
    b.textContent = t.blank ? (window.scT ? scT('tpl.blank') : 'Start blank') : (window.scT ? scT('tpl.use') : 'Use this starting point');
    b.addEventListener('click', () => useTemplate(key));
    actions.append(preview, b);
    card.append(copy, actions);
    return card;
  }
  function render() {
    const list = $('tplList');
    const cat = $('tplCat');
    if (!list || !cat || !window.SC_TPL) return;
    const keep = cat.value;
    cat.textContent = '';
    const all = document.createElement('option');
    all.value = 'all';
    all.textContent = window.scT ? scT('tpl.all') : 'All categories';
    cat.appendChild(all);
    CATS.forEach(([id, name]) => {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = name;
      cat.appendChild(o);
    });
    if ([...cat.options].some(o => o.value === keep)) cat.value = keep;
    const q = ($('tplSearch') && $('tplSearch').value || '').trim().toLowerCase();
    const chosen = cat.value || 'all';
    list.textContent = '';
    let shownCount = 0;
    const blank = tpl('custom');
    if (blank && chosen === 'all') {
      const blob = ('blank ' + titleFor('custom') + ' ' + (blank.use || '')).toLowerCase();
      if (!q || blob.includes(q)) {
        const card = row('custom', 'Blank');
        if (card) { list.appendChild(card); shownCount += 1; }
      }
    }
    CATS.forEach(([id, name, keys]) => {
      if (chosen !== 'all' && chosen !== id) return;
      const matches = keys.filter(key => {
        const t = shown(key);
        if (!t) return false;
        const blob = (name + ' ' + titleFor(key) + ' ' + (t.use || '') + ' ' + (t.desc || '') + ' ' + (t.job || '')).toLowerCase();
        return !q || blob.includes(q);
      });
      if (!matches.length) return;
      const sec = document.createElement('details');
      sec.className = 'tpl-sec';
      sec.open = chosen !== 'all' || !!q;
      const summary = document.createElement('summary');
      const label = document.createElement('span');
      label.textContent = window.scT ? scT('cat.' + id) : name;
      const count = document.createElement('span');
      count.className = 'tpl-count';
      count.textContent = String(matches.length);
      summary.append(label, count);
      sec.appendChild(summary);
      matches.forEach(key => {
        const card = row(key, name);
        if (!card) return;
        sec.appendChild(card);
        shownCount += 1;
      });
      list.appendChild(sec);
    });
    if (!shownCount) {
      const empty = document.createElement('p');
      empty.id = 'tplEmpty';
      empty.textContent = window.scT ? scT('tpl.none') : 'No starting points match that search.';
      list.appendChild(empty);
    }
  }
  function init() {
    if (!$('tplList')) return;
    $('tplSearch') && $('tplSearch').addEventListener('input', render);
    $('tplCat') && $('tplCat').addEventListener('change', render);
    if (window.scOnLang) scOnLang(render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
