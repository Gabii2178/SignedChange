import { Miniflare } from 'miniflare';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const O='https://signedchange-app.surge.sh';
const mf = new Miniflare({ scriptPath: 'dist/worker.js', modules: true, kvNamespaces: ['PAYMENTS'], durableObjects:{GIFT_LOCK:'GiftLock'},
  bindings: { SITE_ORIGIN:O, RECEIVER_EMAIL:'termschange@gmail.com', PRICE:'49.00', SUB_PRICE:'9.00', CURRENCY:'USD', PAYPAL_VERIFY_URL:'http://127.0.0.1:1/', TOKEN_SECRET:'t' } });
const res=[]; const t=(n,ok)=>{res.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n)};
let ipc=0; const req=(p,o={},ip)=>mf.dispatchFetch('http://w'+p,{...o,headers:{Origin:O,'Content-Type':'application/json','CF-Connecting-IP':ip||'2.2.2.'+(ipc++%250),'User-Agent':'TestUA/1.0',...(o.headers||{})}});
const J=async r=>{try{return await r.json()}catch{return{}}};
const png='data:image/png;base64,'+readFileSync('test/sig.png').toString('base64');
const jpg='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([0xFF,0xD8,0xFF,0xE0]),Buffer.alloc(300,1)]).toString('base64');
const realJpg = readFileSync('/tmp/att.jpg'); const attJ='data:image/jpeg;base64,'+realJpg.toString('base64');
const A=a=>({Authorization:`Bearer ${a.id}.${a.key}`});
const acct=async()=>J(await req('/account/new',{method:'POST'}));
const F={biz:'Ada Builds',bizCo:'Ada Builds Ltd',bizRole:'Owner',contact:'ada@x.com',client:'Bob Client',clientCo:'Bob Co',clientRole:'Director',clientContact:'bob@example.com',job:'Kitchen remodel',contractDate:'2026-10-01',
  desc:'Add extra valve and move sink.',priceDir:'inc',price:'999',lines:[{d:'Valve',a:'120.00'},{d:'Labour',a:'80'}],origAmount:'5000',taxRate:'19.25',currency:'XAF',newDate:'2026-12-01',daysAdded:'5',payTerms:'net14',payMethod:'Mobile money',date:'2026-11-04',title:'Contractor Change Order',lang:'en'};
const create=(a,f={},x={})=>req('/doc/create',{method:'POST',headers:A(a),body:JSON.stringify({v:3,fields:{...F,...f},creatorSig:png,mode:'remote',tz:'Africa/Douala',...x})});
const a=await acct(); t('account', a.ok);
let r=await create(a,{desc:'Due on [date] please'}); let j=await J(r); t('placeholder blocked', r.status===400&&j.placeholders&&j.placeholders[0]==='[date]');
r=await create(a,{clientContact:''}); j=await J(r); t('remote requires contact', r.status===400&&j.field==='clientContact');
r=await create(a,{clientContact:'hello'}); t('contact must be email/phone', r.status===400);
r=await create(a,{clientContact:'+237 6 99 88 77 66'}); j=await J(r); t('phone accepted', r.status===200); const firstCo=j.coNo;
r=await create(a,{taxRate:'150'}); t('tax > 100 rejected', r.status===400);
r=await create(a,{newDate:'01/12/2026'}); t('bad date rejected', r.status===400);
r=await create(a,{payTerms:'custom',payCustom:''}); t('custom terms need text', r.status===400);
r=await create(a,{lines:[{d:'x',a:'abc'}]}); t('bad line amount rejected', r.status===400);
r=await create(a,{},{attachments:[jpg,jpg,jpg,jpg]}); t('4 attachments rejected', r.status===400);
r=await create(a,{},{attachments:['data:image/gif;base64,R0lGODlhAQABAAAAACw=']}); t('gif attachment rejected', r.status===400);
r=await create(a,{},{attachments:['data:image/jpeg;base64,'+Buffer.concat([Buffer.from([0x89,0x50,0x4E,0x47]),Buffer.alloc(300)]).toString('base64')]}); t('mismatched magic rejected', r.status===400);
r=await create(a,{},{attachments:['data:image/jpeg;base64,'+Buffer.concat([Buffer.from([0xFF,0xD8,0xFF]),Buffer.alloc(400*1024)]).toString('base64')]}); t('oversize attachment rejected', r.status===400);
// free limit counts only successful creations: 1 used so far
r=await create(a,{},{attachments:[attJ]}); j=await J(r); t('v3 doc with attachment created', r.status===200&&j.coNo===firstCo+1);
const u=new URL(j.signUrl.replace('#','?')), d=u.searchParams.get('d'), tk=u.searchParams.get('t');
r=await req(`/doc/get?d=${d}&t=${tk}`); let g=await J(r); t('signer gets v3 fields+agreement+attachment', g.v===3&&/CO #2/.test(g.agreeText)&&/dated 2026-10-01/.test(g.agreeText)&&g.attachments.length===1&&g.amounts.ch===200);
t('server computes price from lines (not client 999)', g.fields.price==='200.00');
t('tax & new total computed', Math.abs(g.amounts.tax-38.5)<1e-9 && Math.abs(g.amounts.newTotal-5238.5)<1e-9);
r=await req('/doc/sign',{method:'POST',body:JSON.stringify({d,t:tk,sig:png,name:'Bob Client',agree:true})}); t('sign without hash rejected (mandatory)', r.status===409);
r=await req('/doc/sign',{method:'POST',body:JSON.stringify({d,t:tk,sig:png,name:'Bob Client',agree:true,hash:'0'.repeat(64)})}); t('sign with wrong hash rejected', r.status===409);
r=await req('/doc/status?d='+d,{headers:A(a)}); t('owner status pending', (await J(r)).status==='pending');
r=await req('/doc/sign',{method:'POST',body:JSON.stringify({d,t:tk,sig:png,name:'Robert B. Client',agree:true,hash:g.hash,tz:'Europe/Paris',typed:true})}); j=await J(r); t('signed', j.ok&&j.finalHash);
const vk=j.viewKey;
r=await req(`/doc/decline`,{method:'POST',body:JSON.stringify({d,t:tk,reason:'too late'})}); t('decline after sign rejected', r.status===410);
r=await req('/doc/verify?id='+d); let v=await J(r); t('verify public: signed + fingerprints, no sigs/contacts', v.ok&&v.status==='signed'&&v.finalHash===j.finalHash&&v.other.name==='Robert B. Client'&&!JSON.stringify(v).includes('data:image')&&!JSON.stringify(v).includes('bob@example.com')&&v.attachments.length===1);
t('attachment hash matches sha256', v.attachments[0].hash===createHash('sha256').update(realJpg).digest('hex'));
t('signature image hash matches', v.otherSigHash===createHash('sha256').update(readFileSync('test/sig.png')).digest('hex'));
r=await req('/doc/verify?id=bad'); t('verify bad id 400', r.status===400);
r=await req('/doc/verify?id='+'A'.repeat(24)); t('verify unknown id 404', r.status===404);
r=await req(`/doc/pdf?d=${d}&v=${vk}`); const pdf=Buffer.from(await r.arrayBuffer()); t('PDF renders', r.status===200&&pdf.slice(0,5).toString()==='%PDF-'); writeFileSync('/tmp/v3-signed.pdf',pdf);
t('PDF filename has CO number', /-CO2\.pdf/.test(r.headers.get('Content-Disposition')));
// decline path
r=await create(a,{lang:'fr',priceDir:'dec',lines:[],price:'50',origAmount:'',taxRate:''}); j=await J(r);
const u2=new URL(j.signUrl.replace('#','?')), d2=u2.searchParams.get('d'), t2=u2.searchParams.get('t');
r=await req('/doc/decline',{method:'POST',body:JSON.stringify({d:d2,t:t2,reason:''})}); t('decline needs reason', r.status===400);
r=await req('/doc/decline',{method:'POST',body:JSON.stringify({d:d2,t:'x'.repeat(32),reason:'Price is wrong'})}); t('decline with wrong token rejected', r.status===404);
r=await req('/doc/decline',{method:'POST',body:JSON.stringify({d:d2,t:t2,reason:'Price should be 40, not 50.'})}); t('decline ok', r.status===200);
r=await req('/doc/status?d='+d2,{headers:A(a)}); j=await J(r); t('creator sees Declined + reason', j.status==='declined'&&j.declineReason==='Price should be 40, not 50.');
r=await req(`/doc/get?d=${d2}&t=${t2}`); t('link dead after decline', r.status===410);
r=await req('/doc/sign',{method:'POST',body:JSON.stringify({d:d2,t:t2,sig:png,name:'B',agree:true,hash:'x'})}); t('cannot sign after decline', r.status===410);
r=await req('/doc/pdf?d='+d2,{headers:A(a)}); const p2=Buffer.from(await r.arrayBuffer()); writeFileSync('/tmp/v3-declined-fr.pdf',p2); t('declined FR PDF renders', r.status===200&&/DECLINED/.test(r.headers.get('Content-Disposition')));
// me + delete auth
r=await req('/account/me',{headers:A(a)}); j=await J(r); t('me lists v3 docs with fields/coNo/decline', j.docs.some(x=>x.coNo&&x.fields&&x.declineReason));
const b=await acct();
r=await req('/doc/cancel',{method:'POST',headers:A(b),body:JSON.stringify({d,action:'delete'})}); t('other account cannot delete', r.status===404);
r=await req('/doc/cancel',{method:'POST',body:JSON.stringify({d,action:'delete'})}); t('no auth cannot delete', r.status===401);
r=await req('/doc/cancel',{method:'POST',headers:{Authorization:`Bearer ${a.id}.${'x'.repeat(43)}`},body:JSON.stringify({d,action:'delete'})}); t('wrong key cannot delete', r.status===401);
const kv=await mf.getKVNamespace('PAYMENTS');
r=await req('/doc/cancel',{method:'POST',headers:A(a),body:JSON.stringify({d,action:'delete'})}); t('owner deletes', r.status===200);
t('doc + attachment gone', !(await kv.get('doc:'+d)) && !(await kv.get(`att:${d}:0`)));
r=await req('/doc/verify?id='+d); t('verify after delete 404', r.status===404);
// in-person v3 gets final hash
const c=await acct(); r=await req('/doc/create',{method:'POST',headers:A(c),body:JSON.stringify({v:3,fields:{...F,clientContact:''},creatorSig:png,otherSig:png,mode:'inperson'})}); j=await J(r);
t('in-person v3 needs no contact, signed', r.status===200&&j.status==='signed');
v=await J(await req('/doc/verify?id='+j.id)); t('in-person has final fingerprint', !!v.finalHash);
// legacy v2 doc (no v) still works
r=await req('/doc/create',{method:'POST',headers:A(c),body:JSON.stringify({fields:{biz:'A',client:'B',desc:'x',price:'1',currency:'USD',date:'2026-11-04'},creatorSig:png,mode:'remote'})}); t('legacy create still works', r.status===200);
console.log(`${res.filter(Boolean).length}/${res.length} passed`);
await mf.dispose();
