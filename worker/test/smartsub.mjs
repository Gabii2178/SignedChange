import { Miniflare } from 'miniflare';
import http from 'node:http';
const subs = {}; let verify='SUCCESS';
const mock = http.createServer((q, r) => { let b=''; q.on('data',c=>b+=c); q.on('end',()=>{ r.setHeader('Content-Type','application/json');
  if (q.url==='/v1/oauth2/token') return r.end(q.headers.authorization==='Basic '+btoa('cid:csec')?JSON.stringify({access_token:'AT',expires_in:3000}):(r.statusCode=401,'{}'));
  if (q.headers.authorization!=='Bearer AT') { r.statusCode=401; return r.end('{}'); }
  if (q.url.startsWith('/v1/billing/subscriptions/')) { const s=subs[q.url.split('/').pop()]; if(!s){r.statusCode=404;return r.end('{}')} return r.end(JSON.stringify(s)); }
  if (q.url==='/v1/notifications/verify-webhook-signature') return r.end(JSON.stringify({verification_status:verify}));
  r.statusCode=404; r.end('{}'); }); }).listen(8799);
const O='https://signedchange-app.surge.sh';
const base={ SITE_ORIGIN:O, RECEIVER_EMAIL:'termschange@gmail.com', PRICE:'49.00', SUB_PRICE:'9.00', CURRENCY:'USD', PAYPAL_VERIFY_URL:'http://127.0.0.1:8799/x', TOKEN_SECRET:'t', SUB_PLAN_ID:'P-PLAN', PAYPAL_API:'http://127.0.0.1:8799' };
const mk=b=>new Miniflare({ scriptPath:'dist/worker.js', modules:true, kvNamespaces:['PAYMENTS'], durableObjects:{GIFT_LOCK:'GiftLock'}, bindings:b });
const res=[]; const t=(n,ok)=>{res.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n)};
let ip=0; const R=(mf,p,o={})=>mf.dispatchFetch('http://w'+p,{...o,headers:{Origin:O,'Content-Type':'application/json','CF-Connecting-IP':'9.9.9.'+(ip++),...(o.headers||{})}});
const J=async r=>{try{return await r.json()}catch{return{}}};
const A=a=>({Authorization:`Bearer ${a.id}.${a.key}`});
const claim=(mf,a,id)=>R(mf,'/account/paypal-sub',{method:'POST',headers:A(a),body:JSON.stringify({subscriptionID:id})});
const me=async(mf,a)=>J(await R(mf,'/account/me',{headers:A(a)}));
const nb=new Date(Date.now()+30*864e5).toISOString();
// 1) fail closed without secret
let mf=mk({...base}); let a=await J(await R(mf,'/account/new',{method:'POST'}));
subs['I-AAAAAAAAAA']={id:'I-AAAAAAAAAA',status:'ACTIVE',plan_id:'P-PLAN',custom_id:a.id,billing_info:{next_billing_time:nb}};
let r=await claim(mf,a,'I-AAAAAAAAAA'); t('no secret -> 503, no Pro', r.status===503 && !(await me(mf,a)).pro);
r=await R(mf,'/paypal-webhook',{method:'POST',body:'{}'}); t('webhook without config -> 503', r.status===503);
await mf.dispose();
// 2) configured
mf=mk({...base,PAYPAL_CLIENT_ID:'cid',PAYPAL_CLIENT_SECRET:'csec',PAYPAL_WEBHOOK_ID:'WH'});
a=await J(await R(mf,'/account/new',{method:'POST'})); const b=await J(await R(mf,'/account/new',{method:'POST'}));
subs['I-GOOD000001']={id:'I-GOOD000001',status:'ACTIVE',plan_id:'P-PLAN',custom_id:a.id,billing_info:{next_billing_time:nb}};
subs['I-WRONGPLAN1']={...subs['I-GOOD000001'],id:'I-WRONGPLAN1',plan_id:'P-OTHER'};
subs['I-PENDING001']={...subs['I-GOOD000001'],id:'I-PENDING001',status:'APPROVAL_PENDING'};
subs['I-SUSPEND001']={...subs['I-GOOD000001'],id:'I-SUSPEND001',status:'SUSPENDED'};
r=await claim(mf,a,'I-NOTEXIST01'); t('fake id -> 404', r.status===404);
r=await claim(mf,a,'<script>'); t('malformed id -> 400', r.status===400);
r=await claim(mf,a,'I-WRONGPLAN1'); t('wrong plan rejected', r.status===403);
r=await claim(mf,a,'I-PENDING001'); t('pending -> 409', r.status===409);
r=await claim(mf,a,'I-SUSPEND001'); t('suspended rejected', r.status===402);
t('still no Pro', !(await me(mf,a)).pro);
r=await claim(mf,b,'I-GOOD000001'); t('other account cannot claim (custom_id mismatch)', r.status===403 && !(await me(mf,b)).pro);
r=await claim(mf,a,'I-GOOD000001'); let j=await J(r); t('valid sub grants Pro monthly', r.status===200 && j.pro && j.pro.plan==='monthly');
let m=await me(mf,a); t('me shows Pro until ~next billing+3d', m.pro && Math.abs(Date.parse(m.pro.until)-(Date.parse(nb)+3*864e5))<5000);
r=await claim(mf,a,'I-GOOD000001'); t('same account re-claim is idempotent', r.status===200);
subs['I-GOOD000001'].custom_id=b.id; r=await claim(mf,b,'I-GOOD000001'); t('reuse by another account rejected', r.status===403 && !(await me(mf,b)).pro); subs['I-GOOD000001'].custom_id=a.id;
r=await R(mf,'/account/paypal-sub',{method:'POST',body:JSON.stringify({subscriptionID:'I-GOOD000001'})}); t('no auth -> 401', r.status===401);
// webhooks
const wh=(ev)=>R(mf,'/paypal-webhook',{method:'POST',body:JSON.stringify(ev)});
verify='FAILURE'; subs['I-GOOD000001'].status='EXPIRED'; r=await wh({id:'WH-1',event_type:'BILLING.SUBSCRIPTION.EXPIRED',resource:{id:'I-GOOD000001'}}); t('forged webhook rejected, Pro kept', r.status===400 && (await me(mf,a)).pro);
verify='SUCCESS'; subs['I-GOOD000001'].status='ACTIVE';
r=await wh({id:'WH-2',event_type:'PAYMENT.SALE.COMPLETED',resource:{id:'SALE1',billing_agreement_id:'I-GOOD000001'}}); t('sale completed ok', r.status===200 && (await me(mf,a)).pro);
subs['I-GOOD000001'].status='CANCELLED'; r=await wh({id:'WH-3',event_type:'BILLING.SUBSCRIPTION.CANCELLED',resource:{id:'I-GOOD000001'}}); m=await me(mf,a); t('cancel keeps paid period', m.pro && m.pro.status==='cancelled');
r=await wh({id:'WH-4',event_type:'PAYMENT.SALE.REFUNDED',resource:{id:'REF1',sale_id:'SALE1'}}); t('refund revokes Pro', r.status===200 && !(await me(mf,a)).pro);
// suspend path on fresh sub
const c=await J(await R(mf,'/account/new',{method:'POST'})); subs['I-SUSP000002']={id:'I-SUSP000002',status:'ACTIVE',plan_id:'P-PLAN',custom_id:c.id,billing_info:{next_billing_time:nb}};
await claim(mf,c,'I-SUSP000002'); t('c has Pro', (await me(mf,c)).pro);
subs['I-SUSP000002'].status='SUSPENDED'; await wh({id:'WH-5',event_type:'BILLING.SUBSCRIPTION.SUSPENDED',resource:{id:'I-SUSP000002'}}); t('suspend revokes Pro', !(await me(mf,c)).pro);
// webhook body lies (says ACTIVE) but PayPal says suspended -> no Pro
await wh({id:'WH-6',event_type:'BILLING.SUBSCRIPTION.ACTIVATED',resource:{id:'I-SUSP000002',status:'ACTIVE'}}); t('webhook body not trusted', !(await me(mf,c)).pro);
console.log(res.filter(Boolean).length+'/'+res.length+' passed'); await mf.dispose(); mock.close();
