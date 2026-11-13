// Static French coverage. No payment pages are fetched.
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
const site = new URL('..', import.meta.url).pathname;
const context = { window: {} };
vm.createContext(context);
vm.runInContext(readFileSync(join(site, 'i18n/messages.js'), 'utf8'), context);
vm.runInContext(readFileSync(join(site, 'i18n/fr.js'), 'utf8'), context);
vm.runInContext(readFileSync(join(site, 'i18n/exact-fr.js'), 'utf8'), context);
vm.runInContext(readFileSync(join(site, 'i18n/templates-fr.js'), 'utf8'), context);
const fr = context.window.SC_EXACT.fr;
const tpl = context.window.SC_TPL_FR;
const ids = 'freelance designrev webbuild writing photovideo freelancemilestone software sitemaint saaschange itsupport techconsult construction materials renovation propmaint landlord jobschedule duties employment compensation rolechange duration campaign social adbudget branding agency supplier purchase deliverydate partner consultant smallbiz installments deadline paymiles balance training course event eventbudget transport servicemaint hospitality agriculture contractor deposit custom'.split(' ');
const missingTpl = ids.filter(id => !tpl[id] || (id !== 'custom' && !tpl[id].desc));
const messages = context.window.SC_MESSAGES;
const missingKeys = Object.keys(messages.en).filter(k => !messages.fr[k]);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html') && !name.startsWith('google')) out.push(p);
  }
  return out;
}
const pages = walk(site);
let gaps = 0;
const report = [];
for (const file of pages) {
  const html = readFileSync(file, 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const texts = [];
  const re = />([^<]*)</g;
  let m;
  while ((m = re.exec(html))) {
    const t = m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (t.length < 2 || !/[A-Za-zÀ-ÿ]{3,}/.test(t)) continue;
    if (/^\$[\d,.]+$/.test(t)) continue;
    texts.push(t);
  }
  const uncovered = texts.filter(t => !fr[t] && !/data-i18n/.test(t));
  // A string is covered when it is in the French exact map. data-i18n elements are also covered by the message pack.
  const still = [];
  const marked = html.split(/data-i18n(?:-html|-title|-content|-placeholder)?="/);
  for (const t of texts) {
    if (fr[t]) continue;
    still.push(t);
  }
  const rel = file.slice(site.length);
  report.push({ rel, strings: texts.length, uncovered: still.length });
  if (still.length) {
    gaps += still.length;
    console.log('GAP', rel, still.slice(0, 8).map(s => s.slice(0, 80)));
  } else console.log('OK', rel, texts.length);
}
console.log('templates', ids.length - missingTpl.length, '/', ids.length, missingTpl.join(','));
console.log('message keys missing in French', missingKeys.length);
console.log('pages', pages.length, 'uncovered strings', gaps);
if (missingTpl.length || missingKeys.length || gaps) process.exit(1);
console.log('PASS french coverage');
