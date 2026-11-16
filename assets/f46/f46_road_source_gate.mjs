/** BRZ F46: immutable V4FQ road freight hydration. Read-only RLS/RPC source.
 * No credentials, business rows or external data stored in this module.
 */
export const F46_ROAD_REFERENCE=Object.freeze({
 baseline:177687,s46:514,total:178201,routes:1045,weeks:535,
 originalWeek:'2026-S46',
 metadataSha:'e13e1863ae75fb4c897453a3d7becff91430630ecb7e0891270bd99e98bda06b',
 s46Sha:'597f39c1113159af487c72821cbcdcb9c1b456f3120926aa50c6ab588123f03f',
 dataSha:'d735141703d008a8466187c7f9010880d2409c83a1dd41f27ca3328bc9506357',
 fullSha:'ec7b1f86c7ba918595e94ff4d6d5637bf5c7d58cca4b402e5000d57711c4fa10'
});
const PAGE_SIZE=4000;
const tuple=(r)=>[r.origin_text,r.destination_text,r.iso_week];
const asPrice=(v)=>{
 if(typeof v==='number' && Number.isFinite(v) && v>=0) return v;
 if(typeof v==='string' && /^(0|[1-9]\d*)(\.\d+)?$/.test(v)){
  const x=Number(v);if(Number.isFinite(x)&&x>=0)return x;
 }
 throw Error('F46: invalid source road freight price');
};
const stable=(o)=>o===null||typeof o!=='object' ? JSON.stringify(o):
 Array.isArray(o) ? '['+o.map(stable).join(',')+']' :
 '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+stable(o[k])).join(',')+'}';
export {stable as stableStringifyF46};
export async function hydrateF46Road({request,token,sha256,manifest,onProgress=()=>{},isAborted=()=>false,reference=F46_ROAD_REFERENCE}={}){
 if(typeof request!=='function'||typeof sha256!=='function'||
    typeof token!=='string'||token.length<30||
    typeof onProgress!=='function'||typeof isAborted!=='function')
   throw Error('F46: authenticated dependencies required');
 if(!manifest||manifest.fmt!=='rodo-v1'||!Array.isArray(manifest.rotas)||
    !Array.isArray(manifest.semanas)||manifest.rotas.length!==reference.routes||
    manifest.semanas.length!==reference.weeks||
    manifest.semanas[reference.weeks-1]!==reference.originalWeek||
    !manifest.auditoriaV4ES||typeof manifest.regraSemana!=='string'||
    typeof manifest.fonte!=='string')throw Error('F46: private routing manifest not available');
 if(await sha256(stable(manifest))!==reference.metadataSha)
   throw Error('F46: original route-week metadata SHA mismatch');
 const routeIndex=new Map(),weekIndex=new Map();
 manifest.rotas.forEach((pair,i)=>{
  if(!Array.isArray(pair)||pair.length!==2||
      pair.some(x=>typeof x!=='string'||!x))throw Error('F46: invalid route index');
  const key=pair[0]+'\0'+pair[1];
  if(routeIndex.has(key))throw Error('F46: repeated route index');
  routeIndex.set(key,i);
 });
 manifest.semanas.forEach((week,i)=>{
  if(typeof week!=='string'||!/^20\d\d-S\d\d$/.test(week)||weekIndex.has(week))
    throw Error('F46: repeated or invalid freight week');
  weekIndex.set(week,i);
 });
 const baseline=[],seen=new Set();let cursor=null,pages=0;
 const maxPages=Math.ceil(reference.baseline/PAGE_SIZE)+2;
 while(pages<maxPages){
  if(isAborted())throw Error('F46: road loading interrupted');
  const rows=await request('/rest/v1/rpc/brz_api_f46_road_page',{
   method:'POST',token,body:{
    p_after_origin:cursor?.[0]??null,
    p_after_destination:cursor?.[1]??null,
    p_after_week:cursor?.[2]??null,p_limit:PAGE_SIZE}});
  if(!Array.isArray(rows)||rows.length>PAGE_SIZE||rows.length===0)
   throw Error('F46: missing or malformed road freight page');
  for(const row of rows){
   if(!row || typeof row.origin_text!=='string'||
      typeof row.destination_text!=='string'||typeof row.iso_week!=='string')
      throw Error('F46: invalid origin/destination/week');
   const route=routeIndex.get(row.origin_text+'\0'+row.destination_text);
   const week=weekIndex.get(row.iso_week);
   if(route===undefined||week===undefined||week>=reference.weeks-1)
      throw Error('F46: unexpected road route or freight week');
   const key=week*reference.routes+route;
   if(seen.has(key))throw Error('F46: duplicate historical route-week');
   seen.add(key);baseline.push([route,week,asPrice(row.value)]);
  }
  cursor=tuple(rows.at(-1));pages++;
  if(baseline.length>reference.baseline)throw Error('F46: road baseline contains extra rows');
  onProgress(baseline.length,reference.baseline,pages);
  if(rows.length<PAGE_SIZE)break;
 }
 if(pages>=maxPages||baseline.length!==reference.baseline)
   throw Error('F46: incomplete pre-S46 road freight history');
 // The original V4FQ rows are ordered by (week index, route index) up to S45.
 // Explicitly DO NOT sort S46, whose 514 rows have an intentionally distinct order.
 baseline.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
 const overlay=await request('/rest/v1/rpc/brz_api_f46_road_s46',{
  method:'POST',token,body:{}});
 if(!Array.isArray(overlay)||overlay.length!==reference.s46)
    throw Error('F46: S46 freight overlay incomplete');
 const s46Seen=new Set(),s46Ledger=[],s46=[];
 for(let i=0;i<overlay.length;i++){
  const row=overlay[i],position=Number(row?.original_position),
    index=Number(row?.route_index);
  if(!Number.isSafeInteger(position)||position!==i+1||
     !Number.isSafeInteger(index)||index<0||index>=reference.routes||
     row.source_week!==reference.originalWeek||s46Seen.has(index))
    throw Error('F46: S46 order/route identity altered');
  const value=asPrice(row.value_rs_t);
  s46Seen.add(index);s46.push([index,reference.weeks-1,value]);
  s46Ledger.push(position+'|'+index+'|'+String(value)+'\n');
 }
 if(await sha256(s46Ledger.join(''))!==reference.s46Sha)
   throw Error('F46: S46 original data SHA mismatch');
 const data=[...baseline,...s46];
 if(data.length!==reference.total||await sha256(stable(data))!==reference.dataSha)
   throw Error('F46: complete road history order/data mismatch');
 const obj={fmt:manifest.fmt,fonte:manifest.fonte,
   regraSemana:manifest.regraSemana,rotas:manifest.rotas,semanas:manifest.semanas,
   dados:data,auditoriaV4ES:manifest.auditoriaV4ES};
 if(await sha256(stable(obj))!==reference.fullSha)
   throw Error('F46: V4FQ road source canonical SHA mismatch');
 return Object.freeze({payload:obj,verified:true,source:'F46_RLS_JWT',
   count:data.length,preS46:reference.baseline,s46:reference.s46,
   writes:0,productionApproved:false});
}
