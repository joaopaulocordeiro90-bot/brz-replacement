/* F43: derivatives come ONLY from authenticated parent F34, never a local commercial JSON. */
(()=>{'use strict';
  const el=document.getElementById('dataDerivadosSpot');
  if(!el||window===window.parent||window.parent.__BRZF43_DERIV_READY!==true)
    throw Error('F43: authenticated derivative source required');
  const rows=window.parent.__BRZF43_DERIV_ROWS;
  if(!Array.isArray(rows)||rows.length!==14235)
    throw Error('F43: derivative record count invalid');
  const privateRuntime=window.parent.__BRZF56_PRIVATE_RUNTIME;
  if(!privateRuntime||privateRuntime.schema!=='BRZ_F56_PRIVATE_RUNTIME_V1'||!privateRuntime.derivativesMeta)
    throw Error('F56: authenticated derivatives metadata unavailable');
  const meta=privateRuntime.derivativesMeta;
  el.textContent=JSON.stringify({meta,rows});
  window.__BRZF43_DERIV_RENDERED=true;
})();
