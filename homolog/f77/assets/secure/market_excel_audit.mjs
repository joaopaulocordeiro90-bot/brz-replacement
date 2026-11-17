/* BRZ F67 — End-of-day Excel parity, in-memory and read-only.
 * Validate every day's imported physical, FOB, meal, oil and ocean observation.
 * Never alter source prices, dated curves, freight lanes or closed trades. */
const dateKey=s=>Number(String(s||'').replaceAll('-',''));
const identity=x=>[x.data,x.produto,String(x.origem||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s*[-\/]\s*([a-z]{2})$/,'/$1').replace(/\s+/g,''),x.janelaFisica||'N/D'].join('|');
const num=x=>Number(x);
export function auditDailyMarketOverlay(patch,reconciled,nextBasis,nextCMA,nextOcean){
 if(!patch||!reconciled||!Array.isArray(reconciled.rows))throw Error('F67: importação não conciliada.');
 const day=patch.as_of,dayNum=dateKey(day);
 const expected=patch.physical.filter(x=>x.data===day);
 const actual=reconciled.rows.filter(x=>x.data===day);
 const seen=new Set(),errors=[],warnings=[];
 if(expected.length!==actual.length)errors.push('Quantidade de preços divergente: '+expected.length+' / '+actual.length);
 const sourceKeys=new Set(expected.map(identity));
 for(const r of actual){
  const k=identity(r);
  if(seen.has(k))errors.push('Cotação física duplicada: '+k);
  seen.add(k);
  if(!sourceKeys.has(k))errors.push('Cotação fora do Excel: '+k);
  if(!Number.isFinite(num(r.preco))||num(r.preco)<=0)errors.push('Preço inválido: '+k);
 }
 for(const k of sourceKeys)if(!seen.has(k))errors.push('Cotação não exibida: '+k);
 const products={};
 for(const product of ['Soja','Milho','Sorgo']){
  const rows=actual.filter(r=>r.produto===product);
  const input=expected.filter(r=>r.produto===product);
  const incomplete=rows.filter(r=>!r.corredor||!r.safra||!r.embarque||!r.retirada||!r.vencCBOT||!r.vencCambio||!Number.isFinite(num(r.cbot))||num(r.cbot)<=0||!Number.isFinite(num(r.cambio))||num(r.cambio)<=0);
  products[product]={total:input.length,withFinancials:rows.length-incomplete.length,incomplete:incomplete.map(r=>({origin:r.origem,window:r.janelaFisica,missing:['corredor','safra','embarque','retirada','vencCBOT','vencCambio','cbot','cambio'].filter(k=>r[k]==null||r[k]==='')}))};
  if((product==='Soja'||product==='Milho')&&incomplete.length)warnings.push(product+': '+incomplete.length+' origens com referência incompleta');
  const inverted=input.filter(x=>Number(x.bid)>Number(x.offer));
  if(inverted.length)warnings.push(product+': '+inverted.length+' bid(s) acima da offer — preservar fonte e conferir');
 }
 const basis=patch.basis.filter(x=>x.day===dayNum);
 let basisMissing=0;
 for(const x of basis){
  const series=nextBasis?.series?.[x.key]||[];
  if(!series.some(([d,v])=>Number(d)===x.day&&Number(v)===Number(x.value)))basisMissing++;
 }
 if(basisMissing)errors.push('Basis FOB ausentes ou alterados: '+basisMissing);
 const derivatives=patch.derivatives.filter(x=>x.d===day);
 const cmaImported=(nextCMA?.rows||[]).filter(x=>x._brzExcelF64===true&&x.d===day);
 const cmaKeys=new Set(cmaImported.map(x=>[x._brzExcelSeq,x.p,x.o,x.v?.[0]].join('|')));
 const cmaMissing=derivatives.filter(x=>!cmaKeys.has([x._brzExcelSeq,x.p,x.o,x.v?.[0]].join('|'))).length;
 if(cmaMissing||cmaImported.length!==derivatives.length)errors.push('CMA de farelo/óleo divergente: '+cmaMissing);
 const ocean=patch.ocean.filter(x=>x.day===day);
 const oceanApplied=nextOcean?.marketExcelOceanRoutes?.[day]||[];
 if(ocean.length!==oceanApplied.length)errors.push('Rotas marítimas divergentes: '+ocean.length+'/'+oceanApplied.length);
 return {sourceDate:day,sourceSha256:patch.sourceSha,totals:{physicalPairs:expected.length,basisFOB:basis.length,soymealCMA:derivatives.filter(x=>x.p==='Soymeal').length,soyoilCMA:derivatives.filter(x=>x.p==='Soyoil').length,ocean:ocean.length},products,errors,warnings,ok:errors.length===0&&products.Soja.incomplete.length===0&&products.Milho.incomplete.length===0};
}
