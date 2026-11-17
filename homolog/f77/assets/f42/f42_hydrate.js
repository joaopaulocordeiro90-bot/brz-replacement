/* F42: sealed, read-only V4FQ dataDeals hydration from the F41 source.
 * No fetch credentials, no data, no localStorage, no commercial records inside code.
 */
(()=>{'use strict';
const COUNT=2820;
const IDS_SHA='4bf7919ade0d4dfddc2cf335d5b52c374ca777135a9778778c0e67f7e5362405';
const RECORDS_SHA='2fd006dc58e37cfbd5941721d86529c823f25f2bbe0a7abe92484c17422203e6';
function stableStringify(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';
}
async function hydrate(resp,trades,sha256){
 const r=Array.isArray(resp)?resp[0]:resp;
 if(!r||r.snapshot_id!=='V4FQ_2026_11_13'||Number(r.deal_count)!==COUNT||
    !Array.isArray(r.ordered_deal_ids)||r.ordered_deal_ids.length!==COUNT||
    r.ordered_ids_sha256!==IDS_SHA||r.ordered_records_sha256!==RECORDS_SHA)
    throw Error('F42: inventário histórico não certificado');
 if(!Array.isArray(trades)||trades.length!==4011||typeof sha256!=='function')
    throw Error('F42: histórico F41 indisponível');
 const ids=r.ordered_deal_ids,seen=new Set();
 const map=new Map(trades.map(x=>[x?.id,x]));
 if(map.size!==4011)throw Error('F42: duplicidade no histórico principal');
 const records=[];
 for(const id of ids){
  if(typeof id!=='string'||!id||seen.has(id)||!map.has(id))
   throw Error('F42: seleção ausente, duplicada ou corrompida');
  seen.add(id);records.push(map.get(id));
 }
 if(await sha256(JSON.stringify(ids))!==IDS_SHA)
  throw Error('F42: ordem histórica divergente');
 if(await sha256(stableStringify(records))!==RECORDS_SHA)
  throw Error('F42: conteúdo da seleção não corresponde à V4FQ');
 return records;
}
window.__BRZF42_HYDRATE=hydrate;
})();
