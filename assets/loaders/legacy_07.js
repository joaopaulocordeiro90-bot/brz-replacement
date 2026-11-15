/* F46: certified V4FQ road source from authenticated PostgreSQL, never from public JSON. */
(()=>{
 'use strict';
 const el=document.getElementById('dataRodo');
 if(!el)throw Error('F46: missing legacy road source target');
 let parent;
 try{parent=window.parent;}catch{throw Error('F46: private parent unavailable');}
 const data=parent?.__BRZF46_ROAD;
 if(parent?.__BRZF46_ROAD_READY!==true||!data||data.fmt!=='rodo-v1'||
    !Array.isArray(data.dados)||data.dados.length!==178201||
    !Array.isArray(data.semanas)||data.semanas.at(-1)!=='2026-S46')
   throw Error('F46: authenticated road source unavailable; no local fallback');
 el.textContent=JSON.stringify(data);
 window.__BRZF46_ROAD_RENDERED=true;
})();
