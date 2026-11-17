/* BRZ F77 — reconciliação financeira INDEPENDENTE / somente leitura.
 * Verifica TODOS os portos/modais calculados de cada negócio elegível da data.
 * O Excel não contém CBOT/FX: essas referências devem vir dos snapshots
 * autenticados. Sem cotação, rota ou modal verificável = NÃO homologado.
 * Nunca altera histórico, negócio, tarifa, projeção, snapshot ou replacement.
 */
const FACTORS={Soja:2.2046,Milho:2.3621,Sorgo:2.3621};
const TON_SC=0.06,EPS=0.005;
const num=x=>x===null||x===undefined||x===''?null:
 Number.isFinite(Number(x))?Number(x):null;
const fmt=x=>x===null?'N/D':Number(x).toFixed(4);
const nrm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const dateIs=x=>/^20\d\d-\d\d-\d\d$/.test(String(x||''));
const ok=v=>v!==null&&Number.isFinite(v);
const close=(a,b)=>ok(a)&&ok(b)&&Math.abs(a-b)<=EPS;
const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const ym=x=>{
 const m=String(x||'').match(/^([A-Za-z]{3})-(\d{2})$/);
 if(!m)return null;
 const index=months.indexOf(m[1].toLowerCase());
 return index<0?null:2000+Number(m[2])+(index/12);
};
export function isoWeekDay(date){
 if(!dateIs(date))return null;
 const d=new Date(date+'T00:00:00Z');
 if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==date)return null;
 const wd=(d.getUTCDay()+6)%7;
 d.setUTCDate(d.getUTCDate()-wd+3);
 const y=d.getUTCFullYear(),four=new Date(Date.UTC(y,0,4));
 four.setUTCDate(four.getUTCDate()-(four.getUTCDay()+6)%7);
 const w=1+Math.round((d-four)/604800000);
 return y+'-S'+String(w).padStart(2,'0');
}
const weekStart=s=>{
 const m=String(s||'').match(/^(20\d\d)-S(\d\d)$/);if(!m)return null;
 const year=Number(m[1]),w=Number(m[2]);if(w<1||w>53)return null;
 const fourth=new Date(Date.UTC(year,0,4));
 fourth.setUTCDate(fourth.getUTCDate()-(fourth.getUTCDay()+6)%7+7*(w-1));
 return +fourth;
};
const mode=x=>{
 const t=nrm(x);
 if(t==='rodoviario')return 'road';
 if(t.startsWith('ferroviario'))return 'rail';
 if(t==='rodo + ferro'||t==='rodo + ferrovia')return 'road_rail';
 if(t==='rodo + barcaca')return 'road_barge';
 if(t==='manual (total)')return 'manual';
 if(t==='composicao por lote')return 'multi_leg';
 return null;
};
const placeKey=x=>nrm(x).replace(/\s*[-/]\s*([a-z]{2})$/,'/$1').replace(/\s+/g,' ');
const exactKey=(o,d,w)=>placeKey(o)+'|'+nrm(d)+'|'+w;
export function buildRoadReferenceIndex(freights=[],date){
 const byKey=new Map(),week=isoWeekDay(date),asOf=weekStart(week);
 if(!Number.isFinite(asOf))return byKey;
 for(const row of Array.isArray(freights)?freights:[]){
  if(!row||row.tipo!=='Rodoviário'||!row.origem||!row.destino)continue;
  const at=weekStart(row.semana),value=num(row.valor);
  if(at===null||at>asOf||asOf-at>8*604800000||!ok(value)||value<=0)continue;
  const key=exactKey(row.origem,row.destino,String(row.semana));
  if(!byKey.has(key))byKey.set(key,value);
 }
 return byKey;
}
export function auditRouteParity(deal,route,{port=null,freightIndex=null}={}){
 const issues=[],cautions=[],checks={};
 const issue=(tag,explanation)=>issues.push({code:tag,details:explanation});
 const caution=(tag,explanation)=>cautions.push({code:tag,details:explanation});
 const factor=FACTORS[deal?.produto]??null,price=num(deal?.preco),fx=num(deal?.cambio);
 let cbot=num(deal?.cbot);
 if(port==='Santos'&&deal?.regraMilhoSantosDez2026?.tipo==='por_porto'&&
   num(deal.regraMilhoSantosDez2026.cbotSantosCbu)>0)
  cbot=num(deal.regraMilhoSantosDez2026.cbotSantosCbu);
 const fr=num(route?.freteRodo),ff=num(route?.freteFerro),
  fb=num(route?.freteBarcaca),ft=num(route?.freteTotal),
  fobbins=num(route?.fobbins),sea=num(route?.seaFreight),marketRef=num(route?.cfrRefCbot);
 if(!factor||!ok(price)||price<=0||price>300||!ok(fx)||fx<=0||fx>12||
    !ok(cbot)||cbot<=0)
  issue('ENTRADA_MERCADO','Físico R$/sc, CBOT c/bu, dólar e produto precisam de valores confirmados');
 if(!route||[fr,ff,fb,ft,fobbins,sea].some(x=>!ok(x)||x<0))
  issue('FRETE_INCOMPLETO','Faltam frete rodoviário/ferroviário/barcaça, fobbings ou marítimo');
 const modal=mode(route?.modal);
 const freightWeek=String(route?.freteSemana||'');
 if(!modal)issue('MODAL_DESCONHECIDO','Modal do motor não reconhecido: '+String(route?.modal||'N/D'));
 if(modal==='road'&&(ff>EPS||fb>EPS))issue('MODAL_TRECHO','Rota rodoviária contém ferrovia ou barcaça');
 if(modal==='rail'&&!(ff>0))issue('MODAL_TRECHO','Rota ferroviária sem tarifa ferroviária positiva');
 if(modal==='road_rail'&&!(ff>0))issue('MODAL_TRECHO','Rodoferroviário sem perna ferroviária positiva');
 if(modal==='road_barge'&&(!(fb>0)||ff>EPS))issue('MODAL_TRECHO','Rodo+barcaça sem barcaça ou com ferrovia');
 if(ok(ft)&&[fr,ff,fb].every(ok)){
  checks.freteTotal={esperado:fr+ff+fb,motor:ft};
  if(!close(ft,fr+ff+fb))issue('SOMA_FRETES','Frete total difere da soma de seus trechos');
 }
 if(factor&&ok(price)&&price>0&&ok(fx)&&fx>0&&ok(cbot)&&[fr,ff,fb,ft,fobbins,sea].every(ok)){
  // Cálculo INDEPENDENTE do motor. As unidades não podem ser misturadas:
  // físico R$/sc; fretes internos R$/t; FOBBINS/marítimo US$/t;
  // CBOT e basis c/bu. 1 t = 16,6667 sc; TON_SC=0.06 t/sc.
  const expectedPrice=100*(price/fx)/factor;
  const expectedFreight=100*(ft*TON_SC/fx)/factor;
  const expectedFobbins=100*(fobbins*TON_SC)/factor;
  const expectedSea=100*(sea*TON_SC)/factor;
  const expectedFOB=expectedPrice+expectedFreight+expectedFobbins;
  const expectedCFR=expectedFOB+expectedSea;
  const ref=ok(marketRef)&&marketRef>0?marketRef:cbot;
  const expected={
   _priceCbu:expectedPrice,_freightCbu:expectedFreight,
   _fobbinsCbu:expectedFobbins,_seaCbu:expectedSea,
   replacementFOB:expectedFOB,replacementBasis:expectedFOB-cbot,
   replacementCFR:expectedCFR,replacementCFRBasis:expectedCFR-ref
  };
  for(const [field,want] of Object.entries(expected)){
   const got=num(route[field]);
   checks[field]={esperado:want,motor:got,delta:ok(got)?got-want:null};
   if(!ok(got))issue('RESULTADO_AUSENTE',field+' sem resultado do motor');
   else if(!close(got,want))issue('DIVERGENCIA_CALCULO',field+': motor '+fmt(got)+' ≠ esperado '+fmt(want));
  }
  const oldFactor=num(route?._factor);
  if(!ok(oldFactor)||!close(oldFactor,factor))
   issue('FATOR_CONVERSAO','Fator de conversão CBOT incompatível com a commodity');
  for(const [bid,margin,basis] of [
   ['bidFOB','margemFOB',expected.replacementBasis],
   ['bidCFR','margemCFR',expected.replacementCFRBasis]
  ]){
   const b=num(route[bid]),m=num(route[margin]);
   if(ok(b)){
    checks[margin]={esperado:b-basis,motor:m};
    if(!ok(m)||!close(m,b-basis))issue('MARGEM_INCORRETA',margin+' difere de Bid − replacement basis');
   }else if(m!==null){
    issue('MARGEM_SEM_BID',margin+' calculada sem Bid identificado');
   }
  }
 }
 // Audit source provenance separately from the arithmetic. A good sum is
 // not evidence that the underlying truck/rail quote was the correct one.
 if(freightIndex instanceof Map&&modal&&['road','road_rail','road_barge'].includes(modal)&&fr>0){
  const source=String(route?.fonteFrete||'');
  const exactPrice=!(deal?.freteRodoMin>0)&&!/\+\s*\d+(?:[.,]\d+)?\s*km/i.test(String(deal?.origem||''));
  const isDirect=/^(semana_exata|semana_anterior)$/.test(source);
  if(isDirect&&exactPrice){
   const destination=modal==='road'?port:route?._transbordo;
   const quote=freightIndex.get(exactKey(deal?.origem,destination,freightWeek||''));
   const base=num(route?.freteRodoBase);
   if(quote===undefined||!ok(base))
    caution('RODO_SEM_REFERENCIA','Rota/semana não conciliada com a cotação rodoviária autenticada');
   else if(!close(quote,base))
    issue('RODO_BASE_DIVERGENTE','Tabela R$/t '+fmt(quote)+' difere do frete bruto aplicado '+fmt(base));
  }else if(!['porto_origem','no_terminal','base_preco_terminal','acesso_terminal'].includes(source)){
   caution('RODO_NAO_RECONCILIADO','Trecho rodoviário com acesso extra, piso, manual ou estimativa: sem conciliação exata de tarifa');
  }
 }
 if(freightIndex instanceof Map&&modal&&['rail','road_rail'].includes(modal)&&
    !(deal?.freteModalCotado?.valoresFinais===true)){
  caution('FERRO_SEM_DATA','Tarifa ferroviária F45 por mês sem ano: o valor por safra não tem evidência temporal independente');
 }
 if(modal==='road_barge')caution('BARCACA_SEM_DATA','Tarifa hidroviária não possui cotação datada nesta auditoria');
 if(route?.freteProjSafraNova||route?.freteProj2028)
  caution('FRETE_PROJETADO','Projeção futura corretamente recalculada, mas não equivale a tarifa executável');
 if(deal?.produto==='Soja'&&route?.seaFreightSource&&
    route.seaFreightSource!=='monthly-shipment'&&route.seaFreightSource!=='manual')
  caution('MARITIMO_INDICATIVO','Frete marítimo por offset, média ou fallback: sem cotação direta para o porto/janela');
 if(route?.freteEstimado||route?._ferroEstimado||route?.freteManualIndicativo||
    route?.seaFreightFallback||/estimad|proxy|leg_fixa|tku|milho_agoset/i.test(String(route?.fonteFrete||'')))
  caution('TARIFA_INDICATIVA','Frete estimado, proxy ou fallback: cálculo aritmético não significa tarifa confirmada');
 if(freightWeek){
  const dealWeek=isoWeekDay(deal?.data),a=weekStart(freightWeek),b=weekStart(dealWeek);
  if(a===null||b===null)issue('SEMANA_FRETE','Semana do frete ou data do negócio inválida');
  else if(a>b)issue('FRETE_FUTURO','Frete posterior à data original do negócio');
  else if((b-a)/604800000>8)caution('FRETE_ANTIGO','Referência semanal anterior com mais de oito semanas');
 }
 const seaDay=String(route?.seaFreightQuoteDate||'');
 if(seaDay&&dateIs(deal?.data)&&seaDay>deal.data)
  issue('MARITIMO_FUTURO','Cotação marítima posterior à data do negócio');
 const originMonth=ym(deal?.embarqueFisicoOrigem),portMonth=ym(route?.embarquePorto||deal?.embarque);
 if(originMonth!==null&&portMonth!==null&&portMonth+1e-7<originMonth)
  issue('JANELA_PORTO','Embarque no porto anterior ao mês informado na origem');
 if(mode(route?.modal)==='multi_leg'||route?.basisPonderadoMultivencimento||
    route?.cenarioConservadorMultiOrigem||deal?.cenarioMultiOrigemSemRateio)
  caution('RATEIO_SEM_VALIDACAO_INDEPENDENTE','Composição multiorigem/multivencimento exige confronto por lote e volume');
 return {port:port||null,modal:route?.modal||null,status:issues.length?'divergente':
   cautions.length?'indicativo':'conforme',issues,cautions,checks,
   fonteFrete:route?.fonteFrete||null,freteSemana:freightWeek||null,
   embarquePorto:route?.embarquePorto||deal?.embarque||null,
   vencCBOTPorto:route?.vencCBOTPorto||deal?.vencCBOT||null};
}
export function auditDealParity(deal,calculation,{freightIndex=null}={}){
 const ref=String(deal?.id||''),issues=[],routes=[];
 if(!calculation||!Array.isArray(calculation?.cmp?.results)){
  return {id:ref,date:deal?.data||null,produto:deal?.produto||null,
   status:'sem_referencia',routes,issues:[{code:'SEM_RESULTADO',details:'Motor não retornou mapa de portos auditável'}]};
 }
 if(!calculation.cmp.results.length)
  issues.push({code:'SEM_PORTO',details:'Nenhum porto elegível calculado'});
 if(deal?.replacementPendente===true||deal?.marketSnapshotPending===true)
  issues.push({code:'PENDENTE',details:'Contrato pendente ou snapshot de mercado não confirmado'});
 if(deal?.cbotFechamento!=null&&num(deal.cbotFechamento)>0&&
   num(deal.cbot)!==num(deal.cbotFechamento))
  issues.push({code:'CBOT_SNAPSHOT',details:'CBOT atual difere do snapshot comercial do negócio'});
 if(deal?.cambioFechamento!=null&&num(deal.cambioFechamento)>0&&
   num(deal.cambio)!==num(deal.cambioFechamento))
  issues.push({code:'FX_SNAPSHOT',details:'Dólar atual difere do snapshot comercial do negócio'});
 for(const p of calculation.cmp.results){
  if(!Array.isArray(p?.modais)||!p.modais.length){
   routes.push({port:p?.porto||null,status:'sem_referencia',issues:[
    {code:'ROTA_SEM_TARIFA',details:'Nenhum modal com replacement calculável para o porto'}],cautions:[],checks:{}});continue;
  }
  for(const rt of p.modais)routes.push(auditRouteParity(deal,rt,{port:p.porto,freightIndex}));
 }
 const eligible=routes.filter(x=>x.status==='conforme');
 const declared=calculation.bestPort;
 const matching=routes.some(x=>x.port===declared&&(x.status==='conforme'||x.status==='indicativo'));
 if(!matching)issues.push({code:'PORTO_ESCOLHIDO',details:'Melhor porto não corresponde a rota financeira validável'});
 const errs=routes.flatMap(r=>r.issues.map(e=>({...e,port:r.port,modal:r.modal})));
 const cautionCount=routes.reduce((n,x)=>n+x.cautions.length,0);
 const status=issues.length||errs.length?'divergente':
   routes.some(r=>r.status==='sem_referencia')?'sem_referencia':
   cautionCount?'indicativo':'conforme';
 return {id:ref,date:deal?.data||null,produto:deal?.produto||null,status,
  bestPort:declared||null,portos:calculation.portosComparados||[],routes,
  issues:[...issues,...errs],cautions:cautionCount,validRoutes:eligible.length};
}
export async function auditDayParity({trades=[],date,calculate,freights=[],onProgress=()=>{},chunk=20}={}){
 if(!dateIs(date)||!Array.isArray(trades)||typeof calculate!=='function')
  throw Error('F77 financeiro: data, negócios ou motor inválidos');
 const records=trades.filter(d=>d&&String(d.data||'')===date&&/^FECHADO/i.test(String(d.status||''))&&
  ['Soja','Milho','Sorgo'].includes(d.produto)&&
  !d.foraMercado&&!d.foraEscopo&&!d.naoAbrirMercado);
 const rows=[],counts={eligible:records.length,conforme:0,indicativo:0,sem_referencia:0,divergente:0,routes:0};
 const freightIndex=buildRoadReferenceIndex(freights,date);
 for(let i=0;i<records.length;i++){
  const deal=records[i];let row;
  try{const calc=await calculate(deal);row=auditDealParity(deal,calc,{freightIndex})}
  catch(e){row={id:String(deal.id||''),date:deal.data,produto:deal.produto,
    status:'divergente',routes:[],issues:[{code:'ERRO_MOTOR',details:String(e?.message||e).slice(0,170)}]};}
  rows.push(row);counts[row.status]++;counts.routes+=(row.routes||[]).length;
  if((i+1)%chunk===0){onProgress({current:i+1,total:records.length,counts:{...counts}});await new Promise(r=>setTimeout(r,0));}
 }
 onProgress({current:records.length,total:records.length,counts:{...counts}});
 return {schema:'BRZ_F77_FINANCIAL_PARITY_V1',date,counts,
  passed:records.length>0&&counts.conforme===records.length,rows,
  scope:'Negócios FECHADOS de soja/milho/sorgo da data. Outros produtos e tabelas de mercado requerem auditoria separada.',
  notes:['Sem escrita; cálculos conferidos por equações independentes do motor.',
   'Modal/frete estimado, tabela ferroviária sem referência temporal ou exceções multivencimento bloqueiam homologação automática.']};
}
export function installFinancialParityUI({getTrades,getState,calculate}={}){
 if(typeof document==='undefined'||typeof getTrades!=='function'||
   typeof getState!=='function'||typeof calculate!=='function')return null;
 const host=document.getElementById('sistema');
 if(!host||document.getElementById('brz-f77-financial-parity'))return null;
 const panel=document.createElement('details');panel.id='brz-f77-financial-parity';
 panel.style.cssText='margin:14px 0;padding:12px;border:1px solid #cbd7df;border-radius:4px;background:var(--card,#fff);font:12px/1.5 Arial,sans-serif';
 const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 panel.innerHTML='<summary style="font-weight:750;cursor:pointer">Auditoria financeira independente · replacement por negócio e porto</summary>'+
 '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;padding:10px 0">'+
 '<label>Data-base <input type="date" id="brz-f77-finance-day"></label>'+
 '<button type="button" id="brz-f77-finance-run">Auditar todos os negócios da data</button>'+
 '<button type="button" id="brz-f77-finance-json" disabled>Exportar auditoria completa (JSON)</button></div>'+
 '<div id="brz-f77-finance-output" aria-live="polite">Confronta frete, modal, CBOT, dólar, FOB e CFR; não grava valores.</div>';
 host.appendChild(panel);
 const $=id=>panel.querySelector('#'+id);
 const dates=getTrades().map(d=>String(d?.data||'')).filter(dateIs).sort();
 $('brz-f77-finance-day').value=dates.at(-1)||'';
 let report=null;
 const render=()=>{
  if(!report)return;
  const c=report.counts;let h='<p><b>'+safe(report.passed?'CONFERÊNCIA FINANCEIRA CONFORME':'NÃO HOMOLOGADO')+'</b> · '+
    c.eligible+' negócios · '+c.routes+' rotas · '+c.conforme+' conformes · '+
    c.indicativo+' indicativos · '+c.sem_referencia+' N/D · '+c.divergente+' divergentes</p>';
  h+='<table style="width:100%;border-collapse:collapse"><thead><tr><th align="left">ID</th><th align="left">Produto</th><th align="left">Status</th><th align="left">Problema principal</th></tr></thead><tbody>';
  for(const row of report.rows.slice(0,100)){
   const e=row.issues?.[0]||row.routes?.find(r=>r.status!=='conforme')?.issues?.[0]||
     row.routes?.find(r=>r.status!=='conforme')?.cautions?.[0];
   h+='<tr><td>'+safe(row.id)+'</td><td>'+safe(row.produto)+'</td><td>'+safe(row.status)+'</td><td>'+safe(e?.details||'—')+'</td></tr>';
  }
  h+='</tbody></table><small>Exibidos até 100 negócios; todas as rotas, deltas e pendências estão no JSON. Este relatório não homologa derivados nem a persistência de tabelas.</small>';
  $('brz-f77-finance-output').innerHTML=h;
 };
 $('brz-f77-finance-day').addEventListener('change',()=>{
  report=null;window.__BRZ_F77_FINANCIAL_PARITY_AUDIT=null;
  $('brz-f77-finance-json').disabled=true;
  $('brz-f77-finance-output').textContent='Selecione Auditar para recalcular, sem gravação.';
 });
 $('brz-f77-finance-run').onclick=async()=>{
  const button=$('brz-f77-finance-run');if(button.disabled)return;
  const date=$('brz-f77-finance-day').value;button.disabled=true;
  $('brz-f77-finance-json').disabled=true;
  window.__BRZ_F77_FINANCIAL_PARITY_AUDIT=null;report=null;
  const source=getTrades(),state=getState();
  const expectedVersion=Number(state?._version||0),snap=JSON.stringify({
    date,marketExcelAsOf:state?.marketExcelAsOf||null,
    cbot:state?.timestamps?.cbot||null,fx:state?.timestamps?.dolar||null,
    freightRows:state?.fretesRodo?.length||0,railRows:state?.fretesFerro?.length||0,
    trades:source.length});
  try{
   report=await auditDayParity({trades:source,date,calculate,freights:state?.fretesRodo||[],
    onProgress:p=>{$('brz-f77-finance-output').textContent=
     'Auditoria '+p.current+'/'+p.total+' negócios · '+p.counts.divergente+' divergentes';}});
   const current=getState();
   const now=JSON.stringify({
    date,marketExcelAsOf:current?.marketExcelAsOf||null,
    cbot:current?.timestamps?.cbot||null,fx:current?.timestamps?.dolar||null,
    freightRows:current?.fretesRodo?.length||0,railRows:current?.fretesFerro?.length||0,
    trades:getTrades().length});
   if(expectedVersion!==Number(current?._version||0)||snap!==now)
    throw Error('Referências mudaram durante a auditoria: relatório invalidado, execute novamente');
   report.completedAt=new Date().toISOString();
   report.stateVersion=expectedVersion;report.totalRecords=source.length;
   report.marketExcelAsOf=current?.marketExcelAsOf||null;
   report.cbotDate=current?.timestamps?.cbot||null;report.fxDate=current?.timestamps?.dolar||null;
   report.freightRows=current?.fretesRodo?.length||0;
   report.railRows=current?.fretesFerro?.length||0;
   window.__BRZ_F77_FINANCIAL_PARITY_AUDIT=report;
   $('brz-f77-finance-json').disabled=false;render();
  }catch(e){
   report=null;window.__BRZ_F77_FINANCIAL_PARITY_AUDIT=null;
   $('brz-f77-finance-output').textContent='Auditoria bloqueada: '+String(e?.message||e).slice(0,180);
  }finally{button.disabled=false;}
 };
 $('brz-f77-finance-json').onclick=()=>{
  if(!report)return;
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='BRZ_F77_Auditoria_Financeira_'+report.date+'.json';
  link.click();setTimeout(()=>URL.revokeObjectURL(url),2500);
 };
 return panel;
}
