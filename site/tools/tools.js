(function(){
function $(id){return document.getElementById(id)}
function n(id){var v=parseFloat(($(id)||{}).value);return isNaN(v)?0:v}
function money(x,c){c=c||'$';return c+(Math.round(x*100)/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function esc(s){return String(s).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
function bind(form,fn){var f=$(form);if(!f)return;f.addEventListener('input',fn);f.addEventListener('change',fn);f.addEventListener('submit',function(e){e.preventDefault();fn()});fn()}
var p=document.querySelectorAll('[data-print]');for(var i=0;i<p.length;i++)p[i].addEventListener('click',function(){window.print()});

// Overtime
bind('ot-form',function(){var r=n('ot-rate'),reg=n('ot-reg'),h=n('ot-hours'),m=n('ot-mult')||1.5,dt=n('ot-dt');
var ot=Math.max(0,h-reg),reg_h=Math.min(h,reg),otp=ot*r*m,dtp=dt*r*2,tot=reg_h*r+otp+dtp;
$('ot-out').innerHTML='<p>Regular pay: <b>'+money(reg_h*r)+'</b> ('+reg_h+' h)</p><p>Overtime pay: <b>'+money(otp)+'</b> ('+ot+' h at '+money(r*m)+'/h)</p>'+(dt?'<p>Double time: <b>'+money(dtp)+'</b> ('+dt+' h)</p>':'')+'<p class="big">Gross pay: '+money(tot)+'</p>'});

// Late payment
bind('lp-form',function(){var a=n('lp-amt'),rate=n('lp-rate'),d=n('lp-days'),fee=n('lp-fee'),comp=$('lp-comp')&&$('lp-comp').checked;
var interest=comp?a*(Math.pow(1+rate/100/12,d/30.4167)-1):a*rate/100*d/365;
$('lp-out').innerHTML='<p>Interest for '+d+' days: <b>'+money(interest)+'</b></p><p>Daily interest: <b>'+money(comp?interest/Math.max(d,1):a*rate/100/365)+'</b></p><p>Flat late fee: <b>'+money(fee)+'</b></p><p class="big">Total now owed: '+money(a+interest+fee)+'</p>'});

// Freelance rate
bind('fr-form',function(){var inc=n('fr-income'),exp=n('fr-exp'),tax=n('fr-tax'),wk=n('fr-weeks'),hpw=n('fr-hours'),bill=n('fr-bill')||100,profit=n('fr-profit');
var need=(inc+exp)/(1-Math.min(tax,90)/100)*(1+profit/100),hours=wk*hpw*bill/100,rate=hours?need/hours:0;
$('fr-out').innerHTML='<p>Revenue needed per year: <b>'+money(need)+'</b></p><p>Billable hours per year: <b>'+Math.round(hours)+'</b></p><p class="big">Minimum hourly rate: '+money(rate)+'</p><p>Day rate (8 h): <b>'+money(rate*8)+'</b> · Weekly: <b>'+money(rate*hpw*bill/100)+'</b></p>'});

// Scope creep cost
bind('sc-form',function(){
var fee=n('sc-fee'),origH=n('sc-orig-h'),rate=n('sc-rate'),day=n('sc-day');
if(day>0)rate=day/8;
var extraH=n('sc-extra-h'),reqs=n('sc-reqs'),avg=n('sc-avg'),revs=n('sc-revs'),revH=n('sc-rev-h'),markup=n('sc-markup');
var opp=$('sc-opp')&&$('sc-opp').checked;
var fromReqs=reqs*avg, fromRevs=revs*revH, totalExtra=extraH+fromReqs+fromRevs;
var left=totalExtra*rate, oppCost=opp?left:0, totalCost=left+oppCost;
var totalH=origH+totalExtra, eff=totalH?fee/totalH:0, suggested=totalExtra*rate*(1+markup/100);
var planned=origH?fee/origH:0;
$('sc-out').innerHTML='<p>Extra hours (logged + requests + revisions): <b>'+(Math.round(totalExtra*100)/100)+'</b></p>'
+'<p>Money left on the table at your rate: <b>'+money(left)+'</b></p>'
+(opp?'<p>Opportunity cost (same hours elsewhere): <b>'+money(oppCost)+'</b></p><p>Combined cost of unpaid extras: <b>'+money(totalCost)+'</b></p>':'')
+'<p>Planned rate on original scope: <b>'+money(planned)+'/h</b></p>'
+'<p class="big">Effective hourly rate after creep: '+money(eff)+'/h</p>'
+'<p>Suggested change-order price for extras (+'+markup+'%): <b>'+money(suggested)+'</b></p>'
+'<p class="small">Plain language: you quoted '+money(fee)+' for about '+origH+' hours. After ~'+(Math.round(totalExtra*10)/10)+' unpaid extra hours, you are earning closer to '+money(eff)+' per hour. Price the extras at about '+money(suggested)+' before doing more of them.</p>'
});

// Line-item docs (invoice / change order)
function rows(tb){var out=[],tr=$(tb).querySelectorAll('tr');for(var i=0;i<tr.length;i++){var c=tr[i].querySelectorAll('input');out.push({d:c[0].value,q:parseFloat(c[1].value)||0,p:parseFloat(c[2].value)||0})}return out}
function addRow(tb,d,q,p){var tr=document.createElement('tr');tr.innerHTML='<td><input aria-label="Description" value="'+esc(d||'')+'"></td><td><input aria-label="Quantity" type="number" step="any" value="'+(q==null?1:q)+'"></td><td><input aria-label="Unit price" type="number" step="any" value="'+(p==null?0:p)+'"></td><td><button type="button" class="rm" aria-label="Remove line">×</button></td>';$(tb).appendChild(tr)}
function lineDoc(prefix,render){var tb=prefix+'-lines';if(!$(tb))return;
$(prefix+'-add').addEventListener('click',function(){addRow(tb);render()});
$(tb).addEventListener('click',function(e){if(e.target.className==='rm'){e.target.closest('tr').remove();render()}});
bind(prefix+'-form',render)}
function itemsTable(it,cur){var h='<table class="doc-t"><thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>',s=0;
it.forEach(function(x){var t=x.q*x.p;s+=t;h+='<tr><td>'+esc(x.d)+'</td><td>'+x.q+'</td><td>'+money(x.p,cur)+'</td><td>'+money(t,cur)+'</td></tr>'});return {html:h+'</tbody></table>',sum:s}}
function v(id){return esc(($(id)||{}).value||'')}

if($('inv-lines')){addRow('inv-lines','Website design',1,800);addRow('inv-lines','Extra revision round',2,75)}
lineDoc('inv',function(){var cur=$('inv-cur').value,t=itemsTable(rows('inv-lines'),cur),tax=t.sum*n('inv-tax')/100,disc=n('inv-disc');
$('inv-out').innerHTML='<div class="doc"><h2>INVOICE '+v('inv-no')+'</h2><div class="doc-2"><div><b>From</b><br>'+v('inv-from').replace(/\n/g,'<br>')+'</div><div><b>Bill to</b><br>'+v('inv-to').replace(/\n/g,'<br>')+'</div></div><p>Date: '+v('inv-date')+' · Due: '+v('inv-due')+'</p>'+t.html+'<p class="tot">Subtotal '+money(t.sum,cur)+(disc?'<br>Discount −'+money(disc,cur):'')+(tax?'<br>Tax '+money(tax,cur):'')+'<br><b>Total due '+money(t.sum-disc+tax,cur)+'</b></p>'+(v('inv-notes')?'<p class="small">'+v('inv-notes').replace(/\n/g,'<br>')+'</p>':'')+'</div>'});

if($('co-lines')){addRow('co-lines','Add 2 extra electrical outlets in kitchen',2,120)}
lineDoc('co',function(){var cur=$('co-cur').value,t=itemsTable(rows('co-lines'),cur),orig=n('co-orig'),prev=n('co-prev');
$('co-out').innerHTML='<div class="doc"><h2>CHANGE ORDER #'+v('co-no')+'</h2><p><b>Project:</b> '+v('co-proj')+'<br><b>Contractor:</b> '+v('co-from')+'<br><b>Client:</b> '+v('co-to')+'<br><b>Date:</b> '+v('co-date')+'</p><p><b>Description of change:</b><br>'+v('co-desc').replace(/\n/g,'<br>')+'</p>'+t.html+'<p class="tot">Original contract: '+money(orig,cur)+'<br>Previous changes: '+money(prev,cur)+'<br>This change: '+money(t.sum,cur)+'<br><b>New contract total: '+money(orig+prev+t.sum,cur)+'</b><br>Schedule impact: '+(v('co-days')||'0')+' day(s)</p><div class="doc-2 sig"><div>Client signature / date<br><br>__________________</div><div>Contractor signature / date<br><br>__________________</div></div></div>'});
var dd=document.querySelectorAll("input[type=date]");for(var k=0;k<dd.length;k++)if(!dd[k].value){var t=new Date();if(dd[k].id==="inv-due")t.setDate(t.getDate()+14);dd[k].value=t.toISOString().slice(0,10);dd[k].dispatchEvent(new Event("change",{bubbles:true}))}
})();
