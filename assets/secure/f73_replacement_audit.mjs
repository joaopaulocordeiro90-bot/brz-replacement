/* F73 — optional, read-only reconciliation of replacement errors.
 * Does not synthesize CBOT/FX/freight/FOB data, change trades, or save.
 * Bounded chunks keep the UI usable even with thousands of closed trades.
 */
// F75: contracts with valid leg-level references do NOT require a synthetic
// single CBOT contract/price at the header level. Explicitly pending deals and
// Paraguayan-origin operations must not be assigned an invented Brazilian FOB.
export function analyzeShipmentLegs(deal){
 const legs=deal?.lotesEmbarque;
 if(!Array.isArray(legs)||legs.length<2)return {multi:false,valid:false,reasons:[]};
 const reasons=[];
 const count=Number(deal.volume);
 let sum=0;
 const ids=new Set();
 for(const [i,leg] of legs.entries()){
   if(!leg||typeof leg!=='object'){reasons.push('Lote '+(i+1)+' ausente');continue;}
   const id=String(leg.idLote||i);
   if(ids.has(id))reasons.push('ID de lote duplicado: '+id);
   ids.add(id);
   const volume=Number(leg.volume);
   if(!Number.isFinite(volume)||volume<=0)reasons.push('Volume inválido no lote '+(i+1));
   else sum+=volume;
   if(!leg.embarquePorto || !leg.embarqueOrigem)
     reasons.push('Embarque de origem/porto não informado no lote '+(i+1));
   if(!leg.vencCBOT||!Number.isFinite(Number(leg.cbot))||Number(leg.cbot)<=0)
     reasons.push('CBOT não confirmado no lote '+(i+1));
   if(!(leg.vencCambio||deal.vencCambio)||
      !Number.isFinite(Number(leg.cambio??deal.cambio))||Number(leg.cambio??deal.cambio)<=0)
     reasons.push('Câmbio não confirmado no lote '+(i+1));
 }
 if(!Number.isFinite(count)||count<=0||Math.abs(sum-count)>0.001)
   reasons.push('Soma dos volumes por lote diferente do volume do contrato');
 return {multi:true,valid:reasons.length===0,reasons,volume:sum,count:legs.length};
}
export function auditReason(deal,calc,error){
 const flags=[];
 if(!deal||typeof deal!=='object')return {type:'registro_invalido',details:['Registro ausente']};
 const legs=analyzeShipmentLegs(deal);
 const pending=deal.replacementPendente===true||deal.replacementPendente==='true'||
     deal.marketSnapshotPending===true||deal.marketSnapshotPending==='true';
 const foreign=/paraguai|paraguay/i.test(String(deal.corredor||'')+' '+String(deal.origem||''));
 if(foreign) return {type:'fora_paridade_domestica',
   details:['Origem/transação ligada ao Paraguai: não aplicar FOB doméstico sem parametrização comercial específica']};
 if(pending) return {type:'pendencia_comercial',
   details:['Replacement explicitamente pendente: exigir confirmação antes do cálculo']};
 if(!deal.produto)flags.push('Produto ausente');
 if(!deal.origem)flags.push('Origem ausente');
 if(!deal.corredor)flags.push('Corredor ausente');
 if(!deal.embarque&&!deal.retirada&&!legs.valid)flags.push('Janela ausente');
 if(deal.preco==null||!Number.isFinite(Number(deal.preco))||Number(deal.preco)<=0)
   flags.push('Preço físico inválido');
 if(legs.multi){
   if(!legs.valid)flags.push(...legs.reasons);
 }else{
   if(!deal.vencCBOT||deal.cbot==null||
      !Number.isFinite(Number(deal.cbot))||Number(deal.cbot)<=0)
     flags.push('CBOT/vencimento não confirmado');
   if(!deal.vencCambio||deal.cambio==null||
      !Number.isFinite(Number(deal.cambio))||Number(deal.cambio)<=0)
     flags.push('Câmbio/vencimento não confirmado');
 }
 if(error)return {type:'erro_motor',details:[...flags,String(error?.message||error).slice(0,180)]};
 if(flags.length)return {type:'referencia_incompleta',details:flags};
 if(!calc||!Array.isArray(calc.portosComparados)||!calc.portosComparados.length||
    !calc.bestPort||['Pendente','—','-'].includes(calc.bestPort))
   return {type:'sem_rota_calculavel',details:['Nenhuma rota com replacement calculável']};
 return {type:'calculado',details:[]};
}

export async function runReplacementAudit({deals,calculate,onProgress=()=>{},isAborted=()=>false,chunk=25}){
 if(!Array.isArray(deals)||typeof calculate!=='function'||typeof onProgress!=='function'||
    typeof isAborted!=='function'||!Number.isInteger(chunk)||chunk<1||chunk>100)
   throw Error('F73: parâmetros de auditoria inválidos');
 const issues=[],byType=Object.create(null);let computed=0,skipped=0;
 for(let i=0;i<deals.length;i++){
   if(isAborted())throw Error('F73: auditoria interrompida');
   const d=deals[i];
   // This analysis only covers grain replacement, not feed/oil cash trades.
   if(d?.foraMercado||d?.foraEscopo||d?.naoAbrirMercado||d?.status!=='FECHADO'||
      !['Soja','Milho','Sorgo'].includes(d?.produto)){
     skipped++;continue;
   }
   let result=null,exception=null;
   try{result=await calculate(d);}catch(e){exception=e}
   const category=auditReason(d,result,exception);
   byType[category.type]=(byType[category.type]||0)+1;
   if(category.type==='calculado')computed++;
   else issues.push({id:String(d?.id||'sem ID'),date:d?.data||'',
     product:d?.produto||'N/D',type:category.type,details:category.details.join(' · ')});
   if((i+1)%chunk===0){onProgress({current:i+1,total:deals.length,issues:issues.length});await new Promise(r=>setTimeout(r,0))}
 }
 onProgress({current:deals.length,total:deals.length,issues:issues.length});
 return {total:deals.length,considered:computed+issues.length,computed,skipped,issues,byType};
}
// F74: export the COMPLETE pending list from the authenticated session.
export function exportAuditCsv(report){
 if(!report||!Array.isArray(report.issues))throw Error('F74: diagnóstico ausente');
 const cell=value=>{
   let v=String(value??'');
   // Defend spreadsheet tools from CSV formula injection in upstream deal IDs.
   if(/^[\t\r\n ]*[=+@-]/.test(v))v="'"+v;
   return '"'+v.replaceAll('"','""')+'"';
 };
 const header=['ID','Data','Produto','Categoria','Motivo'];
 const lines=report.issues.map(x=>[x.id,x.date,x.product,x.type,x.details].map(cell).join(';'));
 return '\uFEFFsep=;\r\n'+header.map(cell).join(';')+'\r\n'+lines.join('\r\n')+'\r\n';
}
const el=(d,t,text,cls)=>{
 const x=d.createElement(t);if(text!==undefined)x.textContent=String(text);
 if(cls)x.className=cls;return x;
};
export function installReplacementAudit(root,getDeals){
 if(!root||root.__BRZ_F73_REPLACEMENT_AUDIT_INSTALLED)return false;
 if(typeof root.renderDeals!=='function'||typeof root.bestRouteAudit!=='function')return false;
 const originalRender=root.renderDeals;
 let running=false,result=null;
 const mount=()=>{
   const host=root.document.getElementById('negociosStats');
   if(!host||host.querySelector('#brz-f73-audit'))return;
   const doc=root.document,panel=el(doc,'div',undefined,'brz-f73-audit');
   panel.id='brz-f73-audit';
   panel.style.cssText='padding:9px 14px;border-top:1px solid #ccd9dd;background:#f5f9fa;max-width:100%;font-size:12px';
   const btn=el(doc,'button','Auditar replacements (somente leitura)','btn small');
   btn.type='button';btn.style.cssText='width:auto;margin:0 8px 0 0';
   const csv=el(doc,'button','Exportar todas as pendências (CSV)','btn small');
   csv.type='button';csv.disabled=true;
   csv.style.cssText='width:auto;margin:0 8px 0 0';
   const text=el(doc,'span','Identifica referências e erros por negócio; não altera preços nem fretes.');
   const container=el(doc,'div');container.style.cssText='max-height:240px;overflow:auto;margin-top:8px';
   panel.append(btn,csv,text,container);host.appendChild(panel);
   csv.onclick=()=>{
     if(!result)return;
     const blob=new Blob([exportAuditCsv(result)],{type:'text/csv;charset=utf-8'});
     const url=URL.createObjectURL(blob),a=doc.createElement('a');
     a.href=url;a.download='BRZ_auditoria_replacements_'+new Date().toISOString().slice(0,10)+'.csv';
     a.style.display='none';doc.body.appendChild(a);a.click();a.remove();
     setTimeout(()=>URL.revokeObjectURL(url),3000);
   };
   const renderResult=()=>{
     container.replaceChildren();
     if(!result)return;
     const summary=el(doc,'p',result.considered+' negócios elegíveis · '+result.computed+' calculáveis · '+result.issues.length+' com pendência · '+result.skipped+' fora do escopo.');
     container.appendChild(summary);
     const tb=el(doc,'table');tb.style.cssText='border-collapse:collapse;width:100%';
     const hdr=el(doc,'tr');
     for(const x of ['ID','Data','Produto','Tipo','Motivo'])hdr.appendChild(el(doc,'th',x));
     tb.appendChild(hdr);
     const selected=result.issues.slice(0,120);
     for(const issue of selected){const tr=el(doc,'tr');
       for(const v of [issue.id,issue.date,issue.product,issue.type,issue.details])
         tr.appendChild(el(doc,'td',v));
       tb.appendChild(tr);
     }
     container.appendChild(tb);
     if(result.issues.length>selected.length)container.appendChild(el(doc,'p','Mostrando '+selected.length+' de '+result.issues.length+' pendências. Diagnóstico completo disponível na sessão da plataforma.'));
   };
   if(result)renderResult();
   btn.onclick=async()=>{
     if(running)return;running=true;btn.disabled=true;
     try{
       const source=typeof getDeals==='function'?getDeals():root.state?.negocios;
       const deals=Array.isArray(source)?source.slice():[];
       text.textContent='Conferindo '+deals.length+' registros…';
       result=await runReplacementAudit({deals,calculate:deal=>root.bestRouteAudit(deal),
         onProgress:({current,total,issues})=>{
           text.textContent='Auditoria '+current+'/'+total+' · '+issues+' pendências identificadas';}
       });
       root.__BRZ_F73_REPLACEMENT_DIAGNOSTICS=result;
       csv.disabled=false;
       renderResult();
     }catch(error){
       text.textContent='Auditoria interrompida: '+String(error?.message||error).slice(0,180);
     }finally{running=false;btn.disabled=false}
   };
 };
 root.renderDeals=function(...args){const out=originalRender.apply(this,args);mount();return out};
 mount();
 root.__BRZ_F73_REPLACEMENT_AUDIT_INSTALLED=true;
 return true;
}
