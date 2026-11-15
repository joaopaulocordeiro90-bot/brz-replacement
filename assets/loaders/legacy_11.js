(()=>{'use strict';
 const el=document.getElementById('dataRules');
 if(!el||window===window.parent||!window.parent.__BRZF48_READY)
  throw Error('F48: rules need authenticated source');
 const raw=window.parent.__BRZF48_SOURCES?.rules;
 if(typeof raw!=='string')throw Error('F48: rules missing');
 const rules=JSON.parse(raw);
 if(!Array.isArray(rules?.regras)||rules.regras.length!==187)
  throw Error('F48: rules are not the original V4FQ snapshot');
 el.textContent=raw;window.__BRZF48_RULES_RENDERED=true;
})();
