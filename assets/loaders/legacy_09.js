(()=>{'use strict';
 const el=document.getElementById('dataState');
 if(!el||window===window.parent||!window.parent.__BRZF48_READY||
    !window.parent.__BRZF41_TRADES_READY)
  throw Error('F48: state needs authenticated snapshot and frozen trade history');
 const raw=window.parent.__BRZF48_SOURCES?.state;
 const trades=window.parent.__BRZF41_TRADES;
 if(typeof raw!=='string'||!Array.isArray(trades)||trades.length!==4011)
  throw Error('F48: state or trades unavailable');
 const meta=JSON.parse(raw);
 if(!meta||!Array.isArray(meta.negocios)||meta.negocios.length!==0||
    Object.keys(meta).length!==77)
  throw Error('F48: state is not the verified frozen snapshot');
 meta.negocios=trades;
 el.textContent=JSON.stringify(meta);
 window.__BRZF48_STATE_RENDERED=true;
})();
