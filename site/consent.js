(function(){var K='sc_consent',b=document.getElementById('cc');if(!b)return;
function get(){try{return localStorage.getItem(K);}catch(e){return null;}}
function set(v){try{localStorage.setItem(K,v);}catch(e){}}
function show(){b.hidden=false;var a=document.getElementById('cc-accept');if(a)a.focus();}
function hide(){b.hidden=true;}
document.getElementById('cc-accept').addEventListener('click',function(){set('granted');hide();if(window.scLoadGA)window.scLoadGA();});
document.getElementById('cc-reject').addEventListener('click',function(){var was=get()==='granted';set('denied');hide();
 if(window.gtag)gtag('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 document.cookie.split(';').forEach(function(c){var n=c.split('=')[0].trim();if(/^_ga/.test(n)){var d=location.hostname;document.cookie=n+'=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';document.cookie=n+'=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.'+d;}});
 if(was)location.reload();});
var cs=document.getElementById('cookie-settings');if(cs)cs.addEventListener('click',show);
b.addEventListener('keydown',function(e){if(e.key==='Escape'&&get())hide();});
if(!get())show();})();
