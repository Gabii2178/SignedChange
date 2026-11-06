import { Miniflare } from 'miniflare';
import http from 'node:http';
const orders={}; let n=0; const mails=[]; let mailFail=false;
const mock=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{r.setHeader('Content-Type','application/json');
 if(q.url==='/v3/smtp/email'){ if(q.headers['api-key']!=='BK'){r.statusCode=401;return r.end('{}')} if(mailFail){r.statusCode=500;return r.end('{}')} mails.push(JSON.parse(b)); r.statusCode=201; return r.end('{"messageId":"m"}') }
 if(q.url==='/v1/oauth2/token')return r.end(JSON.stringify({access_token:'AT',expires_in:3000}));
 if(q.url==='/v2/checkout/orders'&&q.method==='POST'){const j=JSON.parse(b);const id='ORD'+String(++n).padStart(10,'0');orders[id]={id,status:'APPROVED',payer:{email_address:'Buyer'+n+'@Example.com'},purchase_units:[{custom_id:j.purchase_units[0].custom_id,amount:j.purchase_units[0].amount}]};r.statusCode=201;return r.end(JSON.stringify(orders[id]))}
 const m=/^\/v2\/checkout\/orders\/([A-Z0-9]+)(\/capture)?$/.exec(q.url);
 if(m){const o=orders[m[1]];if(!o){r.statusCode=404;return r.end('{}')}
  if(m[2]){if(o.status==='COMPLETED'){r.statusCode=422;return r.end('{}')}const pu=o.purchase_units[0];o.status='COMPLETED';pu.payments={captures:[{id:'CAP'+m[1].slice(3),status:'COMPLETED',amount:pu.amount,custom_id:pu.custom_id}]}}
  return r.end(JSON.stringify(o))}
 const s=/^\/v1\/billing\/subscriptions\/(I-[A-Z0-9]+)$/.exec(q.url);
 if(s)return r.end(JSON.stringify({id:s[1],status:'ACTIVE',plan_id:'P-PLAN',custom_id:subAcct,subscriber:{email_address:'sub@example.com'},billing_info:{next_billing_time:new Date(Date.now()+30*864e5).toISOString()}}));
 r.statusCode=404;r.end('{}')})}).listen(8799);
let subAcct='';
const O='https://signedchange-app.surge.sh';
const base={SITE_ORIGIN:O,RECEIVER_EMAIL:'termschange@gmail.com',PRICE:'49.00',SUB_PRICE:'9.00',CURRENCY:'USD',PAYPAL_VERIFY_URL:'http://127.0.0.1:8799/x',TOKEN_SECRET:'t',SUB_PLAN_ID:'P-PLAN',PAYPAL_API:'http://127.0.0.1:8799',PAYPAL_CLIENT_ID:'cid',PAYPAL_CLIENT_SECRET:'csec',PAYPAL_WEBHOOK_ID:'W',BREVO_API_URL:'http://127.0.0.1:8799/v3/smtp/email'};
const mk=b=>new Miniflare({scriptPath:'dist/worker.js',modules:true,kvNamespaces:['PAYMENTS'],durableObjects:{GIFT_LOCK:'GiftLock'},bindings:b});
const res=[];const t=(x,ok)=>{res.push(!!ok);console.log((ok?'PASS ':'FAIL ')+x)};
let ip=0;const R=(mf,p,o={})=>mf.dispatchFetch('http://w'+p,{...o,headers:{Origin:O,'Content-Type':'application/json','CF-Connecting-IP':'9.9.9.'+(ip++%250),...(o.headers||{})}});
const J=async r=>{try{return await r.json()}catch{return{}}};const A=a=>({Authorization:`Bearer ${a.id}.${a.key}`});
const buyLife=async(mf,a)=>{const o=await J(await R(mf,'/account/paypal-order',{method:'POST',headers:A(a),body:'{}'}));return J(await R(mf,'/account/paypal-capture',{method:'POST',headers:A(a),body:JSON.stringify({orderID:o.id||o.orderID})}))};
// 1. dormant without key
let mf=mk(base); let a=await J(await R(mf,'/account/new',{method:'POST'}));
let c=await buyLife(mf,a); t('lifetime unlock works without email key', c.ok); t('no email sent when BREVO_API_KEY missing', mails.length===0); await mf.dispose();
// 2. enabled
mf=mk({...base,BREVO_API_KEY:'BK'}); a=await J(await R(mf,'/account/new',{method:'POST'}));
c=await buyLife(mf,a); t('lifetime unlock ok with key', c.ok); t('one welcome email sent', mails.length===1);
const m=mails[0]||{}; t('sent to PayPal payer (lowercased)', m.to&&m.to[0].email===('buyer'+n+'@example.com')); t('html has PRO badge + plan + amount', /PRO/.test(m.htmlContent)&&/Pro Lifetime/.test(m.htmlContent)&&/49\.00/.test(m.htmlContent));
t('key secret not in email', !m.htmlContent.includes(a.key));
c=await buyLife(mf,a); t('second purchase same account: no duplicate', mails.length===1);
// subscription
const b=await J(await R(mf,'/account/new',{method:'POST'})); subAcct=b.id;
const s=await J(await R(mf,'/account/paypal-sub',{method:'POST',headers:A(b),body:'{"subscriptionID":"I-ABCDEFGH1234"}'}));
t('subscription unlock ok', s.ok); t('subscription welcome sent to subscriber email', mails.length===2&&mails[1].to[0].email==='sub@example.com'&&/Pro Monthly/.test(mails[1].htmlContent));
// provider failure never breaks unlock
mailFail=true; const d=await J(await R(mf,'/account/new',{method:'POST'})); c=await buyLife(mf,d); t('mail provider error does not block unlock', c.ok&&mails.length===2);
const meD=await J(await R(mf,'/account/me',{headers:A(d)})); t('account is Pro (server)', !!meD.pro);
mailFail=false; await mf.dispose(); mock.close();
console.log(`${res.filter(Boolean).length}/${res.length} passed`); process.exit(res.every(Boolean)?0:1);
