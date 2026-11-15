(()=>{
  'use strict';
  const el=document.getElementById('dataFerro');
  if(!el||window===window.parent||window.parent.__BRZF45_RAIL_READY!==true)
     throw Error('F45: fretes ferroviários exigem fonte privada autenticada');
  const rows=window.parent.__BRZF45_RAIL_ROWS;
  if(!Array.isArray(rows)||rows.length!==39)
     throw Error('F45: fretes ferroviários incompletos');
  el.textContent=JSON.stringify(rows);
  window.__BRZF45_RAIL_RENDERED=true;
})();
