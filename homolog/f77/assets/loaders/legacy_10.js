/* F44: V4FQ CURVES from audited JWT hydration, never from local JSON. */
(()=>{'use strict';
 const el=document.getElementById('dataCurvas');
 if(!el)throw Error('F44: target CURVES not found');
 if(window===window.parent||window.parent.__BRZF44_READY!==true)
   throw Error('F44: CURVES requires complete mesa/admin hydration');
 const source=window.parent.__BRZF44_CURVES;
 if(!source||typeof source!=='object'||!source.meta||!source.cbot)
   throw Error('F44: CURVES source missing or incomplete');
 el.textContent=JSON.stringify(source);
 window.__BRZF44_CURVES_RENDERED=true;
})();
