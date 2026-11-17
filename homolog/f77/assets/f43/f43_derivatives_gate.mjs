/**
 * F43: read-only authenticated V4FQ derivatives source gate.
 * No source payload, credentials, trade writes or localStorage in this module.
 */
export const F43_DERIVATIVE_COUNT = 14235;
export const F43_DERIVATIVE_SOURCE_SHA256 = 'c78698a65efeb53ed2353945da144973d9b8526ad30d320b681d830c27c95dfb';
export const F43_DERIVATIVE_CANONICAL_SHA256 = '0a8e2fb18663af7c0b6444ee71f5369ac8d3e6c880c2025dfe1ca9bb319202e7';
const PAGE_SIZE=1500;
const MAX_PAGES=60;
const DOMAIN='derivatives';
function stableStringify(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';
}
function safeRow(row,prevCursor){
  const val=row?.record_json;
  const cursor=Number(row?.row_no);
  const seq=Number(val?.seq);
  if(!row||row.domain!==DOMAIN||!Number.isSafeInteger(cursor)||cursor<=prevCursor||
     !Number.isSafeInteger(seq)||seq<1||seq>F43_DERIVATIVE_COUNT||
     row.source_key!==String(seq)||!val||typeof val!=='object'||typeof val.day!=='string'||
     !/^\d{4}-\d{2}-\d{2}$/.test(val.day)||
     typeof val.location_text!=='string'||!val.location_text||
     typeof val.product!=='string'||!val.product||
     !Array.isArray(val.values_json)||!val.values_json.length||
     !val.values_json.every(v=>typeof v==='number'&&Number.isFinite(v))||
     !/^[a-f0-9]{64}$/.test(row.record_fingerprint||''))
    throw Error('F43: inconsistent derivative source row/order');
  return {cursor,seq,record:{d:val.day,o:val.location_text,p:val.product,v:val.values_json}};
}
export async function hydrateF43Derivatives({request,token,sha256,onProgress=()=>{},isAborted=()=>false}={}){
  if(typeof request!=='function'||typeof sha256!=='function'||
     typeof token!=='string'||token.length<30)
    throw Error('F43: authenticated dependencies are required');
  const stats=await request('/rest/v1/rpc/brz_api_f34_market_counts',{token});
  const source=Array.isArray(stats)&&stats.length===6&&stats.every(x=>x?.ready===true)
    ?stats.find(x=>x.domain===DOMAIN):null;
  if(!source||Number(source.expected_rows)!==F43_DERIVATIVE_COUNT||
     Number(source.loaded_rows)!==F43_DERIVATIVE_COUNT)
    throw Error('F43: derivative census mismatch');
  const bySequence=new Map();let cursor=0,pages=0;
  for(;pages<MAX_PAGES;pages++){
    if(isAborted())throw Error('F43: read interrupted');
    const page=await request('/rest/v1/rpc/brz_api_f34_market_page',{
      method:'POST',token,body:{p_domain:DOMAIN,p_after_row_no:cursor,
       p_limit:PAGE_SIZE,p_from_date:null}});
    if(!Array.isArray(page)||page.length>PAGE_SIZE)
      throw Error('F43: invalid market page');
    if(!page.length)break;
    for(const item of page){
      const matched=safeRow(item,cursor);
      if(bySequence.has(matched.seq))throw Error('F43: duplicate derivative sequence');
      bySequence.set(matched.seq,matched.record);cursor=matched.cursor;
    }
    onProgress(bySequence.size,pages+1);
    if(page.length<PAGE_SIZE)break;
  }
  if(pages>=MAX_PAGES||bySequence.size!==F43_DERIVATIVE_COUNT)
    throw Error('F43: derivative source is incomplete');
  // F34 row_no reflects INSERT order; 268 derivatives are not in original seq order.
  // The original financial engine requires the explicit immutable seq 1..14235.
  const rows=Array.from({length:F43_DERIVATIVE_COUNT},(_,i)=>bySequence.get(i+1));
  if(rows.some(r=>!r))throw Error('F43: missing original derivative sequence');
  const ledger=rows.map((r,i)=>[i+1,r.d,r.o,r.p,r.v.join(',')].join('|')+'\n').join('');
  if(await sha256(ledger)!==F43_DERIVATIVE_SOURCE_SHA256)
    throw Error('F43: derivative sequence SHA mismatch');
  if(await sha256(stableStringify(rows))!==F43_DERIVATIVE_CANONICAL_SHA256)
    throw Error('F43: derivative financial data SHA mismatch');
  return Object.freeze({rows:Object.freeze(rows),count:rows.length,
    verified:true,source:'F34_DERIVATIVES_JWT',writes:0,productionApproved:false});
}
