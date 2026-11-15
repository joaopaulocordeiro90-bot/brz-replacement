/* BRZ F48 — AUTHENTICATED V4FQ SOURCE SNAPSHOTS, FAIL-CLOSED.
 * Only source hashes, size and count are in JS. No commercial data or credentials.
 */
export const F48_REFERENCE=Object.freeze({"history":{"sha256_hex":"e3a6002226fc9b38f6feda879205bf77a586c051471d4e80df431e0967bfe792","utf8_bytes":875376,"part_count":20,"expected_fields":35,"expected_rules":0},"state":{"sha256_hex":"0476e08534b46dafc7487ecab3b916414cd46b1eaef8368c374634e68a8018cb","utf8_bytes":1520315,"part_count":34,"expected_fields":77,"expected_rules":0},"rules":{"sha256_hex":"d9d84e95fd7fc4a5b982c243e044fa04a6a85ef5fe577fabeef7bcd5298ae915","utf8_bytes":121627,"part_count":3,"expected_fields":3,"expected_rules":187}});
const NAMES=Object.freeze(['history','state','rules']);
const LIMIT=4;
const encoder=new TextEncoder();
function validateRecord(name,obj,ref){
 if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).length!==ref.expected_fields)
  throw Error('F48: '+name+' JSON object shape diverges');
 if(name==='history'&&(!Array.isArray(obj.build_log)||obj.build_log.length!==529))
  throw Error('F48: missing original history build log');
 if(name==='state'&&(!Array.isArray(obj.negocios)||obj.negocios.length!==0||
   !Array.isArray(obj.simulacoes)||!Array.isArray(obj.fretesRodo)))
  throw Error('F48: original state contract changed');
 if(name==='rules'&&(!Array.isArray(obj.regras)||obj.regras.length!==ref.expected_rules||
  typeof obj.versao!=='string'||typeof obj.atualizadoEm!=='string'))
  throw Error('F48: original rules changed');
}
export async function hydrateF48Legacy({request,token,sha256,onProgress=()=>{},isAborted=()=>false,
 reference=F48_REFERENCE}={}){
 if(typeof request!=='function'||typeof sha256!=='function'||
    typeof token!=='string'||token.length<30)throw Error('F48: mesa/admin session required');
 const inventories=await request('/rest/v1/rpc/brz_api_f48_source_manifest',{
  method:'POST',body:{},token});
 if(!Array.isArray(inventories)||inventories.length!==3)
  throw Error('F48: three historical sources not seeded and verified in PostgreSQL');
 const out={};
 for(const source of NAMES){
  const ref=reference[source],inv=inventories.find(m=>m?.source_name===source);
  if(!ref||!inv||inv.ready!==true||Number(inv.utf8_bytes)!==ref.utf8_bytes||
     Number(inv.part_count)!==ref.part_count||inv.sha256_hex!==ref.sha256_hex)
    throw Error('F48: '+source+' snapshot missing or cryptographically divergent');
  const fragments=[],lastNo=ref.part_count-1;let cursor=-1;
  while(cursor<lastNo){
   if(isAborted())throw Error('F48: cancelled');
   const page=await request('/rest/v1/rpc/brz_api_f48_source_page',{
    method:'POST',token,body:{p_source_name:source,p_after_no:cursor,p_limit:LIMIT}});
   if(!Array.isArray(page)||!page.length||page.length>LIMIT)throw Error('F48: '+source+' missing page');
   for(const fragment of page){
    if(!fragment||Number(fragment.part_no)!==cursor+1||typeof fragment.part_text!=='string'||
      !/^[a-f0-9]{64}$/.test(fragment.sha256_hex||'')||
      encoder.encode(fragment.part_text).byteLength!==Number(fragment.utf8_bytes)||
      await sha256(fragment.part_text)!==fragment.sha256_hex)
      throw Error('F48: '+source+' fragment SHA or sequence incorrect');
    fragments.push(fragment.part_text);cursor++;
   }
   if(cursor>lastNo)throw Error('F48: '+source+' has unexpected extra chunks');
   onProgress(source,cursor+1,ref.part_count);
  }
  const raw=fragments.join('');
  if(encoder.encode(raw).byteLength!==ref.utf8_bytes||
     await sha256(raw)!==ref.sha256_hex)
    throw Error('F48: '+source+' source bytes differ from original V4FQ');
  let parsed;try{parsed=JSON.parse(raw)}catch{throw Error('F48: '+source+' invalid JSON');}
  validateRecord(source,parsed,ref);
  out[source]=raw;
 }
 return Object.freeze({sources:Object.freeze(out),ready:true,writes:0,
  productionApproved:false});
}
