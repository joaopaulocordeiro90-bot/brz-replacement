/* F44: V4FQ BASIS from audited JWT hydration, never from local JSON. */
(()=>{'use strict';
 const el=document.getElementById('dataBasisFOB');
 if(!el)throw Error('F44: target BASIS not found');
 if(window===window.parent||window.parent.__BRZF44_READY!==true)
   throw Error('F44: BASIS requires complete mesa/admin hydration');
 const source=window.parent.__BRZF44_BASIS;
 if(!source||typeof source!=='object'||!source.meta||!source.series)
   throw Error('F44: BASIS source missing or incomplete');
 el.textContent=JSON.stringify(source);
 window.__BRZF44_BASIS_RENDERED=true;
})();
