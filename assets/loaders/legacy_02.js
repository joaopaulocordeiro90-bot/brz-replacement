(()=>{'use strict';
 const el=document.getElementById('__HISTORY__');
 if(!el||window===window.parent||!window.parent.__BRZF48_READY)
  throw Error('F48: history requires authenticated source');
 const raw=window.parent.__BRZF48_SOURCES?.history;
 if(typeof raw!=='string'||!raw.length||!JSON.parse(raw).build_log)
  throw Error('F48: history unavailable');
 el.textContent=raw;window.__BRZF48_HISTORY_RENDERED=true;
})();
