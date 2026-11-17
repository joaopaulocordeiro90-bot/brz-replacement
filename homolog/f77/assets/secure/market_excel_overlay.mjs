/* BRZ F64 — Daily Excel source overlay. Authenticated Supabase gzip.
   No private market quotes are stored in the public repository. */
const ISO=/^20\d{2}-\d{2}-\d{2}$/;
const clean=x=>String(x??'').trim();
const n=x=>{const v=Number(x);return clean(x)!==''&&Number.isFinite(v)?v:null;};
const positive=x=>n(x)!==null&&n(x)>=0;
const ptProd=Object.freeze({Soybean:'Soja',Corn:'Milho',Sorghum:'Sorgo'});
function month(s){
 const m=clean(s).match(/^([A-Za-z]{3})[- ](\d{2})$/);
 if(!m)return null;
 const mons={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
 const k=m[1].charAt(0).toUpperCase()+m[1].slice(1).toLowerCase();
 return mons[k]===undefined?null:{month:mons[k],year:2000+Number(m[2])};
}
function shiftShipment(raw,increment){
 const x=month(raw);if(!x)return null;
 const d=new Date(Date.UTC(x.year,x.month+increment,1));
 return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]+'-'+String(d.getUTCFullYear()).slice(-2);
}
function normalizedDays(pack){
 if(pack?.sheets&&typeof pack.sheets==='object'){
  return Object.fromEntries(Object.entries(pack.sheets).map(([k,rows])=>[k,{[pack.as_of]:rows}]));
 }
 if(pack?.records&&typeof pack.records==='object')return pack.records;
 throw Error('Pacote Excel sem abas ou datas.');
}
function acceptedValue(x,where){
 if(!positive(x))throw Error('Cotação inválida em '+where);
 return Number(x);
}
export function projectExcel(pack){
 if(!pack||!ISO.test(pack.as_of)||!/^[a-f0-9]{64}$/.test(pack.file_sha256||''))
  throw Error('Excel F64: proveniência ausente.');
 const days=normalizedDays(pack),map=new Map();
 let rawQuotes=0,rawBasis=0,rawOcean=0,rawDeriv=0,notQuotedMeal=0,notQuotedOil=0;
 for(const [day,rows] of Object.entries(days.prices||{})){
  if(!ISO.test(day)||!Array.isArray(rows)||day>pack.as_of)throw Error('Data física inválida.');
  for(const r of rows){
   if(!Array.isArray(r)||r.length!==5||!ptProd[r[0]]||
       !['Bid','Offer'].includes(r[2])||(r[4]!==null&&r[4]!==''&&!month(r[4])))throw Error('Registro físico inválido.');
   const price=acceptedValue(r[3],'físico '+day);
   const key=JSON.stringify([day,r[0],r[1],r[4]]),v=map.get(key)||{date:day,product:r[0],city:clean(r[1]),shipment:r[4]};
   if(Object.prototype.hasOwnProperty.call(v,r[2]))throw Error('Bid/offer duplicado para '+key);
   v[r[2]]=price;map.set(key,v);rawQuotes++;
  }
 }
 const physical=[],physicalRaw=[...map.values()];
 for(const x of physicalRaw){
  if(!positive(x.Bid)||!positive(x.Offer))throw Error('Par bid/offer incompleto em '+x.city);
  const code=x.date.replaceAll('-',''),key=[code,x.product,x.city,x.shipment].join('|');
  const id='pxlsx_'+code+'_'+(physical.length+1).toString().padStart(4,'0');
  // Prices in the original 2026 BRZ physical table are R$/sc.
  // Excel's technical column heading says BRL/ton: flag that discrepancy,
  // preserve both bid and offer, and never multiply by 16.667.
  physical.push({id,data:x.date,produto:ptProd[x.product],origem:x.city,
   preco:(x.Bid+x.Offer)/2,precoLado:'mid',
   bid:x.Bid,offer:x.Offer,janelaFisica:x.shipment||'N/D',
   embarque:x.shipment?shiftShipment(x.shipment,1):null,embarqueIndicativo:!!x.shipment,
   janelaFisicaPendente:!x.shipment,
   precoMoeda:'BRL',unidadePreco:'R$/sc',unidadeCabecalhoOriginal:'BRL/ton',
   fonteBase:'Preços',fontePlanilha:pack.source_file||'Excel 16/11/2026',
   fonteRef:'BRZ_XLSX_F64',importacaoSHA256:pack.file_sha256,
   registroFonte:key,precoOrig:'Bid '+x.Bid+' / Offer '+x.Offer+' — média, R$/sc conforme padrão histórico BRZ',
   cbot:null,cambio:null,volume:0});
 }
 const basis=[],seenBasis=new Set();
 for(const [day,rows] of Object.entries(days['Basis FOB']||{})){
  if(!ISO.test(day)||!Array.isArray(rows)||day>pack.as_of)throw Error('Data FOB inválida');
  for(const r of rows){
   if(!Array.isArray(r)||r.length!==8||!['bid','offer'].includes(r[6])||
       !/^(?:\d{2}|\d{2}\|\d{2})-20\d{2}$/.test(r[4]))throw Error('Basis inválido.');
   const key=[r[1],r[0],r[3],r[4],r[6]].join('|'),
    dayNum=Number(day.replaceAll('-','')),value=Number(r[7]);
   if(!Number.isFinite(value)||seenBasis.has(key+'|'+day))throw Error('Duplicidade ou basis inválido');
   seenBasis.add(key+'|'+day);
   basis.push({key,day:dayNum,value,product:r[1],port:r[0],typ:r[3],shipment:r[4],side:r[6],source_code:r[2]});
   rawBasis++;
  }
 }
 const derivatives=[];let seqCma=0;
 for(const [day,rows] of Object.entries(days['Derivados CMA']||{})){
  if(!ISO.test(day)||!Array.isArray(rows)||day>pack.as_of)throw Error('Data CMA inválida.');
  for(const r of rows){
   if(!Array.isArray(r)||r.length!==3||!['Soymeal','Soyoil'].includes(r[2]))throw Error('CMA inválido');
   const val=acceptedValue(r[1],'CMA');
   rawDeriv++;
   // Original V4FS 16/11: 21 Soymeal zero cells mean N/D, not R$ 0/t.
   // Keep the source-row count for SHA/count reconciliation, but exclude
   // unavailable prices from numeric charts, replacement and last-price displays.
   if(val===0){if(r[2]==='Soymeal')notQuotedMeal++;else notQuotedOil++;continue;}
   // CMA may have multiple distinct quotations for one city/product/day.
   // Preserve each source observation and its order, never collapse by location.
   derivatives.push({d:day,o:r[0],v:[val],p:r[2],_brzExcelF64:true,_brzExcelSeq:++seqCma});
  }
 }
 const ocean=[],seenOcean=new Set();
 for(const [day,rows] of Object.entries(days['frete maritimo']||{})){
  if(!ISO.test(day)||!Array.isArray(rows)||day>pack.as_of)throw Error('Data marítima inválida.');
  for(const r of rows){
   if(!Array.isArray(r)||r.length!==3||!clean(r[0])||
     !(r[1]==='CONT'||ISO.test(r[1])))throw Error('Frete marítimo inválido');
   const value=acceptedValue(r[2],'frete marítimo'),key=[day,r[0],r[1]].join('|');
   if(seenOcean.has(key))throw Error('Frete marítimo duplicado');
   seenOcean.add(key);ocean.push({day,route:r[0],shipment:r[1],value});rawOcean++;
  }
 }
 physical.sort((a,b)=>a.data.localeCompare(b.data)||a.origem.localeCompare(b.origem));
 derivatives.sort((a,b)=>a.d.localeCompare(b.d));
 return {as_of:pack.as_of,sourceFile:pack.source_file,sourceSha:pack.file_sha256,
   physical,physicalRaw,basis,derivatives,ocean,
   counts:{physicalBidOffer:rawQuotes,physicalMid:physical.length,basis:rawBasis,
     ocean:rawOcean,derivatives:rawDeriv,
     derivativesQuoted:derivatives.length,soymealNotQuoted:notQuotedMeal,soyoilNotQuoted:notQuotedOil,
     sourceTotal:rawQuotes+rawBasis+rawOcean+rawDeriv}};
}
export async function decodeExcelArchive(archive){
 if(!archive?.available)return null;
 if(!ISO.test(archive.snapshot_day)||!/^[a-f0-9]{64}$/.test(archive.file_sha256||'')||
   typeof archive.compressed_b64!=='string'||archive.compressed_b64.length>200000)
   throw Error('Cabeçalho do pacote Excel inválido.');
 const b64=archive.compressed_b64.replace(/\s+/g,'');
 const raw=atob(b64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 if(bytes.length<30||bytes.length>100000||bytes[0]!==31||bytes[1]!==139)
  throw Error('Carga compactada inválida.');
 if(archive.gzip_sha256){
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))
   .map(x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==archive.gzip_sha256)throw Error('SHA-256 compactado divergente.');
 }
 if(typeof DecompressionStream!=='function')throw Error('Navegador sem suporte à leitura gzip.');
 const str=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 if(new TextEncoder().encode(str).length!==Number(archive.raw_size_bytes))
   throw Error('Tamanho de origem divergente.');
 const pack=JSON.parse(str);
 if(pack.file_sha256!==archive.file_sha256||pack.as_of!==archive.snapshot_day)
   throw Error('Arquivo ou data divergente.');
 const projected=projectExcel(pack);
 if(projected.counts.sourceTotal!==Number(archive.record_count))
   throw Error('Quantidade de cotações divergente.');
 return projected;
}
export function mergeBasisSeries(original,entries){
 if(!original||!original.series)throw Error('Séries FOB não carregadas.');
 const result=structuredClone(original);
 result.meta={...(result.meta||{}),ultimaData:{...(result.meta?.ultimaData||{})}};
 for(const x of entries){
  const dt=String(x.day).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
  if(dt>(result.meta.ultimaData[x.product]||''))result.meta.ultimaData[x.product]=dt;
  const src=result.series[x.key]||[],i=src.findIndex(pair=>Number(pair[0])===x.day);
  if(i<0)src.push([x.day,x.value]);else src[i]=[x.day,x.value];
  src.sort((a,b)=>Number(a[0])-Number(b[0]));result.series[x.key]=src;
 }
 return result;
}
export function mergeCMA(original,entries){
 if(!original||!Array.isArray(original.rows))throw Error('CMA não carregado.');
 // Only remove a previous instance of THIS Excel import; never delete
 // historic CMA observations with the same city/product/day.
 const rows=original.rows.filter(x=>x?._brzExcelF64!==true);
 return {...original,rows:[...rows,...entries]};
}
export function mergePrices(original,entries){
 if(!Array.isArray(original))throw Error('Preço físico não carregado.');
 const map=new Map(original.map((x,i)=>[x.id,i]));const rows=original.slice();
 for(const x of entries){
  if(map.has(x.id))rows[map.get(x.id)]=x;
  else{map.set(x.id,rows.length);rows.push(x);}
 }
 return rows;
}
const monthLabel=iso=>{
 if(iso==='CONT')return 'CONT';
 const x=String(iso).match(/^(20\d{2})-(\d{2})-01$/);
 if(!x)return null;
 return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(x[2])-1]+'-'+x[1].slice(-2);
};
function corridor(route){
 const s=clean(route);
 if(/ARG|^\[USA\]/.test(s))return null;
 const port=/Paranagua|Paranaguá/i.test(s)?'Paranaguá':/Itaqui/i.test(s)?'Itaqui':/Barcarena/i.test(s)?'Barcarena':/Santos/i.test(s)?'Santos':null;
 const product=/SOYB/i.test(s)?'soja':/CORN/i.test(s)?'milho':null;
 const dest=/S\.KOREA/i.test(s)?'Coreia do Sul':/Malay/i.test(s)?'Malásia':/EGT/i.test(s)?'Egito':/N\.CN|N\. CN|S\.CN/i.test(s)?'China':/S\.ESP/i.test(s)?'Espanha':null;
 if(!port||!product||!dest)return null;
 // Avoid changing the standard soybean monthly benchmark using a different
 // charter size: keep 66k Santos, 63k Paranaguá and 66k Itaqui.
 if(product==='soja'&&!(/Santos>N\.CN 66k\/10 SOYB KMX|Paranagua>N\.CN 63k\/10% SOYB KMX|Itaqui>N\. CN 66k\/10 SOYB KMX/i.test(s)))return null;
 return {product,port,dest};
}
export function mergeOcean(original,entries){
 const output={...(original||{})},annual=Object.create(null);
 for(const key of ['oceanFreightMonthly','oceanFreightCornMonthly'])
  output[key]=structuredClone(original?.[key]||{});
 for(const q of entries){
  (annual[q.day]??=[]).push([q.route,q.shipment,q.value]);
  const m=corridor(q.route),month=monthLabel(q.shipment);
  if(!m||!month)continue;
  const target=m.product==='soja'?'oceanFreightMonthly':'oceanFreightCornMonthly';
  const root=output[target];
  root[q.day]??={};root[q.day][m.dest]??={};root[q.day][m.dest][m.port]??={};
  root[q.day][m.dest][m.port][month]=q.value;
 }
 output.marketExcelOceanRoutes=annual;
 return output;
}
export function basisReferences(entries){
 return entries.filter(x=>x.side==='bid'&&['Soybean','Corn'].includes(x.product))
 .map(x=>({product:x.product,port:x.port,shipment:x.shipment,typ:x.typ,day:x.day,value:x.value}));
}
