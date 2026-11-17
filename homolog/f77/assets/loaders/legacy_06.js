(()=>{
 'use strict';
 const el=document.getElementById('dataPrecos');
 if(!el)throw Error('F40: preço físico alvo ausente');
 if(window===window.parent||!window.parent.__BRZF40_PHYSICAL_READY)
    throw Error('F40: leitura de preços exige autenticação antes do motor');
 const rows=window.parent.__BRZF40_PHYSICAL_ROWS;
 if(!Array.isArray(rows)||rows.length!==59758)
    throw Error('F40: fonte física incompleta');
 // Data is in memory only and is not loaded from a public JSON file.
 el.textContent=JSON.stringify(rows);
})();
