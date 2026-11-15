(()=>{
 'use strict';
 const el=document.getElementById('dataDeals');
 if(!el)throw Error('F42: componente da seleção ausente');
 if(window===window.parent||window.parent.__BRZF42_DEALS_READY!==true)
   throw Error('F42: seleção exige consulta autenticada ao PostgreSQL');
 const deals=window.parent.__BRZF42_DEALS;
 if(!Array.isArray(deals)||deals.length!==2820)
   throw Error('F42: seleção histórica incompleta');
 el.textContent=JSON.stringify(deals);
})();
