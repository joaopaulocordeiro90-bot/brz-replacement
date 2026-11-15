/** F45 private homologation: authenticated rail tariff hydration, no writes. */
export const F45_RAIL_COUNT = 39;
export const F45_RAIL_SHA256 = 'ed4767b50fe0c02af88bfc23da25f1599271ece60d6f0c2fa501e8c7a33f6715';
const months = Object.freeze(['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']);
export async function hydrateF45Rail({request,token,sha256}={}) {
  if(typeof request !== 'function' || typeof sha256 !== 'function' ||
     typeof token !== 'string' || token.length < 30) {
    throw Error('F45: authenticated session is required');
  }
  const data=await request('/rest/v1/rpc/brz_api_f45_rail_source',
    {method:'POST',body:{},token});
  if(!Array.isArray(data) || data.length !== F45_RAIL_COUNT) {
    throw Error('F45: missing historical rail tariffs');
  }
  const records=[],ledger=[];
  const unique=new Set();
  for(let i=0;i<data.length;i++){
    const row=data[i];
    if(!row || row.original_seq !== i+1 || typeof row.record_text !== 'string' ||
       row.record_text.length > 8000) {
       throw Error('F45: invalid rail sequence');
    }
    let record;
    try{record=JSON.parse(row.record_text);}catch{throw Error('F45: malformed rail record');}
    if(!record || typeof record !== 'object' || Array.isArray(record) ||
       !/^f\d{3}$/.test(record.id || '') || unique.has(record.id) ||
       typeof record.origem !== 'string' || !record.origem ||
       typeof record.destino !== 'string' || !record.destino ||
       typeof record.regiao !== 'string' ||
       typeof record.obs !== 'string' ||
       !record.meses || typeof record.meses !== 'object' ||
       Array.isArray(record.meses) || Object.keys(record.meses).length !== 12 ||
       !months.every(k=>typeof record.meses[k] === 'number' &&
             Number.isFinite(record.meses[k]))) {
       throw Error('F45: invalid rail economic input');
    }
    // Preserve serialized V4FQ source byte for byte. One historical rail
    // quote deliberately contains 105.0; JS JSON.stringify emits 105.
    // Do NOT rewrite original source or normalize it before SHA validation.
    // The full serialized-source ledger SHA is checked below.
    unique.add(record.id);records.push(record);
    ledger.push(String(row.original_seq)+'|'+row.record_text+'\n');
  }
  if(await sha256(ledger.join('')) !== F45_RAIL_SHA256) {
    throw Error('F45: original rail tariffs SHA diverged');
  }
  return Object.freeze({rows:Object.freeze(records),verified:true,count:records.length,
    writes:0,productionApproved:false});
}
