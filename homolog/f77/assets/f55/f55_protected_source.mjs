/** BRZ F55 — GitHub Pages public application + protected historical inputs.
 * The JS and login form are PUBLIC. Only Supabase Auth/RLS protect data.
 * No static, cached, or local fallback; no business writes.
 */
export const F55_SOURCE_REFERENCE = Object.freeze({
 cfr_offers: Object.freeze({bytes:1079668,parts:30,sha:'164c3c9ffecb1be1c7690d267d85f9165508bf9506d53ab68cc348a8f00d4053'}),
 ocean_freight: Object.freeze({bytes:6233,parts:1,sha:'f4ccb955f5027a15b4246d78cefbbb07b1b53ef9912d1c50e580b2c52555280a'}),
 f44_meta: Object.freeze({bytes:82520,parts:3,sha:'1530163d05c46d70ce70cf5c00dbbc302649c18b48d11c069e0cbc94feb927da'}),
 f46_meta: Object.freeze({bytes:40555,parts:2,sha:'291575b29ac2084c7a4d8781604d5be092ba8351da40b1c4033bbafa9e57b6c6'})
});
const ORDER=Object.freeze(['cfr_offers','ocean_freight','f44_meta','f46_meta']);
const utf8Bytes=s=>new TextEncoder().encode(s).byteLength;

export async function hydrateF55ProtectedSources({request,token,sha256,
 isAborted=()=>false,onProgress=()=>{},reference=F55_SOURCE_REFERENCE}={}){
 if(typeof request!=='function'||typeof sha256!=='function'||
    typeof token!=='string'||token.length<30||
    typeof isAborted!=='function'||typeof onProgress!=='function')
   throw Error('F55: Supabase-authenticated session required');
 const rows=await request('/rest/v1/rpc/brz_api_f55_source_manifest',{
   method:'POST',body:{},token});
 if(!Array.isArray(rows)||rows.length!==4)throw Error('F55: protected source manifest missing');
 const inventory=new Map(rows.map(r=>[r?.source_name,r]));
 if(inventory.size!==4 || ORDER.some(s=>!inventory.has(s)))
   throw Error('F55: protected source inventory invalid');
 for(const name of ORDER){
  const row=inventory.get(name),ref=reference[name];
  if(!ref||row.ready!==true||Number(row.part_count)!==ref.parts||
   Number(row.utf8_bytes)!==ref.bytes||row.sha256_hex!==ref.sha)
   throw Error('F55: source manifest not ready: '+name);
 }
 const result={};
 for(const name of ORDER){
  const ref=reference[name],parts=[],received=new Set();let cursor=-1;
  while(received.size<ref.parts){
   if(isAborted())throw Error('F55: confidential source loading interrupted');
   const page=await request('/rest/v1/rpc/brz_api_f55_source_page',{
    method:'POST',token,body:{p_source_name:name,p_after_no:cursor,p_limit:4}});
   if(!Array.isArray(page)||!page.length||page.length>4)
    throw Error('F55: missing protected source page: '+name);
   for(const row of page){
    const number=Number(row?.part_no);
    if(!Number.isSafeInteger(number)||number!==cursor+1||number>=ref.parts||
       received.has(number)||typeof row.part_text!=='string'||
       typeof row.sha256_hex!=='string'||!/^[0-9a-f]{64}$/.test(row.sha256_hex)||
       !Number.isSafeInteger(Number(row.utf8_bytes))||
       utf8Bytes(row.part_text)!==Number(row.utf8_bytes)||
       await sha256(row.part_text)!==row.sha256_hex)
      throw Error('F55: corrupt protected source part: '+name);
    received.add(number);parts.push(row.part_text);cursor=number;
   }
   onProgress(name,received.size,ref.parts);
  }
  const raw=parts.join('');
  if(utf8Bytes(raw)!==ref.bytes||await sha256(raw)!==ref.sha)
   throw Error('F55: canonical confidential-source SHA mismatch: '+name);
  let value;try{value=JSON.parse(raw);}catch{throw Error('F55: invalid JSON source: '+name);}
  if(!value||typeof value!=='object'||Array.isArray(value))
   throw Error('F55: protected source is not a JSON object: '+name);
  if(name==='cfr_offers'&&Object.keys(value).length!==74)
   throw Error('F55: CFR offer history truncated');
  if(name==='ocean_freight'&&Object.keys(value).length!==5)
   throw Error('F55: ocean freight history truncated');
  if(name==='f44_meta'&&(!Array.isArray(value.basisKeys)||value.basisKeys.length!==1405||
     !Array.isArray(value.cbotContracts)||!Array.isArray(value.dolContracts)))
   throw Error('F55: curve/basis metadata incomplete');
  if(name==='f46_meta'&&(!Array.isArray(value.rotas)||value.rotas.length!==1045||
     !Array.isArray(value.semanas)||value.semanas.length!==535))
   throw Error('F55: road freight metadata incomplete');
  result[name]=value;
 }
 return Object.freeze({...result,ready:true,writes:0,remoteOnly:true,
  browserCodePublic:true,productionApproved:false});
}
