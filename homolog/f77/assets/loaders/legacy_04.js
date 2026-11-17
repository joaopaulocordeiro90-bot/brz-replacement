(()=>{
 'use strict';
 const el=document.getElementById('dataPremios');
 if(!el)throw Error('F47: premium container missing');
 if(window===window.parent||window.parent.__BRZF47_PREMIUM_READY!==true||
    !Array.isArray(window.parent.__BRZF47_PREMIUM_ROWS)||
    window.parent.__BRZF47_PREMIUM_ROWS.length!==38)
   throw Error('F47: authenticated FOB premium source missing');
 el.textContent=JSON.stringify(window.parent.__BRZF47_PREMIUM_ROWS);
 window.__BRZF47_PREMIUM_RENDERED=true;
})();
