/* F73 — optional, read-only reconciliation of replacement errors.
 * Does not synthesize CBOT/FX/freight/FOB data, change trades, or save.
 * Bounded chunks keep the UI usable even with thousands of closed trades.
 */
export function auditReason(deal,calc,error){
 const flags=[];
 if(!deal || typeof deal!=='object')return {type:'registro_invalido',details:['Registro ausente']};
 if(deal.replacementPendente===true || deal.marketSnapshotPending===true)
   flags.push('Pendente comercial/financeiro');
 if(!deal.produto)flags.push('Produto ausente');
 if(!deal.origem)flags.push('Origem ausente');
 if(!deal.corredor)flags.push('Corredor ausente');
 if(!deal.embarque && !deal.retirada)flags.push('Janela ausente');
 if(!Number.isFinite(Number(deal.preco))||Number(deal.preco)<=0)flags.push('Preço físico inválido');
 if(!deal.vencCBOT||!Number.isFinite(Number(deal.cbot))||Number(deal.cbot)<=0)
   flags.push('CBOT/vencimento não confirmado');
 if(!deal.vencCambio||!Number.isFinite(Number(deal.cambio))||Number(deal.cambio)<=0)
   flags.push('Câmbio/vencimento não confirmado');
 if(error)return {type:'erro_motor',details:[...flags,String(error?.message||error).slice(0,180)]};
 if(flags.length)return {type:'referencia_incompleta',details:flags};
 if(!calc || !Array.isArray(calc.portosComparados) || !calc.portosComparados.length ||
    !calc.bestPort || calc.bestPort==='Pendente')
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
   if(d?.foraMercado||d?.foraEscopo||d?.naoAbrirMercado||d?.status!=='FECHADO'){
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
   const text=el(doc,'span','Identifica referências e erros por negócio; não altera preços nem fretes.');
   const container=el(doc,'div');container.style.cssText='max-height:240px;overflow:auto;margin-top:8px';
   panel.append(btn,text,container);host.appendChild(panel);
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
