/** BRZ F47 — read-only premium history from protected PostgreSQL RPC.
 * Records are reconstructed and authenticated before app iframe initialization.
 * No new business records, production writes, or unsecured file fallback.
 */
export const F47_PREMIUM_COUNT=38;
export const F47_CANONICAL_SHA='d1386d45d1b258daffbb5c77cefbe4516cadc08cb90dc03b9074d4882150fc93';
function stable(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
}
export async function hydrateF47Premiums({request,token,sha256}={}){
 if(typeof request!=='function'||typeof sha256!=='function'||
    typeof token!=='string'||token.length<30)
   throw Error('F47: authenticated dependencies required');
 const rows=await request('/rest/v1/rpc/brz_api_f47_premiums_source',{
    method:'POST',body:{},token});
 if(!Array.isArray(rows)||rows.length!==F47_PREMIUM_COUNT)
   throw Error('F47: FOB premium record count mismatch');
 const parsed=[],days=new Set();
 for(let i=0;i<rows.length;i++){
  const row=rows[i];
  if(!row||Number(row.original_seq)!==i+1||typeof row.source_record!=='string')
    throw Error('F47: original premium order changed');
  let value;try{value=JSON.parse(row.source_record);}catch{throw Error('F47: premium record not JSON');}
  if(!value||typeof value!=='object'||Array.isArray(value)||
     typeof value.data!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value.data)||
     days.has(value.data)||!value.fobPaper||typeof value.fobPaper!=='object'||
     (value.bidCFRChina!==undefined && (value.bidCFRChina===null||typeof value.bidCFRChina!=='object'))||
     (value.trades!==undefined&&!Array.isArray(value.trades)))
    throw Error('F47: invalid premium source record');
  for(const each of Object.values(value.fobPaper)){
    if(!each||typeof each!=='object'||Array.isArray(each)||
      !['bid','offer'].every(k=>(each[k]===null||
        (typeof each[k]==='number'&&Number.isFinite(each[k])))))
      throw Error('F47: invalid FOB premium quotation');
  }
  days.add(value.data);parsed.push(value);
 }
 if(await sha256(stable(parsed))!==F47_CANONICAL_SHA)
   throw Error('F47: FOB premium price/order SHA mismatch');
 return Object.freeze({records:Object.freeze(parsed),count:parsed.length,
   verified:true,writes:0,productionApproved:false});
}
