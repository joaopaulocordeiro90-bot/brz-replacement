
(function(){
  var SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/></svg>';
  var MOON='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  window.applyTheme=function(t){var el=document.documentElement;if(t==='dark'){el.setAttribute('data-theme','dark');}else{el.removeAttribute('data-theme');}var b=document.getElementById('themeToggleBtn');if(b){b.innerHTML=(t==='dark'?SUN+'<span>Claro</span>':MOON+'<span>Escuro</span>');}};
  window.toggleTheme=function(){var cur=document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light';var nxt=cur==='dark'?'light':'dark';try{localStorage.setItem('brz_theme',nxt);}catch(e){}window.applyTheme(nxt);try{if(typeof onThemeChange==='function')onThemeChange(nxt);}catch(e){}};
  function init(){var t='light';try{if(localStorage.getItem('brz_theme')==='dark')t='dark';}catch(e){}window.applyTheme(t);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
