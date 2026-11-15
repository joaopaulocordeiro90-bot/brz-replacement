/* F55: fail-closed iframe-only storage. Prevent private market/business
 * objects loaded from JWT/RLS from being persisted on a shared browser.
 * This intentionally does not persist theme, local filters or draft edits.
 * It does NOT provide security for the public JavaScript source code.
 */
(()=>{'use strict';
 if(window===window.parent || window.parent.__BRZF55_VERIFIED!==true)
  throw Error('F55: engine iframe may start only after verified Supabase sources');
 const data=new Map();
 const key=k=>String(k);
 const shim=Object.freeze({
  get length(){return data.size},
  key(n){if(!Number.isInteger(Number(n))||Number(n)<0)return null;return [...data.keys()][Number(n)]??null},
  getItem(k){const v=data.get(key(k));return v===undefined?null:v},
  setItem(k,v){data.set(key(k),String(v))},
  removeItem(k){data.delete(key(k))},
  clear(){data.clear()}
 });
 for(const prop of ['localStorage','sessionStorage']){
  const own=Object.getOwnPropertyDescriptor(window,prop);
  if(!own||own.configurable!==true)
   throw Error('F55: browser storage cannot be isolated');
  Object.defineProperty(window,prop,{configurable:false,enumerable:true,get:()=>shim});
 }
 window.__BRZF55_STORAGE_EPHEMERAL=true;
})();
