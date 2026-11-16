/* BRZ F44 — immutable V4FQ curves & FOB-basis authenticated source reconciliation.
 * No credentials, commercial data, storage or write APIs. The caller supplies a
 * mesa/admin JWT-backed request function; never falls back to unprotected JSON.
 */
export const F44_REFERENCE=Object.freeze({
 curves:16418,cbot:10138,dol:6280,
 basisPoints:107184,basisSeries:1405,
 curvesLedger:'c22248e970346dcb0a7c67781dfe471bbf3939c0b12451df655026978ac3679c',
 basisLedger:'108b3305584f76462bfc11d8dc69aa62728a3cd881e22ee0e574fce2f21942fa',
 curvesStable:'38a3a659c4c46a726ac8188ab2a7a0984c39b6baaa99a06463891cc3b34e300e',
 basisStable:'e91ee638b1ec0524246caa304f857edce919b286af5f384dfea8edc2512a59bf'
});
const PAGE_SIZE=4000;
function stableStringify(o){
 if(o===null||typeof o!=='object')return JSON.stringify(o);
 if(Array.isArray(o))return '['+o.map(stableStringify).join(',')+']';
 return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+stableStringify(o[k])).join(',')+'}';
}
function checkMeta(meta,ref){
 if(!meta||typeof meta!=='object'||!Array.isArray(meta.cbotContracts)||
    !Array.isArray(meta.dolContracts)||!Array.isArray(meta.basisKeys)||
    meta.cbotContracts.length!==46||meta.dolContracts.length!==47||
    meta.basisKeys.length!==ref.basisSeries||
    new Set(meta.cbotContracts).size!==46||new Set(meta.dolContracts).size!==47||
    new Set(meta.basisKeys).size!==ref.basisSeries||
    !meta.curvesMeta||!meta.basisMeta)
  throw Error('F44: private source index manifest invalid');
}
async function readDomain(domain,{request,token,onProgress,isAborted},ref){
 const expected=domain==='curves'?ref.curves:ref.basisPoints;
 const out=[];let cursor=0;
 // Bounded by the F34 page size; no SQL write and no fallback to local prices.
 const maxPages=Math.ceil(expected/PAGE_SIZE)+2;
 for(let i=0;i<maxPages;i++){
  if(isAborted())throw Error('F44: historical read interrupted');
  const page=await request('/rest/v1/rpc/brz_api_f34_market_page',{
   method:'POST',token,body:{p_domain:domain,p_after_row_no:cursor,p_limit:PAGE_SIZE,p_from_date:null}});
  if(!Array.isArray(page)||page.length>PAGE_SIZE||page.length===0)
   throw Error('F44: missing or invalid '+domain+' page');
  for(const row of page){
   if(row?.domain!==domain||!Number.isSafeInteger(Number(row.row_no))||
      Number(row.row_no)<=cursor||!row.record_json||
      typeof row.record_json!=='object'||Array.isArray(row.record_json)||
      typeof row.source_key!=='string'||!/^[a-f0-9]{64}$/.test(row.record_fingerprint||''))
    throw Error('F44: invalid '+domain+' source identity');
   cursor=Number(row.row_no);out.push(row.record_json);
  }
  if(out.length>expected)throw Error('F44: excessive '+domain+' rows');
  onProgress(domain,out.length,expected);
  if(page.length<PAGE_SIZE)break;
 }
 if(out.length!==expected)throw Error('F44: '+domain+' has '+out.length+'/'+expected+' points');
 return out;
}
export async function hydrateF44Market({request,token,sha256,manifest,
 onProgress=()=>{},isAborted=()=>false,reference=F44_REFERENCE}={}){
 if(typeof request!=='function'||typeof token!=='string'||token.length<30||
    typeof sha256!=='function'||typeof onProgress!=='function'||typeof isAborted!=='function')
  throw Error('F44: authenticated dependencies required');
 checkMeta(manifest,reference);
 const stats=await request('/rest/v1/rpc/brz_api_f34_market_counts',{token});
 if(!Array.isArray(stats)||stats.length!==6||stats.some(s=>s?.ready!==true))
  throw Error('F44: market census unavailable');
 for(const [domain,count] of [['curves',reference.curves],['basis_points',reference.basisPoints],['basis_series',reference.basisSeries]]){
  const x=stats.find(r=>r?.domain===domain);
  if(!x||Number(x.loaded_rows)!==count||Number(x.expected_rows)!==count)
   throw Error('F44: '+domain+' census mismatch');
 }
 const cbot=Object.create(null),dol=Object.create(null);
 for(const k of manifest.cbotContracts)cbot[k]=Object.create(null);
 for(const k of manifest.dolContracts)dol[k]=Object.create(null);
 const cSeen=new Set(), cRows=[];
 const curves=await readDomain('curves',{request,token,onProgress,isAborted},reference);
 let cbotCount=0,dolCount=0;
 for(const row of curves){
  const name=row.domain==='cbot_daily'?'cbot':row.domain==='dol_daily'?'dol':null;
  const dest=name==='cbot'?cbot:dol;
  const contract=row.contract,day=row.day,value=row.value;
  if(!name||typeof contract!=='string'||!Object.hasOwn(dest,contract)||
     typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||
     typeof value!=='number'||!Number.isFinite(value))
   throw Error('F44: invalid CBOT/DOL contract/date/value');
  const identity=name+'|'+contract+'|'+day;
  if(cSeen.has(identity))throw Error('F44: duplicate CBOT/DOL point');
  cSeen.add(identity);dest[contract][day]=value;
  cRows.push([row.domain,contract,day,value]);
  if(name==='cbot')cbotCount++;else dolCount++;
 }
 if(cbotCount!==reference.cbot||dolCount!==reference.dol)
  throw Error('F44: CBOT/DOL component counts diverge');
 // Restore chronological object-key insertion order required by legacy charts.
 for(const contracts of [cbot,dol])for(const contract of Object.keys(contracts)){
  const ordered=Object.entries(contracts[contract]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  contracts[contract]=Object.fromEntries(ordered);
 }
 cRows.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:a[2]<b[2]?-1:a[2]>b[2]?1:0);
 const curveLedger=cRows.map(r=>r.join('|')+'\n').join('');
 if(await sha256(curveLedger)!==reference.curvesLedger||
    await sha256(stableStringify({cbot,dol}))!==reference.curvesStable)
  throw Error('F44: CBOT/DOL original-source SHA mismatch');
 // CBOT/DOL passed independently. Do not expose partial data before all sources pass.
 const keys=manifest.basisKeys;
 const series=Object.create(null);
 for(const key of keys){if(typeof key!=='string'||!key)throw Error('F44: invalid basis key');series[key]=[];}
 const bSeen=new Set(),bRows=[];
 const points=await readDomain('basis_points',{request,token,onProgress,isAborted},reference);
 for(const row of points){
  const key=row.legacy_key,day=row.day,value=row.value;
  if(typeof key!=='string'||!Object.hasOwn(series,key)||
     !Number.isSafeInteger(day)||day<20000101||day>20991231||
     typeof value!=='number'||!Number.isFinite(value))
   throw Error('F44: invalid FOB basis key/date/value');
  const identity=key+'\u0000'+day;
  if(bSeen.has(identity))throw Error('F44: duplicate FOB basis date');
  bSeen.add(identity);series[key].push([day,value]);
  bRows.push([key,day,value]);
 }
 for(const value of Object.values(series)){
  if(!value.length)throw Error('F44: empty FOB basis series');
  value.sort((a,b)=>a[0]-b[0]);
 }
 bRows.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]-b[1]);
 const basisLedger=bRows.map(r=>r.join('|')+'\n').join('');
 if(await sha256(basisLedger)!==reference.basisLedger||
    await sha256(stableStringify({series}))!==reference.basisStable)
  throw Error('F44: FOB basis original-source SHA mismatch');
 return Object.freeze({curves:Object.freeze({meta:manifest.curvesMeta,cbot,dol}),
    basis:Object.freeze({meta:manifest.basisMeta,series}),
    counts:Object.freeze({curves:curves.length,basisPoints:points.length,
      basisSeries:keys.length}),ready:true,writes:0,productionApproved:false});
}
