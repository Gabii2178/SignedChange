function toast(t){let e=document.getElementById('sctoast');if(!e){e=document.createElement('div');e.id='sctoast';e.className='toast';e.setAttribute('role','status');document.body.appendChild(e)}e.textContent=t;e.hidden=false;clearTimeout(e._t);e._t=setTimeout(()=>{e.hidden=true},5000)}
'use strict';
(function(){const $=i=>document.getElementById(i),API=(location.hostname==='localhost'||location.hostname==='127.0.0.1')?location.origin:'https://signedchange-unlock.signedchange.workers.dev';
const P=new URLSearchParams(location.hash.slice(1)),d=P.get('d'),t=P.get('t'),v=P.get('v');
const TZ=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){return''}})();
const show=id=>['loading','review','done','err','declined'].forEach(x=>$(x).hidden=x!==id);
const T=(key,fallback,vars)=>window.scT?scT(key,vars):fallback;
const err=m=>{$('errm').textContent=m;show('err')};
async function dl(view){const r=await fetch(API+'/doc/pdf?d='+encodeURIComponent(d)+'&v='+encodeURIComponent(view));if(!r.ok){toast(r.status===409?T('pdf.mismatch',"This copy doesn't match the stored record."):r.status===503?T('pdf.down',"We can't confirm this document right now."):r.status===404?T('pdf.missing','That PDF is not available.'):T('pdf.other','Could not download the PDF. Please try again.'));return}
 const b=await r.blob(),m=/filename="([^"]+)"/.exec(r.headers.get('Content-Disposition')||''),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=m?m[1]:'signedchange.pdf';document.body.appendChild(a);a.click();setTimeout(()=>a.remove(),2000)}
function done(view){show('done');$('dl').onclick=()=>dl(view);try{localStorage.setItem('sc_signed_'+d,view)}catch(e){}history.replaceState(null,'','#d='+d+'&v='+view)}
if(!d){err(T('sign.incomplete','This link is incomplete. Ask the sender to send it again.'));return}
if(v){fetch(API+'/doc/status?d='+encodeURIComponent(d)+'&v='+encodeURIComponent(v)).then(r=>r.json()).then(j=>{if(j.ok&&j.status==='signed')done(v);else if(j.ok&&j.status==='confirming'){err(T('poll.confirm',j.message||'The signature was accepted. The stored record is still being confirmed.'));$('retryGet').hidden=false}else err(T('sign.notfound','Document not found.'))}).catch(()=>err(T('sign.network','Network error. Check your connection and try again.')));return}
let doc=null;const PT={completion:'On completion of this change',net7:'Net 7 (within 7 days)',net14:'Net 14 (within 14 days)',net30:'Net 30 (within 30 days)'};
const money=(x,c,s)=>(s&&x>0?'+':x<0?'−':'')+(c?c+' ':'')+Math.abs(x).toFixed(2);
function load(){fetch(API+'/doc/get?d='+encodeURIComponent(d)+'&t='+encodeURIComponent(t||'')).then(async r=>{const j=await r.json().catch(()=>({}));j._s=r.status;return j}).then(j=>{
 if(!j.ok){const sv=localStorage.getItem('sc_signed_'+d);if(j.code==='used'&&sv)return done(sv);if(j.code==='declined')return show('declined');
  if(j._s===503){err(T('sign.confirm','We can\'t confirm this document right now.'));$('retryGet').hidden=false;return}
  if(j._s===410){err(j.error||T('sign.finished','This link is finished.'));return}
  if(j._s===404){err(T('sign.invalid','This signing link is not valid.'));return}
  if(j._s===403){err(T('sign.forbidden','You cannot open this document with this link.'));return}
  return err(j.error||T('sign.invalid','This signing link is not valid.'))}
 doc=j;const f=j.fields,c=f.currency;$('dt').textContent=f.title;
 const who=(n,co,r,ct)=>n+(r?', '+r:'')+(co?' – '+co:'')+(ct?' · '+ct:'');
 const rows=[[T('sign.row.date','Date'),f.date],[T('sign.row.from','From'),who(f.biz,f.bizCo,f.bizRole,f.contact)],[T('sign.row.to','To'),who(f.client,f.clientCo,f.clientRole,f.clientContact)],[T('sign.row.job','Job / contract'),(f.job||'-')+(f.contractDate?' ('+T('sign.row.dated','agreement dated')+' '+f.contractDate+')':'')],[T('sign.row.change','Agreed change'),f.desc]];
 if(j.v===3){$('cono').textContent=T('sign.co','Change order #'+j.coNo,{n:j.coNo});
  if(f.lines&&f.lines.length)rows.push([T('sign.row.breakdown','Price breakdown'),f.lines.map(l=>l.d+': '+money(parseFloat(String(l.a).replace(',','.')),c)).join('\n')]);
  if(f.newDate||+f.daysAdded)rows.push([T('sign.row.schedule','Schedule'),(f.newDate?T('sign.row.newDate','New completion date: '+f.newDate,{date:f.newDate})+'\n':'')+T('sign.row.days','Days added: '+(+f.daysAdded||0),{n:+f.daysAdded||0})]);
  if(f.payTerms||f.payMethod)rows.push([T('sign.row.payment','Payment'),(f.payTerms?T('sign.row.due','Due: '+(f.payTerms==='custom'?f.payCustom:PT[f.payTerms]),{terms:f.payTerms==='custom'?f.payCustom:T('sign.pay.'+f.payTerms,PT[f.payTerms]||f.payTerms)})+'\n':'')+(f.payMethod?T('sign.row.method','Method: '+f.payMethod,{method:f.payMethod}):'')]);
  const a=j.amounts,totals=$('totals');totals.hidden=false;const row=(x,y,b)=>{const r=document.createElement('div');r.className='trow'+(b?' tb':'');const s1=document.createElement('span'),s2=document.createElement('span');s1.textContent=x;s2.textContent=y;r.append(s1,s2);totals.appendChild(r)};
  if(a.orig!=null)row(T('sign.row.original','Original contract'),money(a.orig,c));row(f.priceDir==='none'?T('sign.row.changeNone','This change (no price change)'):f.priceDir==='dec'?T('sign.row.changeDec','This change (decrease)'):T('sign.row.changeInc','This change (increase)'),money(a.ch,c,1));
  if(a.rate){row(T('sign.row.tax','Tax ('+a.rate+'%)',{rate:a.rate}),money(a.tax,c,1));row(T('sign.row.total','Total of this change'),money(a.tot,c,1),a.orig==null)}if(a.newTotal!=null)row(T('sign.row.newTotal','New contract total'),money(a.newTotal,c),1);
  $('agreetxt').textContent=j.agreeText;$('agreetxt').hidden=false;$('agreeL').textContent=T('app.agreeBox','I agree to the statement above and sign this change electronically.');
  if($('agreeLang'))$('agreeLang').textContent=(f.lang==='en'||f.lang==='fr')?T('agree.recorded','Agreement language: '+f.lang,{lang:T('lang.'+f.lang,f.lang)}):T('agree.unknown','The agreement language was not recorded with this document.');
  (j.attachments||[]).forEach((src,i)=>{if(!src)return;const im=document.createElement('img');im.src=src;im.alt=T('sign.photo','Attached photo '+(i+1),{n:i+1});im.className='attimg';$('atts').appendChild(im)})}
 else rows.push([T('sign.row.amount','Agreed amount'),(c?c+' ':'')+f.price]);
 const dl_=$('rows');rows.forEach(([a,b])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=a;dd.textContent=b;dl_.appendChild(dt);dl_.appendChild(dd)});
 $('cs').src=j.creatorSig;$('cs').hidden=false;$('csn').textContent=T('sign.by','Signed by '+f.biz,{name:f.biz});$('name').value=f.client;$('exp').textContent=j.expires?String(j.expires).slice(0,10):'';try{document.documentElement.dataset.agreeCurrency=c||'';document.documentElement.dataset.agreeAmount=String(j.amounts&&j.amounts.tot!=null?j.amounts.tot:(f.price||''))}catch(e){}show('review');sz();if(window.scPaintFx)scPaintFx();paintVersions(j)}).catch(()=>err(T('sign.network','Network error. Check your connection and try again.')))}
function paintVersions(j){const label=$('verLabel'),list=$('verHist');if(!label||!list)return;const n=j.version||1;label.textContent=T('sign.version','Version '+n+'. You are reviewing this exact version.',{n});list.textContent='';(j.history||[]).forEach(v=>{const li=document.createElement('li');const who=v.by==='invitee'?T('sign.who.invitee','invited person'):T('sign.who.sender','sender');li.textContent=T('sign.history','Version '+v.n+' · '+who+' · '+(v.action||'create')+' · '+(v.at||'').slice(0,10),{n:v.n,who,action:v.action||'create',date:(v.at||'').slice(0,10)});list.appendChild(li)})}
load();if($('retryGet'))$('retryGet').addEventListener('click',()=>{show('loading');load()});
const c=$('sig'),x=c.getContext('2d');let dn=false,signed=false,typed=false;
function sz(){const r=c.getBoundingClientRect();c.width=r.width*2;c.height=r.height*2;x.setTransform(2,0,0,2,0,0);x.lineWidth=2.5;x.lineCap='round'}
const clr=()=>{x.clearRect(0,0,c.width,c.height);signed=false;typed=false};
const p=e=>{const r=c.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
c.addEventListener('pointerdown',e=>{if(typed)clr();dn=true;x.beginPath();x.moveTo(...p(e))});c.addEventListener('pointermove',e=>{if(dn){x.lineTo(...p(e));x.stroke();signed=true}});window.addEventListener('pointerup',()=>dn=false);
$('clear').addEventListener('click',clr);
const signLabel=()=>T('sign.submit','Sign and agree');
$('typeSig').addEventListener('click',()=>{const nm=$('name').value.trim();if(!nm){$('msg').textContent=T('sign.needName','Please type your full name.');$('name').focus();return}clr();const r=c.getBoundingClientRect();let fs=Math.min(48,r.height*.45);const F=s=>`italic ${s}px "Brush Script MT","Segoe Script","Snell Roundhand",cursive`;x.font=F(fs);while(x.measureText(nm).width>r.width-24&&fs>14){fs-=2;x.font=F(fs)}x.fillStyle='#000';x.textBaseline='middle';x.fillText(nm,12,r.height/2);signed=true;typed=true});
let signing=false,declining=false;
$('sign').addEventListener('click',async()=>{if(signing)return;const m=s=>$('msg').textContent=s;m('');
 if(!$('name').value.trim()){m(T('sign.needName','Please type your full name.'));$('name').focus();return}if(!signed){m(T('sign.needSig','Please sign in the box, or type your name instead.'));return}if(!$('agree').checked){m(T('sign.needAgree','Please tick the box to confirm you agree.'));$('agree').focus();return}
 signing=true;
 const o=document.createElement('canvas');o.width=600;o.height=Math.round(600*c.height/c.width);o.getContext('2d').drawImage(c,0,0,o.width,o.height);
 $('sign').disabled=true;$('sign').textContent=T('sign.working','Signing…');
 try{const r=await fetch(API+'/doc/sign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({d,t,sig:o.toDataURL('image/png'),name:$('name').value.trim(),agree:true,hash:doc.hash,tz:TZ,typed})}),j=await r.json();
  if(j.ok)done(j.viewKey);
  else if(r.status===409){signing=false;m(j.error&&/this version/.test(j.error)?j.error:T('sign.conflict','The document changed or could not be checked. Reload the page.'));$('sign').disabled=false;$('sign').textContent=signLabel()}
  else if(r.status===410){err(j.error||T('sign.finished','This link is finished.'));}
  else if(r.status===503){signing=false;m(T('sign.retry','We can\'t confirm this document right now. You can try the same signature again.'));$('sign').disabled=false;$('sign').textContent=signLabel()}
  else if(r.status===403){signing=false;m(T('sign.cannot','You cannot sign this document with this link.'));$('sign').disabled=false;$('sign').textContent=signLabel()}
  else if(r.status===400){signing=false;m(j.error||T('sign.missing','Name, signature, or consent is missing.'));$('sign').disabled=false;$('sign').textContent=signLabel()}
  else{signing=false;m(j.error||T('sign.fail','Could not sign.'));$('sign').disabled=false;$('sign').textContent=signLabel()}}catch(e){signing=false;m(T('sign.network','Network error. Check your connection and try again.'));$('sign').disabled=false;$('sign').textContent=signLabel()}});
$('decline').addEventListener('click',async()=>{if(declining)return;const m=s=>$('dmsg').textContent=s;m('');const reason=$('reason').value.trim();if(reason.length<3){m(T('sign.reason','Please say what should change.'));$('reason').focus();return}
 declining=true;if(!confirm(T('sign.declineConfirm','Decline this document and send your reason to the sender?'))){declining=false;return}$('decline').disabled=true;
 try{const r=await fetch(API+'/doc/decline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({d,t,reason,name:$('name').value.trim(),tz:TZ})}),j=await r.json();
  if(j.ok)show('declined');else if(r.status===400){declining=false;m(j.error||T('sign.reason','Please say what should change.'));$('decline').disabled=false}else if(r.status===410){err(T('sign.closed','This link is already closed.'));}else if(r.status===503){declining=false;m(T('sign.confirm','We can\'t confirm this document right now.'));$('decline').disabled=false}else{declining=false;m(j.error||T('sign.sendFail','Could not send.'));$('decline').disabled=false}}catch(e){declining=false;m(T('sign.network','Network error. Check your connection and try again.'));$('decline').disabled=false}});
if($('counter'))$('counter').addEventListener('click',async()=>{const m=s=>$('cmsg').textContent=s;m('');if(!doc){m(T('sign.counter.closed','This version is not open.'));return}const desc=$('counterDesc').value.trim();if(desc.length<3){m(T('sign.counter.need','Describe the terms you propose.'));$('counterDesc').focus();return}const price=$('counterPrice').value.trim()||'0';$('counter').disabled=true;
 try{const fields={...doc.fields,desc,price};const r=await fetch(API+'/doc/counter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({d,t,baseHash:doc.hash,template:doc.template||'custom',fields})}),j=await r.json();
  if(!j.ok||!j.signUrl){m(j.error||T('sign.counter.fail','This version was not saved.'));$('counter').disabled=false;return}
  location.assign(j.signUrl)}catch(e){m(T('sign.network','Network error. Check your connection and try again.'));$('counter').disabled=false}});
})();
