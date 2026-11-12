function toast(t){let e=document.getElementById('sctoast');if(!e){e=document.createElement('div');e.id='sctoast';e.className='toast';e.setAttribute('role','status');document.body.appendChild(e)}e.textContent=t;e.hidden=false;clearTimeout(e._t);e._t=setTimeout(()=>{e.hidden=true},5000)}
'use strict';
(function(){const $=i=>document.getElementById(i),API=(location.hostname==='localhost'||location.hostname==='127.0.0.1')?location.origin:'https://signedchange-unlock.signedchange.workers.dev';
const P=new URLSearchParams(location.hash.slice(1)),d=P.get('d'),t=P.get('t'),v=P.get('v');
const TZ=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){return''}})();
const show=id=>['loading','review','done','err','declined'].forEach(x=>$(x).hidden=x!==id);
const err=m=>{$('errm').textContent=m;show('err')};
async function dl(view){const r=await fetch(API+'/doc/pdf?d='+encodeURIComponent(d)+'&v='+encodeURIComponent(view));if(!r.ok){toast(r.status===409?"This copy doesn’t match the stored record.":r.status===503?"We can’t confirm this document right now.":r.status===404?'That PDF is not available.':'Could not download the PDF. Please try again.');return}
 const b=await r.blob(),m=/filename="([^"]+)"/.exec(r.headers.get('Content-Disposition')||''),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=m?m[1]:'signedchange.pdf';document.body.appendChild(a);a.click();setTimeout(()=>a.remove(),2000)}
function done(view){show('done');$('dl').onclick=()=>dl(view);try{localStorage.setItem('sc_signed_'+d,view)}catch(e){}history.replaceState(null,'','#d='+d+'&v='+view)}
if(!d){err(window.scT?scT('sign.incomplete'):'This link is incomplete. Ask the sender to send it again.');return}
if(v){fetch(API+'/doc/status?d='+encodeURIComponent(d)+'&v='+encodeURIComponent(v)).then(r=>r.json()).then(j=>{if(j.ok&&j.status==='signed')done(v);else err('Document not found.')}).catch(()=>err('Network error.'));return}
let doc=null;const PT={completion:'On completion of this change',net7:'Net 7 (within 7 days)',net14:'Net 14 (within 14 days)',net30:'Net 30 (within 30 days)'};
const money=(x,c,s)=>(s&&x>0?'+':x<0?'−':'')+(c?c+' ':'')+Math.abs(x).toFixed(2);
function load(){fetch(API+'/doc/get?d='+encodeURIComponent(d)+'&t='+encodeURIComponent(t||'')).then(async r=>{const j=await r.json().catch(()=>({}));j._s=r.status;return j}).then(j=>{
 if(!j.ok){const sv=localStorage.getItem('sc_signed_'+d);if(j.code==='used'&&sv)return done(sv);if(j.code==='declined')return show('declined');
  if(j._s===503){err('We can’t confirm this document right now.');$('retryGet').hidden=false;return}
  if(j._s===410){err(j.error||'This link is finished.');return}
  if(j._s===404){err('This signing link is not valid.');return}
  if(j._s===403){err('You cannot open this document with this link.');return}
  return err(j.error||'This link is not valid.')}
 doc=j;const f=j.fields,c=f.currency;$('dt').textContent=f.title;
 const who=(n,co,r,ct)=>n+(r?', '+r:'')+(co?' – '+co:'')+(ct?' · '+ct:'');
 const rows=[['Date',f.date],['From',who(f.biz,f.bizCo,f.bizRole,f.contact)],['To',who(f.client,f.clientCo,f.clientRole,f.clientContact)],['Job / contract',(f.job||'-')+(f.contractDate?' (agreement dated '+f.contractDate+')':'')],['Agreed change',f.desc]];
 if(j.v===3){$('cono').textContent='Change order #'+j.coNo;
  if(f.lines&&f.lines.length)rows.push(['Price breakdown',f.lines.map(l=>l.d+': '+money(parseFloat(l.a.replace(',','.')),c)).join('\n')]);
  if(f.newDate||+f.daysAdded)rows.push(['Schedule',(f.newDate?'New completion date: '+f.newDate+'\n':'')+'Days added: '+(+f.daysAdded||0)]);
  if(f.payTerms||f.payMethod)rows.push(['Payment',(f.payTerms?'Due: '+(f.payTerms==='custom'?f.payCustom:PT[f.payTerms])+'\n':'')+(f.payMethod?'Method: '+f.payMethod:'')]);
  const a=j.amounts,T=$('totals');T.hidden=false;const row=(x,y,b)=>{const r=document.createElement('div');r.className='trow'+(b?' tb':'');const s1=document.createElement('span'),s2=document.createElement('span');s1.textContent=x;s2.textContent=y;r.append(s1,s2);T.appendChild(r)};
  if(a.orig!=null)row('Original contract',money(a.orig,c));row(f.priceDir==='none'?'This change (no price change)':f.priceDir==='dec'?'This change (decrease)':'This change (increase)',money(a.ch,c,1));
  if(a.rate){row('Tax ('+a.rate+'%)',money(a.tax,c,1));row('Total of this change',money(a.tot,c,1),a.orig==null)}if(a.newTotal!=null)row('New contract total',money(a.newTotal,c),1);
  $('agreetxt').textContent=j.agreeText;$('agreetxt').hidden=false;$('agreeL').textContent='I agree to the statement above and sign this change electronically.';
  if($('agreeLang'))$('agreeLang').textContent=(f.lang==='en'||f.lang==='fr')?(window.scT?scT('agree.recorded',{lang:scT('lang.'+f.lang)}):('Agreement language: '+f.lang)):(window.scT?scT('agree.unknown'):'The agreement language was not recorded with this document.');
  (j.attachments||[]).forEach((src,i)=>{if(!src)return;const im=document.createElement('img');im.src=src;im.alt='Attached photo '+(i+1);im.className='attimg';$('atts').appendChild(im)})}
 else rows.push(['Agreed amount',(c?c+' ':'')+f.price]);
 const dl_=$('rows');rows.forEach(([a,b])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=a;dd.textContent=b;dl_.appendChild(dt);dl_.appendChild(dd)});
 $('cs').src=j.creatorSig;$('cs').hidden=false;$('csn').textContent='Signed by '+f.biz;$('name').value=f.client;$('exp').textContent=j.expires.slice(0,10);try{document.documentElement.dataset.agreeCurrency=c||'';document.documentElement.dataset.agreeAmount=String(j.amounts&&j.amounts.tot!=null?j.amounts.tot:(f.price||''))}catch(e){}show('review');sz();if(window.scPaintFx)scPaintFx();paintVersions(j)}).catch(()=>err('Network error. Check your connection and reload.'))}
function paintVersions(j){const label=$('verLabel'),list=$('verHist');if(!label||!list)return;label.textContent='Version '+(j.version||1)+'. You are reviewing this exact version.';list.textContent='';(j.history||[]).forEach(v=>{const li=document.createElement('li');li.textContent='Version '+v.n+' · '+(v.by==='invitee'?'invited person':'sender')+' · '+(v.action||'create')+' · '+(v.at||'').slice(0,10);list.appendChild(li)})}
load();if($('retryGet'))$('retryGet').addEventListener('click',()=>{show('loading');load()});
const c=$('sig'),x=c.getContext('2d');let dn=false,signed=false,typed=false;
function sz(){const r=c.getBoundingClientRect();c.width=r.width*2;c.height=r.height*2;x.setTransform(2,0,0,2,0,0);x.lineWidth=2.5;x.lineCap='round'}
const clr=()=>{x.clearRect(0,0,c.width,c.height);signed=false;typed=false};
const p=e=>{const r=c.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
c.addEventListener('pointerdown',e=>{if(typed)clr();dn=true;x.beginPath();x.moveTo(...p(e))});c.addEventListener('pointermove',e=>{if(dn){x.lineTo(...p(e));x.stroke();signed=true}});window.addEventListener('pointerup',()=>dn=false);
$('clear').addEventListener('click',clr);
$('typeSig').addEventListener('click',()=>{const nm=$('name').value.trim();if(!nm){$('msg').textContent='Type your full name first.';$('name').focus();return}clr();const r=c.getBoundingClientRect();let fs=Math.min(48,r.height*.45);const F=s=>`italic ${s}px "Brush Script MT","Segoe Script","Snell Roundhand",cursive`;x.font=F(fs);while(x.measureText(nm).width>r.width-24&&fs>14){fs-=2;x.font=F(fs)}x.fillStyle='#000';x.textBaseline='middle';x.fillText(nm,12,r.height/2);signed=true;typed=true});
$('sign').addEventListener('click',async()=>{const m=s=>$('msg').textContent=s;m('');
 if(!$('name').value.trim()){m('Please type your full name.');$('name').focus();return}if(!signed){m('Please sign in the box (or tap "Type my name instead").');return}if(!$('agree').checked){m('Please tick the box to confirm you agree.');$('agree').focus();return}
 const o=document.createElement('canvas');o.width=600;o.height=Math.round(600*c.height/c.width);o.getContext('2d').drawImage(c,0,0,o.width,o.height);
 $('sign').disabled=true;$('sign').textContent='Signing…';
 try{const r=await fetch(API+'/doc/sign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({d,t,sig:o.toDataURL('image/png'),name:$('name').value.trim(),agree:true,hash:doc.hash,tz:TZ,typed})}),j=await r.json();
  if(j.ok)done(j.viewKey);
  else if(r.status===409){m(j.error&&/this version/.test(j.error)?j.error:'The document changed or could not be checked. Reload the page.');$('sign').disabled=false;$('sign').textContent='Sign and agree'}
  else if(r.status===410){err(j.error||'This link is already finished.');}
  else if(r.status===503){m('We can’t confirm this document right now. You can try the same signature again.');$('sign').disabled=false;$('sign').textContent='Sign and agree'}
  else if(r.status===403){m('You cannot sign this document with this link.');$('sign').disabled=false;$('sign').textContent='Sign and agree'}
  else if(r.status===400){m(j.error||'Name, signature, or consent is missing.');$('sign').disabled=false;$('sign').textContent='Sign and agree'}
  else{m(j.error||'Could not sign.');$('sign').disabled=false;$('sign').textContent='Sign and agree'}}catch(e){m('Network error, try again.');$('sign').disabled=false;$('sign').textContent='Sign and agree'}});
$('decline').addEventListener('click',async()=>{const m=s=>$('dmsg').textContent=s;m('');const reason=$('reason').value.trim();if(reason.length<3){m('Please say what should change.');$('reason').focus();return}
 if(!confirm('Decline this document and send your reason to the sender?'))return;$('decline').disabled=true;
 try{const r=await fetch(API+'/doc/decline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({d,t,reason,name:$('name').value.trim(),tz:TZ})}),j=await r.json();
  if(j.ok)show('declined');else if(r.status===400){m(j.error||'Please say what should change.');$('decline').disabled=false}else if(r.status===410){err('This link is already closed.');}else if(r.status===503){m('We can’t confirm this document right now.');$('decline').disabled=false}else{m(j.error||'Could not send.');$('decline').disabled=false}}catch(e){m('Network error, try again.');$('decline').disabled=false}});
if($('counter'))$('counter').addEventListener('click',async()=>{const m=s=>$('cmsg').textContent=s;m('');if(!doc){m('This version is not open.');return}const desc=$('counterDesc').value.trim();if(desc.length<3){m('Describe the terms you propose.');$('counterDesc').focus();return}const price=$('counterPrice').value.trim()||'0';$('counter').disabled=true;
 try{const fields={...doc.fields,desc,price};const r=await fetch(API+'/doc/counter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({d,t,baseHash:doc.hash,template:doc.template||'custom',fields})}),j=await r.json();
  if(!j.ok||!j.signUrl){m(j.error||'This version was not saved.');$('counter').disabled=false;return}
  location.assign(j.signUrl)}catch(e){m('Network error, try again.');$('counter').disabled=false}});
})();
