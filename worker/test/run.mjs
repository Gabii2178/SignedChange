import { Miniflare } from 'miniflare';
import http from 'node:http';
let calls = 0;
const mock = http.createServer((q, r) => { let b=''; q.on('data',c=>b+=c); q.on('end',()=>{ calls++;
  r.end(b.startsWith('cmd=_notify-validate&') && !b.includes('forged=1') ? 'VERIFIED' : 'INVALID'); }); }).listen(8799);
const mf = new Miniflare({ scriptPath: 'dist/worker.js', modules: true, kvNamespaces: ['PAYMENTS'],
  bindings: { SITE_ORIGIN: 'https://signedchange-app.surge.sh', RECEIVER_EMAIL: 'termschange@gmail.com', PRICE: '49.00', SUB_PRICE: '9.00', CURRENCY: 'USD',
    PAYPAL_VERIFY_URL: 'http://127.0.0.1:8799/', TOKEN_SECRET: 'test-secret-123' } });
const W = 'http://w';
const ipn = o => mf.dispatchFetch(W+'/ipn', { method:'POST', body: new URLSearchParams({ receiver_email:'termschange@gmail.com', payment_status:'Completed', mc_gross:'49.00', mc_currency:'USD', payer_email:'Buyer@Example.com', ...o }).toString() });
const get = (p, origin='https://signedchange-app.surge.sh') => mf.dispatchFetch(W+p, { headers: { Origin: origin } });
const res = []; const t = (n, ok) => { res.push(ok); console.log((ok?'PASS ':'FAIL ')+n); };
await ipn({ txn_id:'1AB23456CD789012E' });
await ipn({ txn_id:'1AB23456CD789012E' }); // duplicate
await ipn({ txn_id:'WRONGAMT00000001', mc_gross:'1.00' });
await ipn({ txn_id:'WRONGRCV00000001', receiver_email:'evil@x.com' });
await ipn({ txn_id:'PENDING000000001', payment_status:'Pending' });
await ipn({ txn_id:'FORGED0000000001', forged:'1' });
await ipn({ txn_id:'EURPAY0000000001', mc_currency:'EUR' });
let r = await get('/verify?tx=1AB23456CD789012E&email=buyer@example.com'); let j = await r.json();
t('valid payment returns token', r.status===200 && j.ok && j.token);
t('CORS allows site origin', r.headers.get('Access-Control-Allow-Origin')==='https://signedchange-app.surge.sh');
const tok = j.token;
r = await get('/verify?tx=1AB23456CD789012E&email=buyer@example.com','https://evil.com'); t('CORS blocks other origin', !r.headers.get('Access-Control-Allow-Origin'));
r = await get('/verify?tx=1AB23456CD789012E&email=other@example.com'); t('wrong email rejected', r.status===404);
r = await get('/verify?tx=1AB23456CD789012E&ret=1'); t('tx-only from PayPal return (fresh) accepted', r.status===200);
r = await get('/verify?tx=1AB23456CD789012E'); t('tx-only without ret rejected', r.status===404);
for (const x of ['WRONGAMT00000001','WRONGRCV00000001','PENDING000000001','FORGED0000000001','EURPAY0000000001']) { r = await get(`/verify?tx=${x}&email=buyer@example.com`); t('not stored: '+x, r.status===404); }
r = await get('/verify?tx=<script>&email=a'); t('bad input rejected', r.status===400);
r = await get('/check?token='+encodeURIComponent(tok)); t('valid token passes /check', r.status===200);
r = await get('/check?token='+encodeURIComponent(tok.slice(0,-2)+'xx')); t('tampered token fails /check', r.status===403);
const kv = await mf.getKVNamespace('PAYMENTS'); t('KV record stored once', JSON.parse(await kv.get('txn:1AB23456CD789012E')).payer_email==='buyer@example.com');
await ipn({ txn_id:'REFUND0000000001', payment_status:'Refunded', parent_txn_id:'1AB23456CD789012E', mc_gross:'-49.00' });
r = await get('/check?token='+encodeURIComponent(tok)); t('refund revokes token', r.status===403);
let last; for (let i=0;i<25;i++) last = await get('/verify?tx=AAAAAAAAAAAA&email=a@b.c'); t('rate limit returns 429', last.status===429);
t('PayPal validate called for every IPN', calls===8);
console.log(`${res.filter(Boolean).length}/${res.length} passed`);
await mf.dispose(); mock.close();
