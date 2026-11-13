import { sendWelcome } from './email.js';
import { resolveTemplate, schemaFor, unknownFields, missingRequired, publicSchema, fieldIssues, isIsoCurrency } from './template-schema.js';
// SignedChange v2: accounts, server-side documents, remote signing, server-side PDF, subscriptions.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import qrcode from 'qrcode-generator';
const enc = new TextEncoder();
export const b64u = buf => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const rand = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
export async function sha256hex(s) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', typeof s === 'string' ? enc.encode(s) : s))].map(b => b.toString(16).padStart(2, '0')).join(''); }
const ID = /^[\w-]{20,40}$/;
export const FREE_DOCS = 3, FREE_PER_IP_MONTH = 10, NEW_ACCT_PER_IP_DAY = 5, SIGN_DAYS = 14, DOC_TTL = 2 * 365 * 86400;
const json = (o, s, h) => new Response(JSON.stringify(o), { status: s, headers: h });

async function lock(env, name, body) {
  const stub = env.GIFT_LOCK.get(env.GIFT_LOCK.idFromName(name));
  return (await stub.fetch('https://lock/', { method: 'POST', body: JSON.stringify(body) })).json();
}

// ---------- accounts ----------
export async function auth(req, env) {
  const m = /^Bearer ([\w-]{20,40})\.([\w-]{40,60})$/.exec(req.headers.get('Authorization') || '');
  if (!m) return null;
  const acct = await env.PAYMENTS.get('acct:' + m[1], 'json');
  if (!acct) return null;
  const h = await sha256hex('acct-v1:' + m[2]);
  if (h.length !== acct.kh.length) return null;
  let r = 0; for (let i = 0; i < h.length; i++) r |= h.charCodeAt(i) ^ acct.kh.charCodeAt(i);
  return r === 0 ? { id: m[1], ...acct } : null;
}
export async function newAccount(env, ipHash, h) {
  const day = new Date().toISOString().slice(0, 10);
  const r = await lock(env, `newacct:${ipHash}:${day}`, { op: 'use', limit: NEW_ACCT_PER_IP_DAY });
  if (!r.ok) return json({ ok: false, error: 'Too many new accounts from this network today.' }, 429, h);
  const id = rand(18), key = rand(32);
  await env.PAYMENTS.put('acct:' + id, JSON.stringify({ kh: await sha256hex('acct-v1:' + key), created: new Date().toISOString(), pro: null }));
  return json({ ok: true, id, key }, 200, h);
}
async function saveAcct(env, a) { const { id, ...rest } = a; await env.PAYMENTS.put('acct:' + id, JSON.stringify(rest)); }

// Pro status is always recomputed from the server-side source of truth (payment / subscription / gift records).
export async function proStatus(env, acct) {
  const p = acct && acct.pro;
  if (!p) return null;
  if (p.type === 'life') { const t = await env.PAYMENTS.get('txn:' + p.ref, 'json'); return t && !t.revoked && !t.sub ? { plan: 'lifetime' } : null; }
  if (p.type === 'gift') { const g = await env.PAYMENTS.get(p.ref, 'json'); return g && g.status === 'used' && !g.revoked ? { plan: 'gift' } : null; }
  if (p.type === 'sub') {
    const s = await env.PAYMENTS.get('sub:' + p.ref, 'json');
    if (!s || s.revoked || s.status === 'ended') return null;
    if ((s.paidThrough || 0) > Date.now()) return { plan: 'monthly', status: s.status, until: new Date(s.paidThrough).toISOString() };
    return null;
  }
  return null;
}
export async function grantPro(env, acctId, pro) {
  if (!acctId || !ID.test(acctId)) return false;
  const a = await env.PAYMENTS.get('acct:' + acctId, 'json');
  if (!a) return false;
  a.pro = pro; await env.PAYMENTS.put('acct:' + acctId, JSON.stringify(a));
  // post-unlock hook only: welcome email if Pro is really active now (dormant without BREVO_API_KEY)
  if (env.BREVO_API_KEY && (pro.type === 'life' || pro.type === 'sub')) { try { if (await proStatus(env, { pro })) await sendWelcome(env, acctId, pro); } catch {} }
  return true;
}

// ---------- validation ----------
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim().slice(0, max);
const cleanLine = (s, max) => clean(s, max).replace(/\n/g, ' ');
function pngOk(d) {
  if (typeof d !== 'string' || d.length > 200000 || !d.startsWith('data:image/png;base64,')) return null;
  try { const bin = atob(d.slice(22)); if (bin.length < 100 || bin.charCodeAt(0) !== 0x89 || bin.slice(1, 4) !== 'PNG') return null;
    const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return d; } catch { return null; }
}
export const MAX_ATT = 3, MAX_ATT_BYTES = 350 * 1024;
// attachments: JPEG/PNG only, magic bytes checked, size-capped
export function attOk(d) {
  if (typeof d !== 'string' || d.length > Math.ceil(MAX_ATT_BYTES * 4 / 3) + 40) return null;
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(d); if (!m) return null;
  let bin; try { bin = atob(m[2]); } catch { return null; }
  if (bin.length < 100 || bin.length > MAX_ATT_BYTES) return null;
  const jpg = bin.charCodeAt(0) === 0xFF && bin.charCodeAt(1) === 0xD8 && bin.charCodeAt(2) === 0xFF, png = bin.charCodeAt(0) === 0x89 && bin.slice(1, 4) === 'PNG';
  if (m[1] === 'jpeg' ? !jpg : !png) return null;
  return { type: m[1], size: bin.length, data: d };
}
const DATE = /^\d{4}-\d{2}-\d{2}$/, NUM = /^\d{1,9}([.,]\d{1,2})?$/;
function realDate(value) {
  if (!DATE.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
export const PLACEHOLDER = /\[[^\]\n]{1,60}\]/g;
const num = s => Math.round(parseFloat(String(s || '0').replace(',', '.')) * 100) / 100;
const PAY = ['', 'completion', 'net7', 'net14', 'net30', 'custom'];
export function readFields(b) {
  const f = b && b.fields || {}, v3 = !!(b && b.v === 3);
  const o = { biz: clean(f.biz, 120), contact: clean(f.contact, 120), client: clean(f.client, 120), clientContact: clean(f.clientContact, 120), job: clean(f.job, 160),
    title: clean(f.title, 80) || 'Signed Change Record', desc: clean(f.desc, 3000), price: clean(f.price, 20), currency: clean(f.currency, 8).toUpperCase().replace(/[^A-Z]/g, ''), date: clean(f.date, 10) };
  if (v3) {
    Object.assign(o, { bizCo: cleanLine(f.bizCo, 120), bizRole: cleanLine(f.bizRole, 60), clientCo: cleanLine(f.clientCo, 120), clientRole: cleanLine(f.clientRole, 60),
      priceDir: ['inc', 'dec', 'none'].includes(f.priceDir) ? f.priceDir : 'inc', origAmount: clean(f.origAmount, 20), taxRate: clean(f.taxRate, 8),
      newDate: clean(f.newDate, 10), daysAdded: clean(f.daysAdded, 5), payTerms: PAY.includes(f.payTerms) ? f.payTerms : '', payCustom: cleanLine(f.payCustom, 120),
      payMethod: cleanLine(f.payMethod, 80), contractDate: clean(f.contractDate, 10), lang: f.lang === 'fr' ? 'fr' : 'en', lines: [] });
    if (Array.isArray(f.lines)) {
      if (f.lines.length > 15) return { error: 'Up to 15 price lines.' };
      for (const x of f.lines) { const d = cleanLine(x && x.d, 120), a = clean(x && x.a, 20); if (!d && !a) continue;
        if (!d || !NUM.test(a)) return { error: 'Each price line needs a description and an amount like 120.00.' }; o.lines.push({ d, a }); }
    }
    if (o.lines.length) o.price = o.lines.reduce((s, x) => s + num(x.a), 0).toFixed(2);
    if (o.priceDir === 'none') o.price = o.price || '0';
    if (o.origAmount && !NUM.test(o.origAmount)) return { error: 'Original contract amount should be a number like 5000.00.', field: 'origAmount' };
    if (o.taxRate && (!/^\d{1,3}([.,]\d{1,3})?$/.test(o.taxRate) || num(o.taxRate) > 100)) return { error: 'Tax rate should be a percentage between 0 and 100.', field: 'taxRate' };
    if (o.newDate && !realDate(o.newDate)) return { error: 'New completion date is not a real calendar date.', field: 'newDate' };
    if (o.contractDate && !realDate(o.contractDate)) return { error: 'Original agreement date is not a real calendar date.', field: 'contractDate' };
    if (o.daysAdded === '') o.daysAdded = '0';
    if (!/^-?\d{1,4}$/.test(o.daysAdded)) return { error: 'Days added should be a whole number (0 if none).', field: 'daysAdded' };
    if (o.payTerms === 'custom' && !o.payCustom) return { error: 'Please describe the custom payment terms.', field: 'payCustom' };
  }
  if (o.currency && !isIsoCurrency(o.currency)) return { error: 'Choose a real currency code, such as USD, EUR or XAF.', field: 'currency' };
  if (!o.biz || !o.client || !o.desc || !o.price) return { error: 'Please fill your name, the other party, what changed and the amount.' };
  if (!NUM.test(o.price)) return { error: 'Amount should be a number like 250 or 250.00.', field: 'price' };
  if (o.date && !realDate(o.date)) return { error: 'The date is not a real calendar date.', field: 'date' };
  if (!o.date) o.date = new Date().toISOString().slice(0, 10);
  const ph = [...new Set([o.title, o.job, o.desc, o.payCustom || ''].join('\n').match(PLACEHOLDER) || [])];
  if (ph.length) return { error: 'Please replace the template placeholders first: ' + ph.slice(0, 5).join(', '), field: 'desc', placeholders: ph };
  if (v3 && b.mode !== 'inperson') {
    const c = o.clientContact; if (!c) return { error: "Add the other party's email or phone so the signing link can reach them.", field: 'clientContact' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) && (c.replace(/\D/g, '').length < 6 || /[^\d\s+().-]/.test(c))) return { error: "The other party's contact should be an email or a phone number.", field: 'clientContact' };
  }
  return { f: o };
}
export function amounts(f) {
  const dir = f.priceDir || 'inc', ch = dir === 'none' ? 0 : num(f.price) * (dir === 'dec' ? -1 : 1);
  const rate = f.taxRate ? num(f.taxRate) : 0, tax = Math.round(ch * rate) / 100, tot = Math.round((ch + tax) * 100) / 100;
  const orig = f.origAmount ? num(f.origAmount) : null;
  return { ch, rate, tax, tot, orig, newTotal: orig != null ? Math.round((orig + tot) * 100) / 100 : null };
}
export function agreementText(f, coNo) {
  const ref = f.job || (f.lang === 'fr' ? "l'accord initial" : 'the original agreement');
  if (f.lang === 'fr') return `J'accepte que cette modification (avenant n°${coNo}) amende ${ref}${f.contractDate ? ' daté du ' + f.contractDate : ''} ; toutes les autres conditions restent inchangées ; ma signature électronique a la même valeur qu'une signature manuscrite.`;
  return `I agree this change (CO #${coNo}) amends ${ref}${f.contractDate ? ' dated ' + f.contractDate : ''}; all other terms remain unchanged; my electronic signature has the same effect as a handwritten signature.`;
}

// ---------- PDF ----------
const MAP = { '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"', '\u2013': '-', '\u2014': '-', '\u2026': '...', '\u20AC': 'EUR ', '\u00A0': ' ', '\u2212': '-' };
const pdfSafe = s => String(s || '').replace(/[\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u20AC\u00A0\u2212]/g, c => MAP[c]).replace(/[^\n\x20-\x7E\xA1-\xFF]/g, '?');
function wrap(font, text, size, width) {
  const out = [];
  for (const para of pdfSafe(text).split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) {
      let word = w;
      while (font.widthOfTextAtSize(word, size) > width) { // break very long words
        let k = word.length; while (k > 1 && font.widthOfTextAtSize(word.slice(0, k), size) > width) k--;
        if (line) { out.push(line); line = ''; } out.push(word.slice(0, k)); word = word.slice(k);
      }
      const t = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(t, size) > width) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}
const b64bytes = d => { const bin = atob(d.split(',')[1]); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const V3KEYS = ['title', 'biz', 'bizCo', 'bizRole', 'contact', 'client', 'clientCo', 'clientRole', 'clientContact', 'job', 'contractDate', 'desc', 'lines', 'priceDir', 'price', 'origAmount', 'taxRate', 'currency', 'newDate', 'daysAdded', 'payTerms', 'payCustom', 'payMethod', 'date', 'lang'];
export async function contentHash(doc) {
  const f = doc.fields;
  if (doc.v !== 3) return sha256hex(JSON.stringify([f.title, f.biz, f.contact, f.client, f.job, f.desc, f.price, f.currency, f.date]));
  return sha256hex(JSON.stringify(['v3', V3KEYS.map(k => f[k] == null ? '' : f[k]), doc.coNo, doc.agreeText, (doc.atts || []).map(a => a.hash), doc.creatorSigHash]));
}
export async function finalHash(doc) {
  const parts = ['final-v3', doc.hash, doc.creatorSigHash, doc.otherSigHash, doc.signerName, doc.signedAt];
  if (doc.ownerSig) parts.push(await sha256hex(b64bytes(doc.ownerSig)));
  return sha256hex(JSON.stringify(parts));
}

const T = {
  en: { draft: 'DRAFT - AWAITING SIGNATURE OF ', declined: 'DECLINED BY ', co: 'Change order #', date: 'Date', from: 'From', other: 'Other party', job: 'Job / contract', cdate: 'Original agreement dated',
    change: 'Agreed change:', lines: 'Price breakdown:', orig: 'Original contract amount', inc: 'This change (increase)', dec: 'This change (decrease)', none: 'This change (no price change)',
    tax: 'Tax', chtot: 'Total of this change', newtot: 'New contract total', agreed: 'Agreed amount (this change): ', sched: 'Schedule impact', newDate: 'New completion date', days: 'Days added',
    pay: 'Payment terms', due: 'Due', method: 'Method', terms: { completion: 'On completion of this change', net7: 'Net 7 (within 7 days)', net14: 'Net 14 (within 14 days)', net30: 'Net 30 (within 30 days)' },
    sigC: 'Signed by (creator)', sigO: 'Signed by (other party)', name: 'Name: ', signed: 'Signed ', notyet: 'Not signed yet', audit: 'Audit trail', scan: 'Scan to verify', att: 'Attachment ', reason: 'Reason: ' },
  fr: { draft: 'BROUILLON - EN ATTENTE DE LA SIGNATURE DE ', declined: 'REFUSÉ PAR ', co: 'Avenant n°', date: 'Date', from: 'De', other: 'Autre partie', job: 'Travail / contrat', cdate: 'Accord initial daté du',
    change: 'Modification convenue :', lines: 'Détail du prix :', orig: 'Montant du contrat initial', inc: 'Cette modification (hausse)', dec: 'Cette modification (baisse)', none: 'Cette modification (sans changement de prix)',
    tax: 'Taxe', chtot: 'Total de cette modification', newtot: 'Nouveau total du contrat', agreed: 'Montant convenu (cette modification) : ', sched: 'Impact sur le calendrier', newDate: "Nouvelle date d'achèvement", days: 'Jours ajoutés',
    pay: 'Conditions de paiement', due: 'Échéance', method: 'Moyen', terms: { completion: 'À la fin de cette modification', net7: 'Sous 7 jours', net14: 'Sous 14 jours', net30: 'Sous 30 jours' },
    sigC: 'Signé par (créateur)', sigO: 'Signé par (autre partie)', name: 'Nom : ', signed: 'Signé le ', notyet: 'Pas encore signé', audit: "Piste d'audit", scan: 'Scanner pour vérifier', att: 'Pièce jointe ', reason: 'Motif : ' } };
const fmt = (n, cur, sign) => (sign && n > 0 ? '+' : n < 0 ? '-' : '') + (cur ? cur + ' ' : '') + Math.abs(n).toFixed(2);

export async function renderPdf(doc, opts = {}) {
  const pdf = await PDFDocument.create();
  const f = doc.fields, v3 = doc.v === 3, L = T[v3 && f.lang === 'fr' ? 'fr' : 'en'];
  pdf.setTitle(pdfSafe(f.title)); pdf.setCreator('SignedChange'); pdf.setProducer('SignedChange');
  const R = await pdf.embedFont(StandardFonts.Helvetica), B = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]); let y = 790; const X = 50, W = 495;
  const blue = rgb(0.06, 0.3, 0.5), grey = rgb(0.45, 0.45, 0.45), red = rgb(0.75, 0.2, 0.1);
  const pages = [page];
  const need = h => { if (y - h < 90) { page = pdf.addPage([595, 842]); pages.push(page); y = 790; } };
  const footer = p => {
    if (doc.tier === 'free') {
      p.drawRectangle({ x: 0, y: 0, width: 595, height: 34, color: rgb(0.93, 0.96, 1) });
      p.drawText('Made with SignedChange - try free at signedchange.com', { x: 297 - R.widthOfTextAtSize('Made with SignedChange - try free at signedchange.com', 10) / 2, y: 13, size: 10, font: B, color: blue });
    } else { const s = 'signedchange.com', w = R.widthOfTextAtSize(s, 7), pw = B.widthOfTextAtSize('PRO', 6) + 10, x0 = 297 - (w + 6 + pw) / 2;
      p.drawText(s, { x: x0, y: 14, size: 7, font: R, color: grey });
      p.drawRectangle({ x: x0 + w + 6, y: 11.5, width: pw, height: 10, color: rgb(0.96, 0.65, 0.14), opacity: 0.9 });
      p.drawText('PRO', { x: x0 + w + 11, y: 14.3, size: 6, font: B, color: rgb(0.35, 0.23, 0) }); }
    p.drawText('Document ID: ' + doc.id, { x: X, y: 42, size: 7, font: R, color: grey });
  };
  const text = (t, o = {}) => { const size = o.size || 11, font = o.bold ? B : R; for (const l of wrap(font, t, size, o.w || W)) { need(size + 4); page.drawText(l, { x: o.x || X, y, size, font, color: o.color || rgb(0, 0, 0) }); y -= size + 4; } };
  const row = (a, b, lw = 150) => { need(16); const ls = wrap(R, b, 11, W - lw); page.drawText(pdfSafe(a) + ':', { x: X, y, size: 11, font: B }); for (const l of ls) { need(15); page.drawText(l, { x: X + lw, y, size: 11, font: R }); y -= 15; } };
  const amt = (a, b, bold) => { need(16); page.drawText(pdfSafe(a), { x: X, y, size: 11, font: bold ? B : R }); const s = pdfSafe(b), fn = bold ? B : R; page.drawText(s, { x: X + W - fn.widthOfTextAtSize(s, 11), y, size: 11, font: fn }); y -= 16; };
  if (opts.sample) { page.drawText('SAMPLE', { x: 150, y: 400, size: 120, font: B, color: rgb(0.9, 0.9, 0.9), rotate: { type: 'degrees', angle: 35 } }); }
  text(f.title.toUpperCase(), { size: 18, bold: true, color: blue });
  if (v3) text(L.co + doc.coNo + (f.contractDate ? '  |  ' + L.cdate + ' ' + f.contractDate : ''), { size: 10, bold: true, color: grey });
  if (doc.status === 'declined') { text(L.declined + (doc.declinedBy || f.client).toUpperCase(), { size: 10, bold: true, color: red }); if (doc.declineReason) text(L.reason + doc.declineReason, { size: 9, color: red }); }
  else if (doc.status !== 'signed') text(L.draft + f.client.toUpperCase(), { size: 10, bold: true, color: red });
  y -= 6;
  const party = (n, co, role, c) => n + (role ? ', ' + role : '') + (co ? ' - ' + co : '') + (c ? '  |  ' + c : '');
  row(L.date, f.date); row(L.from, party(f.biz, f.bizCo, f.bizRole, f.contact)); row(L.other, party(f.client, f.clientCo, f.clientRole, f.clientContact)); row(L.job, f.job || '-');
  y -= 8; text(L.change, { bold: true }); text(f.desc); y -= 6;
  if (!v3) { text('Agreed amount: ' + (f.currency ? f.currency + ' ' : '') + f.price, { size: 14, bold: true }); y -= 4;
    text('By signing below, both parties confirm they agreed to the change described above at the stated amount, which is added to their original agreement.', { size: 9, color: grey }); }
  else {
    const a = amounts(f), cur = f.currency;
    if (f.lines && f.lines.length) { text(L.lines, { bold: true }); for (const l of f.lines) amt('  ' + l.d, fmt(num(l.a), cur)); y -= 4; }
    page.drawLine({ start: { x: X, y: y + 10 }, end: { x: X + W, y: y + 10 }, thickness: 0.5, color: grey });
    if (a.orig != null) amt(L.orig, fmt(a.orig, cur));
    amt(L[f.priceDir || 'inc'], fmt(a.ch, cur, true));
    if (a.rate) { amt(`${L.tax} (${a.rate}%)`, fmt(a.tax, cur, true)); amt(L.chtot, fmt(a.tot, cur, true), true); }
    if (a.newTotal != null) amt(L.newtot, fmt(a.newTotal, cur), true);
    else if (!a.rate) amt(L.agreed.replace(/: ?$/, '').trim(), fmt(a.tot, cur, true), true);
    y -= 6;
    if (f.newDate || +f.daysAdded) { text(L.sched, { bold: true }); if (f.newDate) row(L.newDate, f.newDate, 170); row(L.days, String(+f.daysAdded || 0), 170); y -= 4; }
    if (f.payTerms || f.payMethod) { text(L.pay, { bold: true }); if (f.payTerms) row(L.due, f.payTerms === 'custom' ? f.payCustom : L.terms[f.payTerms], 170); if (f.payMethod) row(L.method, f.payMethod, 170); y -= 4; }
    y -= 4; page.drawRectangle({ x: X - 4, y: y - 4 - 13 * wrap(R, doc.agreeText, 9.5, W - 8).length, width: W + 8, height: 13 * wrap(R, doc.agreeText, 9.5, W - 8).length + 14, color: rgb(0.95, 0.97, 1) });
    text(doc.agreeText, { size: 9.5, w: W - 8, x: X + 2 }); y -= 8;
  }
  y -= 10; need(140);
  const sigBox = async (label, name, dataUrl, when, x) => {
    page.drawText(pdfSafe(label), { x, y, size: 9, font: B, color: grey });
    if (dataUrl) { const img = await pdf.embedPng(b64bytes(dataUrl)); const s = Math.min(220 / img.width, 70 / img.height); page.drawImage(img, { x, y: y - 80, width: img.width * s, height: img.height * s }); }
    page.drawLine({ start: { x, y: y - 84 }, end: { x: x + 220, y: y - 84 }, thickness: 0.8 });
    page.drawText((v3 ? pdfSafe(L.name) : '') + pdfSafe(name).slice(0, 50), { x, y: y - 97, size: 9, font: v3 ? B : R });
    page.drawText(when ? pdfSafe(L.signed) + when.replace('T', ' ').slice(0, 16) + ' UTC' : pdfSafe(L.notyet), { x, y: y - 108, size: 8, font: R, color: grey });
  };
  await sigBox(L.sigC, f.biz, doc.creatorSig, doc.created, X);
  await sigBox(L.sigO, doc.signerName || f.client, doc.otherSig, doc.signedAt, X + 265);
  y -= 130;
  const verifyUrl = (opts.site || 'https://signedchange.com') + '/verify.html?id=' + doc.id;
  need(v3 ? 215 : 110);
  const qy = y; text(L.audit, { size: 9, bold: true, color: grey });
  const ut = s => s ? s.replace('T', ' ').slice(0, 19) + ' UTC' : '';
  const at = [`Document ID: ${doc.id}`, `Created: ${ut(doc.created)}${doc.creatorTz ? ' (creator local timezone: ' + doc.creatorTz + ')' : ''}`];
  if (doc.creatorIpHash) at.push(`Creator network (hashed IP): ${doc.creatorIpHash.slice(0, 16)}  |  Browser: ${(doc.creatorUA || '-').slice(0, 90)}`);
  at.push(`Signing method: ${doc.mode === 'remote' ? 'remote link (other party signed on their own device)' : 'in person on the creator\'s device'}`);
  if (doc.signedAt) at.push(`Other party signed: ${ut(doc.signedAt)}${doc.signerCountry ? ' from ' + doc.signerCountry : ''}${doc.signerTz ? ' (local timezone: ' + doc.signerTz + ')' : ''}${doc.signerTyped ? ' - typed-name signature' : ''}`);
  if (doc.signerIpHash) at.push(`Signer network (hashed IP): ${doc.signerIpHash.slice(0, 16)}  |  Browser: ${(doc.signerUA || '-').slice(0, 90)}`);
  if (doc.declinedAt) at.push(`Declined: ${ut(doc.declinedAt)}`);
  at.push(`Content fingerprint (SHA-256): ${doc.hash}`);
  if (doc.creatorSigHash) at.push(`Creator signature image (SHA-256): ${doc.creatorSigHash}`);
  if (doc.otherSigHash) at.push(`Other party signature image (SHA-256): ${doc.otherSigHash}`);
  if (doc.finalHash) at.push(`Signed record fingerprint (SHA-256): ${doc.finalHash}`);
  (doc.atts || []).forEach((a, i) => at.push(`Attachment ${i + 1} (${a.type}, ${Math.round(a.size / 1024)} KB) SHA-256: ${a.hash}`));
  at.push(`Verify: ${verifyUrl}`);
  for (const l of at) text(l, { size: 7.5, color: grey, w: v3 ? W - 100 : W });
  if (v3) { // QR code (self-hosted generator, drawn as vector squares)
    const qr = qrcode(0, 'M'); qr.addData(verifyUrl); qr.make(); const n = qr.getModuleCount(), S = 78 / n, qx = X + W - 80, p = pages.includes(page) ? page : page;
    const top = Math.min(qy, 790); const by = top - 82;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) p.drawRectangle({ x: qx + c * S, y: by + (n - 1 - r) * S, width: S + 0.05, height: S + 0.05, color: rgb(0, 0, 0) });
    p.drawText(pdfSafe(L.scan), { x: qx, y: by - 10, size: 7, font: R, color: grey });
  }
  if (opts.atts && opts.atts.length) {
    for (let i = 0; i < opts.atts.length; i++) {
      const d = opts.atts[i]; if (!d) continue;
      page = pdf.addPage([595, 842]); pages.push(page); y = 790;
      text(L.att + (i + 1) + ' - ' + f.title, { bold: true, color: blue });
      text('SHA-256: ' + (doc.atts[i] && doc.atts[i].hash || ''), { size: 7.5, color: grey });
      try { const img = d.startsWith('data:image/png') ? await pdf.embedPng(b64bytes(d)) : await pdf.embedJpg(b64bytes(d));
        const s = Math.min(W / img.width, 620 / img.height, 1.5); page.drawImage(img, { x: X, y: y - 10 - img.height * s, width: img.width * s, height: img.height * s }); } catch { text('(image could not be rendered)', { size: 9, color: grey }); }
    }
  }
  pages.forEach(footer);
  return pdf.save();
}

// ---------- document handlers ----------
const ua = req => cleanLine(req.headers.get('User-Agent'), 200);
const tzOk = s => /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$|^UTC[+-]?\d{0,2}(:\d\d)?$/.test(s || '') ? s.slice(0, 60) : '';
export async function createDoc(req, env, h, ip, ipHash, acct) {
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request.' }, 400, h); }
  if (b.template == null || String(b.template).trim() === '') return json({ ok: false, error: 'Choose a starting point.', field: 'tpl' }, 400, h);
  const template = resolveTemplate(b.template);
  if (!template) return json({ ok: false, error: 'That starting point is not recognized.', field: 'tpl' }, 400, h);
  const extra = unknownFields(b.fields);
  if (extra.length) return json({ ok: false, error: 'The field "' + extra[0] + '" is not part of this starting point.', field: extra[0] }, 400, h);
  const schema = schemaFor(template);
  if (template !== 'custom') {
    if (!String(b.fields && b.fields.title || '').trim()) return json({ ok: false, error: 'This starting point needs a title.', field: 'title' }, 400, h);
    if (!String(b.fields && b.fields.job || '').trim()) return json({ ok: false, error: 'This starting point needs the job or contract.', field: 'job' }, 400, h);
  }
  const rf = readFields(b); if (rf.error) return json({ ok: false, error: rf.error, field: rf.field, placeholders: rf.placeholders }, 400, h);
  const missing = missingRequired(schema, rf.f).filter(key => key !== 'title' && key !== 'job');
  if (missing.length) return json({ ok: false, error: 'This starting point needs ' + missing[0] + '.', field: missing[0] }, 400, h);
  const issues = fieldIssues(schema, rf.f);
  if (issues.length) return json({ ok: false, error: issues[0].error, field: issues[0].field }, 400, h);
  const creatorSig = pngOk(b.creatorSig); if (!creatorSig) return json({ ok: false, error: 'Your signature is required.', field: 'sigMe' }, 400, h);
  const mode = b.mode === 'inperson' ? 'inperson' : 'remote';
  let otherSig = null; if (mode === 'inperson') { otherSig = pngOk(b.otherSig); if (!otherSig) return json({ ok: false, error: 'The other party\'s signature is required.', field: 'sigOther' }, 400, h); }
  const v3 = b.v === 3, atts = [];
  if (b.attachments != null) {
    if (!v3 || !Array.isArray(b.attachments) || b.attachments.length > MAX_ATT) return json({ ok: false, error: 'Up to 3 photos can be attached.', field: 'photos' }, 400, h);
    for (const d of b.attachments) { const a = attOk(d); if (!a) return json({ ok: false, error: 'Photos must be JPEG or PNG images under 350 KB each.', field: 'photos' }, 400, h); atts.push(a); }
  }
  const pro = await proStatus(env, acct);
  if (!pro) {
    const r = await lock(env, 'used:' + acct.id, { op: 'use', limit: FREE_DOCS });
    if (!r.ok) return json({ ok: false, error: 'free_limit', message: 'You have used your 3 free documents. Upgrade to Pro for unlimited documents.' }, 402, h);
    const month = new Date().toISOString().slice(0, 7);
    const r2 = await lock(env, `freeip:${ipHash}:${month}`, { op: 'use', limit: FREE_PER_IP_MONTH });
    if (!r2.ok) { await lock(env, 'used:' + acct.id, { op: 'unuse' }); return json({ ok: false, error: 'free_limit', message: 'Free documents from this network are used up this month. Upgrade to Pro for unlimited documents.' }, 402, h); }
  } else await lock(env, 'used:' + acct.id, { op: 'use', limit: null });
  const id = rand(18), now = new Date().toISOString();
  const doc = { id, acct: acct.id, fields: rf.f, creatorSig, mode, tier: pro ? 'pro' : 'free', created: now, status: mode === 'inperson' ? 'signed' : 'pending' };
  if (v3) {
    doc.v = 3;
    const pk = (await sha256hex('co-v1:' + (rf.f.client + '|' + rf.f.job).toLowerCase().replace(/\s+/g, ' '))).slice(0, 24);
    doc.coNo = (await lock(env, `cono:${acct.id}:${pk}`, { op: 'use', limit: null })).n || 1;
    doc.agreeText = agreementText(rf.f, doc.coNo);
    doc.creatorSigHash = await sha256hex(b64bytes(creatorSig));
    doc.creatorIpHash = ipHash; doc.creatorUA = ua(req); doc.creatorTz = tzOk(b.tz);
    doc.atts = [];
    for (let i = 0; i < atts.length; i++) { doc.atts.push({ type: atts[i].type, size: atts[i].size, hash: await sha256hex(b64bytes(atts[i].data)) }); await env.PAYMENTS.put(`att:${id}:${i}`, atts[i].data, { expirationTtl: DOC_TTL }); }
  }
  doc.template = template;
  doc.version = 1;
  doc.hash = await contentHash(doc);
  doc.ownerApprovedHash = doc.hash;
  let signToken = null;
  if (mode === 'inperson') { doc.otherSig = otherSig; doc.signedAt = now; doc.signerName = rf.f.client; if (v3) { doc.otherSigHash = await sha256hex(b64bytes(otherSig)); doc.finalHash = await finalHash(doc); } }
  else { signToken = rand(24); doc.signHash = await sha256hex('sign-v1:' + signToken); doc.signExp = Date.now() + SIGN_DAYS * 86400e3; }
  await env.PAYMENTS.put('doc:' + id, JSON.stringify(doc), { expirationTtl: DOC_TTL });
  await env.PAYMENTS.put('ver:' + id + ':1', JSON.stringify({ n: 1, parent: null, docId: id, by: 'owner', at: now, action: 'create', hash: doc.hash, template, fields: doc.fields }), { expirationTtl: DOC_TTL });
  await env.PAYMENTS.put(`adoc:${acct.id}:${(9e15 - Date.now()).toString().padStart(16, '0')}:${id}`, '1', { expirationTtl: DOC_TTL });
  return json({ ok: true, id, coNo: doc.coNo || null, status: doc.status, hash: doc.hash, version: 1, template, signUrl: signToken ? `${env.SITE_ORIGIN}/sign.html#d=${id}&t=${signToken}` : null, expires: doc.signExp ? new Date(doc.signExp).toISOString() : null }, 200, h);
}
export function templateCatalogue(_req, _env, h) { return json(publicSchema(), 200, h); }

// Document lifecycle coordinator. See worker/DOC_LIFECYCLE.md.
// Gift/payment locks use other Durable Object names and the claim/use operations; they do not enter here.
const LIFE = 'life', PENDING_SIG = 'pendingSig';
const lifeCode = s => s === 'signed' ? 'used' : s === 'declined' ? 'declined' : s === 'cancelled' || s === 'deleted' ? 'cancelled' : 'invalid';
function lifeHttp(code) { return code === 'invalid' || code === 'visibility' ? (code === 'visibility' ? 503 : 404) : code === 'hash' ? 409 : code === 'coord' || code === 'kv' ? 503 : 410; }

async function docCoord(env, docId, body) {
  if (!env || !env.GIFT_LOCK || typeof env.GIFT_LOCK.idFromName !== 'function' || env.SC_TEST_FAULT === 'do-down')
    return { ok: false, status: 503, code: 'coord', error: 'Document coordination is unavailable. Please try again.' };
  try {
    const stub = env.GIFT_LOCK.get(env.GIFT_LOCK.idFromName('sign:' + docId));
    const r = await stub.fetch('https://lock/', { method: 'POST', body: JSON.stringify({ op: 'lifecycle', docId, ...body }) });
    const j = await r.json();
    if (!j || typeof j !== 'object') return { ok: false, status: 503, code: 'coord' };
    return j;
  } catch { return { ok: false, status: 503, code: 'coord', error: 'Document coordination is unavailable. Please try again.' }; }
}
function coordOut(env, docId, out) {
  const st = out.status || 503, h = out.h;
  if (out.ok && out.viewKey) return json({ ok: true, viewKey: out.viewKey, finalHash: out.finalHash, viewUrl: `${env.SITE_ORIGIN}/sign.html#d=${docId}&v=${out.viewKey}` }, 200, h);
  if (out.ok) return json({ ok: true }, 200, h);
  if (st === 404) return json({ ok: false, error: out.error || 'Not found.', code: out.code }, 404, h);
  if (out.code && SIGN_ERR[out.code]) return json({ ok: false, error: SIGN_ERR[out.code], code: out.code }, st, h);
  return json({ ok: false, error: out.error || 'Document coordination is unavailable. Please try again.', code: out.code }, st, h);
}
async function signedSnapshot(state, life) {
  if (!life || life.status !== 'signed' || !life.finalHash) return null;
  try {
    const snap = await state.storage.get('terminalDoc');
    if (!snap || snap.status !== 'signed' || snap.finalHash !== life.finalHash) return null;
    return snap;
  } catch { return null; }
}
async function kvGetDoc(state, env, id) {
  const live = await env.PAYMENTS.get('doc:' + id, 'json');
  if (env.SC_TEST_FAULT !== 'stale-get') return live;
  const shadow = await state.storage.get('shadow');
  if (shadow && shadow.armed) { await state.storage.put('shadow', { armed: false, doc: shadow.doc }); return shadow.doc; }
  return live;
}
async function armShadow(state, env, previous) {
  if (env.SC_TEST_FAULT === 'stale-get') await state.storage.put('shadow', { armed: true, doc: previous == null ? null : previous });
}
async function kvPutDoc(state, env, id, doc) {
  if (env.SC_TEST_FAULT === 'kv-put-fail') {
    const n = (await state.storage.get('faultPuts')) || 0;
    if (n < 1) { await state.storage.put('faultPuts', n + 1); throw new Error('injected kv put failure'); }
  }
  await env.PAYMENTS.put('doc:' + id, JSON.stringify(doc), { expirationTtl: DOC_TTL });
}
function blankLife(doc) {
  const terminal = !doc || doc.status !== 'pending';
  return { gen: 1, kvGen: doc ? 1 : 0, status: doc ? doc.status : 'missing', terminal: !!doc && terminal, owner: doc ? doc.acct : null, opId: null, action: null };
}
function signError(doc, body) {
  if (!doc || !doc.signHash) return { status: 404, code: 'invalid' };
  if (doc.status === 'signed') return { status: 410, code: 'used' };
  if (doc.status === 'declined') return { status: 410, code: 'declined' };
  if (doc.status === 'cancelled') return { status: 410, code: 'cancelled' };
  if (Date.now() > doc.signExp) return { status: 410, code: 'expired' };
  return null;
}
async function tokenOk(doc, token) { return !!doc && doc.signHash === await sha256hex('sign-v1:' + (token || '')); }
async function exactSignReplay(doc, life, body) {
  if (!doc || !life || life.status !== 'signed' || doc.status !== 'signed') return null;
  if (!life.viewKey || !life.finalHash || doc.finalHash !== life.finalHash) return null;
  if (!body || body.agree !== true || body.hash !== doc.hash) return null;
  if (!(await tokenOk(doc, body.t))) return null;
  const sig = pngOk(body.sig);
  if (!sig || !life.sigHash) return null;
  if (await sha256hex(b64bytes(sig)) !== life.sigHash) return null;
  if (cleanLine(body.name, 120) !== life.signerName) return null;
  if (doc.signedAt && life.signedAt && doc.signedAt !== life.signedAt) return null;
  return { ok: true, status: 200, viewKey: life.viewKey, finalHash: life.finalHash };
}
async function buildSigned(doc, body, life) {
  const sig = pngOk(body.sig);
  const name = cleanLine(body.name, 120);
  if (body.agree !== true) return { status: 400, error: 'Please tick the box to confirm you agree.' };
  if (!sig) return { status: 400, error: 'A signature is required.' };
  if (!name) return { status: 400, error: 'Please type your full name.' };
  if (body.hash !== doc.hash) return { status: 409, code: 'hash', error: 'The document changed or could not be checked. Reload the page.' };
  const sigHash = await sha256hex(b64bytes(sig));
  if (life && life.sigHash && life.sigHash !== sigHash) return { status: 409, code: 'hash', error: 'The document changed or could not be checked. Reload the page.' };
  const viewKey = life && life.viewKey || rand(24);
  const signedAt = life && life.signedAt || new Date().toISOString();
  const next = { ...doc, status: 'signed', otherSig: sig, signerName: name, signedAt, signerIpHash: body.ipHash || '', signerCountry: body.country || '', signerUA: body.ua || '', signerTz: body.tz || '', signerTyped: body.typed === true || undefined, viewHash: await sha256hex('view-v1:' + viewKey) };
  next.otherSigHash = sigHash;
  if (!next.creatorSigHash && next.creatorSig) next.creatorSigHash = await sha256hex(b64bytes(next.creatorSig));
  next.finalHash = life && life.finalHash || await finalHash(next);
  next.lifeGen = life ? life.gen : 0;
  return { doc: next, viewKey, finalHash: next.finalHash, sigHash, signedAt, name };
}
function buildCancelled(doc, gen) { const next = { ...doc, status: 'cancelled', lifeGen: gen }; delete next.signHash; return next; }
function buildDeclined(doc, body, life) {
  const reason = clean(body.reason, 500);
  if (!life && reason.length < 3) return { status: 400, error: 'Please say what should change (a few words).' };
  const declinedAt = life && life.declinedAt || new Date().toISOString();
  const declinedBy = life && life.declinedBy || cleanLine(body.name, 120) || doc.fields.client;
  const declineReason = life && life.declineReason || reason;
  return { doc: { ...doc, status: 'declined', declineReason, declinedAt, declinedBy, signerIpHash: body.ipHash || doc.signerIpHash || '', signerUA: body.ua || doc.signerUA || '', signerTz: body.tz || '', lifeGen: life ? life.gen : 0 } };
}
function cancelClosed(status) {
  if (status === 'signed') return 'Signing finished first. This document is signed, so it was not cancelled. Open the signed record instead of cancelling it.';
  if (status === 'declined') return 'This document was declined, so cancel did not change it. Send a revised version if you still want a signature.';
  if (status === 'cancelled') return 'This document is already cancelled. The signing link stays closed.';
  return 'Only a document that is still waiting for a signature can be cancelled.';
}
function settled(life, action) {
  if (life.status === 'deleted') return { ok: false, status: 404, code: 'cancelled', error: 'Not found.' };
  if (action === 'cancel') return { ok: false, status: 409, error: cancelClosed(life.status) };
  if (action === 'delete') return life.status === 'deleted' ? { ok: false, status: 404, error: 'Not found.' } : { ok: false, status: 409, error: 'This document could not be deleted. Reload the list and try again.' };
  return { ok: false, status: 410, code: lifeCode(life.status) };
}
function kvMatches(doc, life) {
  if (!life || !life.terminal) return !!doc && doc.status === 'pending';
  if (life.status === 'deleted') return !doc;
  if (!doc) return false;
  if (life.status === 'cancelled') return doc.status === 'cancelled' && !doc.signHash;
  if (life.status === 'signed') return doc.status === 'signed' && (doc.lifeGen == null || doc.lifeGen === life.gen);
  if (life.status === 'declined') return doc.status === 'declined' && (doc.lifeGen == null || doc.lifeGen === life.gen);
  return false;
}
async function eraseDoc(env, id, acct, attCount) {
  await env.PAYMENTS.delete('doc:' + id);
  const n = Math.max(attCount || 0, 3);
  for (let i = 0; i < n; i++) await env.PAYMENTS.delete(`att:${id}:${i}`);
  if (acct) { const list = await env.PAYMENTS.list({ prefix: `adoc:${acct}:` }); for (const k of list.keys) if (k.name.endsWith(':' + id)) await env.PAYMENTS.delete(k.name); }
}
async function writeTerminal(state, env, id, life, doc, body) {
  if (life.status === 'deleted') { await eraseDoc(env, id, life.owner || (doc && doc.acct), life.attCount); await armShadow(state, env, doc || null); return; }
  let next = null;
  if (life.status === 'cancelled') {
    if (!doc) throw new Error('kv-base');
    next = buildCancelled(doc.status === 'cancelled' ? doc : doc, life.gen);
  } else if (life.status === 'declined') {
    if (!doc) throw new Error('kv-base');
    const built = buildDeclined(doc, body || {}, life);
    next = built.doc; next.lifeGen = life.gen;
  } else if (life.status === 'signed') {
    const sig = body && pngOk(body.sig);
    const stored = !sig && await state.storage.get(PENDING_SIG);
    const useBody = sig ? body : stored ? { ...body, sig: stored, agree: true, hash: doc && doc.hash, name: life.signerName } : null;
    if (!useBody || !doc) throw new Error('kv-base');
    const built = await buildSigned({ ...doc, hash: doc.hash }, useBody, life);
    if (built.status) throw new Error('kv-base');
    next = built.doc; next.lifeGen = life.gen;
  }
  if (!next) throw new Error('kv-base');
  if (next.status === 'signed') { try { await state.storage.put('terminalDoc', next); } catch { /* the signed body is still written below; a cached read can use it once the cache expires */ } }
  const previous = doc;
  await kvPutDoc(state, env, id, next);
  await armShadow(state, env, previous);
}
async function ackLife(state, gen) {
  return state.storage.transaction(async txn => {
    const life = await txn.get(LIFE);
    if (!life || life.gen !== gen) return false;
    life.kvGen = gen;
    await txn.put(LIFE, life);
    await txn.delete(PENDING_SIG);
    return true;
  });
}
export async function runLifecycle(state, env, body) {
  try {
    if (!state || typeof state.storage.transaction !== 'function' || !env || !env.PAYMENTS) return { ok: false, status: 503, code: 'coord' };
    const id = body.docId;
    if (!ID.test(id || '')) return { ok: false, status: 404, code: 'invalid' };
    const action = body.action;
    for (let attempt = 0; attempt < 4; attempt++) {
      const observed = await kvGetDoc(state, env, id);
      const step = await state.storage.transaction(async txn => {
        let life = await txn.get(LIFE);
        const claim = await txn.get('claim');
        if (!life && claim && observed && observed.status === 'pending') {
          life = { gen: 1, kvGen: 0, status: 'signed', terminal: true, owner: observed.acct, opId: 'legacy-claim', action: 'sign', legacy: true };
          await txn.put(LIFE, life);
          return { type: 'settled', life };
        }
        if (!life) {
          if (!observed) return { type: 'respond', response: { ok: false, status: action === 'delete' || action === 'cancel' ? 404 : 404, code: action === 'read' || action === 'peek' ? 'invalid' : 'invalid', error: 'Not found.' } };
          life = blankLife(observed);
          if (life.terminal && action !== 'delete') { life.owner = observed.acct; await txn.put(LIFE, life); return { type: 'settled', life }; }
        }
        const owns = !!(body.acct && ((observed && observed.acct === body.acct) || (life && life.owner === body.acct)));
        if ((action === 'delete' || action === 'cancel') && !owns) return { type: 'respond', response: { ok: false, status: 404, error: 'Not found.' } };
        if (action === 'delete' && owns && life.status !== 'deleted') {
          const opId = await sha256hex('life:delete:' + id + ':' + body.acct);
          const next = { gen: (life.gen || 0) + 1, kvGen: life.kvGen || 0, status: 'deleted', terminal: true, owner: (observed && observed.acct) || life.owner, opId, action: 'delete', attCount: observed ? (observed.atts || []).length : (life.attCount || 0) };
          await txn.put(LIFE, next);
          await txn.delete(PENDING_SIG);
          return { type: 'write', life: next, success: { ok: true, status: 200 } };
        }
        if (action === 'history' && observed) {
          const invitee = await tokenOk(observed, body.t);
          const owner = !!(body.acct && observed.acct === body.acct);
          if (!invitee && !owner) return { type: 'respond', response: { ok: false, status: 404, error: 'Not found.' } };
          const versions = (await txn.get('versions')) || [{ n: observed.version || 1, parent: null, docId: id, by: 'owner', at: observed.created, action: 'create', hash: observed.hash, template: observed.template || 'custom', fields: observed.fields }];
          return { type: 'respond', response: { ok: true, status: 200, version: observed.version || 1, hash: observed.hash, history: versions.map(v => ({ n: v.n, parent: v.parent, by: v.by, at: v.at, action: v.action, hash: v.hash, template: v.template, fields: v.fields })) } };
        }
        if (life.terminal && life.kvGen < life.gen) return { type: 'repair', life };
        if (life.terminal && life.status === 'signed' && life.kvGen === life.gen && (!observed || observed.status !== 'signed')) {
          const snap = await txn.get('terminalDoc');
          if (snap && snap.status === 'signed' && snap.finalHash && snap.finalHash === life.finalHash) return { type: 'restore', life, snap };
        }
        if (life.terminal && observed && !kvMatches(observed, life) && life.status !== 'signed') return { type: 'repair', life };
        if (life.terminal) return { type: 'settled', life };
        if (action === 'invite') {
          const ok = !!(observed && observed.signHash && observed.signHash === body.invite);
          return { type: 'respond', response: { ok, status: ok ? 200 : 404, code: ok ? undefined : 'invalid' } };
        }
        if (action === 'read' || action === 'peek') return { type: 'respond', response: { ok: true, status: 200, proceed: true } };
        if (!observed) return { type: 'respond', response: { ok: false, status: 503, code: 'visibility', error: 'Document coordination is unavailable. Please try again.' } };
        if ((action === 'cancel' || action === 'delete') && observed.acct !== body.acct) return { type: 'respond', response: { ok: false, status: 404, error: 'Not found.' } };
        if (action === 'sign' || action === 'decline') {
          if (!(await tokenOk(observed, body.t))) return { type: 'respond', response: { ok: false, status: 404, code: 'invalid' } };
          const bad = signError(observed, body);
          if (bad) return { type: 'respond', response: { ok: false, ...bad } };
        }
        const opId = await sha256hex('life:' + action + ':' + id + ':' + (body.t || '') + ':' + (body.baseHash || body.reason || '') + ':' + (body.acct || ''));
        const gen = (life.gen || 1) + 1;
        if (action === 'history' || action === 'counter' || action === 'accept') {
          const invitee = action !== 'accept' && await tokenOk(observed, body.t);
          const owner = !!(body.acct && observed.acct === body.acct);
          if (!invitee && !owner) return { type: 'respond', response: { ok: false, status: 404, error: 'Not found.' } };
          let versions = (await txn.get('versions')) || [];
          if (!versions.length) versions = [{ n: observed.version || 1, parent: null, docId: id, by: 'owner', at: observed.created, action: 'create', hash: observed.hash, template: observed.template || 'custom', fields: observed.fields }];
          if (action === 'history') return { type: 'respond', response: { ok: true, status: 200, version: observed.version || 1, hash: observed.hash, history: versions.map(v => ({ n: v.n, parent: v.parent, by: v.by, at: v.at, action: v.action, hash: v.hash, template: v.template, fields: v.fields })) } };
          if (action === 'accept') {
            if (!owner || body.hash !== observed.hash || !pngOk(body.sig)) return { type: 'respond', response: { ok: false, status: 409, error: 'The sender can approve only the current version, and that approval needs a signature. Reload this version and approve it before the other person signs.' } };
            const next = { ...life, gen, kvGen: life.kvGen || 0, status: 'pending', terminal: false, owner: observed.acct, opId, action: 'accept', version: observed.version || 1, versionHash: observed.hash };
            await txn.put(LIFE, next);
            await txn.put('pendingAccept', { hash: observed.hash, sig: body.sig, at: new Date().toISOString() });
            versions.push({ n: observed.version || 1, parent: (observed.version || 1) > 1 ? (observed.version || 1) - 1 : null, docId: id, by: 'owner', at: new Date().toISOString(), action: 'accept', hash: observed.hash, template: observed.template || 'custom', fields: observed.fields });
            await txn.put('versions', versions);
            return { type: 'accept', life: next };
          }
          if (body.baseHash !== observed.hash || !body.nextHash || !body.nextFields || !body.signHash) return { type: 'respond', response: { ok: false, status: 409, error: 'This version already changed. Reload the page, read the current version, and propose again only if you still want a change.' } };
          const currentN = observed.version || 1;
          const by = owner && !invitee ? 'owner' : 'invitee';
          const entry = { n: currentN + 1, parent: currentN, docId: id, by, at: new Date().toISOString(), action: 'counter', hash: body.nextHash, template: body.template || observed.template || 'custom', fields: body.nextFields };
          versions.push(entry);
          await txn.put('versions', versions);
          const next = { gen, kvGen: life.kvGen || 0, status: 'pending', terminal: false, owner: observed.acct, opId, action: 'counter', version: entry.n, versionHash: body.nextHash };
          await txn.put(LIFE, next);
          await txn.put('pendingCounter', { entry, signHash: body.signHash, signExp: body.signExp, agreeText: body.agreeText || observed.agreeText, creatorSig: body.creatorSig || null, by });
          return { type: 'counter', life: next, version: entry.n };
        }
        if (action === 'sign') {
          if (Object.prototype.hasOwnProperty.call(observed, 'ownerApprovedHash') && observed.ownerApprovedHash !== observed.hash) return { type: 'respond', response: { ok: false, status: 409, error: 'The sender has not signed this version yet. Wait for their approval, then sign this same version.' } };
          const built = await buildSigned(observed, body, null);
          if (built.status) return { type: 'respond', response: { ok: false, ...built } };
          const next = { gen, kvGen: life.kvGen || 0, status: 'signed', terminal: true, owner: observed.acct, opId, action, viewKey: built.viewKey, finalHash: built.finalHash, sigHash: built.sigHash, signerName: built.name, signedAt: built.signedAt, attCount: (observed.atts || []).length };
          await txn.put(LIFE, next);
          await txn.put(PENDING_SIG, body.sig);
          return { type: 'write', life: next, success: { ok: true, status: 200, viewKey: built.viewKey, finalHash: built.finalHash } };
        }
        if (action === 'decline') {
          const built = buildDeclined(observed, body, null);
          if (built.status) return { type: 'respond', response: { ok: false, ...built } };
          const next = { gen, kvGen: life.kvGen || 0, status: 'declined', terminal: true, owner: observed.acct, opId, action, declineReason: built.doc.declineReason, declinedAt: built.doc.declinedAt, declinedBy: built.doc.declinedBy, attCount: (observed.atts || []).length };
          await txn.put(LIFE, next);
          return { type: 'write', life: next, success: { ok: true, status: 200 } };
        }
        if (action === 'cancel') {
          if (observed.status !== 'pending') return { type: 'respond', response: { ok: false, status: 409, error: cancelClosed(observed.status) } };
          const next = { gen, kvGen: life.kvGen || 0, status: 'cancelled', terminal: true, owner: observed.acct, opId, action, attCount: (observed.atts || []).length, inviteHash: observed.signHash || '' };
          await txn.put(LIFE, next);
          return { type: 'write', life: next, success: { ok: true, status: 200 } };
        }
        return { type: 'respond', response: { ok: false, status: 400, error: 'Bad request.' } };
      });
      if (step.type === 'respond') return step.response;
      if (step.type === 'restore') {
        try { await kvPutDoc(state, env, id, step.snap); } catch { /* the snapshot is still returned to this read */ }
        if (action === 'read' || action === 'peek') return { ok: true, status: 200, proceed: false, terminalStatus: step.life.status, code: lifeCode(step.life.status), snapshot: step.snap };
        return settled(step.life, action);
      }
      if (step.type === 'settled') {
        if (action === 'invite') {
          const ok = !!(step.life.inviteHash && step.life.inviteHash === body.invite);
          return { ok, status: ok ? 200 : 404, code: ok ? undefined : 'invalid' };
        }
        if (action === 'read' || action === 'peek') {
          if (step.life.status === 'deleted' && observed) { try { await eraseDoc(env, id, step.life.owner, step.life.attCount); } catch { /* read still reports the tombstone */ } }
          const out = { ok: step.life.status !== 'deleted', status: step.life.status === 'deleted' ? 404 : 200, proceed: false, terminalStatus: step.life.status, code: lifeCode(step.life.status) };
          if (step.life.status === 'signed') { const snapshot = await signedSnapshot(state, step.life); if (snapshot) out.snapshot = snapshot; }
          return out;
        }
        const same = step.life.opId && step.life.kvGen < step.life.gen;
        if (same) return { ok: false, status: 503, code: 'kv' };
        if (action === 'sign' && step.life.status === 'signed') {
          const replay = await exactSignReplay(observed, step.life, body);
          if (replay) return replay;
        }
        return settled(step.life, action);
      }
      if (step.type === 'counter' || step.type === 'accept') {
        try {
          const pending = await state.storage.get(step.type === 'counter' ? 'pendingCounter' : 'pendingAccept');
          const base = observed || await env.PAYMENTS.get('doc:' + id, 'json');
          if (!base || !pending) throw new Error('kv-base');
          if (step.type === 'accept') {
            const next = { ...base, ownerApprovedHash: pending.hash, ownerSig: pending.sig };
            await kvPutDoc(state, env, id, next);
          } else {
            const next = { ...base, fields: pending.entry.fields, template: pending.entry.template, version: pending.entry.n, hash: pending.entry.hash, agreeText: pending.agreeText, signHash: pending.signHash, signExp: pending.signExp, status: 'pending', ownerApprovedHash: pending.by === 'owner' ? pending.entry.hash : '' };
            if (pending.creatorSig) { next.creatorSig = pending.creatorSig; next.creatorSigHash = await sha256hex(b64bytes(pending.creatorSig)); }
            delete next.otherSig; delete next.otherSigHash; delete next.finalHash; delete next.signedAt; delete next.signerName;
            await kvPutDoc(state, env, id, next);
            const prior = await env.PAYMENTS.get('ver:' + id + ':' + pending.entry.n);
            if (!prior) await env.PAYMENTS.put('ver:' + id + ':' + pending.entry.n, JSON.stringify(pending.entry), { expirationTtl: DOC_TTL });
          }
          const acked = await ackLife(state, step.life.gen);
          if (!acked) continue;
          await state.storage.delete('pendingCounter');
          await state.storage.delete('pendingAccept');
          return { ok: true, status: 200, version: step.life.version, hash: step.life.versionHash || (pending && pending.hash) };
        } catch { return { ok: false, status: 503, code: 'kv', error: 'Document coordination is unavailable. Please try again.' }; }
      }
      const incomplete = step.life.kvGen < step.life.gen;
      try {
        const base = observed || await env.PAYMENTS.get('doc:' + id, 'json');
        await writeTerminal(state, env, id, step.life, base, body);
        const acked = await ackLife(state, step.life.gen);
        if (!acked) continue;
        if (step.type === 'write' || (incomplete && step.life.action === action)) {
          if (action === 'sign' && step.life.viewKey) return { ok: true, status: 200, viewKey: step.life.viewKey, finalHash: step.life.finalHash };
          return step.success || { ok: true, status: 200 };
        }
        if (action === 'read' || action === 'peek') {
          const out = { ok: step.life.status !== 'deleted', status: step.life.status === 'deleted' ? 404 : 200, proceed: false, terminalStatus: step.life.status, code: lifeCode(step.life.status) };
          if (step.life.status === 'signed') { const snapshot = await signedSnapshot(state, step.life); if (snapshot) out.snapshot = snapshot; }
          return out;
        }
        return settled(step.life, action);
      } catch { return { ok: false, status: 503, code: 'kv', error: 'Document coordination is unavailable. Please try again.' }; }
    }
    return { ok: false, status: 503, code: 'coord', error: 'Document coordination is unavailable. Please try again.' };
  } catch { return { ok: false, status: 503, code: 'coord', error: 'Document coordination is unavailable. Please try again.' }; }
}

async function loadSignable(env, d, t) {
  if (!ID.test(d || '') || !/^[\w-]{30,40}$/.test(t || '')) return { err: 'invalid' };
  const doc = await env.PAYMENTS.get('doc:' + d, 'json');
  if (!doc || !doc.signHash) return { err: 'invalid' };
  if (doc.signHash !== await sha256hex('sign-v1:' + t)) return { err: 'invalid' };
  if (doc.status === 'signed') return { err: 'used', doc };
  if (doc.status === 'declined') return { err: 'declined', doc };
  if (doc.status === 'cancelled') return { err: 'cancelled' };
  if (Date.now() > doc.signExp) return { err: 'expired' };
  return { doc };
}
const SIGN_ERR = { invalid: 'This signing link is not valid.', used: 'This document has already been signed. Signing links work only once.', expired: 'This signing link has expired. Ask the sender for a new one.', cancelled: 'The sender cancelled this document.', declined: 'You declined this document. The sender has been told and can send a revised version.' };
const loadAtts = async (env, doc) => Promise.all((doc.atts || []).map((_, i) => env.PAYMENTS.get(`att:${doc.id}:${i}`)));
export async function getForSigning(url, env, h) {
  const d = url.searchParams.get('d');
  const t = url.searchParams.get('t');
  if (!ID.test(d || '') || !/^[\w-]{30,40}$/.test(t || '')) return json({ ok: false, error: SIGN_ERR.invalid, code: 'invalid' }, 404, h);
  const tokenHash = await sha256hex('sign-v1:' + t);
  const hinted = await env.PAYMENTS.get('doc:' + d, 'json');
  if (!hinted) return json({ ok: false, error: SIGN_ERR.invalid, code: 'invalid' }, 404, h);
  if (hinted.signHash && hinted.signHash !== tokenHash) return json({ ok: false, error: SIGN_ERR.invalid, code: 'invalid' }, 404, h);
  if (!hinted.signHash) {
    const known = await docCoord(env, d, { action: 'invite', invite: tokenHash });
    if (!known.ok) return json({ ok: false, error: SIGN_ERR.invalid, code: 'invalid' }, 404, h);
  }
  const gate = await docCoord(env, d, { action: 'read' });
  if (!gate.proceed) {
    const status = gate.status === 503 || gate.status === 404 || gate.status === 400 || gate.status === 409 ? gate.status : 410;
    return coordOut(env, d, { ...gate, ok: false, status, h });
  }
  const r = await loadSignable(env, d, url.searchParams.get('t'));
  if (r.err) return json({ ok: false, error: SIGN_ERR[r.err], code: r.err }, r.err === 'invalid' ? 404 : 410, h);
  const { fields, creatorSig, created, signExp, hash, v, coNo, agreeText } = r.doc;
  const out = { ok: true, fields, creatorSig, created, expires: new Date(signExp).toISOString(), hash };
  if (v === 3) Object.assign(out, { v, coNo, agreeText, amounts: amounts(fields), attachments: await loadAtts(env, r.doc) });
  out.version = r.doc.version || 1;
  out.template = r.doc.template || 'custom';
  const hist = await docCoord(env, d, { action: 'history', t: url.searchParams.get('t') });
  if (hist.ok && hist.history) out.history = hist.history.map(vrow => ({ n: vrow.n, by: vrow.by, at: vrow.at, action: vrow.action, hash: vrow.hash }));
  return json(out, 200, h);
}
export async function counterDoc(req, env, h, acct) {
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request.' }, 400, h); }
  if (!ID.test(b.d || '')) return json({ ok: false, error: 'Not found.' }, 404, h);
  const current = await env.PAYMENTS.get('doc:' + b.d, 'json');
  if (!current) return json({ ok: false, error: 'Not found.' }, 404, h);
  const template = resolveTemplate(b.template || current.template || 'custom');
  if (!template) return json({ ok: false, error: 'That starting point is not recognized.', field: 'tpl' }, 400, h);
  const extra = unknownFields(b.fields);
  if (extra.length) return json({ ok: false, error: 'The field "' + extra[0] + '" is not part of this starting point.', field: extra[0] }, 400, h);
  if (template !== 'custom') {
    if (!String(b.fields && b.fields.title || '').trim()) return json({ ok: false, error: 'This starting point needs a title.', field: 'title' }, 400, h);
    if (!String(b.fields && b.fields.job || '').trim()) return json({ ok: false, error: 'This starting point needs the job or contract.', field: 'job' }, 400, h);
  }
  const schema = schemaFor(template);
  const rf = readFields({ v: current.v || 3, mode: 'remote', fields: b.fields });
  if (rf.error) return json({ ok: false, error: rf.error, field: rf.field, placeholders: rf.placeholders }, 400, h);
  const missing = missingRequired(schema, rf.f).filter(key => key !== 'title' && key !== 'job');
  if (missing.length) return json({ ok: false, error: 'This starting point needs ' + missing[0] + '.', field: missing[0] }, 400, h);
  const issues = fieldIssues(schema, rf.f);
  if (issues.length) return json({ ok: false, error: issues[0].error, field: issues[0].field }, 400, h);
  const draft = { ...current, fields: rf.f, template, agreeText: agreementText(rf.f, current.coNo || 1) };
  draft.hash = await contentHash(draft);
  const signToken = rand(24);
  const signHash = await sha256hex('sign-v1:' + signToken);
  const out = await docCoord(env, b.d, { action: 'counter', t: b.t, acct: acct && acct.id, baseHash: b.baseHash, nextHash: draft.hash, nextFields: rf.f, template, signHash, signExp: Date.now() + SIGN_DAYS * 86400e3, agreeText: draft.agreeText, creatorSig: pngOk(b.creatorSig) });
  if (!out.ok) return coordOut(env, b.d, { ...out, h });
  return json({ ok: true, version: out.version, hash: draft.hash, signUrl: `${env.SITE_ORIGIN}/sign.html#d=${b.d}&t=${signToken}` }, 200, h);
}
export async function acceptDoc(req, env, h, acct) {
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request.' }, 400, h); }
  const out = await docCoord(env, b.d, { action: 'accept', acct: acct.id, hash: b.hash, sig: b.sig });
  if (!out.ok) return coordOut(env, b.d, { ...out, h });
  return json({ ok: true, version: out.version, hash: out.hash }, 200, h);
}
export async function historyDoc(req, url, env, h, acct) {
  const d = url.searchParams.get('d');
  const out = await docCoord(env, d, { action: 'history', t: url.searchParams.get('t'), acct: acct && acct.id });
  if (!out.ok) return coordOut(env, d, { ...out, h });
  return json({ ok: true, version: out.version, hash: out.hash, history: out.history || [] }, 200, h);
}
export async function signDoc(req, env, h, ip, ipHash) {
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request.' }, 400, h); }
  const out = await docCoord(env, b.d, { action: 'sign', t: b.t, sig: b.sig, name: b.name, agree: b.agree === true, hash: b.hash, tz: tzOk(b.tz), typed: b.typed === true, ipHash, country: req.headers.get('CF-IPCountry') || '', ua: ua(req) });
  return coordOut(env, b.d, { ...out, h });
}
export async function declineDoc(req, env, h, ip, ipHash) {
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request.' }, 400, h); }
  const out = await docCoord(env, b.d, { action: 'decline', t: b.t, reason: b.reason, name: b.name, tz: tzOk(b.tz), ipHash, ua: ua(req) });
  return coordOut(env, b.d, { ...out, h });
}
// PDF access: owner (Authorization) or signer view key. The body must already match lifecycle authority.
async function canReadDoc(req, url, env, doc) {
  const v = url.searchParams.get('v');
  if (v && /^[\w-]{30,40}$/.test(v) && doc.viewHash && doc.viewHash === await sha256hex('view-v1:' + v)) return true;
  const acct = await auth(req, env); return !!(acct && acct.id === doc.acct);
}
function gateDown(gate) {
  return !gate || gate.status === 503 || gate.code === 'coord' || gate.code === 'kv' || gate.code === 'visibility';
}
async function fingerprintsMatch(env, doc) {
  if (!doc || !doc.hash || (await contentHash(doc)) !== doc.hash) return false;
  if (doc.otherSig) {
    if (!doc.otherSigHash || (await sha256hex(b64bytes(doc.otherSig))) !== doc.otherSigHash) return false;
  } else if (doc.status === 'signed') return false;
  if (doc.finalHash) { if ((await finalHash(doc)) !== doc.finalHash) return false; }
  else if (doc.status === 'signed') return false;
  for (let i = 0; i < (doc.atts || []).length; i++) {
    const raw = await env.PAYMENTS.get(`att:${doc.id}:${i}`);
    if (!raw || !doc.atts[i] || (await sha256hex(b64bytes(raw))) !== doc.atts[i].hash) return false;
  }
  return true;
}
async function readStored(env, id) {
  if (env.SC_TEST_FAULT === 'cached-get') {
    const cached = await env.PAYMENTS.get('cache:' + id, 'json');
    if (cached) return cached;
  }
  return env.PAYMENTS.get('doc:' + id, 'json');
}
// Ask the lifecycle object first. KV reads can stay on the pre-sign body for about a minute, so a signed lifecycle snapshot is the record until that cache expires. A stored body that is already signed but no longer matches is not replaced.
async function authoritativeDoc(env, id) {
  const gate = await docCoord(env, id, { action: 'peek' });
  if (gateDown(gate)) return { status: 503, error: 'Document coordination is unavailable. Please try again.' };
  if (gate.terminalStatus === 'deleted') return { status: 404, error: 'No document with this ID. It may have been deleted by its owner.' };
  if (gate.status === 404 && !gate.terminalStatus) return { status: 404, error: 'No document with this ID. It may have been deleted by its owner.' };
  const doc = await readStored(env, id);
  const snap = gate.snapshot && gate.snapshot.status === 'signed' ? gate.snapshot : null;
  if (doc && doc.status === 'signed') {
    if (!(await fingerprintsMatch(env, doc))) return { status: 409, error: 'This document failed its integrity check.' };
    return { doc, lifeStatus: gate.terminalStatus || doc.status };
  }
  if (gate.terminalStatus === 'signed' && snap && (!doc || doc.status !== 'signed')) {
    if (await fingerprintsMatch(env, snap)) return { doc: snap, lifeStatus: 'signed' };
  }
  if (gate.terminalStatus && doc && doc.status !== gate.terminalStatus && gate.terminalStatus !== 'deleted') {
    return { status: 200, confirming: true, expected: gate.terminalStatus, error: 'The signature was accepted. The stored record is still being confirmed. This page will update when the stored record matches. It is not shown as signed until then.' };
  }
  if (gate.terminalStatus && (!doc || doc.status !== gate.terminalStatus)) return { status: 503, error: 'Document coordination is unavailable. Please try again.' };
  if (!doc) return { status: 404, error: 'No document with this ID. It may have been deleted by its owner.' };
  if (!(await fingerprintsMatch(env, doc))) return { status: 409, error: 'This document failed its integrity check.' };
  return { doc, lifeStatus: gate.terminalStatus || doc.status };
}
export async function docAccess(req, url, env) {
  const d = url.searchParams.get('d'); if (!ID.test(d || '')) return null;
  const doc = await env.PAYMENTS.get('doc:' + d, 'json'); if (!doc) return null;
  return await canReadDoc(req, url, env, doc) ? doc : null;
}
export async function pdfResponse(req, url, env, h) {
  const d = url.searchParams.get('d'); if (!ID.test(d || '')) return json({ ok: false, error: 'Not found.' }, 404, h);
  const view = await authoritativeDoc(env, d);
  if (view.confirming) return json({ ok: false, code: 'confirming', error: view.error }, 409, h);
  if (!view.doc) return json({ ok: false, error: view.status === 409 ? view.error : view.status === 503 ? view.error : 'Not found.' }, view.status === 409 || view.status === 503 ? view.status : 404, h);
  if (!(await canReadDoc(req, url, env, view.doc))) return json({ ok: false, error: 'Not found.' }, 404, h);
  const doc = view.doc;
  const bytes = await renderPdf(doc, { site: env.SITE_ORIGIN, atts: await loadAtts(env, doc) });
  const name = 'signedchange-' + doc.fields.client.replace(/[^\w]+/g, '-').slice(0, 40) + '-' + doc.fields.date + (doc.coNo ? '-CO' + doc.coNo : '') + (doc.status === 'signed' ? '' : doc.status === 'declined' ? '-DECLINED' : '-DRAFT') + '.pdf';
  return new Response(bytes, { status: 200, headers: { ...h, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"`, 'Access-Control-Expose-Headers': 'Content-Disposition' } });
}
export async function docStatus(req, url, env, h) {
  const d = url.searchParams.get('d'); if (!ID.test(d || '')) return json({ ok: false, error: 'Not found.' }, 404, h);
  const hinted = await env.PAYMENTS.get('doc:' + d, 'json');
  const viewShaped = /^[\w-]{30,40}$/.test(url.searchParams.get('v') || '');
  const hintedOk = !!(hinted && await canReadDoc(req, url, env, hinted));
  if (!hintedOk && !viewShaped) {
    const acct = await auth(req, env);
    if (!acct) return json({ ok: false, error: 'Not found.' }, 404, h);
  }
  const view = await authoritativeDoc(env, d);
  if (view.confirming) {
    if (!hintedOk) return json({ ok: false, error: 'Not found.' }, 404, h);
    return json({ ok: true, status: 'confirming', message: view.error }, 200, h);
  }
  if (!view.doc) return json({ ok: false, error: view.status === 404 ? 'Not found.' : view.error }, view.status, h);
  if (!(await canReadDoc(req, url, env, view.doc))) return json({ ok: false, error: 'Not found.' }, 404, h);
  const doc = view.doc;
  return json({ ok: true, status: view.lifeStatus, client: doc.fields.client, biz: doc.fields.biz, title: doc.fields.title, signedAt: doc.signedAt || null, declinedAt: doc.declinedAt || null, declineReason: doc.declineReason || null }, 200, h);
}
// Public verification: no signatures, no contact details, no amounts.
export async function verifyDoc(url, env, h) {
  const id = url.searchParams.get('id'); if (!ID.test(id || '')) return json({ ok: false, error: 'Not a valid document ID.' }, 400, h);
  const view = await authoritativeDoc(env, id);
  if (view.confirming) return json({ ok: true, id, status: 'confirming', message: view.error }, 200, h);
  if (!view.doc) return json({ ok: false, error: view.error }, view.status, h);
  const doc = view.doc, f = doc.fields;
  return json({ ok: true, id, status: view.lifeStatus, title: f.title, coNo: doc.coNo || null, date: f.date, contractDate: f.contractDate || null, created: doc.created, signedAt: doc.signedAt || null, declinedAt: doc.declinedAt || null,
    mode: doc.mode, creator: { name: f.biz, company: f.bizCo || '', role: f.bizRole || '' }, other: { name: doc.signerName || f.client, company: f.clientCo || '', role: f.clientRole || '' },
    hash: doc.hash, creatorSigHash: doc.creatorSigHash || null, otherSigHash: doc.otherSigHash || null, finalHash: doc.finalHash || null, attachments: (doc.atts || []).map(a => ({ type: a.type, hash: a.hash })) }, 200, h);
}
const PAGE_MAX = 50;
function pageLimit(url) {
  if (!url || !url.searchParams || !url.searchParams.has('limit')) return 50;
  const raw = url.searchParams.get('limit');
  if (!/^\d{1,2}$/.test(raw || '')) return null;
  const n = Number(raw);
  return n >= 1 && n <= PAGE_MAX ? n : null;
}
function encodeCursor(acctId, limit, kvCursor) {
  return btoa(JSON.stringify({ v: 1, a: acctId, l: limit, c: kvCursor })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeCursor(raw, acctId, limit) {
  if (raw == null || raw === '') return { kv: undefined };
  if (typeof raw !== 'string' || raw.length > 2048 || !/^[\w-]+$/.test(raw)) return null;
  try {
    const pad = raw.replace(/-/g, '+').replace(/_/g, '/');
    const j = JSON.parse(atob(pad + '='.repeat((4 - pad.length % 4) % 4)));
    if (!j || j.v !== 1 || j.a !== acctId || j.l !== limit || typeof j.c !== 'string' || !j.c) return null;
    return { kv: j.c };
  } catch { return null; }
}
function listRow(d) {
  return { id: d.id, title: d.fields.title, client: d.fields.client, price: d.fields.price, currency: d.fields.currency, date: d.fields.date, status: d.status, created: d.created, signedAt: d.signedAt || null, mode: d.mode,
    expires: d.status === 'pending' && d.signExp ? new Date(d.signExp).toISOString() : null, coNo: d.coNo || null, v: d.v || 2, total: d.v === 3 ? amounts(d.fields).tot : null,
    declineReason: d.declineReason || null, declinedAt: d.declinedAt || null, fields: d.fields };
}
export async function me(env, acct, h, url) {
  const pro = await proStatus(env, acct);
  const used = (await lock(env, 'used:' + acct.id, { op: 'get' })).n || 0;
  const limit = pageLimit(url);
  if (limit == null) return json({ ok: false, error: 'Invalid limit.' }, 400, h);
  const parsed = decodeCursor(url && url.searchParams.get('cursor'), acct.id, limit);
  if (!parsed) return json({ ok: false, error: 'Invalid cursor.' }, 400, h);
  const prefix = `adoc:${acct.id}:`;
  let listed;
  try { listed = await env.PAYMENTS.list({ prefix, limit, cursor: parsed.kv }); }
  catch { return json({ ok: false, error: 'Invalid cursor.' }, 400, h); }
  const docs = [];
  for (const k of listed.keys) {
    if (!k.name.startsWith(prefix)) return json({ ok: false, error: 'Invalid cursor.' }, 400, h);
    const id = k.name.split(':').pop();
    const gate = await docCoord(env, id, { action: 'peek' });
    if (gateDown(gate)) return json({ ok: false, error: 'Document coordination is unavailable. Please try again.' }, 503, h);
    if (gate.terminalStatus === 'deleted' || (gate.status === 404 && !gate.terminalStatus)) continue;
    const d = await readStored(env, id);
    if (gate.snapshot && gate.snapshot.status === 'signed' && (!d || d.status !== 'signed') && gate.snapshot.acct === acct.id) {
      docs.push(listRow(gate.snapshot));
      continue;
    }
    if (gate.terminalStatus && d && d.status !== gate.terminalStatus && gate.terminalStatus !== 'deleted') {
      if (d.acct === acct.id) docs.push({ ...listRow(d), status: 'confirming' });
      continue;
    }
    if (gate.terminalStatus && (!d || d.status !== gate.terminalStatus)) return json({ ok: false, error: 'Document coordination is unavailable. Please try again.' }, 503, h);
    if (!d || d.acct !== acct.id) continue;
    docs.push(listRow(d));
  }
  const out = { ok: true, pro, used, freeLeft: pro ? null : Math.max(0, FREE_DOCS - used), docs };
  if (!listed.list_complete && listed.cursor) out.nextCursor = encodeCursor(acct.id, limit, listed.cursor);
  return json(out, 200, h);
}
export async function cancelDoc(req, env, h, acct) {
  let b; try { b = await req.json(); } catch { return json({ ok: false }, 400, h); }
  if (!ID.test(b.d || '')) return json({ ok: false }, 400, h);
  const out = await docCoord(env, b.d, { action: b.action === 'delete' ? 'delete' : 'cancel', acct: acct.id });
  return coordOut(env, b.d, { ...out, h });
}
export { json, lock };
