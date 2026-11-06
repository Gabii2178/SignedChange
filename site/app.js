function toast(t,ms){let e=document.getElementById('sctoast');if(!e){e=document.createElement('div');e.id='sctoast';e.className='toast';e.setAttribute('role','status');document.body.appendChild(e)}e.textContent=t;e.hidden=false;clearTimeout(e._t);e._t=setTimeout(()=>{e.hidden=true},ms||5000)}
'use strict';
(function(){
const $=i=>document.getElementById(i),API='https://signedchange-unlock.signedchange.workers.dev',SITE='https://signedchange-app.surge.sh';
const AK='sc_acct',TK='sc_pro_token',LK='sc_links',DK='sc_draft',UK='sc_tpls',SEEN='sc_seen';
const msg=t=>{$('msg').textContent=t};
const TZ=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){return''}})();
const TPL={
 freelance:{title:'Freelance Scope Change',job:'Project: ',desc:'The client asked for extra work not in the original quote:\n- \nAll other terms stay the same.',payTerms:'completion'},
 contractor:{title:'Contractor Change Order',job:'Job site / address: ',desc:'Additional work requested by the client during the job:\n- \nMaterials and labour for this change are included in the amount below.',payTerms:'completion'},
 landlord:{title:'Lease Amendment',job:'Property / unit: ',desc:'Landlord and tenant agree to the following change to the lease:\n- \nThe amount below is the [new monthly rent / one-time charge]. All other lease terms remain unchanged.'},
 agency:{title:'Retainer Change',job:'Retainer / account: ',desc:'Agency and client agree to change the monthly retainer:\n- Added services: \n- Removed services: \nNotice period and other terms stay the same.',payTerms:'net30'},
 employment:{title:'Employment Terms Change',job:'Position: ',desc:'Employer and employee agree to the following change:\n- Hours / shift: \n- Duties: \nAll other terms of employment stay the same.'},
 deadline:{title:'Deadline Extension',job:'Project / order: ',desc:'Both parties agree to move the deadline to the new completion date below because:\n- \nNo other terms change.',priceDir:'none'},
 deposit:{title:'Deposit & Refund Terms',job:'Booking / order: ',desc:'Both parties agree on these deposit terms:\n- Deposit paid: \n- Refundable if cancelled before [date]: yes / no\nThe amount below is the deposit.'},
 custom:{title:'Signed Change Record',job:'',desc:''}};
const FK=['title','biz','bizCo','bizRole','contact','client','clientCo','clientRole','clientContact','job','contractDate','origAmount','desc','priceDir','price','currency','taxRate','newDate','daysAdded','payTerms','payCustom','payMethod','date','lang'];
const userTpls=()=>{try{return JSON.parse(localStorage.getItem(UK))||{}}catch(e){return{}}};
const ts=$('tpl');function fillTpls(){ts.textContent='';const add=(k,v,g)=>{const o=document.createElement('option');o.value=k;o.textContent=v;(g||ts).appendChild(o)};
 Object.entries({freelance:'Freelancer – scope change',contractor:'Contractor – change order',landlord:'Landlord / tenant – lease amendment',agency:'Agency – retainer change',employment:'Employer / employee – hours or pay change',deadline:'Any job – deadline extension',deposit:'Any job – deposit & refund terms',custom:'Blank (write your own)'}).forEach(([k,v])=>add(k,v));
 const u=userTpls();if(Object.keys(u).length){const g=document.createElement('optgroup');g.label='My templates';Object.keys(u).forEach(n=>add('u:'+n,n,g));ts.appendChild(g)}ts.value='custom'}
fillTpls();
function setF(o){Object.entries(o).forEach(([k,v])=>{if($(k)&&v!=null)$(k).value=v});if(o.lines)setLines(o.lines);sync()}
ts.addEventListener('change',()=>{const v=ts.value,t=v.startsWith('u:')?userTpls()[v.slice(2)]:TPL[v];if(!t)return;if($('desc').value.trim()&&!confirm('Replace what you wrote with the template?'))return;
 setF({priceDir:'inc',payTerms:'',...t,lines:t.lines||[]});hilite()});
$('saveTpl').addEventListener('click',()=>{const n=(prompt('Name for this template (e.g. "Plumbing extra")')||'').trim().slice(0,40);if(!n)return;const f=read();const u=userTpls();
 u[n]={title:f.title,job:f.job,desc:f.desc,priceDir:f.priceDir,payTerms:f.payTerms,payCustom:f.payCustom,payMethod:f.payMethod,taxRate:f.taxRate,currency:f.currency,lines:f.lines,lang:f.lang};
 localStorage.setItem(UK,JSON.stringify(u));fillTpls();ts.value='u:'+n;toast('Template saved on this device.')});
['biz','bizCo','bizRole','contact','currency','lang'].forEach(k=>{const v=localStorage.getItem('co_'+k);if(v)$(k).value=v;$(k).addEventListener('input',()=>localStorage.setItem('co_'+k,$(k).value))});
$('date').valueAsDate=new Date();
// ---- price lines + live totals ----
function addLine(d,a){const r=document.createElement('div');r.className='pline';const di=document.createElement('input'),ai=document.createElement('input'),x=document.createElement('button');
 di.maxLength=120;di.placeholder='Item';di.setAttribute('aria-label','Line description');ai.maxLength=20;ai.inputMode='decimal';ai.placeholder='0.00';ai.setAttribute('aria-label','Line amount');
 x.type='button';x.className='btn ghost sm';x.textContent='✕';x.setAttribute('aria-label','Remove line');di.value=d||'';ai.value=a||'';
 x.addEventListener('click',()=>{r.remove();sync()});[di,ai].forEach(i=>i.addEventListener('input',sync));r.append(di,ai,x);$('lines').appendChild(r)}
function setLines(ls){$('lines').textContent='';(ls||[]).forEach(l=>addLine(l.d,l.a));if(ls&&ls.length)$('linesBox').open=true}
const lines=()=>[...document.querySelectorAll('#lines .pline')].map(r=>({d:r.children[0].value.trim(),a:r.children[1].value.trim()})).filter(l=>l.d||l.a);
$('addLine').addEventListener('click',()=>{addLine();$('lines').lastChild.firstChild.focus()});
const n=s=>{const v=parseFloat(String(s||'').replace(',','.'));return isNaN(v)?0:v},m2=v=>(Math.round(v*100)/100).toFixed(2);
function sync(){const dir=$('priceDir').value,ls=lines();$('priceBox').hidden=false;$('price').disabled=dir==='none'||ls.length>0;
 if(ls.length)$('price').value=m2(ls.reduce((s,l)=>s+n(l.a),0));if(dir==='none')$('price').value='0';
 $('payCustomBox').hidden=$('payTerms').value!=='custom';
 const c=$('currency').value+' ',ch=dir==='none'?0:n($('price').value)*(dir==='dec'?-1:1),rate=n($('taxRate').value),tax=Math.round(ch*rate)/100,tot=ch+tax,o=$('origAmount').value.trim();
 const T=$('totals');T.textContent='';const row=(a,b,bold)=>{const r=document.createElement('div');r.className='trow'+(bold?' tb':'');const x=document.createElement('span'),y=document.createElement('span');x.textContent=a;y.textContent=b;r.append(x,y);T.appendChild(r)};
 const sg=v=>(v>0?'+':v<0?'−':'')+c+m2(Math.abs(v));
 if(o)row('Original contract',c+m2(n(o)));row(dir==='none'?'This change (no price change)':dir==='dec'?'This change (decrease)':'This change (increase)',sg(ch));
 if(rate){row('Tax ('+rate+'%)',sg(tax));row('Total of this change',sg(tot),!o)}if(o)row('New contract total',c+m2(n(o)+tot),true);
 const inp=modeSel()==='remote';$('ccReq').textContent=inp?'(required to send a link)':'(optional)';
 $('agreePrev').textContent=($('lang').value==='fr'?'Texte signé par les deux parties : ':'Both parties sign this statement: ')+agreeText();draft()}
function agreeText(){const fr=$('lang').value==='fr',j=$('job').value.trim(),cd=$('contractDate').value;
 return fr?`J'accepte que cette modification (avenant n°…) amende ${j||"l'accord initial"}${cd?' daté du '+cd:''} ; toutes les autres conditions restent inchangées ; ma signature électronique a la même valeur qu'une signature manuscrite.`
 :`I agree this change (CO #…) amends ${j||'the original agreement'}${cd?' dated '+cd:''}; all other terms remain unchanged; my electronic signature has the same effect as a handwritten signature.`}
// ---- placeholder highlight ----
const PH=/\[[^\]\n]{1,60}\]/g;
function hilite(){let any=[];['job','desc','payCustom'].forEach(k=>{const v=$(k).value,m=v.match(PH)||[];any=any.concat(m);const e=$(k+'-e');
 if(m.length){$(k).classList.add('ph');$(k).setAttribute('aria-invalid','true');if(e)e.textContent='Replace: '+[...new Set(m)].join(', ')}else{$(k).classList.remove('ph');if(e&&e.dataset.ph!=='0')e.textContent='';$(k).removeAttribute('aria-invalid')}});return any}
// ---- accessible inline errors ----
function clearErr(){document.querySelectorAll('[aria-invalid]').forEach(e=>e.removeAttribute('aria-invalid'));document.querySelectorAll('.ferr').forEach(e=>e.textContent='')}
function ferr(id,t){const el=$(id),e=$(id+'-e');if(el){el.setAttribute('aria-invalid','true')}if(e)e.textContent=t;msg(t);if(el&&el.focus){el.focus();el.scrollIntoView({block:'center',behavior:'smooth'})}return false}
// ---- draft autosave ----
let dT=0,loading=true;function draft(){if(loading)return;clearTimeout(dT);dT=setTimeout(()=>{try{localStorage.setItem(DK,JSON.stringify({...read(),at:Date.now()}));$('draftNote').textContent='Draft saved on this device.'}catch(e){}},600)}
function read(){const f={};FK.forEach(k=>f[k]=($(k).value||'').trim());f.lines=lines();return f}
$('clearDraft').addEventListener('click',()=>{if(!confirm('Clear the form and the saved draft?'))return;localStorage.removeItem(DK);['title','job','desc','client','clientCo','clientRole','clientContact','contractDate','origAmount','price','taxRate','newDate','payCustom','payMethod'].forEach(k=>$(k).value='');
 $('title').value='Signed Change Record';$('daysAdded').value='0';$('priceDir').value='inc';$('payTerms').value='';setLines([]);$('date').valueAsDate=new Date();photos=[];thumbs();me.clear();other.clear();clearErr();sync();$('draftNote').textContent='Draft cleared.'});
document.querySelectorAll('#formbox input,#formbox textarea,#formbox select').forEach(e=>{if(e.id!=='tpl'&&e.type!=='file')e.addEventListener('input',()=>{if(e.getAttribute('aria-invalid')){e.removeAttribute('aria-invalid');const x=$(e.id+'-e');if(x)x.textContent=''}sync();if(['job','desc','payCustom'].includes(e.id))hilite()})});
// ---- photos (compressed in the browser) ----
let photos=[];
function shrink(file){return new Promise((ok,no)=>{const u=URL.createObjectURL(file),i=new Image();i.onload=()=>{let w=i.naturalWidth,h=i.naturalHeight;const s=Math.min(1,1400/Math.max(w,h));w=Math.round(w*s);h=Math.round(h*s);
 const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(i,0,0,w,h);URL.revokeObjectURL(u);let q=.8,d=c.toDataURL('image/jpeg',q);while(d.length>440000&&q>.3){q-=.1;d=c.toDataURL('image/jpeg',q)}
 if(d.length>440000){c.width=Math.round(w*.6);c.height=Math.round(h*.6);c.getContext('2d').drawImage(i,0,0,c.width,c.height);d=c.toDataURL('image/jpeg',.6)}ok(d)};i.onerror=()=>{URL.revokeObjectURL(u);no()};i.src=u})}
function thumbs(){const t=$('thumbs');t.textContent='';photos.forEach((p,k)=>{const w=document.createElement('div');w.className='thumb';const im=document.createElement('img');im.src=p;im.alt='Photo '+(k+1);const x=document.createElement('button');x.type='button';x.className='btn ghost sm';x.textContent='Remove';x.addEventListener('click',()=>{photos.splice(k,1);thumbs()});w.append(im,x);t.appendChild(w)})}
$('photos').addEventListener('change',async e=>{$('photos-e').textContent='';for(const f of [...e.target.files]){if(photos.length>=3){$('photos-e').textContent='Up to 3 photos.';break}
 if(!/^image\/(jpeg|png)$/.test(f.type)&&!/\.(jpe?g|png|heic)$/i.test(f.name)){$('photos-e').textContent='Only JPEG or PNG photos.';continue}try{photos.push(await shrink(f))}catch(x){$('photos-e').textContent='Could not read '+f.name+'.'}}e.target.value='';thumbs()});
// ---- signature pads (draw or type) ----
function pad(id,clr,typeBtn,nameFn){const c=$(id),x=c.getContext('2d');let d=false;const P={signed:false,typed:false,c};
 const sz=()=>{const r=c.getBoundingClientRect();if(!r.width)return;c.width=r.width*2;c.height=r.height*2;x.setTransform(2,0,0,2,0,0);x.lineWidth=2.5;x.lineCap='round';x.strokeStyle='#000';P.signed=false;P.typed=false};sz();P.sz=sz;
 const p=e=>{const r=c.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
 c.addEventListener('pointerdown',e=>{if(P.typed){P.clear()}d=true;x.beginPath();x.moveTo(...p(e))});c.addEventListener('pointermove',e=>{if(d){x.lineTo(...p(e));x.stroke();P.signed=true}});
 window.addEventListener('pointerup',()=>d=false);P.clear=()=>{x.clearRect(0,0,c.width,c.height);P.signed=false;P.typed=false};$(clr).addEventListener('click',P.clear);
 $(typeBtn).addEventListener('click',()=>{const nm=nameFn();if(!nm){toast('Type the name first.');return}P.clear();const r=c.getBoundingClientRect();let fs=Math.min(48,r.height*.45);x.font=`italic ${fs}px "Brush Script MT","Segoe Script","Snell Roundhand",cursive`;
  while(x.measureText(nm).width>r.width-24&&fs>14){fs-=2;x.font=`italic ${fs}px "Brush Script MT","Segoe Script","Snell Roundhand",cursive`}x.fillStyle='#000';x.textBaseline='middle';x.fillText(nm,12,r.height/2);P.signed=true;P.typed=true});
 P.url=()=>{const o=document.createElement('canvas');o.width=600;o.height=Math.round(600*c.height/c.width);o.getContext('2d').drawImage(c,0,0,o.width,o.height);return o.toDataURL('image/png')};return P}
const me=pad('sigMe','clearMe','typeMe',()=>$('biz').value.trim()),other=pad('sigOther','clearOther','typeOther',()=>$('client').value.trim());
const modeSel=()=>document.querySelector('input[name=mode]:checked').value;
document.querySelectorAll('input[name=mode]').forEach(r=>r.addEventListener('change',()=>{$('otherBox').hidden=modeSel()!=='inperson';if(!$('otherBox').hidden)other.sz();$('gen').textContent=modeSel()==='inperson'?'Create signed PDF':'Create & get signing link';sync()}));
// restore draft
try{const d=JSON.parse(localStorage.getItem(DK));if(d&&d.desc){setF(d);$('draftNote').textContent='Restored your unsent draft from '+new Date(d.at).toLocaleString()+'.'}}catch(e){}
loading=false;sync();hilite();
// ---- account ----
let acct=null;try{acct=JSON.parse(localStorage.getItem(AK))}catch(e){}
const H=()=>acct?{Authorization:'Bearer '+acct.id+'.'+acct.key}:{};
async function api(p,o={}){const r=await fetch(API+p,{...o,headers:{'Content-Type':'application/json',...H(),...(o.headers||{})}});let j={};try{j=await r.json()}catch(e){}j._s=r.status;return j}
async function ensure(){if(acct)return acct;const j=await api('/account/new',{method:'POST'});if(!j.ok)throw new Error(j.error||'Could not start. Please try again.');acct={id:j.id,key:j.key};localStorage.setItem(AK,JSON.stringify(acct));if(window.scTrack)scTrack('sign_up',{method:'app'});return acct}
let state=null;
const links=()=>{try{return JSON.parse(localStorage.getItem(LK))||{}}catch(e){return{}}};
const seen=()=>{try{return JSON.parse(localStorage.getItem(SEEN))||{}}catch(e){return{}}};
async function refresh(){if(!acct){$('count').textContent='Your first 3 documents are free.';hist([]);return}
 const j=await api('/account/me');if(j._s===401){localStorage.removeItem(AK);acct=null;return refresh()}if(!j.ok)return;state=j;
 $('count').textContent=j.pro?(j.pro.plan==='monthly'?`Pro Monthly: unlimited${j.pro.status==='cancelled'?' until '+j.pro.until.slice(0,10):''}.`:'Pro: unlimited documents.'):`Free documents left: ${j.freeLeft} of 3.`;
 $('plans').hidden=!!j.pro;$('isPro').hidden=!j.pro;document.querySelectorAll('.probadge').forEach(b=>{if(b.closest('#isPro'))return;b.hidden=!j.pro;b.title=j.pro?(j.pro.plan==='monthly'?'Pro Monthly':j.pro.plan==='lifetime'?'Pro Lifetime':'Pro'):''});$('akey').value=acct.id+'.'+acct.key;
 // in-app notices for status changes since last visit
 const sn=seen(),ch=j.docs.filter(d=>sn[d.id]&&sn[d.id]!==d.status&&(d.status==='signed'||d.status==='declined'));
 if(ch.length)toast(ch.map(d=>(d.status==='signed'?'✅ Signed: ':'✋ Changes requested: ')+d.title+' – '+d.client).join(' · '),9000);
 hist(j.docs,ch.map(d=>d.id));const nx={};j.docs.forEach(d=>nx[d.id]=d.status);localStorage.setItem(SEEN,JSON.stringify(nx))}
function hist(docs,fresh){fresh=fresh||[];const L=$('history');L.textContent='';if(!docs.length){L.innerHTML='<p class="small">No documents yet.</p>';return}const lk=links();
 docs.forEach(d=>{const c=document.createElement('div');c.className='card hdoc';const b=document.createElement('b');b.textContent=(d.coNo?'CO #'+d.coNo+' · ':'')+d.title+' – '+d.client;c.appendChild(b);
  if(fresh.includes(d.id)){const nb=document.createElement('span');nb.className='stb new';nb.textContent='NEW';b.appendChild(document.createTextNode(' '));b.appendChild(nb)}
  const st={signed:['ok','✅ Signed by both'],pending:['wait','⏳ Waiting for signature'],declined:['no','✋ Changes requested'],cancelled:['off','✖ Cancelled']}[d.status]||['off',d.status];
  const bd=document.createElement('span');bd.className='stb '+st[0];bd.textContent=st[1];const s=document.createElement('p');s.className='small';
  const amt=d.total!=null?(d.total>0?'+':d.total<0?'−':'')+(d.currency||'')+' '+Math.abs(d.total).toFixed(2):`${d.currency||''} ${d.price}`;
  s.append(bd,document.createTextNode(` ${amt} · ${d.date}`+(d.status==='pending'?' · link valid until '+d.expires.slice(0,10):'')));c.appendChild(s);
  if(d.status==='declined'&&d.declineReason){const q=document.createElement('blockquote');q.className='reason';q.textContent='Their reason: “'+d.declineReason+'”';c.appendChild(q)}
  const left=d.expires?(new Date(d.expires)-Date.now())/864e5:99;
  if(d.status==='pending'&&left<3){const w=document.createElement('p');w.className='small warnx';w.textContent=`⚠️ The signing link expires in ${Math.max(0,Math.ceil(left))} day(s).`;c.appendChild(w)}
  const btn=(t,f,g)=>{const x=document.createElement('button');x.type='button';x.className='btn sm'+(g?' ghost':'');x.textContent=t;x.addEventListener('click',f);c.appendChild(x);c.appendChild(document.createTextNode(' '))};
  if(d.status!=='cancelled')btn(d.status==='signed'?'Download PDF':'Download draft',()=>dl(d.id),d.status!=='signed');
  if(d.status==='pending'&&lk[d.id])btn(left<3?'Send reminder':'Share link again',()=>showShare(lk[d.id],d.client,d.id,left<3),1);
  if(d.fields)btn(d.status==='declined'?'Revise & resend':'Duplicate',()=>dup(d),1);
  if(d.status==='pending')btn('Cancel',async()=>{if(confirm('Cancel this document? The link will stop working.')){await api('/doc/cancel',{method:'POST',body:JSON.stringify({d:d.id})});refresh()}},1);
  btn('Delete',async()=>{if(!confirm('Delete "'+d.title+' – '+d.client+'" permanently? The PDF, photos and verify page will be removed from our server. This cannot be undone.'))return;
   const r=await api('/doc/cancel',{method:'POST',body:JSON.stringify({d:d.id,action:'delete'})});if(r.ok){const l=links();delete l[d.id];localStorage.setItem(LK,JSON.stringify(l));toast('Document deleted.');refresh()}else toast(r.error||'Could not delete.')},1);
  c.lastChild.previousSibling.classList.add('danger');
  const vl=document.createElement('a');vl.href='verify.html?id='+d.id;vl.className='small vlink';vl.textContent='Public verify page';vl.target='_blank';vl.rel='noopener';c.appendChild(vl);
  L.appendChild(c)})}
function dup(d){if($('desc').value.trim()&&!confirm('Replace the form with a copy of this document?'))return;const f={...d.fields};
 setF({priceDir:'inc',payTerms:'',...f,date:new Date().toISOString().slice(0,10),lines:f.lines||[]});$('formbox').scrollIntoView({behavior:'smooth'});toast(d.status==='declined'?'Copied. Edit it to address their reason, then sign and send again.':'Copied into the form. Edit and sign to create a new document.');hilite()}
async function dl(id){const r=await fetch(API+'/doc/pdf?d='+encodeURIComponent(id),{headers:H()});if(!r.ok){toast('Could not download the PDF. Please try again.');return}
 const bl=await r.blob(),cd=r.headers.get('Content-Disposition')||'',m=/filename="([^"]+)"/.exec(cd),a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download=m?m[1]:'signedchange.pdf';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000)}
let poll=0;
function watch(id){clearInterval(poll);let k=0;$('live').className='live';$('live').textContent='⏳ Waiting for them to sign… this page updates by itself.';
 poll=setInterval(async()=>{if($('share').hidden||++k>360||document.hidden&&k%6)return k>360&&clearInterval(poll);const j=await api('/doc/status?d='+encodeURIComponent(id));if(!j.ok)return;
  if(j.status==='signed'){clearInterval(poll);$('live').className='live ok';$('live').textContent='✅ Signed! '+j.client+' signed just now. Download the final PDF in My documents below.';toast('✅ Signed! '+j.client+' signed your document.',9000);if(window.scTrack)scTrack('doc_signed_remote');refresh()}
  else if(j.status==='declined'){clearInterval(poll);$('live').className='live no';$('live').textContent='✋ '+j.client+' asked for changes: “'+(j.declineReason||'')+'”. Use "Revise & resend" in My documents.';toast('✋ '+j.client+' asked for changes.',9000);refresh()}
  else if(j.status==='cancelled')clearInterval(poll)},5000)}
function showShare(url,client,id,remind){$('share').hidden=false;$('slink').value=url;if(window.scTrack)scTrack('share_sign_link');
 const t=remind?`Hi ${client}, a reminder: the signing link for our agreed change expires soon. Please review and sign (or ask for changes) here: ${url}`:`Hi ${client}, please review and sign our agreed change here (takes 1 minute, no app needed): ${url}`;
 $('wa').href='https://wa.me/?text='+encodeURIComponent(t);const cc=(state&&state.docs.find(x=>x.id===id)||{}).fields;const to=cc&&/@/.test(cc.clientContact)?cc.clientContact:'';
 $('em').href='mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent(remind?'Reminder: please sign our agreed change':'Please sign: agreed change')+'&body='+encodeURIComponent(t);$('share').scrollIntoView({behavior:'smooth'});if(id)watch(id)}
$('copy').addEventListener('click',()=>{navigator.clipboard.writeText($('slink').value).then(()=>{$('copy').textContent='Copied ✓'})});
if(navigator.share)$('nshare').hidden=false;$('nshare').addEventListener('click',()=>navigator.share({title:'Please sign',url:$('slink').value}).catch(()=>{}));
$('gen').addEventListener('click',async()=>{msg('');clearErr();const mode=modeSel(),g=$('gen');const f=read();
 if(!f.biz)return ferr('biz','Please type your name.');if(!f.client)return ferr('client','Please type the other party\'s name.');
 if(mode==='remote'){if(!f.clientContact)return ferr('clientContact','Add their email or phone so the signing link can reach them.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.clientContact)&&(f.clientContact.replace(/\D/g,'').length<6||/[^\d\s+().-]/.test(f.clientContact)))return ferr('clientContact','Use an email (name@example.com) or a phone number.')}
 if(!f.desc)return ferr('desc','Please describe what changed.');const ph=hilite();if(ph.length){const k=['job','desc','payCustom'].find(k=>PH.test($(k).value)||(PH.lastIndex=0,false));PH.lastIndex=0;return ferr(k||'desc','Replace the highlighted [placeholders] first: '+[...new Set(ph)].join(', '))}
 if(f.priceDir!=='none'&&!/^\d{1,9}([.,]\d{1,2})?$/.test(f.price))return ferr('price','Amount should be a number like 250 or 250.00.');
 if(f.origAmount&&!/^\d{1,9}([.,]\d{1,2})?$/.test(f.origAmount))return ferr('origAmount','Original amount should be a number like 5000.00.');
 if(f.taxRate&&!(/^\d{1,3}([.,]\d{1,3})?$/.test(f.taxRate)&&n(f.taxRate)<=100))return ferr('taxRate','Tax rate should be between 0 and 100.');
 if(f.payTerms==='custom'&&!f.payCustom)return ferr('payCustom','Describe the custom payment terms.');
 if(!me.signed)return ferr('sigMe','Please sign in the "Your signature" box (or tap "Type my name instead").');if(mode==='inperson'&&!other.signed)return ferr('sigOther','The other party must sign in their box.');
 g.disabled=true;g.textContent='Working…';
 try{await ensure();const j=await api('/doc/create',{method:'POST',body:JSON.stringify({v:3,tz:TZ,fields:f,creatorSig:me.url(),mode,otherSig:mode==='inperson'?other.url():undefined,attachments:photos.length?photos:undefined})});
  if(j._s===402){msg(j.message||'Free limit reached.');$('buy').scrollIntoView({behavior:'smooth'})}
  else if(!j.ok){if(j.field&&$(j.field))ferr(j.field,j.error);else msg(j.error||'Something went wrong. Please try again.');if(j.placeholders)hilite()}
  else{if(window.scTrack)scTrack('doc_created',{method:mode});localStorage.removeItem(DK);photos=[];thumbs();$('draftNote').textContent='';toast('Created CO #'+j.coNo+'.');
   if(j.signUrl){const l=links();l[j.id]=j.signUrl;localStorage.setItem(LK,JSON.stringify(l));await refresh();showShare(j.signUrl,f.client,j.id)}else{$('share').hidden=true;await dl(j.id);await refresh()}}}
 catch(e){msg(e.message||'Network error, please try again.')}
 g.disabled=false;g.textContent=mode==='inperson'?'Create signed PDF':'Create & get signing link'});
// ---- payments (PayPal hosted checkout; card data never touches this site) ----
function pay(kind){if(!acct)return;const fm=document.createElement('form');fm.method='post';fm.action='https://www.paypal.com/cgi-bin/webscr';fm.target='_top';
 const base={business:'termschange@gmail.com',currency_code:'USD',no_shipping:'1',no_note:'1',custom:acct.id,notify_url:API+'/ipn',return:SITE+'/app.html?paid=1',cancel_return:SITE+'/app.html#buy',rm:'1',cbt:'Return to SignedChange'};
 const v=kind==='sub'?{cmd:'_xclick-subscriptions',item_name:'SignedChange Pro Monthly',a3:'9.00',p3:'1',t3:'M',src:'1',sra:'1'}:{cmd:'_xclick',item_name:'SignedChange Pro Lifetime',amount:'49.00'};
 Object.entries({...base,...v}).forEach(([k,val])=>{const i=document.createElement('input');i.type='hidden';i.name=k;i.value=val;fm.appendChild(i)});document.body.appendChild(fm);fm.submit()}
['paySub','payLife'].forEach(id=>$(id).addEventListener('click',async()=>{const p=$('pmsg');try{p.innerHTML='<span class="spin" aria-hidden="true"></span> Redirecting to secure PayPal checkout…';await ensure();const kind=id==='paySub'?'sub':'life';if(window.scTrack)scTrack('begin_checkout',{currency:'USD',value:kind==='sub'?9:49,item_name:kind==='sub'?'Pro Monthly':'Pro Lifetime'});pay(kind)}catch(e){p.textContent=e.message}}));
const rmsg=t=>{$('rmsg').textContent=t};
// ---- Pro Monthly via PayPal Smart Subscribe (PayPal or Debit/Credit Card; card data stays in PayPal's frames) ----
const PP_CLIENT='BAAi-lz10cQgfYEl5iTOYjSX4nNOxG3GhSGsyIfH93vIW66lG7hCQ-GO3jqb1FY5XWKnIHbcfAMkqKy868',PP_PLAN='P-74K152053K411091TNLU5UCQ',SK='sc_sub';
async function claimSub(id,tries){const p=$('pmsg');for(let i=0;i<tries;i++){const j=await api('/account/paypal-sub',{method:'POST',body:JSON.stringify({subscriptionID:id})});
 if(j.ok){await refresh();p.textContent='Pro Monthly unlocked. Thank you!';if(window.scTrack)scTrack('purchase',{currency:'USD',value:9,transaction_id:id});return true}
 if(!(j.pending||j._s===502||j._s===503||j._s===429)||i===tries-1){p.textContent=(j.error||'Could not confirm the subscription.')+' Your subscription ID: '+id+' (email it to termschange@gmail.com if Pro is not unlocked).';return false}
 p.textContent='Confirming your subscription with PayPal…';await new Promise(r=>setTimeout(r,5000))}return false}
function loadSmartSub(){const box=$('ppSub');if(!box)return;const fail=()=>{box.textContent='';$('paySub').hidden=false};
 const s=document.createElement('script');s.src='https://www.paypal.com/sdk/js?client-id='+PP_CLIENT+'&vault=true&intent=subscription';s.dataset.sdkIntegrationSource='button-factory';
 s.onerror=fail;s.onload=()=>{try{box.textContent='';window.paypal.Buttons({style:{shape:'rect',color:'gold',layout:'vertical',label:'subscribe'},
  createSubscription:async(data,actions)=>{await ensure();if(window.scTrack)scTrack('begin_checkout',{currency:'USD',value:9,item_name:'Pro Monthly'});return actions.subscription.create({plan_id:PP_PLAN,custom_id:acct.id})},
  onApprove:async(data)=>{try{localStorage.setItem(SK,data.subscriptionID)}catch(e){}$('pmsg').textContent='Confirming your subscription with PayPal…';await claimSub(data.subscriptionID,8)},
  onError:()=>{$('pmsg').textContent='PayPal could not start the checkout. Please try again, or use the button below.';$('paySub').hidden=false}
 }).render('#ppSub').catch(fail)}catch(e){fail()}};document.head.appendChild(s)}
loadSmartSub();
// ---- Pro Lifetime via PayPal Smart Buttons (one-time $49; order created & captured on our server) ----
function loadSmartLife(){const box=$('ppLife');if(!box)return;const fail=()=>{box.textContent='';$('payLife').hidden=false};
 const s=document.createElement('script');s.src='https://www.paypal.com/sdk/js?client-id='+PP_CLIENT+'&intent=capture&currency=USD';s.dataset.namespace='paypalLife';
 s.onerror=fail;s.onload=()=>{try{box.textContent='';window.paypalLife.Buttons({style:{shape:'rect',color:'gold',layout:'vertical',label:'pay'},
  createOrder:async()=>{await ensure();if(window.scTrack)scTrack('begin_checkout',{currency:'USD',value:49,item_name:'Pro Lifetime'});const j=await api('/account/paypal-order',{method:'POST',body:'{}'});if(!j.ok)throw new Error(j.error||'Could not start checkout.');return j.id},
  onApprove:async(data)=>{const p=$('pmsg');p.innerHTML='<span class="spin" aria-hidden="true"></span> Confirming your payment with PayPal…';
   for(let i=0;i<4;i++){const j=await api('/account/paypal-capture',{method:'POST',body:JSON.stringify({orderID:data.orderID})});
    if(j.ok){await refresh();p.textContent='Pro Lifetime unlocked. Thank you!';if(window.scTrack)scTrack('purchase',{currency:'USD',value:49,transaction_id:data.orderID});return}
    if(!(j._s===502||j._s===503||j._s===429)||i===3){p.textContent=(j.error||'Could not confirm the payment.')+' Order ID: '+data.orderID+' (email it to termschange@gmail.com if Pro is not unlocked).';return}
    await new Promise(r=>setTimeout(r,4000))}},
  onError:()=>{$('pmsg').textContent='PayPal could not start the checkout. Please try again, or use the button below.';$('payLife').hidden=false}
 }).render('#ppLife').catch(fail)}catch(e){fail()}};document.head.appendChild(s)}
loadSmartLife();

async function link(token){const j=await api('/account/link',{method:'POST',body:JSON.stringify({token})});if(j.ok){localStorage.setItem(TK,token);await refresh();return true}rmsg(j.error||'Could not unlock.');return false}
$('restore').addEventListener('click',async()=>{const tx=$('rtx').value.trim().replace(/[^A-Za-z0-9]/g,''),em=$('rem').value.trim();if(!tx||!em){rmsg('Enter both the transaction ID and your PayPal email.');return}
 rmsg('Checking…');try{await ensure();const r=await fetch(API+'/verify?tx='+encodeURIComponent(tx)+'&email='+encodeURIComponent(em)),j=await r.json();if(j.ok&&j.token){if(await link(j.token))rmsg('Pro unlocked. Thank you!')}else rmsg(j.error||'Not found.')}catch(e){rmsg('Network error, please try again.')}});
$('redeem').addEventListener('click',async()=>{const gm=t=>{$('gmsg').textContent=t},code=$('gcode').value.trim();if(!code){gm('Enter your gift code.');return}gm('Checking…');
 try{await ensure();const r=await fetch(API+'/redeem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})}),j=await r.json();
  if(j.ok&&j.token){$('gcode').value='';if(await link(j.token))gm('Pro unlocked. Enjoy!')}else gm(j.error||'Code not accepted.')}catch(e){gm('Network error, please try again.')}});
// ---- account key backup / restore ----
$('copykey').addEventListener('click',()=>navigator.clipboard.writeText($('akey').value).then(()=>{$('copykey').textContent='Copied ✓'}));
$('usekey').addEventListener('click',async()=>{const v=$('newkey').value.trim(),m=/^([\w-]{20,40})\.([\w-]{40,60})$/.exec(v);if(!m){$('kmsg').textContent='That key does not look right.';return}
 const old=acct;acct={id:m[1],key:m[2]};const j=await api('/account/me');if(j.ok){localStorage.setItem(AK,JSON.stringify(acct));$('kmsg').textContent='Account restored.';refresh()}else{acct=old;$('kmsg').textContent='Key not accepted.'}});
// ---- startup ----
(async()=>{try{
 const old=localStorage.getItem(TK);if(old){await ensure();await api('/account/link',{method:'POST',body:JSON.stringify({token:old})})}
 const P=new URLSearchParams(location.search);
 const ALIAS={'change-order':'contractor','scope-creep':'freelance','verbal-agreement':'freelance','contractor':'contractor','freelance':'freelance','landlord':'landlord','agency':'agency','employment':'employment','deadline':'deadline','deposit':'deposit','custom':'custom'};
 const tplKey=ALIAS[(P.get('template')||'').toLowerCase()];
 if(tplKey&&TPL[tplKey]){ts.value=tplKey;const t=TPL[tplKey];$('title').value=t.title;$('job').value=t.job;$('desc').value=t.desc}
 const firePurchase=(tx)=>{if(window.scTrack){const v=(state&&state.pro&&state.pro.plan==='monthly')?9:49;scTrack('purchase',{currency:'USD',value:v,transaction_id:tx||undefined})}};
 if(P.get('paid')==='1'){const tx=(P.get('tx')||P.get('txn_id')||'').replace(/[^A-Za-z0-9]/g,'');history.replaceState(null,'',location.pathname+(tplKey?('?template='+encodeURIComponent(P.get('template'))):''));$('buy').scrollIntoView();rmsg('Confirming your PayPal payment… (this can take up to a minute)');
  for(let i=0;i<10;i++){await refresh();if(state&&state.pro){rmsg('Pro unlocked. Thank you!');firePurchase(tx);return}
   if(tx){const r=await fetch(API+'/verify?ret=1&tx='+encodeURIComponent(tx)).catch(()=>null);if(r&&r.ok){const j=await r.json();if(j.token&&await link(j.token)){rmsg('Pro unlocked. Thank you!');firePurchase(tx);return}}}
   await new Promise(r=>setTimeout(r,6000))}
  rmsg('Payment not confirmed yet. If you paid, wait a few minutes and reload, or use "Restore Pro" with your PayPal transaction ID.')}
 else{await refresh();const sid=localStorage.getItem(SK);if(sid&&state&&!state.pro)await claimSub(sid,1).catch(()=>{})}}catch(e){}})();
})();
