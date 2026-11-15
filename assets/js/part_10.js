
/* Topnav fixa no mobile: empurra o conteúdo por baixo com a altura real da barra */
(function(){
  function adj(){
    try{
      var mn=document.querySelector('main');
      if(mn) mn.style.paddingTop='';
    }catch(e){}
  }
  window.addEventListener('resize',adj);
  window.addEventListener('orientationchange',adj);
  window.addEventListener('load',adj);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',adj);else adj();
  try{var t=document.querySelector('header.topnav');if(t&&window.ResizeObserver){new ResizeObserver(adj).observe(t);}}catch(e){}
  setTimeout(adj,200);setTimeout(adj,800);setTimeout(adj,2000);
})();
