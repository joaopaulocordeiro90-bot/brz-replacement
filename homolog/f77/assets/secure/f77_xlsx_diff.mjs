/* BRZ Replacement F77 — full pre-publication diff of a daily XLSX.
 * Immutable/source rows are never modified. Comparisons use the last
 * recorded observation of exactly the same city/product/month or FOB series.
 * Missing baseline is N/D — never interpreted as zero or an unchanged price.
 */
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const delta=(a,b)=>a===null||b===null?null:+(b-a).toFixed(4);
const dayKey=x=>String(x||'').replaceAll('-','');
const validValue=x=>Array.isArray(x)?finite(x[0]):finite(x);
export function compareDailyXlsx(projected,{physicalHistory=[],basisHistory=null,derivativeHistory=[],oceanHistory=null}={}){
 if(!projected||!/^20\d\d-\d\d-\d\d$/.test(projected.as_of||''))throw Error('F77: pacote sem data de origem');
 const changes=[],asof=projected.as_of,keyDate=dayKey(asof),physicalMap=new Map();
 for(const record of Array.isArray(physicalHistory)?physicalHistory:[]){
  if(!record||String(record.data||'')>=asof)continue;
  const key=[norm(record.produto),norm(record.origem),norm(record.janelaFisica)].join('|');
  const prev=physicalMap.get(key);
  if(!prev||String(record.data||'')>=String(prev.data||''))physicalMap.set(key,record);
 }
 for(const item of projected.physical||[]){
  const key=[norm(item.produto),norm(item.origem),norm(item.janelaFisica)].join('|');
  const prev=physicalMap.get(key),oldBid=finite(prev?.bid),oldOffer=finite(prev?.offer);
  changes.push({tab:'Preços',key:item.produto+' · '+item.origem+' · '+item.janelaFisica,
   oldDate:prev?.data||null,oldBid,newBid:finite(item.bid),bidDelta:delta(oldBid,finite(item.bid)),
   oldOffer,newOffer:finite(item.offer),offerDelta:delta(oldOffer,finite(item.offer)),
   status:prev?'comparado':'sem_referencia'});
 }
 const series=basisHistory?.series||{};
 for(const item of projected.basis||[]){
  const old=Array.isArray(series[item.key])?series[item.key]
    .filter(p=>Array.isArray(p)&&String(p[0])<keyDate&&Number.isFinite(Number(p[1])))
    .sort((a,b)=>Number(b[0])-Number(a[0]))[0]:null;
  const was=finite(old?.[1]),next=finite(item.value);
  changes.push({tab:'Basis FOB',key:item.key,oldDate:old?String(old[0]):null,
   oldValue:was,newValue:next,delta:delta(was,next),status:old?'comparado':'sem_referencia'});
 }
 const cmaMap=new Map(),cmaRows=Array.isArray(derivativeHistory)?derivativeHistory:[];
 for(const item of cmaRows){
  if(!item||String(item.d||'')>=asof)continue;
  const v=validValue(item.v);if(v===null||v===0)continue;
  const key=[norm(item.o),norm(item.p)].join('|');
  const prior=cmaMap.get(key);
  if(!prior||String(item.d||'')>=String(prior.d||''))cmaMap.set(key,{d:item.d,value:v});
 }
 for(const item of projected.derivatives||[]){
  const key=[norm(item.o),norm(item.p)].join('|'),prior=cmaMap.get(key);
  const was=finite(prior?.value),next=validValue(item.v);
  changes.push({tab:'Derivados CMA',key:item.p+' · '+item.o,oldDate:prior?.d||null,
   oldValue:was,newValue:next,delta:delta(was,next),status:prior?'comparado':'sem_referencia'});
 }
 for(const item of projected.ocean||[]){
  const history=oceanHistory&&typeof oceanHistory==='object'?oceanHistory:{};
  const key=item.route+'|'+item.shipment;
  // ocean routes may include multiple observations for the day. Only compare
  // exact route+shipment keys if archival entries explicitly provide that pair.
  const records=Object.entries(history).filter(([d,rows])=>d<asof&&Array.isArray(rows))
   .sort((a,b)=>b[0].localeCompare(a[0]));
  let prev=null,priorDay=null;
  for(const [d,rows] of records){
   const hit=rows.find(x=>Array.isArray(x)&&String(x[0])===item.route&&String(x[1])===item.shipment);
   if(hit){prev=finite(hit[2]);priorDay=d;break;}
  }
  changes.push({tab:'frete maritimo',key,oldDate:priorDay,
   oldValue:prev,newValue:finite(item.value),delta:delta(prev,finite(item.value)),
   status:priorDay?'comparado':'sem_referencia'});
 }
 const byTab=Object.create(null),counts={total:changes.length,comparado:0,sem_referencia:0,alterado:0,sem_alteracao:0};
 for(const item of changes){
  const t=byTab[item.tab]||(byTab[item.tab]={total:0,comparado:0,sem_referencia:0,alterado:0});
  t.total++;
  if(item.status==='sem_referencia'){counts.sem_referencia++;t.sem_referencia++;continue;}
  counts.comparado++;t.comparado++;
  const different=item.tab==='Preços'?item.bidDelta!==0||item.offerDelta!==0:item.delta!==0;
  if(different){counts.alterado++;t.alterado++;}else counts.sem_alteracao++;
 }
 return {schema:'BRZ_F77_XLSX_DIFF_V1',comparisonRule:'strictly_previous_date',date:asof,
  sourceSha256:projected.sourceSha||null,
  counts,byTab,changes,
  warnings:[
   'Nunca comparar uma observação com registros da mesma data de importação: usar somente datas anteriores.',
   'N/D indica referência histórica ausente, nunca preço zero.',
   'O valor do fechamento somente pode ser aceito se CBOT e dólar forem da mesma data.',
   'A comparação CMA por praça/produto é indicativa quando houver múltiplas cotações na mesma data.'
  ]};
}
