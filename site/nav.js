(function(){if(window.top!==window.self){document.documentElement.style.display='none';try{window.top.location.replace(window.self.location.href)}catch(e){}}})();
(function(){var b=document.getElementById('burger'),m=document.getElementById('menu');if(!b||!m)return;function set(o){m.classList.toggle('open',o);b.setAttribute('aria-expanded',o?'true':'false');if(o){var a=m.querySelector('a');if(a)a.focus();}}
b.addEventListener('click',function(){set(!m.classList.contains('open'))});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&m.classList.contains('open')){set(false);b.focus();}});
m.addEventListener('click',function(e){if(e.target.closest('a'))set(false);});})();
