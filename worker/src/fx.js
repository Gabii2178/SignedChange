// Display-currency suggestion and exchange rates.
// Country comes only from Cloudflare request.cf.country.
// Rates come from the European Central Bank via Frankfurter, plus the official XAF euro peg.
// Nothing in this module writes an agreement, a fingerprint, or an IP address.

const SOURCE = 'European Central Bank reference rates via Frankfurter (api.frankfurter.app)';
const RATE_URL = 'https://api.frankfurter.app/latest?from=USD';
const CACHE_KEY = 'fx:ecb:v1';
const CACHE_MS = 6 * 3600 * 1000;
const MAX_AGE_MS = 7 * 86400 * 1000;
const XAF_PER_EUR = 655.957;
const PEG_NOTE = 'Official CEMAC parity: 1 EUR = 655.957 XAF, applied to the ECB euro rate.';

export const DISPLAY_CURRENCIES = ['USD', 'EUR', 'GBP', 'XAF', 'NGN', 'GHS', 'KES', 'ZAR', 'CAD', 'AUD', 'INR'];
const RATE_CODES = ['EUR', 'GBP', 'CAD', 'AUD', 'INR', 'ZAR', 'NGN', 'GHS', 'KES'];
const EUR = ['AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK', 'AD', 'MC', 'SM', 'VA'];
const COUNTRY = { US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', IN: 'INR', ZA: 'ZAR', NG: 'NGN', GH: 'GHS', KE: 'KES', CM: 'XAF', CF: 'XAF', TD: 'XAF', CG: 'XAF', GA: 'XAF', GQ: 'XAF' };
EUR.forEach(code => { COUNTRY[code] = 'EUR'; });

const json = (o, s, h) => new Response(JSON.stringify(o), { status: s, headers: h });

export function countryFromRequest(req) {
  const raw = req && req.cf && typeof req.cf.country === 'string' ? req.cf.country.toUpperCase() : '';
  if (raw === 'XX' || raw === 'T1' || !/^[A-Z]{2}$/.test(raw)) return '';
  return raw;
}

export function suggestionFor(country) {
  const code = /^[A-Z]{2}$/.test(country || '') ? country : '';
  if (!code) return { country: null, currency: 'USD', suggested: false, reason: 'missing' };
  const currency = COUNTRY[code];
  if (!currency || !DISPLAY_CURRENCIES.includes(currency)) return { country: code, currency: 'USD', suggested: false, reason: 'unsupported' };
  return { country: code, currency, suggested: true, reason: 'country' };
}

export function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.getTime();
}
function isStaleDate(date, now) {
  const n = calendarDate(date);
  return n == null || now - n > MAX_AGE_MS;
}
function rateNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
export function validRateRecord(record, now = Date.now()) {
  if (!record || record.source !== SOURCE || record.base !== 'USD') return false;
  if (calendarDate(record.date) == null || isStaleDate(record.date, now)) return false;
  if (typeof record.fetchedAt !== 'number' || !Number.isFinite(record.fetchedAt)) return false;
  if (!record.rates || typeof record.rates !== 'object') return false;
  if (record.rates.USD !== 1) return false;
  for (const [code, value] of Object.entries(record.rates)) {
    if (!/^[A-Z]{3}$/.test(code) || !rateNumber(value)) return false;
  }
  if (record.rates.XAF != null) {
    if (!rateNumber(record.rates.EUR)) return false;
    const peg = Math.round(record.rates.EUR * XAF_PER_EUR * 1e6) / 1e6;
    if (Math.abs(record.rates.XAF - peg) > 1e-4) return false;
  }
  return true;
}

export function interpretFrankfurter(body, now) {
  if (!body || body.base !== 'USD' || calendarDate(body.date) == null) return { ok: false, error: 'invalid' };
  const when = calendarDate(body.date);
  if (when - now > 86400000) return { ok: false, error: 'invalid' };
  const rates = { USD: 1 };
  const src = body.rates && typeof body.rates === 'object' ? body.rates : null;
  if (!src) return { ok: false, error: 'invalid' };
  for (const code of RATE_CODES) {
    const n = src[code];
    if (rateNumber(n)) rates[code] = n;
  }
  const pegs = {};
  if (rates.EUR) {
    rates.XAF = Math.round(rates.EUR * XAF_PER_EUR * 1e6) / 1e6;
    pegs.XAF = PEG_NOTE;
  }
  return { ok: true, date: body.date, rates, pegs, stale: isStaleDate(body.date, now) };
}

async function readCache(env) {
  try { return await env.PAYMENTS.get(CACHE_KEY, 'json'); } catch { return null; }
}
async function writeCache(env, record) {
  try { await env.PAYMENTS.put(CACHE_KEY, JSON.stringify(record)); } catch { /* a missed cache is not a failed quote */ }
}

export async function loadRates(env, now = Date.now()) {
  const cached = await readCache(env);
  const cachedUsable = validRateRecord(cached, now);
  if (cachedUsable && now - (cached.fetchedAt || 0) < CACHE_MS) return { ok: true, ...cached, fromCache: true, stale: false };
  let body = null;
  try {
    if (env.FX_STUB) body = JSON.parse(env.FX_STUB);
    else {
      const res = await fetch(RATE_URL);
      if (!res.ok) throw new Error('rate source unavailable');
      body = await res.json();
    }
  } catch {
    if (cachedUsable) return { ok: true, ...cached, fromCache: true, fallback: true, stale: false, source: cached.source || SOURCE };
    if (cached && cached.date) return { ok: false, error: 'stale', date: cached.date, source: SOURCE, stale: true };
    return { ok: false, error: 'unavailable', source: SOURCE };
  }
  const parsed = interpretFrankfurter(body, now);
  if (!parsed.ok) return { ok: false, error: parsed.error || 'invalid', source: SOURCE };
  if (parsed.stale) return { ok: false, error: 'stale', date: parsed.date, source: SOURCE, stale: true };
  const record = { source: SOURCE, base: 'USD', date: parsed.date, fetchedAt: now, rates: parsed.rates, pegs: parsed.pegs };
  await writeCache(env, record);
  return { ok: true, ...record, fromCache: false, stale: false };
}

export async function suggest(req, env, h) {
  const found = suggestionFor(countryFromRequest(req));
  return json({
    ok: true,
    ...found,
    defaultCurrency: 'USD',
    note: 'Approximate country from the network edge, used only to suggest a display currency. It is not identity, residency, or the agreement currency.'
  }, 200, h);
}

export async function rates(req, env, h) {
  const loaded = await loadRates(env);
  if (!loaded.ok) return json({ ok: false, error: loaded.error, source: loaded.source || SOURCE, date: loaded.date || null, stale: !!loaded.stale }, loaded.error === 'stale' ? 200 : 503, h);
  return json({
    ok: true,
    source: loaded.source,
    base: 'USD',
    date: loaded.date,
    fetchedAt: new Date(loaded.fetchedAt).toISOString(),
    rates: loaded.rates,
    pegs: loaded.pegs || {},
    fromCache: !!loaded.fromCache,
    fallback: !!loaded.fallback,
    stale: false,
    approximate: true
  }, 200, h);
}
