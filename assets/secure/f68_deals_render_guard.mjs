/* BRZ F68 — isolate faulty route/replacement calculations from the Deals table.
 * Presentation-only safety gate. No change to financial formulas, source data,
 * confirmed trades, storage, freight tables or historical snapshots. */
export function installDealsRenderIsolation(root) {
  if (!root || root.__BRZ_F68_DEALS_ISOLATED) return false;
  if (typeof root.bestRouteAudit !== 'function' || typeof root.renderDeals !== 'function')
    throw Error('F68: renderizadores legados não carregados.');
  const originalAudit = root.bestRouteAudit;
  const originalRender = root.renderDeals;
  const failures = new Map();
  let lastEvaluated = null;
  let warnedCount = 0;
  const stringifyId = deal => String(deal?.id ?? 'ID não informado');
  const pending = () => ({
    cmp:{bestPort:null,results:[]},bestRes:null,best:null,
    bestPort:'Pendente',bestModal:'—',semanaNegocio:'—',
    freteRodo:null,freteFerro:null,freteTotal:null,semanaFrete:'—',
    fonteFrete:'Falha no cálculo · conferir negócio',
    replacementFOB:null,replacementBasis:null,replacementCFR:null,
    replacementCFRBasis:null,margemFOB:null,margemCFR:null,
    portosComparados:[]
  });
  const note = (id,error) => {
    const msg=error instanceof Error?error.message:String(error);
    if (!failures.has(id)) {
      failures.set(id,msg);
      if (warnedCount<15) console.error('[BRZ F68] Replacement não calculado; ID '+id,error);
      warnedCount++;
    }
  };
  const panel = (critical) => {
    const doc=root.document;
    const target=doc?.getElementById('negociosStats')||doc?.getElementById('negociosToolbar');
    if(!target) return;
    let slot=doc.getElementById('brz-f68-deals-status');
    if(!slot){
      slot=doc.createElement('div');
      slot.id='brz-f68-deals-status';
      slot.setAttribute('role','status');
      slot.style.cssText='padding:8px 12px;font:600 12px Arial,sans-serif;border-top:1px solid #e3c77c;background:#fff8e8;color:#704c16;white-space:normal';
      target.appendChild(slot);
    }
    if(!failures.size&&!critical){slot.style.display='none';return;}
    slot.style.display='block';
    const ids=[...failures.keys()];
    slot.textContent=critical
      ?'Falha de exibição em Negócios · ID '+(lastEvaluated||'não identificado')+
         ' · consulte o erro técnico no console. Nenhuma alteração comercial foi realizada.'
      :'Atenção: '+ids.length+' negócio(s) com cálculo de replacement indisponível. '+
         'Linhas mantidas, sem replacement estimado · IDs: '+ids.slice(0,8).join(', ')+
         (ids.length>8?'…':'');
  };
  root.bestRouteAudit=function(deal){
    const id=stringifyId(deal);
    lastEvaluated=id;
    try{
      const audit=originalAudit.call(this,deal);
      if(!audit || typeof audit!=='object' || !Array.isArray(audit.portosComparados))
        throw Error('Retorno inválido da auditoria de rotas');
      return audit;
    }catch(error){
      note(id,error);
      return pending();
    }
  };
  root.renderDeals=function(...args){
    failures.clear();
    warnedCount=0;
    lastEvaluated=null;
    try {
      const result=originalRender.apply(this,args);
      panel(false);
      return result;
    } catch(error) {
      const reason=error instanceof Error?error.message:String(error);
      const id=lastEvaluated||'não identificado';
      console.error('[BRZ F68] Erro de renderização da tabela; último ID '+id,error);
      const tbody=root.document?.getElementById('dealsBody');
      if(tbody){
        tbody.replaceChildren();
        const tr=root.document.createElement('tr');
        const td=root.document.createElement('td');
        td.colSpan=34;
        td.style.cssText='padding:22px;white-space:normal;color:#ac3027;text-align:center';
        td.textContent='Falha ao montar a tabela · último ID '+id+
          ' · '+reason.slice(0,220)+' · consulte o console.';
        tr.appendChild(td);tbody.appendChild(tr);
      }
      panel(true);
      return undefined;
    }
  };
  root.__BRZ_F68_DEALS_ISOLATED=true;
  root.__BRZ_F68_DEALS_DIAGNOSTICS=()=>({
    status:failures.size?'pending':'rendered',
    affected:failures.size,
    rows:[...failures.entries()].map(([id,error])=>({id,error})),
    lastEvaluated
  });
  return true;
}
