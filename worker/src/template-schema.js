// Authoritative starting-point rules. The browser asks GET /doc/templates for this same list.
export const CATALOGUE = {
  creative: ['freelance', 'designrev', 'webbuild', 'writing', 'photovideo', 'freelancemilestone'],
  software: ['software', 'sitemaint', 'saaschange', 'itsupport', 'techconsult'],
  property: ['construction', 'materials', 'renovation', 'propmaint', 'landlord', 'jobschedule'],
  employment: ['duties', 'employment', 'compensation', 'rolechange', 'duration'],
  agency: ['campaign', 'social', 'adbudget', 'branding', 'agency'],
  commerce: ['supplier', 'purchase', 'deliverydate', 'partner', 'consultant', 'smallbiz'],
  finance: ['installments', 'deadline', 'paymiles', 'balance'],
  education: ['training', 'course', 'event', 'eventbudget'],
  logistics: ['transport', 'servicemaint', 'hospitality', 'agriculture']
};
export const NAMED = Object.values(CATALOGUE).flat().concat(['contractor', 'deposit']);
export const BLANK = 'custom';
const REQUIRED_NAMED = ['title', 'job', 'biz', 'client', 'desc', 'price', 'currency', 'date'];
const REQUIRED_BLANK = ['biz', 'client', 'desc', 'price', 'currency', 'date'];
const REQUIRED_SCHEDULE = ['title', 'job', 'biz', 'client', 'desc', 'date', 'newDate'];
const REQUIRED_DATED = ['title', 'job', 'biz', 'client', 'desc', 'price', 'currency', 'date', 'newDate'];
const SCHEDULE = new Set(['jobschedule', 'deadline', 'deliverydate', 'course']);
const DATED = new Set(['duration']);
export const OPTIONAL = ['bizCo', 'bizRole', 'contact', 'clientCo', 'clientRole', 'clientContact', 'contractDate', 'origAmount', 'taxRate', 'newDate', 'daysAdded', 'payTerms', 'payCustom', 'payMethod', 'priceDir', 'lines', 'lang'];
const ALLOWED = new Set([...REQUIRED_DATED, ...OPTIONAL, 'price', 'currency']);
const ZERO_PRICE_OK = new Set(['jobschedule', 'deadline', 'deliverydate', 'course']);
export const ISO_CURRENCY = new Set('AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD STN SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWL'.split(' '));
export function isIsoCurrency(code) { return typeof code === 'string' && ISO_CURRENCY.has(code); }

export function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.getTime();
}

export function resolveTemplate(id) {
  if (id == null || id === '') return BLANK;
  const key = String(id);
  if (key === BLANK || NAMED.includes(key)) return key;
  return null;
}

function requiredFor(key) {
  if (key === BLANK) return REQUIRED_BLANK;
  if (SCHEDULE.has(key)) return REQUIRED_SCHEDULE;
  if (DATED.has(key)) return REQUIRED_DATED;
  return REQUIRED_NAMED;
}
export function schemaFor(id) {
  const key = resolveTemplate(id);
  if (!key) return null;
  const required = requiredFor(key);
  const optional = [...new Set([...REQUIRED_DATED, ...OPTIONAL, 'title', 'job', 'price', 'currency'])].filter(field => !required.includes(field));
  return {
    id: key,
    blank: key === BLANK,
    catalogue: key !== 'contractor' && key !== 'deposit' && key !== BLANK,
    schedule: SCHEDULE.has(key),
    dated: DATED.has(key),
    required,
    optional,
    zeroPriceOk: ZERO_PRICE_OK.has(key)
  };
}
export function fieldIssues(schema, fields) {
  const issues = [];
  const price = fields.price == null ? '' : String(fields.price).trim();
  const amount = Number(price.replace(',', '.'));
  const dir = fields.priceDir || 'inc';
  if (fields.currency && !isIsoCurrency(fields.currency)) issues.push({ field: 'currency', error: 'Choose a real currency code, such as USD, EUR or XAF.' });
  if (price && Number.isFinite(amount) && amount === 0 && dir !== 'none' && !schema.zeroPriceOk) issues.push({ field: 'price', error: 'This starting point needs an amount greater than zero, or choose no price change.' });
  if (schema.schedule && dir !== 'none' && Number.isFinite(amount) && amount > 0 && !isIsoCurrency(fields.currency || '')) issues.push({ field: 'currency', error: 'Choose the agreement currency for this price change.' });
  return issues;
}

export function publicSchema() {
  return {
    ok: true,
    blank: BLANK,
    catalogue: CATALOGUE,
    extra: ['contractor', 'deposit'],
    templates: [BLANK, ...NAMED].map(schemaFor),
    conditional: [
      'clientContact is required when a signing link is sent, and optional in person.',
      'payCustom is required when payTerms is custom.',
      'Schedule starting points (jobschedule, deadline, deliverydate, course) require the new date and allow a zero amount. Other starting points allow a zero amount only when there is no price change.',
      'A contract-duration change also requires the new end date.',
      'Currency must be a real ISO 4217 code. Codes such as ZZZ are rejected.',
      'date, newDate and contractDate must be real calendar dates.',
      'Square-bracket placeholders are rejected.'
    ],
    notice: 'Starting points are examples, not legal advice.'
  };
}

export function unknownFields(fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return ['fields'];
  return Object.keys(fields).filter(key => !ALLOWED.has(key));
}

export function missingRequired(schema, fields) {
  return schema.required.filter(key => {
    const value = fields[key];
    return value == null || String(value).trim() === '';
  });
}
