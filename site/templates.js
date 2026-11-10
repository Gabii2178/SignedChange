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
  function titleFor(key) {
    const t = tpl(key);
    if (!t) return key;
    return t.blank ? 'Blank (write your own)' : (t.title || key);
  }
  function showPreview(key) {
    const box = $('tplPreview');
    const t = tpl(key);
    if (!box || !t) return;
    box.hidden = false;
    box.textContent = '';
    const h = document.createElement('h3');
    h.textContent = 'Preview';
    const use = document.createElement('p');
    use.textContent = t.use || '';
    const title = document.createElement('p');
    title.textContent = t.blank ? 'Title, job, description and amount stay empty until you write them.' : (t.title || '');
    const body = document.createElement('p');
    body.textContent = t.blank ? 'Blank starting point.' : (t.desc || '');
    const note = document.createElement('p');
    note.textContent = 'Starting point, not legal advice. Review it before anyone signs, and get professional advice when the change matters.';
    box.append(h, use, title, body, note);
  }
  function render() {
    const list = $('tplList');
    const cat = $('tplCat');
    if (!list || !cat || !window.SC_TPL) return;
    const keep = cat.value;
    cat.textContent = '';
    const all = document.createElement('option');
    all.value = 'all';
    all.textContent = 'All categories';
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
    let shown = 0;
    CATS.forEach(([id, name, keys]) => {
      if (chosen !== 'all' && chosen !== id) return;
      keys.forEach(key => {
        const t = tpl(key);
        if (!t) return;
        const uiTitle = titleFor(key);
        const blob = (name + ' ' + uiTitle + ' ' + (t.use || '') + ' ' + (t.desc || '') + ' ' + (t.job || '')).toLowerCase();
        if (q && !blob.includes(q)) return;
        shown += 1;
        const card = document.createElement('article');
        card.className = 'card';
        const h = document.createElement('h3');
        h.textContent = uiTitle;
        const catp = document.createElement('p');
        catp.className = 'small';
        catp.textContent = name;
        const p = document.createElement('p');
        p.textContent = t.use || '';
        const advice = document.createElement('p');
        advice.className = 'small';
        advice.textContent = 'Starting point, not legal advice.';
        const preview = document.createElement('button');
        preview.type = 'button';
        preview.className = 'btn ghost';
        preview.textContent = 'Preview';
        preview.addEventListener('click', () => showPreview(key));
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn secondary';
        b.textContent = t.blank ? 'Start blank' : 'Use this starting point';
        b.addEventListener('click', () => {
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
        });
        card.append(h, catp, p, advice, preview, b);
        list.appendChild(card);
      });
    });
    const blank = tpl('custom');
    if (blank && (chosen === 'all' || chosen === 'general')) {
      const uiTitle = titleFor('custom');
      const blob = ('blank ' + uiTitle + ' ' + (blank.use || '')).toLowerCase();
      if (!q || blob.includes(q)) {
        shown += 1;
        const card = document.createElement('article');
        card.className = 'card';
        const h = document.createElement('h3');
        h.textContent = uiTitle;
        const catp = document.createElement('p');
        catp.className = 'small';
        catp.textContent = 'Blank';
        const p = document.createElement('p');
        p.textContent = blank.use || '';
        const advice = document.createElement('p');
        advice.className = 'small';
        advice.textContent = 'Starting point, not legal advice.';
        const preview = document.createElement('button');
        preview.type = 'button';
        preview.className = 'btn ghost';
        preview.textContent = 'Preview';
        preview.addEventListener('click', () => showPreview('custom'));
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn secondary';
        b.textContent = 'Start blank';
        b.addEventListener('click', () => {
          showPreview('custom');
          const sel = $('tpl');
          if (!sel) return;
          sel.value = 'custom';
          sel.dispatchEvent(new Event('change'));
          if (sel.value !== 'custom') return;
          const box = document.getElementById('catalog');
          if (box) box.open = false;
          const title = $('title');
          if (title) title.scrollIntoView({ block: 'center' });
        });
        card.append(h, catp, p, advice, preview, b);
        list.appendChild(card);
      }
    }
    if (!shown) {
      const empty = document.createElement('p');
      empty.id = 'tplEmpty';
      empty.textContent = 'No starting points match that search.';
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
