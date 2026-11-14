'use strict';
(function(){const $=i=>document.getElementById(i),API=(location.hostname==='localhost'||location.hostname==='127.0.0.1')?location.origin:'https://signedchange-unlock.signedchange.workers.dev';
const t=(k,vars)=>window.scT?scT(k,vars):k;
const ut=s=>s?s.replace('T',' ').slice(0,16)+' UTC':'';
async function go(id){$('vmsg').textContent='';$('vres').hidden=true;if(!/^[\w-]{16,40}$/.test(id)){$('vmsg').textContent=t('verify.bad');return}
 try{const r=await fetch(API+'/doc/verify?id='+encodeURIComponent(id)),j=await r.json();if(j.ok&&j.status==='confirming'){$('vres').hidden=true;$('vmsg').textContent=t('poll.confirm');return}if(!r.ok){$('vres').hidden=true;$('vmsg').textContent=r.status===400?t('verify.bad'):r.status===404?t('verify.missing'):r.status===409?t('verify.mismatch'):r.status===503?t('verify.down'):(j.error||t('verify.missing'));return}
  if(!j.creator||!j.other||!Array.isArray(j.attachments)){$('vmsg').textContent=t('verify.down');return}
  const statusKey={signed:'status.signed',pending:'status.pending',declined:'status.declined',cancelled:'status.cancelled',confirming:'status.confirming'}[j.status];
  $('vstat').textContent=statusKey?t(statusKey):j.status;const R=$('vrows');R.textContent='';
  const p=o=>o.name+(o.role?', '+o.role:'')+(o.company?' – '+o.company:'');
  const rows=[[t('verify.l.document'),(j.title||'')+(j.coNo?' '+t('verify.l.co',{n:j.coNo}):'')],[t('verify.l.id'),j.id],[t('verify.l.date'),j.date],j.contractDate&&[t('verify.l.contract'),j.contractDate],[t('verify.l.creator'),p(j.creator)],[t('verify.l.other'),p(j.other)],
   [t('verify.l.created'),ut(j.created)],j.signedAt&&[t('verify.l.signed'),ut(j.signedAt)+' '+(j.mode==='inperson'?t('verify.l.inPerson'):t('verify.l.remote'))],j.declinedAt&&[t('verify.l.declined'),ut(j.declinedAt)],
   [t('verify.l.content'),j.hash,1],j.creatorSigHash&&[t('verify.l.creatorSig'),j.creatorSigHash,1],j.otherSigHash&&[t('verify.l.otherSig'),j.otherSigHash,1],j.finalHash&&[t('verify.l.final'),j.finalHash,1]]
   .concat(j.attachments.map((a,i)=>[t('verify.l.attachment',{n:i+1}),a.hash,1])).filter(Boolean);
  rows.forEach(([a,b,code])=>{const d=document.createElement('div');d.className='vrow';const k=document.createElement('b');k.textContent=a;const v=document.createElement(code?'code':'span');v.textContent=b==null?'':b;d.append(k,v);R.appendChild(d)});
  $('vres').hidden=false;history.replaceState(null,'','?id='+encodeURIComponent(j.id))}catch(e){$('vmsg').textContent=t('verify.net')}}
$('vf').addEventListener('submit',e=>{e.preventDefault();go($('vid').value.trim())});
const q=new URLSearchParams(location.search).get('id');if(q){$('vid').value=q;go(q)}
})();
