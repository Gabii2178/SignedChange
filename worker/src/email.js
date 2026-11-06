// "Welcome to SignedChange Pro" email via Brevo transactional API (free 300/day).
// Dormant (no-op) unless the Worker secret BREVO_API_KEY is set. Called only AFTER Pro was granted
// by the existing verified payment paths; it never grants or checks anything itself. Once per account.
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMAIL = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[a-z]{2,24}$/i;
export function welcomeHtml(o) {
  const site = o.site || 'https://signedchange-app.surge.sh', support = o.support || 'termschange@gmail.com';
  const row = (k, v) => `<tr><td style="padding:7px 0;color:#5b6b7c;font-size:14px">${esc(k)}</td><td style="padding:7px 0;text-align:right;font-size:14px;font-weight:600;color:#0b2e4f">${esc(v)}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;color:#1a2b3c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(11,46,79,.08)">
<tr><td style="background:#0b2e4f;padding:22px 28px;color:#fff;font-size:20px;font-weight:800">SignedChange
 <span style="display:inline-block;margin-left:8px;padding:3px 10px;border-radius:999px;background:#f5a623;color:#5a3a00;font-size:11px;font-weight:800;letter-spacing:1px;vertical-align:middle">&#9733; PRO</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 10px;font-size:22px;color:#0b2e4f">Welcome to SignedChange Pro</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.55">Thank you${o.name ? ', ' + esc(o.name) : ''}! Your payment was confirmed and Pro is now active on your account: unlimited change records and signing links, with the smaller Pro footer on your PDFs.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3e9f0;border-bottom:1px solid #e3e9f0;margin:0 0 20px">
${row('Plan', o.plan)}${row('Amount', o.amount)}${row('Date', o.date)}${o.renews ? row('Renews / paid through', o.renews) : ''}${row('Payment reference', o.ref)}${row('Account ID', o.acct)}
</table>
<h2 style="margin:0 0 8px;font-size:16px;color:#0b2e4f">How to use Pro</h2>
<ol style="margin:0 0 18px;padding-left:20px;font-size:14px;line-height:1.6">
<li>Open the app on the phone or computer you paid on - Pro is already unlocked there.</li>
<li>To use Pro on another device, open <b>"Use your account on another phone / back up"</b> in the app on the first device, copy your private account key, and paste it on the new device.</li>
<li>Keep that key private. We will never ask you for it, and it is not included in this email for your safety.</li></ol>
<p style="text-align:center;margin:0 0 22px"><a href="${esc(site)}/app.html" style="display:inline-block;background:#0f4c81;color:#fff;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:9px">Open SignedChange</a></p>
<p style="margin:0;font-size:13px;color:#5b6b7c;line-height:1.5">${o.plan && /month/i.test(o.plan) ? 'You can cancel any time in your PayPal account (Settings &rarr; Payments &rarr; Automatic payments). ' : ''}PayPal also sent you its own official receipt. Questions or a refund request? Reply to this email or write to <a href="mailto:${esc(support)}" style="color:#0f4c81">${esc(support)}</a>.</p>
</td></tr>
<tr><td style="background:#f6f9fc;padding:14px 28px;font-size:12px;color:#8494a5;text-align:center">SignedChange &middot; <a href="${esc(site)}" style="color:#8494a5">${esc(site.replace(/^https?:\/\//, ''))}</a> &middot; You received this because you bought SignedChange Pro.</td></tr>
</table></td></tr></table></body></html>`;
}
// Look up the buyer's email from the server-side payment record linked to this Pro grant.
async function buyer(env, pro) {
  if (pro.type === 'life') { const t = await env.PAYMENTS.get('txn:' + pro.ref, 'json'); return t && { email: t.payer_email, name: t.payer_name, plan: 'Pro Lifetime', amount: '$' + (env.PRICE || '49.00') + ' USD (one-time)', date: t.date }; }
  if (pro.type === 'sub') { const s = await env.PAYMENTS.get('sub:' + pro.ref, 'json'); return s && { email: s.payer_email, name: s.payer_name, plan: 'Pro Monthly', amount: '$' + (env.SUB_PRICE || '9.00') + ' USD / month', date: s.created, renews: s.paidThrough ? new Date(s.paidThrough).toISOString().slice(0, 10) : '' }; }
  return null; // gift codes: no buyer email on file
}
export async function sendWelcome(env, acctId, pro) {
  try {
    if (!(env.BREVO_API_KEY || env.Brevo_api_key) || !pro || !acctId) return { skipped: 'disabled' };
    const k = 'welcome:' + acctId;
    if (await env.PAYMENTS.get(k)) return { skipped: 'sent' };
    const b = await buyer(env, pro);
    const to = b && String(b.email || '').trim().toLowerCase();
    if (!to || !EMAIL.test(to)) return { skipped: 'noemail' };
    await env.PAYMENTS.put(k, JSON.stringify({ state: 'sending', at: new Date().toISOString() }), { expirationTtl: 600 }); // short lock vs. parallel IPN/webhook/claim
    const html = welcomeHtml({ ...b, site: env.SITE_ORIGIN, support: env.SUPPORT_EMAIL || env.RECEIVER_EMAIL, ref: pro.ref, acct: acctId, date: String(b.date || new Date().toISOString()).slice(0, 10) });
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email', { method: 'POST', signal: ctl.signal,
      headers: { 'api-key': (env.BREVO_API_KEY || env.Brevo_api_key), 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: { name: 'SignedChange', email: env.MAIL_FROM || 'termschange@gmail.com' }, replyTo: { email: env.SUPPORT_EMAIL || 'termschange@gmail.com' },
        to: [{ email: to }], subject: 'Welcome to SignedChange Pro \u2605', htmlContent: html, tags: ['pro-welcome'] }) }).finally(() => clearTimeout(tm));
    if (!r.ok) { await env.PAYMENTS.delete(k); return { error: r.status }; }
    await env.PAYMENTS.put(k, JSON.stringify({ state: 'sent', at: new Date().toISOString(), plan: b.plan }));
    return { sent: true };
  } catch (e) { try { await env.PAYMENTS.delete('welcome:' + acctId); } catch {} return { error: String(e && e.message || e).slice(0, 60) }; }
}
