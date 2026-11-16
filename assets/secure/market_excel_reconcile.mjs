/* BRZ F66 — fixed-origin market price reconciliation.
 * Pure reconciliation: overlay the new bid/offer midpoint using the previous
 * official physical row for city, product and monthly window.
 * A historical daily CBOT/FX snapshot is never replaced with today's curve.
 * No closed deal, rail tariff or contracted freight is modified. */
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PT=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const LETTER='FGHJKMNQUVXZ';
const clean=s=>String(s??'').trim();
export const normalizeMarketCity=s=>clean(s).normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/\s*[-\/]\s*([a-z]{2})$/,'/$1').replace(/\s+/g,'');
const pnum=v=>v!==null&&v!==undefined&&clean(v)!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
const key=r=>[r.data,r.produto,normalizeMarketCity(r.origem),r.janelaFisica||'N/D'].join('|');
const byCity=r=>[r.produto,normalizeMarketCity(r.origem)].join('|');
const byLane=r=>[r.produto,normalizeMarketCity(r.origem),r.janelaFisica||'N/D'].join('|');
const byWindow=r=>[r.produto,r.janelaFisica||'N/D'].join('|');
export function physicalPeriod(raw){
 const x=clean(raw).match(/^([A-Za-z]{3})-(\d{2})$/);if(!x)return null;
 const m=MONTHS.indexOf(x[1].charAt(0).toUpperCase()+x[1].slice(1).toLowerCase());
 return m<0?null:{month:m,year:2000+Number(x[2])};
}
function physicalEnd(raw){
 const d=physicalPeriod(raw);return d?
 new Date(Date.UTC(d.year,d.month+1,0)).toISOString().slice(0,10):null;
}
function shiftPhysical(raw){
 const d=physicalPeriod(raw);if(!d)return null;
 const v=new Date(Date.UTC(d.year,d.month+1,1));
 return MONTHS[v.getUTCMonth()]+'-'+String(v.getUTCFullYear()).slice(-2);
}
function sameOrEarlier(old,day){return old&&old.data<=day;}
function latest(rows,day){return (rows||[]).filter(x=>sameOrEarlier(x,day)).at(-1)||null;}
function defaultSeason(prod,window){
 const m=physicalPeriod(window);if(!m)return {safra:null,safraKey:null,disponivel:null};
 if(prod==='Soja'){
  // The Brazilian soybean crop year ends in the physical delivery year:
  // NOV/26 is old crop 25/26; JAN/27 is new crop 26/27.
  const start=m.year-1,end=m.year;
  return {safra:'Soja '+String(start).slice(-2)+'/'+String(end).slice(-2),
   safraKey:String(start).slice(-2)+'_'+String(end).slice(-2),disponivel:m.month<1};
 }
 if(prod==='Milho'){
  // July onward is safrinha of the same calendar year, including December.
  const safrinha=m.month>=6;
  return safrinha?
   {safra:'Milho Safrinha '+m.year,safraKey:'safrinha_'+m.year,disponivel:false}:
   {safra:'Milho '+String(m.year-1).slice(-2)+'/'+String(m.year).slice(-2),
    safraKey:String(m.year-1).slice(-2)+'_'+String(m.year).slice(-2),disponivel:m.month<1};
 }
 return {safra:null,safraKey:null,disponivel:null};
}
function isMarketTemplate(row){return row&&row.produto&&row.data&&row.origem&&pnum(row.preco)!==null;}
export function reconcileMarketPrices(historical,imported,curveCapture,resolvers={},manualEdits={}){
 if(!Array.isArray(historical)||!Array.isArray(imported))throw Error('F66: histórico físico indisponível.');
 const originals=historical.filter(isMarketTemplate);
 const byExact=new Map(),byLane=new Map(),byPlaceProd=new Map(),byProdWindow=new Map(),
  historicalCBOT=new Map(),historicalFX=new Map();
 const push=(map,k,r)=>{if(!map.has(k))map.set(k,[]);map.get(k).push(r);};
 for(const h of originals){
  push(byExact,key(h),h);push(byLane,byLaneKey(h),h);push(byPlaceProd,byCity(h),h);
  push(byProdWindow,byWindow(h),h);
  if(pnum(h.cbot)!==null&&h.vencCBOT)
   historicalCBOT.set([h.data,h.produto,h.vencCBOT].join('|'),pnum(h.cbot));
  if(pnum(h.cambio)!==null&&h.vencCambio)
   historicalFX.set([h.data,h.vencCambio].join('|'),pnum(h.cambio));
 }
 for(const m of [byExact,byLane,byPlaceProd,byProdWindow]){
  for(const rows of m.values())rows.sort((a,b)=>a.data.localeCompare(b.data)||String(a.id||'').localeCompare(String(b.id||'')));
 }
 const live=curveCapture?.curves||{},liveDate=clean(curveCapture?.source_date);
 const status={sourceRows:imported.length,matchedExisting:0,inserted:0,
  revisedPrevious:0,readyCurrent:0,missingCorridor:0,missingCurve:0,unknownSeason:0};
 const out=[];
 for(const r of imported){
  const d=clean(r.data),prod=r.produto,loc=normalizeMarketCity(r.origem),p=clean(r.janelaFisica);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!['Soja','Milho','Sorgo'].includes(prod)||
      !(pnum(r.preco)>0)||!loc)throw Error('F66: cotação física sem identidade ou preço.');
  const exact=latest(byExact.get(key(r)),d);
  // Same city and same product are fixed commercial lanes. Do not substitute
  // a route from another municipality when the lane has no history.
  const laneRef=latest(byLane.get([prod,loc,p||'N/D'].join('|')),d);
  const placeProd=latest(byPlaceProd.get([prod,loc].join('|')),d);
  const periodReference=latest(byProdWindow.get([prod,p||'N/D'].join('|')),d);
  const sameDay=exact?.data===d?exact:null;
  // Never borrow the road corridor from another commodity, even in the same city.
  // The established city/product/physical-window lane outranks a generic city template.
  const routeRef=sameDay||laneRef||placeProd;
  const seasonRef=sameDay||laneRef||periodReference;
  const season=seasonRef?.safra&&seasonRef?.safraKey?
   {safra:seasonRef.safra,safraKey:seasonRef.safraKey,disponivel:seasonRef.disponivel}:
   defaultSeason(prod,p);
  // The daily sheet's default next-month shipment is only a fallback.
  // Preserve same-month and other approved lanes from the prior physical series.
  const shipment=sameDay?.embarque||laneRef?.embarque||r.embarque||shiftPhysical(p);
  const originalCBOT=sameDay?.vencCBOT||laneRef?.vencCBOT||null;
  const viaRules=typeof resolvers.cbotContract==='function'&&shipment?
   resolvers.cbotContract(prod,shipment,d):null;
  const cbotContract=viaRules||originalCBOT||
   (periodReference?.embarque===shipment?periodReference?.vencCBOT:null);
  const viaDol=typeof resolvers.dolContract==='function'&&shipment?
   resolvers.dolContract(shipment):null;
  const fxContract=viaDol||sameDay?.vencCambio||
   (laneRef?.embarque===shipment?laneRef?.vencCambio:null)||
   (periodReference?.embarque===shipment?periodReference?.vencCambio:null);
  let cbot=null,fx=null,sourceCbot='',sourceFX='';
  if(d===liveDate){
   const bucket=prod==='Soja'?live.cbot:live.cbotMilho;
   cbot=pnum(bucket?.[cbotContract]);sourceCbot='Desk CBOT '+liveDate+' C'+curveCapture.capture_no;
   const k=String(fxContract||'').match(/^DOL([FGHJKMNQUVXZ])(\d{2})$/);
   const dolKey=k?PT[LETTER.indexOf(k[1])]+k[2]:null;
   fx=pnum(live.dolar?.[dolKey]);sourceFX='B3 DOL '+liveDate+' C'+curveCapture.capture_no;
  }else{
   cbot=pnum(sameDay?.cbot)||historicalCBOT.get([d,prod,cbotContract].join('|'))||null;
   fx=pnum(sameDay?.cambio)||historicalFX.get([d,fxContract].join('|'))||null;
   sourceCbot=sameDay?.curvaCbotData||'CBOT histórico da data '+d;
   sourceFX=sameDay?.curvaCambioData||'DOL histórico da data '+d;
  }
  // An exact historical record retains its original ID and all non-price
  // commercial fields. Data from the new Excel changes only the bid/offer price.
  const result={...(sameDay||{}),...(r||{}),
   id:sameDay?.id||r.id,
   safra:season.safra||null,safraKey:season.safraKey||null,
   corredor:routeRef?.corredor||null,
   disponivel:season.disponivel??(p?false:null),
   origem:routeRef?.origem||r.origem,
   retirada:sameDay?.retirada||laneRef?.retirada||physicalEnd(p),
   embarque:shipment||null,janelaFisica:p||'N/D',
   preco:r.preco,precoLado:'mid',volume:0,
   cbot:cbot,cambio:fx,vencCBOT:cbotContract||null,
   vencFreteCBOT:cbotContract||null,vencCambio:fxContract||null,
   curvaCbotFonte:cbotContract||null,
   curvaCbotData:sourceCbot,curvaCambioData:sourceFX,
   premio:sameDay?.premio??0,fonteBase:'Preços',
   regFonte:'excel:F66|capture:'+(d===liveDate?curveCapture.capture_no:'historico'),
   fontePlanilha:r.fontePlanilha,
   mercadoSomenteIndicativo:true,marketSnapshotLocked:true,
   excelSourceDate:d,excelTemplateId:routeRef?.id||null,
   precoOrig:'Bid '+r.bid+' / Offer '+r.offer+' → R$ '+r.preco+'/sc (média); '+d+
     ' · base histórica/curva específica da data; não é trade'
  };
  if(sameDay){
   status.matchedExisting++;
   if(Math.abs(Number(sameDay.preco)-Number(r.preco))>0.001){
    status.revisedPrevious++;result.precoAnteriorPlanilha=Number(sameDay.preco);
    result.fontePlanilhaAnterior=sameDay.fontePlanilha||null;
   }
  }else status.inserted++;
  const edits=manualEdits?.[result.id];
  if(edits&&typeof edits==='object'&&pnum(edits.preco)!==null){
   result.precoEditadoPelaMesa=true;
   result.preco=Number(edits.preco);
   result.precoOrig+=' · ajuste manual da mesa preservado';
  }
  result.fonteStatus=cbot&&fx&&result.corredor&&result.safra&&result.retirada&&result.embarque?
   'COMPLETO_INDICATIVO':'REFERENCIA_NAO_DISPONIVEL';
  if(!result.corredor)status.missingCorridor++;
  if(!cbot||!fx)status.missingCurve++;
  if(!result.safra)status.unknownSeason++;
  if(d===liveDate&&result.fonteStatus==='COMPLETO_INDICATIVO')status.readyCurrent++;
  out.push(result);
 }
 return {rows:out,status,sourceDay:liveDate,captureNo:curveCapture?.capture_no||null};
}
export function mergeReconciledMarketPrices(history,updates){
 if(!Array.isArray(history)||!Array.isArray(updates))throw Error('F66: linhas inválidas');
 const result=history.slice(),byId=new Map(),byIdentity=new Map();
 for(let i=0;i<result.length;i++){
  const r=result[i];if(r?.id)byId.set(r.id,i);
  if(r?.data&&r?.produto&&r?.origem)
   byIdentity.set(key(r),i);
 }
 for(const r of updates){
  const idx=byIdentity.get(key(r))??byId.get(r.id);
  if(idx===undefined){
   byId.set(r.id,result.length);byIdentity.set(key(r),result.length);result.push(r);
  }else{
   // The imported record replaces only the current visible market row, not
   // the immutable original source, which remains inside dataPrecos.
   result[idx]={...result[idx],...r};
  }
 }
 return result;
}
