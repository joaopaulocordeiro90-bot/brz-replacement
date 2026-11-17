/* F58: static release integrity PRE-login. Does not read account or business data.
 * This detects an incomplete/mixed deployment; it does not make public JS private,
 * prove authenticity of a mutable public manifest, or approve a go-live.
 */
const EXPECTED_SCHEMA='BRZ_F58_PUBLIC_STATIC_PREFLIGHT_V1';
const hex=/^[a-f0-9]{64}$/;
function safePath(path){
 if(typeof path!=='string'||path.length>180||!path||path.startsWith('/')||path.includes('\\')||path.includes('//')||
    path.split('/').some(x=>x==='.'||x==='..'||!x)||!/^[a-zA-Z0-9._/-]+$/.test(path))
    throw Error('F58_INVALID_RESOURCE_PATH');
 if(/(?:^|\/)(?:\.git|private|qa|tests)(?:\/|$)/i.test(path)||
    /\.(?:sql|env|zip|csv|xlsx|jsonl|dump|backup|pem|key|md|map)$/i.test(path))
    throw Error('F58_FORBIDDEN_PUBLIC_RESOURCE');
 return path;
}
const hexFromBytes=bytes=>Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
export async function verifyF58PublicRelease({baseURL,fetchImpl=fetch,subtle=crypto.subtle,
  onProgress=()=>{},parallel=6}={}){
 if(!(baseURL instanceof URL)||!['https:','http:'].includes(baseURL.protocol)||
    typeof fetchImpl!=='function'||!subtle||!Number.isSafeInteger(parallel)||parallel<1||parallel>10)
   throw Error('F58_INVALID_PREFLIGHT_ARGUMENTS');
 const manifestURL=new URL('MANIFEST_F58_PUBLIC_SHA256.json',baseURL);
 async function get(url){
  const r=await fetchImpl(url.href,{cache:'no-store',credentials:'same-origin',redirect:'error'});
  if(!r||!r.ok||r.url&&new URL(r.url).origin!==baseURL.origin)throw Error('F58_RESOURCE_UNAVAILABLE');
  const out=new Uint8Array(await r.arrayBuffer());
  if(out.length>2000000)throw Error('F58_RESOURCE_TOO_LARGE');
  return out;
 }
 const manifestRaw=await get(manifestURL);
 let manifest;try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestRaw));}
 catch{throw Error('F58_MANIFEST_MALFORMED');}
 if(manifest?.schema!==EXPECTED_SCHEMA||manifest?.live_deployed!==false||
  manifest?.production_approved!==false||manifest?.real_jwt_uat!==false||
  manifest?.readonly_staging!==true||typeof manifest.files!=='object'||
  !manifest.files||Array.isArray(manifest.files))throw Error('F58_MANIFEST_RELEASE_FLAGS_INVALID');
 const entries=Object.entries(manifest.files);
 if(entries.length<70||entries.length>110||!manifest.files['index.html']||
  !manifest.files['app.html']||!manifest.files['assets/f40/f40_boot.js']||
  !manifest.files['assets/f58/f58_manifest_gate.mjs'])
   throw Error('F58_MANIFEST_INCOMPLETE');
 const names=new Set(),checks=[];
 for(const [path,entry] of entries){
  safePath(path);
  if(names.has(path))throw Error('F58_DUPLICATE_RESOURCE');names.add(path);
  if(!entry||!hex.test(entry.sha256)||!Number.isSafeInteger(entry.bytes)||
    entry.bytes<0||entry.bytes>2000000)throw Error('F58_BAD_RESOURCE_DIGEST');
  if(path==='.nojekyll'||path==='README_F58.txt')continue;
  checks.push([path,entry]);
 }
 let next=0,done=0;
 async function worker(){
  while(next<checks.length){
   const n=next++,[path,entry]=checks[n];
   const url=new URL(path,baseURL);
   if(url.origin!==baseURL.origin||!url.pathname.startsWith(baseURL.pathname))
    throw Error('F58_ORIGIN_MISMATCH');
   const bytes=await get(url);
   if(bytes.length!==entry.bytes)throw Error('F58_SIZE_MISMATCH');
   const sha=hexFromBytes(new Uint8Array(await subtle.digest('SHA-256',bytes)));
   if(sha!==entry.sha256)throw Error('F58_HASH_MISMATCH');
   done++;if(done===checks.length||done%10===0)onProgress(done,checks.length);
  }
 }
 await Promise.all(Array.from({length:Math.min(parallel,checks.length)},()=>worker()));
 if(done!==checks.length)throw Error('F58_PRECHECK_INCOMPLETE');
 return Object.freeze({verified:true,verifiedResources:done,listedResources:entries.length,
  financialSha256:manifest.financial_engine_sha256,readOnly:true,
  credentialsLoaded:false,commercialRowsLoaded:0,productionApproved:false,
  files:Object.freeze(Object.fromEntries(entries.map(([k,v])=>[k,v.sha256])))});
}
