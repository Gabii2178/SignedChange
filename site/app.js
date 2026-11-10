function toast(t,ms){let e=document.getElementById('sctoast');if(!e){e=document.createElement('div');e.id='sctoast';e.className='toast';e.setAttribute('role','status');document.body.appendChild(e)}e.textContent=t;e.hidden=false;clearTimeout(e._t);e._t=setTimeout(()=>{e.hidden=true},ms||5000)}
'use strict';
(function(){
const $=i=>document.getElementById(i),SITE='https://signedchange-app.surge.sh';
const API=(location.hostname==='localhost'||location.hostname==='127.0.0.1')?location.origin:'https://signedchange-unlock.signedchange.workers.dev';
const AK='sc_acct',TK='sc_pro_token',LK='sc_links',DK='sc_draft',UK='sc_tpls',SEEN='sc_seen';
const msg=t=>{$('msg').textContent=t};
const TZ=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){return''}})();
const TPL={
 freelance:{title:'Freelance project scope change',job:'Project: ',use:'When a freelance job gains, loses, or changes work after the original quote.',desc:'Example, replace this: the client asked for work beyond the original freelance quote. This record describes that extra work. All other terms stay the same.',payTerms:'completion'},
 designrev:{title:'Additional design revisions',job:'Design project: ',use:'When a design project needs more revision rounds than the original agreement.',desc:'Example, replace this: the client requested two extra revision rounds on the approved design. The effect on delivery is described here. Other creative terms stay the same.',payTerms:'completion'},
 webbuild:{title:'Website build scope amendment',job:'Website: ',use:'When a website being built gains or loses pages, features, or content.',desc:'Example, replace this: the website build adds one page and removes a feature from the original scope. The new delivery timing is described here. Other build terms stay the same.',payTerms:'completion'},
 writing:{title:'Writing or editing amendment',job:'Piece: ',use:'When a writing or editing assignment changes length, topic, or rounds of edits.',desc:'Example, replace this: the article length and the number of editing rounds change from the original assignment. The new length is described here. Other writing terms stay the same.',payTerms:'completion'},
 photovideo:{title:'Photography or video change',job:'Shoot: ',use:'When a photo or video booking changes hours, locations, or deliverables.',desc:'Example, replace this: the shoot adds two hours and a second location. The number of edited photos or the video length changes as described here. Other booking terms stay the same.',payTerms:'completion'},
 freelancemilestone:{title:'Freelance milestone adjustment',job:'Project: ',use:'When the dates or amounts of agreed freelance milestones change.',desc:'Example, replace this: the parties move one freelance milestone and describe the new date and the amount tied to it. This is a change to their agreement. Other terms stay the same.',payTerms:'custom',payCustom:'Example, replace this: milestone 2 is due when the draft is accepted.'},
 software:{title:'Software development change request',job:'Product: ',use:'When software work adds, removes, or changes a feature after the build was agreed.',desc:'Example, replace this: the client requests a change to an agreed software feature. The new behaviour and the effect on the delivery date are described here. Other development terms stay the same.',payTerms:'net30'},
 sitemaint:{title:'Website maintenance amendment',job:'Site: ',use:'When a website care plan changes hours, tasks, or response time.',desc:'Example, replace this: monthly website maintenance changes the included hours and the response time. The new tasks are listed here. Other maintenance terms stay the same.',payTerms:'net30'},
 saaschange:{title:'Digital service scope change',job:'Service: ',use:'When a digital service the parties already use changes seats, features, or dates.',desc:'Example, replace this: the parties change the seats and features of a digital service they already agreed. The new dates are described here. This does not describe a SignedChange plan. Other service terms stay the same.',payTerms:'net30'},
 itsupport:{title:'IT support service amendment',job:'Support agreement: ',use:'When IT support hours, covered systems, or response times change.',desc:'Example, replace this: the support agreement adds one system and changes the response time for urgent issues. Covered hours are described here. Other support terms stay the same.',payTerms:'net30'},
 techconsult:{title:'Technical consulting scope change',job:'Engagement: ',use:'When technical consulting days, questions, or deliverables change.',desc:'Example, replace this: the consulting engagement adds review of one system and changes the number of workshop days. Other consulting terms stay the same.',payTerms:'net30'},
 construction:{title:'Construction change order',job:'Job site: ',use:'When construction work, materials, or time change after the job was agreed.',desc:'Example, replace this: additional construction work was requested on site. The materials and labour for this change are described here. Other contract terms stay the same.',payTerms:'completion'},
 materials:{title:'Additional materials or labour',job:'Job site: ',use:'When a job needs materials or labour that were not in the original price.',desc:'Example, replace this: the job needs extra materials and labour that were not in the original price. Quantities are described here. Other job terms stay the same.',payTerms:'completion'},
 renovation:{title:'Renovation scope amendment',job:'Property: ',use:'When a renovation adds, removes, or swaps rooms, finishes, or fixtures.',desc:'Example, replace this: the renovation swaps the agreed finish in one room and adds work in another. The effect on the schedule is described here. Other renovation terms stay the same.',payTerms:'completion'},
 propmaint:{title:'Property maintenance amendment',job:'Property: ',use:'When property maintenance visits, tasks, or seasons change.',desc:'Example, replace this: the maintenance visit list adds gutter clearing and changes how often the visits happen. Other property terms stay the same.',payTerms:''},
 landlord:{title:'Rental agreement change',job:'Property: ',use:'When a landlord and tenant change rent, a charge, or a house rule in writing.',desc:'Example, replace this: the landlord and the tenant change one charge or one house rule. The effective date is described here. All other lease terms stay as they are.',payTerms:''},
 jobschedule:{title:'Project schedule adjustment',job:'Job site: ',use:'When a contractor and client move dates without changing the scope of work.',desc:'Example, replace this: both parties move the start or completion date. The work itself does not change. The new dates are described here.',priceDir:'none',payTerms:''},
 duties:{title:'Job responsibilities amendment',job:'Position: ',use:'When an employer and employee change duties and keep the same role title.',desc:'Example, replace this: the employer and the employee change the duties of the role. The new duties are described here. Other employment terms stay the same.',payTerms:''},
 employment:{title:'Working hours or schedule change',job:'Position: ',use:'When working days or daily hours change and the person keeps the role.',desc:'Example, replace this: the employer and the employee change the days or the daily hours. The new schedule is described here. Other employment terms stay the same.',payTerms:''},
 compensation:{title:'Compensation adjustment',job:'Position: ',use:'When pay, a bonus, or an allowance changes for an existing role.',desc:'Example, replace this: the employer and the employee change pay or an allowance. The new amount and the date it starts are described here. Other employment terms stay the same.',payTerms:''},
 rolechange:{title:'Role or position change',job:'New position: ',use:'When someone moves to a different role with different duties.',desc:'Example, replace this: the employee moves to a different role. The new title and duties are described here. Other employment terms stay the same unless they are listed here.',payTerms:''},
 duration:{title:'Contract duration amendment',job:'Engagement: ',use:'When a fixed-term contract is extended or shortened.',desc:'Example, replace this: the parties extend or shorten the contract end date. The new end date is described here. Other terms stay the same.',payTerms:''},
 campaign:{title:'Marketing campaign scope change',job:'Campaign: ',use:'When a campaign adds channels, audiences, or deliverables.',desc:'Example, replace this: the campaign adds one channel and changes the audience. Deliverables and dates are described here. Other campaign terms stay the same.',payTerms:'net30'},
 social:{title:'Social media management amendment',job:'Accounts: ',use:'When posting frequency, platforms, or approval rules change.',desc:'Example, replace this: social media management changes how many posts are included and which platforms are covered. Other management terms stay the same.',payTerms:'net30'},
 adbudget:{title:'Advertising budget adjustment',job:'Campaign: ',use:'When the parties change an advertising spend they already agreed.',desc:'Example, replace this: the parties change the advertising amount they already agreed and how it is split across channels. This is their campaign budget, not a SignedChange charge. Other terms stay the same.',payTerms:'net30'},
 branding:{title:'Branding project amendment',job:'Brand: ',use:'When a branding project changes the marks, guidelines, or applications.',desc:'Example, replace this: the branding project adds one submark and a short guidelines document. Other branding terms stay the same.',payTerms:'net30'},
 agency:{title:'Agency and client service change',job:'Account: ',use:'When an agency retainer adds or removes services.',desc:'Example, replace this: the agency and the client change which services the retainer includes. Added and removed services are listed here. Other terms stay the same.',payTerms:'net30'},
 supplier:{title:'Supplier agreement amendment',job:'Supplier: ',use:'When a buyer and supplier change price, quality, or supply terms.',desc:'Example, replace this: the buyer and the supplier change the specification of goods they already agreed. Other supply terms stay the same.',payTerms:''},
 purchase:{title:'Purchase order change',job:'Order: ',use:'When a purchase order changes quantity, delivery date, or price.',desc:'Example, replace this: the purchase order changes quantity and the delivery date. The new quantity is described here. Other order terms stay the same.',payTerms:''},
 deliverydate:{title:'Delivery schedule amendment',job:'Order: ',use:'When the goods stay the same but the delivery dates change.',desc:'Example, replace this: the parties keep the same goods and move the delivery dates. The new dates are described here. Other order terms stay the same.',priceDir:'none',payTerms:''},
 partner:{title:'Business partnership amendment',job:'Venture: ',use:'When partners change who does what or how a cost is shared.',desc:'Example, replace this: the partners change responsibilities or how one cost is shared. Other partnership terms stay the same.',payTerms:''},
 consultant:{title:'Consulting engagement change',job:'Engagement: ',use:'When a consultant and client change scope, dates, or the fee they already agreed.',desc:'Example, replace this: the client and the consultant change the scope, the dates, or the fee of 200 USD. Other engagement terms stay the same.',payTerms:'net30'},
 smallbiz:{title:'Small-business service amendment',job:'Service: ',use:'When a small business and its customer change a service package.',desc:'Example, replace this: the business and the customer change what the service package includes. The new visits or deliverables are described here. Other service terms stay the same.',payTerms:''},
 installments:{title:'Installment schedule adjustment',job:'Invoice or contract: ',use:'When the parties replace dates and amounts in a payment schedule they already agreed.',desc:'Example, replace this: the parties replace the previous installment dates and amounts with the schedule described here. This is their own arrangement, not a SignedChange subscription.',payTerms:'custom',payCustom:'Example, replace this: three installments, due on the dates written here.'},
 deadline:{title:'Payment deadline extension',job:'Invoice: ',use:'When the parties give more time to pay an amount they already agreed.',desc:'Example, replace this: both parties move the payment deadline to the new date below. The original amount does not change unless that change is written here.',priceDir:'none',payTerms:''},
 paymiles:{title:'Revised payment milestones',job:'Contract: ',use:'When milestone dates or amounts in an existing contract change.',desc:'Example, replace this: the parties change which milestone triggers a payment and the amount tied to it. This is not a SignedChange subscription. Other contract terms stay the same.',payTerms:'custom',payCustom:'Example, replace this: the next milestone is due when the work described here is accepted.'},
 balance:{title:'Outstanding balance arrangement',job:'Account: ',use:'When the parties agree how an existing balance will be repaid.',desc:'Example, replace this: the parties describe how an outstanding balance will be repaid and the dates they agree. This records their arrangement. It is not a loan offer and it is not a SignedChange charge.',payTerms:'custom',payCustom:'Example, replace this: the balance is repaid on the dates written here.'},
 training:{title:'Training programme scope amendment',job:'Programme: ',use:'When a training programme changes topics, length, or the number of sessions.',desc:'Example, replace this: the training programme adds one topic and changes the number of sessions. Other training terms stay the same.',payTerms:''},
 course:{title:'Course delivery schedule change',job:'Course: ',use:'When course dates or the way sessions are delivered change.',desc:'Example, replace this: the course dates move and one session changes from in person to online. The new dates are described here. Other course terms stay the same.',priceDir:'none',payTerms:''},
 event:{title:'Event planning service amendment',job:'Event: ',use:'When event planning changes guest count, venue, or included services.',desc:'Example, replace this: the event plan changes the guest count and one included service. The event date is described here. Other planning terms stay the same.',payTerms:''},
 eventbudget:{title:'Event budget or deliverables adjustment',job:'Event: ',use:'When the parties change an event budget they already agreed, or the deliverables inside it.',desc:'Example, replace this: the parties change the event deliverables and the budget they agreed for those deliverables. This is their event budget, not a SignedChange charge. Other event terms stay the same.',payTerms:''},
 transport:{title:'Delivery or transport change',job:'Route or shipment: ',use:'When a pickup, drop-off, route, or transport date changes.',desc:'Example, replace this: the pickup place or the transport date changes. The goods stay as described here. Other transport terms stay the same.',payTerms:''},
 servicemaint:{title:'Maintenance service amendment',job:'Equipment or site: ',use:'When a maintenance contract changes equipment, visits, or response time.',desc:'Example, replace this: the maintenance contract adds one piece of equipment and changes how quickly urgent calls are answered. Other maintenance terms stay the same.',payTerms:''},
 hospitality:{title:'Hospitality service scope change',job:'Booking: ',use:'When catering, rooms, or hospitality hours change after a booking.',desc:'Example, replace this: the hospitality booking changes the number of guests or the hours of service. Other booking terms stay the same.',payTerms:''},
 agriculture:{title:'Agricultural supply or service change',job:'Farm or order: ',use:'When an agricultural supply quantity, delivery, or field service changes.',desc:'Example, replace this: the parties change the quantity or the delivery window of an agricultural supply, or the field service attached to it. Other terms stay the same.',payTerms:''},
 contractor:{title:'Contractor Change Order',job:'Job site / address: ',desc:'Additional work requested by the client during the job:\n- \nMaterials and labour for this change are included in the amount below.',payTerms:'completion'},
 deposit:{title:'Deposit & Refund Terms',job:'Booking / order: ',desc:'Both parties agree on these deposit terms:\n- Deposit paid: \n- Refundable if cancelled before [date]: yes / no\nThe amount below is the deposit.'},
 custom:{title:'',job:'',desc:'',blank:true,use:'Start with empty fields and write the change yourself.'}};
const FK=['title','biz','bizCo','bizRole','contact','client','clientCo','clientRole','clientContact','job','contractDate','origAmount','desc','priceDir','price','currency','taxRate','newDate','daysAdded','payTerms','payCustom','payMethod','date','lang'];
const userTpls=()=>{try{return JSON.parse(localStorage.getItem(UK))||{}}catch(e){return{}}};
const ts=$('tpl');const TPL_KEYS=['freelance','designrev','webbuild','writing','photovideo','freelancemilestone','software','sitemaint','saaschange','itsupport','techconsult','construction','materials','renovation','propmaint','landlord','jobschedule','duties','employment','compensation','rolechange','duration','campaign','social','adbudget','branding','agency','supplier','purchase','deliverydate','partner','consultant','smallbiz','installments','deadline','paymiles','balance','training','course','event','eventbudget','transport','servicemaint','hospitality','agriculture','contractor','deposit','custom'];
function tplOptionLabel(k){const t=TPL[k];if(!t)return k;return t.blank?'Blank (write your own)':(t.title||k)}
function fillTpls(){const keep=ts.value;ts.textContent='';const add=(k,v,g)=>{const o=document.createElement('option');o.value=k;o.textContent=v;(g||ts).appendChild(o)};
 TPL_KEYS.forEach(k=>add(k,tplOptionLabel(k)));
 const u=userTpls();if(Object.keys(u).length){const g=document.createElement('optgroup');g.label=window.scT?scT('tpl.mine'):'My templates';Object.keys(u).forEach(n=>add('u:'+n,n,g));ts.appendChild(g)}
 ts.value=[...ts.options].some(o=>o.value===keep)?keep:'custom'}
fillTpls();
function setF(o){Object.entries(o).forEach(([k,v])=>{if($(k)&&v!=null)$(k).value=v});if(o.lines)setLines(o.lines);sync()}
function exampleFor(key){const lang=($('lang')&&$('lang').value)||'en';const all=window.SC_EXAMPLES||{};const pack=all[lang]||all.en||{};return pack[key]||null}
let appliedTpl=ts.value||'custom';
function formDirty(){return ['title','job','desc','price','origAmount','payCustom'].some(id=>{const el=$(id);if(!el)return false;const v=String(el.value||'').trim();if(!v)return false;if(id==='price'&&(v==='0'||v==='0.00'))return false;if(id==='title'&&v==='Signed Change Record')return false;return true})}
ts.addEventListener('change',()=>{const v=ts.value,t=v.startsWith('u:')?userTpls()[v.slice(2)]:TPL[v];if(!t){ts.value=appliedTpl;return}
 if(formDirty()&&!confirm('Replace what you wrote with this starting point? Your current text will be replaced.')){ts.value=appliedTpl;const box=document.getElementById('catalog');if(box)box.open=true;return}
 const cleared={priceDir:'inc',payTerms:'',price:'',origAmount:'',payCustom:'',title:'',job:'',desc:'',lines:[]};
 if(v==='custom'||t.blank)setF(cleared);else setF({...cleared,...t,lines:t.lines||[]});appliedTpl=v;hilite()});
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
window.addEventListener('sc-step',()=>{me.sz();if(!$('otherBox').hidden)other.sz()});
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
let pageCursors=[''],pageIndex=0;
function showListError(t){const e=$('listError');if(!e)return;e.hidden=!t;e.textContent=t||'';}
async function refresh(cursor){if(!acct){$('count').textContent=window.scT?scT('count.none'):'Your first 3 documents are free.';hist([]);showListError('');return}
 const path='/account/me'+(cursor?('?cursor='+encodeURIComponent(cursor)):'');
 const j=await api(path);
 if(j._s===401){localStorage.removeItem(AK);acct=null;return refresh()}
 if(j._s===503){showListError(window.scT?scT('list.fail'):'We cannot confirm your documents right now. This is not an empty list.');return}
 if(j._s===400){showListError(j.error||(window.scT?scT('list.badpage'):'That page link is not valid.'));return}
 if(j._s===403){showListError(window.scT?scT('list.forbidden'):'This account cannot open that list.');return}
 if(!j.ok){showListError(j.error||(window.scT?scT('list.other'):'The list could not be loaded.'));return}
 showListError('');state=j;
 $('count').textContent=j.pro?(j.pro.plan==='monthly'?(window.scT?scT('count.monthly'):'Pro Monthly: unlimited.'):(window.scT?scT('count.pro'):'Pro: unlimited documents.')):(window.scT?scT('count.free',{n:j.freeLeft}):`Free documents left: ${j.freeLeft} of 3.`);
 $('plans').hidden=!!j.pro;$('isPro').hidden=!j.pro;document.querySelectorAll('.probadge').forEach(b=>{if(b.closest('#isPro'))return;b.hidden=!j.pro;b.title=j.pro?(j.pro.plan==='monthly'?'Pro Monthly':j.pro.plan==='lifetime'?'Pro Lifetime':'Pro'):''});$('akey').value=acct.id+'.'+acct.key;
 // in-app notices for status changes since last visit
 const sn=seen(),ch=j.docs.filter(d=>sn[d.id]&&sn[d.id]!==d.status&&(d.status==='signed'||d.status==='declined'));
 if(ch.length)toast(ch.map(d=>(d.status==='signed'?'✅ Signed: ':'✋ Changes requested: ')+d.title+' – '+d.client).join(' · '),9000);
 hist(j.docs,ch.map(d=>d.id));const nx={};j.docs.forEach(d=>nx[d.id]=d.status);localStorage.setItem(SEEN,JSON.stringify(nx));
 if($('nextPage')){$('nextPage').hidden=!j.nextCursor;$('nextPage').dataset.cursor=j.nextCursor||'';}
 if($('prevPage'))$('prevPage').hidden=pageIndex===0;}
function hist(docs,fresh){fresh=fresh||[];const L=$('history');L.textContent='';if(!docs.length){const p=document.createElement('p');p.className='small';p.textContent=window.scT?scT('list.empty'):'No documents yet.';L.appendChild(p);return}const lk=links();
 docs.forEach(d=>{const c=document.createElement('div');c.className='card hdoc';const open=document.createElement('button');open.type='button';open.className='btn ghost';open.textContent=(d.coNo?'CO #'+d.coNo+' · ':'')+d.title+' – '+d.client;open.addEventListener('click',()=>showDetail(d));c.appendChild(open);
  if(fresh.includes(d.id)){const nb=document.createElement('span');nb.className='badge wait';nb.textContent='NEW';open.appendChild(document.createTextNode(' '));open.appendChild(nb)}
  const label=window.scT&&['signed','pending','declined','cancelled'].includes(d.status)?scT('status.'+d.status):d.status;
  const st={signed:['ok',label],pending:['wait',label],declined:['no',label],cancelled:['off',label]}[d.status]||['off',d.status];
  const bd=document.createElement('span');bd.className='stb '+st[0];bd.textContent=st[1];const s=document.createElement('p');s.className='small';
  const rawAmt=d.total!=null?d.total:d.price;const shown=window.scFormatMoney?scFormatMoney(Math.abs(Number(rawAmt)||0),d.currency):(d.currency||'')+' '+rawAmt;const sign=Number(rawAmt)<0?'−':Number(rawAmt)>0?'+':'';
  const when=window.scFormatDay?scFormatDay(d.date):d.date;const exp=d.status==='pending'&&d.expires?(window.scFormatDay?scFormatDay(d.expires):d.expires.slice(0,10)):'';
  s.append(bd,document.createTextNode(` ${sign}${shown} · ${when}`+(exp?' · '+exp:'')));c.appendChild(s);
  if(d.status==='declined'&&d.declineReason){const q=document.createElement('blockquote');q.className='reason';q.textContent='Their reason: “'+d.declineReason+'”';c.appendChild(q)}
  const left=d.expires?(new Date(d.expires)-Date.now())/864e5:99;
  if(d.status==='pending'&&left<3){const w=document.createElement('p');w.className='small warnx';w.textContent=`⚠️ The signing link expires in ${Math.max(0,Math.ceil(left))} day(s).`;c.appendChild(w)}
  const btn=(t,f,g)=>{const x=document.createElement('button');x.type='button';x.className='btn sm'+(g?' ghost':'');x.textContent=t;x.addEventListener('click',f);c.appendChild(x);c.appendChild(document.createTextNode(' '))};
  if(d.status!=='cancelled')btn(d.status==='signed'?'Download PDF':'Download draft',()=>dl(d.id),d.status!=='signed');
  if(d.status==='pending'&&lk[d.id])btn(left<3?'Send reminder':'Share link again',()=>showShare(lk[d.id],d.client,d.id,left<3),1);
  if(d.fields)btn(d.status==='declined'?'Revise & resend':'Duplicate',()=>dup(d),1);
  if(d.status==='pending')btn('Cancel',async()=>{if(!confirm('Cancel this document? The link will stop working.'))return;const r=await api('/doc/cancel',{method:'POST',body:JSON.stringify({d:d.id})});
   if(r.ok){toast(window.scT?scT('cancel.done'):'Cancelled.');refresh()}
   else if(r._s===409){const s=await api('/doc/status?d='+encodeURIComponent(d.id));const w=s.ok?s.status:'';toast(w==='signed'?(window.scT?scT('cancel.signed'):'Signing finished first.'):w==='cancelled'?(window.scT?scT('cancel.already'):'Already cancelled.'):w==='declined'?(window.scT?scT('cancel.declined'):'This document was declined.'):(s._s===503||!s.ok)?(window.scT?scT('cancel.unknown'):"We can't confirm the current status."):(window.scT?scT('cancel.other'):'Cancel did not change the document.'));refresh()}
   else if(r._s===503)toast(window.scT?scT('cancel.unknown'):"We can't confirm this document right now.");else if(r._s===401)toast(window.scT?scT('pdf.auth'):'This account key was not accepted.');else if(r._s===404)toast(window.scT?scT('delete.already'):'That document is already gone.');else if(r._s===400)toast(r.error||'That request was not valid.');else toast(r.error||'Could not cancel.');},1);
  btn('Delete',async()=>{if(!confirm('Delete "'+d.title+' – '+d.client+'" permanently? The PDF, photos and verify page will be removed from our server. This cannot be undone.'))return;
   const r=await api('/doc/cancel',{method:'POST',body:JSON.stringify({d:d.id,action:'delete'})});if(r.ok||r._s===404){const l=links();delete l[d.id];localStorage.setItem(LK,JSON.stringify(l));toast(r.ok?(window.scT?scT('delete.done'):'Document deleted.'):(window.scT?scT('delete.already'):'Already deleted.'));refresh()}else if(r._s===503)toast(window.scT?scT('delete.unknown'):"We can't confirm this document right now.");else if(r._s===401)toast(window.scT?scT('pdf.auth'):'This account key was not accepted.');else if(r._s===403)toast(window.scT?scT('pdf.forbid'):'This account cannot delete that document.');else toast(r.error||'Could not delete.');},1);
  c.lastChild.previousSibling.classList.add('danger');
  const vl=document.createElement('a');vl.href='verify.html?id='+d.id;vl.className='small vlink';vl.textContent='Public verify page';vl.target='_blank';vl.rel='noopener';c.appendChild(vl);
  L.appendChild(c)})}
async function showDetail(d){const box=$('detail');if(!box)return;box.hidden=false;$('history').hidden=true;$('detailTitle').textContent=d.title||'Document';$('detailCrumb').textContent=(d.title||'Document').slice(0,32);$('detailCrumb').title=d.title||'';
 const words={signed:'Signed',pending:'Waiting for signature',declined:'Declined',cancelled:'Cancelled'};$('detailBadge').innerHTML='';const b=document.createElement('span');b.className='badge '+({signed:'ok',pending:'wait',declined:'no',cancelled:'off'}[d.status]||'off');b.textContent=words[d.status]||d.status;$('detailBadge').appendChild(b);
 $('detailError').textContent='';$('detailBody').textContent='Checking this document…';
 const j=await api('/doc/status?d='+encodeURIComponent(d.id));
 if(j._s===503){$('detailBody').textContent='';$('detailError').textContent='We can’t confirm this document right now.';return}
 if(j._s===409){$('detailBody').textContent='';$('detailError').textContent='This copy doesn’t match the stored record.';return}
 if(j._s===404){$('detailBody').textContent='';$('detailError').textContent='No document with this ID. It may have been deleted.';return}
 if(j._s===401){$('detailBody').textContent='';$('detailError').textContent='This account key was not accepted.';return}
 if(j._s===400){$('detailBody').textContent='';$('detailError').textContent='That does not look like a document ID.';return}
 const f=d.fields||{};$('detailBody').textContent='';const dl=document.createElement('dl');dl.className='rows';
 const row=(a,c)=>{const dt=document.createElement('dt');dt.textContent=a;const dd=document.createElement('dd');dd.textContent=c||'—';dl.append(dt,dd)};
 row('From',f.biz);row('To',f.client||d.client);row('Change',f.desc);row('Amount',d.currency+' '+(d.total!=null?d.total:d.price));row('Date',f.date||d.date);
 $('detailBody').appendChild(dl)}
if($('detailClose'))$('detailClose').addEventListener('click',()=>{$('detail').hidden=true;$('history').hidden=false});
if($('nextPage'))$('nextPage').addEventListener('click',()=>{const c=$('nextPage').dataset.cursor;if(!c)return;pageCursors=pageCursors.slice(0,pageIndex+1);pageCursors.push(c);pageIndex++;refresh(c)});
if($('prevPage'))$('prevPage').addEventListener('click',()=>{if(pageIndex<1)return;pageIndex--;refresh(pageCursors[pageIndex]||undefined)});
function dup(d){if($('desc').value.trim()&&!confirm('Replace the form with a copy of this document?'))return;const f={...d.fields};
 setF({priceDir:'inc',payTerms:'',...f,date:new Date().toISOString().slice(0,10),lines:f.lines||[]});location.hash='create';toast(d.status==='declined'?'Copied. Edit it to address their reason, then sign and send again.':'Copied into the form. Edit and sign to create a new document.');hilite()}
async function dl(id){const r=await fetch(API+'/doc/pdf?d='+encodeURIComponent(id),{headers:H()});if(!r.ok){toast(r.status===409?"This copy doesn’t match the stored record.":r.status===503?"We can’t confirm this document right now.":r.status===404?'That PDF is not available.':r.status===401?'This account key was not accepted.':r.status===403?'This account cannot download that PDF.':'Could not download the PDF. Please try again.');return}
 const bl=await r.blob(),cd=r.headers.get('Content-Disposition')||'',m=/filename="([^"]+)"/.exec(cd),a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download=m?m[1]:'signedchange.pdf';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000)}
let poll=0;
function watch(id){clearInterval(poll);let k=0;$('live').className='live';$('live').textContent=window.scT?scT('poll.wait'):'Waiting for them to sign. This page updates by itself.';
 const tick=async()=>{if($('share').hidden)return;const j=await api('/doc/status?d='+encodeURIComponent(id));if(j._s===503){$('live').textContent=window.scT?scT('poll.down'):'Cannot confirm yet.';return}if(!j.ok)return;
  if(j.status==='signed'){clearInterval(poll);$('live').className='live ok';$('live').textContent='✅ Signed! '+j.client+' signed just now. Download the final PDF in My documents below.';toast('✅ Signed! '+j.client+' signed your document.',9000);if(window.scTrack)scTrack('doc_signed_remote');refresh()}
  else if(j.status==='declined'){clearInterval(poll);$('live').className='live no';$('live').textContent='✋ '+j.client+' asked for changes: “'+(j.declineReason||'')+'”. Use "Revise & resend" in My documents.';toast('✋ '+j.client+' asked for changes.',9000);refresh()}
  else if(j.status==='cancelled')clearInterval(poll)};
 tick();
 poll=setInterval(async()=>{if(++k>360||document.hidden&&k%6)return k>360&&clearInterval(poll);await tick()},5000)}
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
  if(j._s===402){msg(j.message||'Free limit reached.');location.hash='buy'}
  else if(j._s===429){msg(window.scT?scT('limit.fast'):'Too many documents too fast.')}
  else if(j._s===503){msg(window.scT?scT('create.uncertain'):"We can't confirm this document right now.")}
  else if(!j.ok){if(j.field&&$(j.field))ferr(j.field,j.error);else msg(j.error||'Something went wrong. Please try again.');if(j.placeholders)hilite()}
  else{if(window.scTrack)scTrack('doc_created',{method:mode});localStorage.removeItem(DK);photos=[];thumbs();$('draftNote').textContent='';toast('Created CO #'+j.coNo+'.');
   if(j.signUrl){const l=links();l[j.id]=j.signUrl;localStorage.setItem(LK,JSON.stringify(l));await refresh();showShare(j.signUrl,f.client,j.id)}else{$('share').hidden=true;await dl(j.id);await refresh()}}}
 catch(e){const m=e&&e.message||'';msg(/fetch|network|Failed/i.test(m)||!m?(window.scT?scT('net.draft'):'Network error. Your draft is still on this device.'):m)}
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
 const ALIAS={'change-order':'contractor','scope-creep':'freelance','verbal-agreement':'freelance','contractor':'contractor','freelance':'freelance','landlord':'landlord','agency':'agency','employment':'employment','deadline':'deadline','deposit':'deposit','custom':'custom','partner':'partner','consultant':'consultant','supplier':'supplier','installments':'installments'};
 const tplKey=ALIAS[(P.get('template')||'').toLowerCase()];
 if(tplKey&&TPL[tplKey]){ts.value=tplKey;const t=TPL[tplKey];$('title').value=t.title;$('job').value=t.job;$('desc').value=t.desc;if(t.payTerms!=null)$('payTerms').value=t.payTerms;if(t.priceDir)$('priceDir').value=t.priceDir;if(t.payCustom!=null)$('payCustom').value=t.payCustom}
 const firePurchase=(tx)=>{if(window.scTrack){const v=(state&&state.pro&&state.pro.plan==='monthly')?9:49;scTrack('purchase',{currency:'USD',value:v,transaction_id:tx||undefined})}};
 if(P.get('paid')==='1'){const tx=(P.get('tx')||P.get('txn_id')||'').replace(/[^A-Za-z0-9]/g,'');history.replaceState(null,'',location.pathname+(tplKey?('?template='+encodeURIComponent(P.get('template'))):'')+'#buy');rmsg('Confirming your PayPal payment… (this can take up to a minute)');
  for(let i=0;i<10;i++){await refresh();if(state&&state.pro){rmsg('Pro unlocked. Thank you!');firePurchase(tx);return}
   if(tx){const r=await fetch(API+'/verify?ret=1&tx='+encodeURIComponent(tx)).catch(()=>null);if(r&&r.ok){const j=await r.json();if(j.token&&await link(j.token)){rmsg('Pro unlocked. Thank you!');firePurchase(tx);return}}}
   await new Promise(r=>setTimeout(r,6000))}
  rmsg('Payment not confirmed yet. If you paid, wait a few minutes and reload, or use "Restore Pro" with your PayPal transaction ID.')}
 else{await refresh();const sid=localStorage.getItem(SK);if(sid&&state&&!state.pro)await claimSub(sid,1).catch(()=>{})}}catch(e){}})();
window.SC_TPL=TPL;
if(window.scOnLang)scOnLang(()=>{fillTpls();if(state&&state.docs)hist(state.docs)});
})();
