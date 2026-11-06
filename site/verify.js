'use strict';
(function(){const $=i=>document.getElementById(i),API='https://signedchange-unlock.signedchange.workers.dev';
const ST={signed:'✅ Signed by both parties',pending:'⏳ Created, waiting for the other party to sign',declined:'✋ Declined – the other party asked for changes',cancelled:'✖ Cancelled by the sender'};
const ut=s=>s?s.replace('T',' ').slice(0,16)+' UTC':'';
async function go(id){$('vmsg').textContent='';$('vres').hidden=true;if(!/^[\w-]{16,40}$/.test(id)){$('vmsg').textContent='That does not look like a document ID.';return}
 try{const r=await fetch(API+'/doc/verify?id='+encodeURIComponent(id)),j=await r.json();if(!j.ok){$('vmsg').textContent=j.error||'Not found.';return}
  $('vstat').textContent=ST[j.status]||j.status;const R=$('vrows');R.textContent='';
  const p=o=>o.name+(o.role?', '+o.role:'')+(o.company?' – '+o.company:'');
  const rows=[['Document',j.title+(j.coNo?' (change order #'+j.coNo+')':'')],['Document ID',j.id],['Date of change',j.date],j.contractDate&&['Original agreement dated',j.contractDate],['Created by',p(j.creator)],['Other party',p(j.other)],
   ['Created',ut(j.created)],j.signedAt&&['Signed by other party',ut(j.signedAt)+(j.mode==='inperson'?' (in person)':' (remote link)')],j.declinedAt&&['Declined',ut(j.declinedAt)],
   ['Content fingerprint',j.hash,1],j.creatorSigHash&&['Creator signature fingerprint',j.creatorSigHash,1],j.otherSigHash&&['Other party signature fingerprint',j.otherSigHash,1],j.finalHash&&['Signed record fingerprint',j.finalHash,1]]
   .concat(j.attachments.map((a,i)=>['Attachment '+(i+1)+' fingerprint',a.hash,1])).filter(Boolean);
  rows.forEach(([a,b,code])=>{const d=document.createElement('div');d.className='vrow';const k=document.createElement('b');k.textContent=a;const v=document.createElement(code?'code':'span');v.textContent=b;d.append(k,v);R.appendChild(d)});
  $('vres').hidden=false;history.replaceState(null,'','?id='+encodeURIComponent(j.id))}catch(e){$('vmsg').textContent='Network error. Please try again.'}}
$('vf').addEventListener('submit',e=>{e.preventDefault();go($('vid').value.trim())});
const q=new URLSearchParams(location.search).get('id');if(q){$('vid').value=q;go(q)}
})();
