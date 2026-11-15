
(function(){
  var sp=document.getElementById("brz-splash");
  if(!sp) return;
  var t0=Date.now(), MIN=1200, MAX=4000, done=false;
  function hide(){
    if(done) return; done=true;
    var wait=Math.max(0, MIN-(Date.now()-t0));
    setTimeout(function(){
      sp.classList.add("brz-out");
      setTimeout(function(){ if(sp&&sp.parentNode) sp.parentNode.removeChild(sp); }, 650);
    }, wait);
  }
  if(document.readyState==="interactive"||document.readyState==="complete") hide();
  else document.addEventListener("DOMContentLoaded", hide);
  window.addEventListener("load", hide);
  setTimeout(hide, MAX);
})();
