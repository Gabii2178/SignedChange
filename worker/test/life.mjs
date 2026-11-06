import { Miniflare } from 'miniflare';
import http from 'node:http';
const orders={}; let n=0, verify='SUCCESS';
const mock=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{r.setHeader('Content-Type','application/json');
 if(q.url==='/v1/oauth2/token')return r.end(q.headers.authorization==='Basic '+btoa('cid:csec')?JSON.stringify({access_token:'AT',expires_in:3000}):(r.statusCode=401,'{}'));
 if(q.headers.authorization!=='Bearer AT'){r.statusCode=401;return r.end('{}')}
 if(q.url==='/v1/notifications/verify-webhook-signature')return r.end(JSON.stringify({verification_status:verify}));
 if(q.url==='/v2/checkout/orders'&&q.method==='POST'){const j=JSON.parse(b);const id='ORD'+String(++n).padStart(10,'0');orders[id]={id,status:'APPROVED',purchase_units:[{custom_id:j.purchase_units[0].custom_id,amount:j.purchase_units[0].amount}],_req:j};r.statusCode=201;return r.end(JSON.stringify(orders[id]))}
 const m=/^\/v2\/checkout\/orders\/([A-Z0-9]+)(\/capture)?$/.exec(q.url);
 if(m){const o=orders[m[1]];if(!o){r.statusCode=404;return r.end('{}')}
  if(m[2]){if(o.status==='COMPLETED'){r.statusCode=422;return r.end('{}')}if(o._fail){r.statusCode=422;return r.end('{}')}
   const pu=o.purchase_units[0];o.status='COMPLETED';pu.payments={captures:[{id:'CAP'+m[1].slice(3),status:o._pending?'PENDING':'COMPLETED',amount:o._amt||pu.amount,custom_id:pu.custom_id}]};if(o._pending)o.status='COMPLETED';}
  return r.end(JSON.stringify(o))}
 r.statusCode=404;r.end('{}')})}).listen(8798);
const O='https://signedchange-app.surge.sh';
const base={SITE_ORIGIN:O,RECEIVER_EMAIL:'termschange@gmail.com',PRICE:'49.00',SUB_PRICE:'9.00',CURRENCY:'USD',PAYPAL_VERIFY_URL:'http://127.0.0.1:8798/x',TOKEN_SECRET:'t',SUB_PLAN_ID:'P-PLAN',PAYPAL_API:'http://127.0.0.1:8798'};
const mk=b=>new Miniflare({scriptPath:'dist/worker.js',modules:true,kvNamespaces:['PAYMENTS'],durableObjects:{GIFT_LOCK:'GiftLock'},bindings:b});
const res=[];const t=(x,ok)=>{res.push(!!ok);console.log((ok?'PASS ':'FAIL ')+x)};
let ip=0;const R=(mf,p,o={})=>mf.dispatchFetch('http://w'+p,{...o,headers:{Origin:O,'Content-Type':'application/json','CF-Connecting-IP':'8.8.8.'+(ip++%250),...(o.headers||{})}});
const J=async r=>{try{return await r.json()}catch{return{}}};const A=a=>({Authorization:`Bearer ${a.id}.${a.key}`});
const me=async(mf,a)=>J(await R(mf,'/account/me',{headers:A(a)}));
const mko=async(mf,a)=>J(await R(mf,'/account/paypal-order',{method:'POST',headers:A(a),body:'{"amount":"0.01"}'}));
const cap=(mf,a,id)=>R(mf,'/account/paypal-capture',{method:'POST',headers:A(a),body:JSON.stringify({orderID:id})});
let mf=mk({...base});let a=await J(await R(mf,'/account/new',{method:'POST'}));
let r=await R(mf,'/account/paypal-order',{method:'POST',headers:A(a),body:'{}'});t('no secret -> order 503',r.status===503);
r=await cap(mf,a,'ORD0000000001');t('no secret -> capture 503, no Pro',r.status===503&&!(await me(mf,a)).pro);await mf.dispose();
mf=mk({...base,PAYPAL_CLIENT_ID:'cid',PAYPAL_CLIENT_SECRET:'csec',PAYPAL_WEBHOOK_ID:'WH'});
a=await J(await R(mf,'/account/new',{method:'POST'}));const b=await J(await R(mf,'/account/new',{method:'POST'}));
r=await R(mf,'/account/paypal-order',{method:'POST',body:'{}'});t('order needs auth',r.status===401||r.status===403);
let o=await mko(mf,a);t('order created',o.ok&&o.id);const q=orders[o.id]._req.purchase_units[0];
t('server fixes 49.00 USD + custom_id (client amount ignored)',q.amount.value==='49.00'&&q.amount.currency_code==='USD'&&q.custom_id===a.id);
r=await cap(mf,b,o.id);t('other account cannot capture',r.status===403&&!(await me(mf,b)).pro);
r=await cap(mf,a,'ORD9999999999');t('unknown order rejected',r.status===403);
r=await cap(mf,a,'<x>');t('malformed id 400',r.status===400);
t('no Pro yet',!(await me(mf,a)).pro);
r=await cap(mf,a,o.id);let j=await J(r);t('valid capture -> lifetime',r.status===200&&j.pro&&j.pro.plan==='lifetime');
t('/account/me shows lifetime',(await me(mf,a)).pro?.plan==='lifetime');
r=await cap(mf,a,o.id);t('repeat capture idempotent (200)',r.status===200);
// wrong amount
let o2=await mko(mf,b);orders[o2.id]._amt={value:'1.00',currency_code:'USD'};r=await cap(mf,b,o2.id);t('wrong amount rejected',r.status===403&&!(await me(mf,b)).pro);
let o3=await mko(mf,b);orders[o3.id]._amt={value:'49.00',currency_code:'EUR'};r=await cap(mf,b,o3.id);t('wrong currency rejected',r.status===403);
let o4=await mko(mf,b);orders[o4.id].purchase_units[0].custom_id=a.id;r=await cap(mf,b,o4.id);t('custom_id mismatch rejected',r.status===403&&!(await me(mf,b)).pro);
let o5=await mko(mf,b);orders[o5.id]._pending=true;r=await cap(mf,b,o5.id);t('pending capture -> 402 no Pro',r.status===402&&!(await me(mf,b)).pro);
let o6=await mko(mf,b);orders[o6.id]._fail=true;r=await cap(mf,b,o6.id);t('not approved -> 402',r.status===402&&!(await me(mf,b)).pro);
// webhook: forged
verify='FAILURE';r=await R(mf,'/paypal-webhook',{method:'POST',body:JSON.stringify({id:'WH-1',event_type:'PAYMENT.CAPTURE.COMPLETED',resource:{supplementary_data:{related_ids:{order_id:o6.id}}}})});t('forged webhook 400',r.status===400);
verify='SUCCESS';
// webhook completes order buyer abandoned
let o7=await mko(mf,b);await R(mf,'/x');const ord=orders[o7.id];ord.status='COMPLETED';ord.purchase_units[0].payments={captures:[{id:'CAP'+o7.id.slice(3),status:'COMPLETED',amount:{value:'49.00',currency_code:'USD'}}]};
r=await R(mf,'/paypal-webhook',{method:'POST',body:JSON.stringify({id:'WH-2',event_type:'PAYMENT.CAPTURE.COMPLETED',resource:{id:'CAP'+o7.id.slice(3),supplementary_data:{related_ids:{order_id:o7.id}}}})});
t('verified webhook grants lifetime for abandoned order',r.status===200&&(await me(mf,b)).pro?.plan==='lifetime');
// refund revokes
const capA='CAP'+o.id.slice(3);
r=await R(mf,'/paypal-webhook',{method:'POST',body:JSON.stringify({id:'WH-3',event_type:'PAYMENT.CAPTURE.REFUNDED',resource:{id:'REF0000000001',links:[{rel:'up',href:'https://api/v2/payments/captures/'+capA}]}})});
t('refund webhook revokes lifetime',r.status===200&&!(await me(mf,a)).pro);
r=await cap(mf,a,o.id);t('refunded payment cannot be re-claimed',r.status===403&&!(await me(mf,a)).pro);
console.log(`${res.filter(Boolean).length}/${res.length} passed`);await mf.dispose();mock.close();
