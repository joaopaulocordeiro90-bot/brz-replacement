/* BRZ Replacement — Negócios > Pendências, authenticated F33 save */
import {num,normal,month,label,commodity,isCif,candidates,calculate,cbotContract,fxContract,fxValue} from './pendencias_calc.mjs?v=20261116f60';
import {installRoadGeo} from './rodoviario_tku.mjs?v=20261116f60';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(x,d=2)=>num(x)===null?'N/D':num(x).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const ELEMENTS=['origem','incoterm','porto','mesPorto','modal','retirada','pagamento','preco','freteRodo','freteFerro','despesas','cbot','contratoCBOT','fx','contratoDOL','basis','due','obs'];
const FINANCIAL=['preco','freteRodo','freteFerro','despesas','cbot','fx','basis','due'];
function editorField(key,title,value,options){
 const a='<label>'+esc(title);
 if(options)return a+'<select data-field="'+key+'">'+options.map(x=>
   '<option value="'+esc(x)+'" '+(String(value)===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>';
 return a+'<input '+(FINANCIAL.includes(key)?'inputmode="decimal" ':'')+
  'data-field="'+key+'" value="'+esc(value??'')+'"></label>';
}
export function installPendencias(api){
 if(window.BRZPendencias)return window.BRZPendencias;
 const screen=document.getElementById('negocios');
 if(!screen||!api||typeof api.getTrades!=='function')throw Error('Negócios indisponíveis');
 let active=false,query='',refs=null,editing=null;
 const st=document.createElement('style');st.id='brzp-styles';
 st.textContent=[
 '#negocios>.tableWrap{overflow:auto;max-height:min(70vh,800px);scrollbar-gutter:stable}',
 '#negocios>.tableWrap>.table{min-width:1550px;border-collapse:separate;border-spacing:0;font-size:12px}',
 '#negocios>.tableWrap>.table thead th{position:sticky;top:0;z-index:2;background:var(--card);border-bottom:2px solid var(--g200);white-space:nowrap;padding:11px 12px}',
 '#negocios>.tableWrap>.table td{padding:9px 12px;white-space:nowrap;border-bottom:1px solid var(--g100,#e9eff4)}',
 '#negocios>.tableWrap>.table tbody tr:hover{background:var(--g50)}',
 '#brzp-tabs{display:flex;gap:5px;padding:6px 24px 0;border-bottom:1px solid var(--g200)}',
 '#brzp-tabs button{border:1px solid transparent;border-bottom:0;border-radius:5px 5px 0 0;padding:10px 17px;background:transparent;cursor:pointer;color:var(--g600);font:700 13px Inter,Arial}',
 '#brzp-tabs button.active{color:#087d76;background:var(--card);border-color:var(--g200);box-shadow:inset 0 3px #087d76}',
 '#brzp-others{margin:8px 24px 16px;border:1px solid var(--g200);background:var(--card);padding:0 12px;border-radius:6px}',
 '#brzp-others summary{cursor:pointer;padding:11px 4px;font-weight:700;font-size:12px;color:var(--g900)}',
 '#brzp-others #brzOutrosProdutos{margin:0 0 12px!important}',
 '#negocios.brzp-show #negociosToolbar,#negocios.brzp-show #negociosStats,#negocios.brzp-show>.tableWrap,#negocios.brzp-show #brzp-others{display:none!important}',
 '#brzp-content{display:none;padding:16px 24px 30px}',
 '#negocios.brzp-show #brzp-content{display:block}',
 '.brzp-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:0 0 12px}',
 '.brzp-top input{width:min(410px,100%);padding:10px;border:1px solid var(--g200);border-radius:5px;color:var(--g900);background:var(--card)}',
 '.brzp-card{background:var(--card);border:1px solid var(--g200);border-radius:7px;margin:11px 0;padding:14px}',
 '.brzp-head{display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap}',
 '.brzp-title{font-size:13px;font-weight:800;color:var(--g900)}',
 '.brzp-sub{font-size:11px;color:var(--g600);margin:6px 0;line-height:1.55}',
 '.brzp-result{border:1px solid var(--g200);background:var(--g50);border-radius:5px;padding:10px;margin-top:9px;font-size:12px;line-height:1.6}',
 '.brzp-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:11px;margin:15px 0}',
 '.brzp-fields label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:650;color:var(--g600)}',
 '.brzp-fields input,.brzp-fields select{padding:9px 10px;border:1px solid var(--g200);border-radius:5px;background:var(--card);color:var(--g900);min-width:0;width:100%;font:13px Inter,Arial}',
 '.brzp-btn{padding:9px 13px;background:var(--card);border:1px solid var(--g200);border-radius:5px;cursor:pointer;color:var(--g900);font:700 12px Inter,Arial}',
 '.brzp-action{background:#087d76;color:white;border-color:#087d76}',
 '.brzp-note{font-size:11px;color:var(--g600);line-height:1.5;margin-top:7px}',
 '@media(max-width:700px){#brzp-content{padding:12px}#brzp-tabs{padding-left:12px}#brzp-others{margin:9px 12px}.brzp-fields{grid-template-columns:repeat(2,minmax(0,1fr))}}'
 ].join('\n');
 document.head.appendChild(st);
 const tabs=document.createElement('div');tabs.id='brzp-tabs';
 tabs.innerHTML='<button type="button" class="active" data-tab="fechados">Fechados</button>'+
  '<button type="button" data-tab="pendencias">Pendências <span id="brzp-count"></span></button>';
 const header=screen.querySelector('.head');if(!header)throw Error('Cabeçalho Negócios ausente');
 header.insertAdjacentElement('afterend',tabs);
 const workspace=document.createElement('div');workspace.id='brzp-content';tabs.insertAdjacentElement('afterend',workspace);
 const others=document.getElementById('brzOutrosProdutos');
 if(others){
  const details=document.createElement('details');details.id='brzp-others';
  const summary=document.createElement('summary');summary.textContent='Outros produtos ▾  ·  expandir / recolher';
  details.appendChild(summary);others.before(details);details.appendChild(others);details.open=false;
 }
 const pending=()=>api.getTrades().filter(d=>d&&d.status==='FECHADO'&&commodity(d)!==null&&(
     d.replacementPendente===true||(d.replacementCenario&&!d.replacementCalculo&&!d.replacementResolvidoEm)));
 const outOfScope=()=>api.getTrades().filter(d=>d&&d.status==='FECHADO'&&commodity(d)===null&&(d.replacementPendente===true||(d.replacementCenario&&!d.replacementCalculo&&!d.replacementResolvidoEm)));
 const done=()=>api.getTrades().filter(d=>commodity(d)!==null&&d?.replacementCalculo?.indicativo&&d.replacementResolvidoEm)
  .sort((a,b)=>String(b.replacementResolvidoEm).localeCompare(String(a.replacementResolvidoEm))).slice(0,25);
 function count(){const x=document.getElementById('brzp-count');if(x)x.textContent='('+pending().length+' grãos / '+outOfScope().length+' informativos)';}
 async function ensureRefs(){
  if(refs)return refs;
  try{refs=await api.getReferences();}catch(err){console.warn('Referências BRZ:',err?.message);refs={basis:[],road:[],rail:[]};}
  return refs;
 }
 function createSaved(d,p,out){
  const numeric=num(p.preco);
   const now=new Date().toISOString();
   const saved={
    origem:p.origem,modalidadeComercial:p.incoterm,
    retirada:p.retirada,pagamentoRegra:p.pagamento,
    preco:numeric,embarque:p.mesPorto,
    vencCBOT:p.contratoCBOT,cbot:p.cbot,vencCambio:p.contratoDOL,
    cambio:p.fx,cambioIndicativo:true,cbotIndicativo:true,cambioFechamento:null,
    premio:p.basis,premioNaoFixado:p.basis===null,
    portoReferencia:p.porto,
    replacementIndicativo:true,replacementPendente:false,
    replacementStatus:'CALCULADO_INDICATIVO',replacementResolvidoEm:now,
    replacementCenario:{...(d.replacementCenario||{}),tipo:'CENARIO_INDICATIVO',
     porto:p.porto,embarquePorto:p.mesPorto,modal:p.modal,
     freteRodoviarioBRZ_RSt:p.freteRodo,freteFerroviarioBRZ_RSt:p.freteFerro,
     outrosCustosBRZ_RSt:p.despesas,basisFOBBid_cbu:p.basis,
     cbot_cbu:p.cbot,cambioBRLUSD:p.fx,margemExecutada:false,
     freteFonte:'BRZ indicativo / configurado em Negócios → Pendências'},
    replacementCalculo:{...out,parametros:p,dataCalculo:now,indicativo:true,executado:false}
   };

  return saved;
 }
 function openEditor(d){
  editing=d.id;
  const card=[...workspace.querySelectorAll('.brzp-card')].find(el=>el.dataset.id===d.id);
  if(!card)return;
  let ui=card.querySelector('.brzp-editor');
  if(!ui){ui=document.createElement('div');ui.className='brzp-editor';card.appendChild(ui);}
  const best=candidates(d,api.getState(),refs)[0]||{};
  const old=d.replacementCalculo?.parametros||{},scenario=d.replacementCenario||{};
  const init={
   origem:old.origem??d.origem??'',
   incoterm:old.incoterm??(isCif(d)?'CIF':'FOB'),
   porto:old.porto??best.porto??d.portoReferencia??'Santos',
   mesPorto:old.mesPorto??best.mesPorto??label(month(d.embarque))??'',
   modal:old.modal??best.modal??'Rodoviário',
   retirada:old.retirada??d.retirada??'',pagamento:old.pagamento??d.pagamentoRegra??'',
   preco:old.preco??d.preco??'',
   freteRodo:old.freteRodo??best.freteRodo??scenario.freteRodoviarioBRZ_RSt??'',
   freteFerro:old.freteFerro??best.freteFerro??0,
   despesas:old.despesas??best.despesas??0,
   cbot:old.cbot??best.cbot??d.cbot??'',
   contratoCBOT:old.contratoCBOT??best.contratoCBOT??d.vencCBOT??'',
   fx:old.fx??best.fx??d.cambio??'',
   contratoDOL:old.contratoDOL??best.contratoDOL??d.vencCambio??'',
   basis:old.basis??best.basis??(d.premioNaoFixado?null:d.premio)??'',
   due:old.due??'',obs:old.obs??''
  };
  const fields=[
   ['origem','Praça de referência'],['incoterm','Condição comercial',['FOB','CIF']],
   ['porto','Porto',['Santos','Paranaguá','Itaqui','Rio Grande','Barcarena']],
   ['mesPorto','Embarque no porto'],['retirada','Retirada / entrega'],
   ['pagamento','Pagamento'],['modal','Modal',['Rodoviário','Rodoviário + Ferroviário','Ferroviário']],
   ['preco','Preço R$/sc'],['freteRodo','Frete rodoviário R$/t'],
   ['freteFerro','Frete ferroviário R$/t'],['despesas','Custos adicionais R$/t'],
   ['cbot','CBOT c/bu'],['contratoCBOT','Vencimento CBOT'],
   ['fx','Dólar B3 R$/USD'],['contratoDOL','Vencimento dólar'],
   ['basis','Basis FOB bid c/bu (opcional)'],['due','DUE R$/sc (se informado)'],
   ['obs','Observação / ajustes']
  ];
  ui.innerHTML='<div class="brzp-fields">'+fields.map(([k,t,opts])=>editorField(k,t,init[k],opts)).join('')+
   '</div><div class="brzp-result" data-preview></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">'+
   '<button type="button" class="brzp-btn brzp-action" data-save>Calcular e salvar no Supabase</button>'+
   '<button type="button" class="brzp-btn" data-auto>Melhor conta BRZ</button>'+
   '<button type="button" class="brzp-btn" data-close>Recolher</button>'+
   '</div><div class="brzp-note" data-message></div>';
  const grab=()=>Object.fromEntries([...ui.querySelectorAll('[data-field]')].map(x=>[x.dataset.field,x.value.trim()]));
  const parse=()=>{
   const p=grab();
   for(const k of FINANCIAL)p[k]=p[k]===''?null:num(p[k]);
   return p;
  };
  function renderPreview(){
   const p=parse(),out=calculate(d,p),div=ui.querySelector('[data-preview]');
   if(!out){div.textContent='Para concluir: confirme preço, CBOT, dólar e fretes. Sem taxa inventada.';return;}
   div.innerHTML='<b>Replacement implícito: '+fmt(out.replacementBasis_cbu,1)+' c/bu</b>'+
    ' · Custo FOB '+fmt(out.costUSDt,2)+' US$/t · Frete '+fmt(out.freight,2)+' R$/t'+
    (out.marginUSDt!==null?' · <b>Margem indicativa '+fmt(out.marginUSDt,2)+' US$/t</b>':
     ' · Margem FOB N/D (basis não informado)')+
    '<div class="brzp-note">'+(out.dueKnown?'DUE aplicado: R$ '+fmt(out.dueAppliedRSsc,2)+'/sc.':'DUE não quantificado: custo DUE não aplicado.')+' CBOT e dólar indicativos; não são taxas de hedge executadas. '+
     (out.proxySorgo?'CBOT milho como proxy de sorgo.':'')+'</div>';
  }
  renderPreview();ui.addEventListener('input',renderPreview);
  // Port month determines CBOT contract; payment month determines the
  // Brazilian DOL forward reference. Recalculate only when these inputs
  // change, preserving manually keyed quotes otherwise.
  ui.addEventListener('change',event=>{
   const k=event.target?.dataset?.field;
   if(!['mesPorto','pagamento','porto','modal'].includes(k))return;
   const p=parse(),m=month(p.mesPorto);
   if(['mesPorto','porto','modal'].includes(k)){
    const look={...d,embarque:p.mesPorto,
      replacementCenario:{...(d.replacementCenario||{}),
       embarquePortoCenarios:[],embarquePorto:p.mesPorto}};
    const choice=candidates(look,api.getState(),refs).find(r=>
     r.porto===p.porto&&r.mesPorto===p.mesPorto&&r.modal===p.modal);
    const message=ui.querySelector('[data-message]');
    if(choice){
     for(const key of ['freteRodo','freteFerro','basis','cbot','contratoCBOT','fx','contratoDOL']){
      const input=ui.querySelector('[data-field="'+key+'"]');
      if(input)input.value=choice[key]===null?'':String(choice[key]??'');
     }
     message.textContent='Rota atualizada: '+choice.rota+' · '+choice.freteFonte+
       (choice.proxy?' (praça proxy)':'');
    }else if(k==='porto'||k==='mesPorto'){
     for(const key of ['freteRodo','freteFerro','basis']){
      const input=ui.querySelector('[data-field="'+key+'"]');if(input)input.value='';
     }
     message.textContent='Sem cotação completa para este porto/mês. Preencha frete e basis apenas se houver referência.';
    }
   }
   if(m){
    const cc=cbotContract(d,m);
    const candidate=num((commodity(d)==='Soja'?api.getState().cbot:api.getState().cbotMilho)?.[cc]);
    if(candidate!==null){
     ui.querySelector('[data-field="cbot"]').value=candidate;
     ui.querySelector('[data-field="contratoCBOT"]').value=cc;
    }
   }
   const pay=month(p.pagamento)||m;
   const dollar=fxValue(api.getState(),pay);
   if(dollar!==null){
    ui.querySelector('[data-field="fx"]').value=dollar;
    ui.querySelector('[data-field="contratoDOL"]').value=fxContract(pay);
   }
   renderPreview();
  });
  ui.querySelector('[data-close]').onclick=()=>{editing=null;ui.remove();};
  ui.querySelector('[data-auto]').onclick=()=>{
   const bestNow=candidates(d,api.getState(),refs)[0];
   const message=ui.querySelector('[data-message]');
   if(!bestNow){message.textContent='Rota automática não encontrada. Informe os fretes por trecho manualmente.';return;}
   for(const [k,v] of Object.entries(bestNow)){
    const input=ui.querySelector('[data-field="'+k+'"]');
    if(input&&v!==null&&v!==undefined)input.value=String(v);
   }
   message.textContent='Cenário BRZ: '+bestNow.rota+' ('+bestNow.freteFonte+')'+
     (bestNow.proxy?', referência por praça aproximada.':'.');
   renderPreview();
  };
  ui.querySelector('[data-save]').onclick=async()=>{
   const p=parse(),message=ui.querySelector('[data-message]');
   const numeric=num(p.preco);
   if(!p.porto||!p.mesPorto||!p.origem||!p.contratoCBOT||!p.contratoDOL){
    message.textContent='Informe porto, mês de embarque, origem e vencimentos CBOT/DOL.';return;}
   if(p.freteRodo===null||p.freteRodo<0||p.freteFerro===null||p.freteFerro<0){
    message.textContent='Informe fretes rodoviário e ferroviário. Use zero somente se o trecho não existir.';return;}
   if(p.modal!=='Rodoviário'&&p.freteFerro===0){
    message.textContent='Modal rodo + ferro: informe tarifa ferroviária efetiva/indicativa.';return;}
   if(p.due!==null&&p.due<0){message.textContent='DUE não pode ser negativo.';return;}
   const out=calculate({...d,preco:numeric},p);
   if(!out){message.textContent='CBOT, dólar, preço e frete precisam ser numéricos e válidos.';return;}
   const saved=createSaved(d,p,out);
   const button=ui.querySelector('[data-save]');button.disabled=true;
   message.textContent='Gravando com controle de versão…';
   try{await api.saveTrade(d.id,saved);editing=null;refresh();}
   catch(err){message.textContent='Gravação não confirmada: '+err.message;button.disabled=false;}
  };
 }
 let processing=false;
 function autoCandidate(d){
  if(!d||isCif(d)||!/^fob\b/i.test(String(d.modalidadeComercial||''))||!(num(d.preco)>0))return null;
  if(String(d.retirada||'').includes('INCONSISTENTE')||String(d.embarque||'').includes('PENDENTE'))return null;
  let routes=[];try{if(typeof getRotasCorredor==='function')routes=getRotasCorredor(d)||[];}catch{}
  if(!routes.length)return null;
  const options=candidates(d,api.getState(),refs);
  const authorized=options.filter(p=>p.calc&&num(p.freteRodo)!==null&&num(p.fx)>0&&num(p.cbot)>0&&
   routes.some(rt=>rt.porto===p.porto&&(
     (rt.modal==='T'&&p.modal==='Rodoviário')||
     (rt.modal==='T+R'&&p.modal==='Rodoviário + Ferroviário'&&
       p.rota.includes(String(rt.transbordo||'__no_rail_term__')))
   )));
  if(!authorized.length)return null;
  const explicit=d.portoReferencia||d.replacementCenario?.porto||null;
  const choices=explicit?authorized.filter(c=>c.porto===explicit):authorized;
  if(!choices.length)return null;
  const top=choices[0],p={
   origem:d.origem,incoterm:'FOB',porto:top.porto,mesPorto:top.mesPorto,
   modal:top.modal,retirada:d.retirada,pagamento:d.pagamentoRegra||'',
   preco:num(d.preco),freteRodo:top.freteRodo,freteFerro:top.freteFerro,
   despesas:top.despesas??0,cbot:top.cbot,contratoCBOT:top.contratoCBOT,
   fx:top.fx,contratoDOL:top.contratoDOL,basis:top.basis,due:null,
   obs:'Replacement indicativo automático F60; DUE não quantificado quando ausente.'
  };
  const out=calculate(d,p);
  return out?{d,p,out,route:top.rota}:null;
 }
 async function autoSaveEligible(){
  if(processing)return;
  await ensureRefs();
  const eligible=pending().map(autoCandidate).filter(Boolean);
  const note=document.getElementById('brzp-batch-message');
  if(!eligible.length){if(note)note.textContent='Nenhum negócio FOB com referências completas e corredor validado para cálculo automático. Os demais permanecem pendentes.';return;}
  if(!confirm('Salvar '+eligible.length+' replacement(s) INDICATIVO(S) no Supabase? Negócios CIF, referências faltantes e outros produtos serão preservados.'))return;
  processing=true;let ok=0;const errors=[];
  const btn=document.getElementById('brzp-batch');if(btn)btn.disabled=true;
  for(const item of eligible){
   try{await api.saveTrade(item.d.id,createSaved(item.d,item.p,item.out));ok++;}
   catch(err){errors.push(item.d.id+': '+String(err?.message||err).slice(0,130));}
  }
  processing=false;refresh();
  const status=document.getElementById('brzp-batch-message');
  if(status)status.textContent='Gravados e confirmados: '+ok+'/'+eligible.length+
    ' indicativos no Supabase. '+(errors.length?'Falhas sem baixa: '+errors.join(' · '):'Sem falhas de gravação.');
 }
 function refresh(){
  if(!document.getElementById('brzp-content'))return;
  count();
  if(!active)return;
  const rows=pending().filter(d=>!query||normal([d.id,d.vendedor,d.comprador,d.origem,d.produto].join(' ')).includes(normal(query)));
  const completed=done();
  workspace.innerHTML='<div class="brzp-top"><div><b>Pendências do replacement</b>'+
   '<div class="brzp-note">Motor de grãos: soja, milho e sorgo. Fretes rodoviários por OSRM; ferroviário inalterado. Salvar registra conta no banco.</div></div>'+
   '<input id="brzp-search" placeholder="Buscar negócio, praça ou comprador" value="'+esc(query)+'"></div>'+
   '<div class="brzp-note">'+rows.length+' pendência(s) de grãos · '+outOfScope().length+' registro(s) de outros produtos fora deste motor · '+completed.length+' cálculo(s) salvo(s)</div>'+
   '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:9px"><button type="button" class="brzp-btn brzp-action" id="brzp-batch">Calcular e salvar elegíveis</button><span class="brzp-note" id="brzp-batch-message">Somente FOB com preço, referência CBOT/DOL e rota permitida. CIF e ausência de preço não são inferidos.</span></div>'+
   '<div id="brzp-list"></div>'+
   (completed.length?'<details style="margin-top:20px"><summary style="cursor:pointer;font-size:13px;font-weight:700">Contas concluídas ('+
     completed.length+')</summary><div id="brzp-done"></div></details>':'');
  const host=workspace.querySelector('#brzp-list');
  for(const d of rows.slice(0,130)){
   const options=candidates(d,api.getState(),refs),top=options[0],card=document.createElement('div');
   card.className='brzp-card';card.dataset.id=d.id;
   const preview=top?.calc;
   card.innerHTML='<div class="brzp-head"><div class="brzp-title">'+esc(d.vendedor)+' → '+esc(d.comprador)+'</div>'+
    '<div style="display:flex;gap:7px"><button class="brzp-btn" type="button" data-road>Mapa · km rodoviários</button><button class="brzp-btn" type="button" data-edit>Definir parâmetros</button></div></div>'+
    '<div class="brzp-sub">'+esc(d.id)+' · '+esc(d.produto)+' · '+fmt(d.volume,0)+' t · R$ '+
    fmt(d.preco,2)+'/sc · '+esc(d.modalidadeComercial||'FOB')+' · '+
    esc(d.origem||d.localEntrega)+' · '+esc(d.retirada)+'</div>'+
    '<div class="brzp-result">'+(preview?
     '<b>Melhor referência disponível:</b> '+esc(top.porto)+' · '+esc(top.mesPorto)+
     ' · Frete R$ '+fmt(top.freteRodo,2)+'/t · FOB US$ '+fmt(preview.costUSDt,2)+'/t'+
     ' · Basis implícito '+fmt(preview.replacementBasis_cbu,1)+' c/bu'+
     (preview.marginUSDt!==null?' · Margem indicativa US$ '+fmt(preview.marginUSDt,2)+'/t':' · Basis FOB de mercado N/D')+
     '<div class="brzp-note">Outros cenários BRZ: '+
      options.slice(1,4).map(q=>esc(q.porto)+' '+esc(q.mesPorto)+' ('+esc(q.modal)+
       '), FOB US$ '+fmt(q.calc.costUSDt,2)+'/t'+
       (q.calc.marginUSDt!==null?', margem US$ '+fmt(q.calc.marginUSDt,2)+'/t':', mercado N/D'))
       .join(' · ')+'</div>':
     'Sem rota completa automaticamente. Abra os campos para definir a referência.')+
     '</div>';
   card.querySelector('[data-edit]').onclick=()=>openEditor(d);
   card.querySelector('[data-road]').onclick=()=>window.BRZRoadGeo?.selectFromPending(d.id);
   host.appendChild(card);
   if(editing===d.id)openEditor(d);
  }
  const completedList=workspace.querySelector('#brzp-done');
  if(completedList)for(const d of completed){
   const el=document.createElement('div');el.className='brzp-card';el.dataset.id=d.id;
   el.innerHTML='<div class="brzp-head"><div class="brzp-title">'+esc(d.vendedor)+' → '+esc(d.comprador)+'</div>'+
    '<button type="button" class="brzp-btn" data-edit>Revisar parâmetros</button></div>'+
    '<div class="brzp-sub">'+esc(d.id)+' · '+esc(d.replacementCalculo?.parametros?.porto)+
     ' · Replacement '+fmt(d.replacementCalculo?.replacementBasis_cbu,1)+' c/bu · FOB US$ '+
     fmt(d.replacementCalculo?.costUSDt,2)+'/t · <b>Salvo (indicativo)</b></div>';
   el.querySelector('[data-edit]').onclick=()=>openEditor(d);
   completedList.appendChild(el);
  }
  workspace.querySelector('#brzp-batch').onclick=autoSaveEligible;
  workspace.querySelector('#brzp-search').oninput=e=>{query=e.target.value;editing=null;refresh();};
 }
 tabs.onclick=e=>{
  const target=e.target.closest('button[data-tab]');if(!target)return;
  active=target.dataset.tab==='pendencias';
  screen.classList.toggle('brzp-show',active);
  for(const b of tabs.querySelectorAll('button'))b.classList.toggle('active',b===target);
  void ensureRefs().then(refresh);
 };
 void ensureRefs().then(refresh);
 const exported=Object.freeze({refresh,open:()=>tabs.querySelector('[data-tab="pendencias"]').click(),
  status:()=>({pendencias:pending().length,referencias:refs?{fretes:refs.road?.length,basis:refs.basis?.length}:null})});
 window.BRZPendencias=exported;
 try{installRoadGeo({getTrades:api.getTrades,getState:api.getState,refresh});}catch(e){console.warn('F60 mapa rodoviário:',e?.message);}
 return exported;
}
