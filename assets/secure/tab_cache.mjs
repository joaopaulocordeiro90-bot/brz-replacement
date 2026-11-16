/* BRZ Replacement — authenticated, one-hour, tab-bound encrypted source cache.
 * Only previously SHA-validated immutable source objects enter this cache.
 * No raw business data, PIN, access token, or refresh token is stored in IDB.
 * The AES-GCM key lives in sessionStorage in this tab and expires with login.
 * F33 trades and mutable curves are ALWAYS fetched from Supabase on reload.
 */
const SCHEMA='BRZ_ENCRYPTED_HYDRATION_V1';
const DATABASE='brz_replacement_encrypted_tab_v1';
const KEY_NAME='brz_replacement_cache_key_v1';
const RECORDS=['tradeBundle','derivativesResult','resultF44','rail','road',
 'premiums','restored','rows'];
const MAX_LIFETIME_MS=3600000;
const enc=new TextEncoder();
const dec=new TextDecoder();
function encoded(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
function decoded(hex){
 if(!/^[a-f0-9]{64}$/.test(hex))throw Error('cache-key-not-valid');
 return new Uint8Array(hex.match(/../g).map(x=>parseInt(x,16)));
}
function validContext(ctx){
 return typeof ctx?.userId==='string'&&/^[a-f0-9-]{36}$/i.test(ctx.userId)&&
  typeof ctx?.fingerprint==='string'&&/^[a-f0-9]{64}$/.test(ctx.fingerprint)&&
  Number.isFinite(ctx?.expiresAt)&&ctx.expiresAt>Date.now()&&
  ctx.expiresAt<=Date.now()+MAX_LIFETIME_MS+60000;
}
function cacheSecret(allowCreate=false){
 try{
  let secret=sessionStorage.getItem(KEY_NAME);
  if(!secret&&allowCreate){
   secret=encoded(crypto.getRandomValues(new Uint8Array(32)));
   sessionStorage.setItem(KEY_NAME,secret);
  }
  return secret?decoded(secret):null;
 }catch{return null;}
}
async function aesKey(create){
 const raw=cacheSecret(create);
 return raw?crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']):null;
}
function openDb(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window))return reject(Error('indexeddb-unavailable'));
  const req=indexedDB.open(DATABASE,1);
  req.onupgradeneeded=()=>{
   if(!req.result.objectStoreNames.contains('encrypted'))
    req.result.createObjectStore('encrypted');
  };
  req.onerror=()=>reject(req.error||Error('indexeddb-open-failed'));
  req.onsuccess=()=>resolve(req.result);
  req.onblocked=()=>reject(Error('indexeddb-blocked'));
 });
}
function storeCall(db,op,id,value){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('encrypted',op==='get'?'readonly':'readwrite');
  const st=tx.objectStore('encrypted');
  let result;
  if(op==='put')result=st.put(value,id);
  else if(op==='delete')result=st.delete(id);
  else if(op==='clear')result=st.clear();
  else result=st.get(id);
  result.onsuccess=()=>{if(op==='get')resolve(result.result);};
  result.onerror=()=>reject(result.error||Error('cache-operation-failed'));
  tx.oncomplete=()=>{if(op!=='get')resolve(true);};
  tx.onerror=()=>reject(tx.error||Error('cache-transaction-failed'));
  tx.onabort=()=>reject(tx.error||Error('cache-transaction-aborted'));
 });
}
async function compress(bytes){
 if(typeof CompressionStream!=='function'||typeof DecompressionStream!=='function')
  return {codec:'raw',bytes:bytes.buffer};
 const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
 const compressed=await new Response(stream).arrayBuffer();
 return {codec:'gzip',bytes:compressed};
}
async function expand(buffer,codec){
 if(codec==='raw')return buffer;
 if(codec!=='gzip'||typeof DecompressionStream!=='function')
  throw Error('cache-decompression-unavailable');
 return new Response(new Blob([buffer]).stream()
  .pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
const aad=(ctx,name)=>enc.encode([SCHEMA,ctx.userId,ctx.fingerprint,name].join('|'));
function validate(data){
 if(!data||typeof data!=='object')return false;
 const t=data.tradeBundle;
 return Array.isArray(t?.frozenTrades)&&t.frozenTrades.length===4011&&
  !!t.orderedDeals&&Array.isArray(data.derivativesResult?.rows)&&
  data.derivativesResult.rows.length===14235&&
  data.resultF44?.ready===true&&
  Number(data.resultF44.counts?.curves)===16418&&
  Number(data.resultF44.counts?.basisPoints)===107184&&
  Array.isArray(data.rail?.rows)&&data.rail.rows.length===39&&
  Array.isArray(data.road?.payload?.dados)&&
  data.road.payload.dados.length===178201&&
  Array.isArray(data.premiums?.records)&&data.premiums.records.length===38&&
  typeof data.restored?.sources?.state==='string'&&
  typeof data.restored.sources.rules==='string'&&
  Array.isArray(data.rows)&&data.rows.length===59758;
}
export async function readHydrationCache(ctx){
 if(!validContext(ctx))return null;
 const key=await aesKey(false);
 if(!key)return null;
 let db;
 try{
  db=await openDb();
  const meta=await storeCall(db,'get','manifest');
  if(meta?.schema!==SCHEMA||meta.userId!==ctx.userId||
     meta.fingerprint!==ctx.fingerprint||meta.complete!==true||
     meta.expiresAt<=Date.now()||meta.expiresAt>ctx.expiresAt||
     RECORDS.some(x=>!meta.entries?.includes(x)))return null;
  const out={};
  for(const name of RECORDS){
   const item=await storeCall(db,'get',name);
   if(item?.schema!==SCHEMA||item.fingerprint!==ctx.fingerprint||
      !(item.iv instanceof ArrayBuffer)||!(item.ciphertext instanceof ArrayBuffer))
    return null;
   const clear=await crypto.subtle.decrypt({name:'AES-GCM',
     iv:new Uint8Array(item.iv),additionalData:aad(ctx,name)},
     key,item.ciphertext);
   const bytes=await expand(clear,item.codec);
   out[name]=JSON.parse(dec.decode(bytes));
  }
  return validate(out)?out:null;
 }catch(error){
  console.warn('BRZ: cache protegido indisponível, consultando Supabase',error?.message);
  return null;
 }finally{db?.close();}
}
export async function writeHydrationCache(ctx,data){
 if(!validContext(ctx)||!validate(data))return false;
 const key=await aesKey(true);
 if(!key)return false;
 let db;
 try{
  db=await openDb();
  await storeCall(db,'put','manifest',{
   schema:SCHEMA,userId:ctx.userId,fingerprint:ctx.fingerprint,
   expiresAt:ctx.expiresAt,entries:RECORDS,complete:false
  });
  for(const name of RECORDS){
   const serialized=JSON.stringify(data[name]);
   if(typeof serialized!=='string'||serialized.length>120000000)
    throw Error('cache-entry-too-large');
   const packed=await compress(enc.encode(serialized));
   const iv=crypto.getRandomValues(new Uint8Array(12));
   const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',
     iv,additionalData:aad(ctx,name)},key,packed.bytes);
   await storeCall(db,'put',name,{
    schema:SCHEMA,fingerprint:ctx.fingerprint,
    iv:iv.buffer,codec:packed.codec,ciphertext:encrypted
   });
  }
  await storeCall(db,'put','manifest',{
   schema:SCHEMA,userId:ctx.userId,fingerprint:ctx.fingerprint,
   expiresAt:ctx.expiresAt,entries:RECORDS,complete:true
  });
  return true;
 }catch(error){
  console.warn('BRZ: cache criptografado não foi gravado',error?.message);
  return false;
 }finally{db?.close();}
}
export async function clearHydrationCache(){
 try{sessionStorage.removeItem(KEY_NAME);}catch{}
 let db;
 try{db=await openDb();await storeCall(db,'clear');}catch{}
 finally{db?.close();}
}
export const cacheVersion=SCHEMA;
