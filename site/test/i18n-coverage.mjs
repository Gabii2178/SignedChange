// French must cover every English interface key. Agreement starter text is not in this pack.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(readFileSync(new URL('../i18n/messages.js', import.meta.url), 'utf8'), context);
vm.runInContext(readFileSync(new URL('../i18n/fr.js', import.meta.url), 'utf8'), context);
const en = context.window.SC_MESSAGES.en;
const fr = context.window.SC_MESSAGES.fr;
const missing = Object.keys(en).filter(key => !fr[key] || !String(fr[key]).trim());
const offered = ['en', 'fr'];
console.log('en', Object.keys(en).length, 'fr', Object.keys(fr).length, 'missing', missing.length);
if (missing.length) {
  console.log(missing.join('\n'));
  process.exit(1);
}
if (offered.some(code => !['en', 'fr'].includes(code))) process.exit(1);
console.log('PASS french covers every english interface key');
