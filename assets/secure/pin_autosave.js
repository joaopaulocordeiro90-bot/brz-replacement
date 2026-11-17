/* BRZ PIN: versioned, authenticated, automatic persistence of NEGOCIOS only.
 * No remote mutation of source tables or financial engine. JWT only in memory.
 * F33 event journal holds append-only overlays with conflict protection.
 */
(function(){
 'use strict';
 if(window.BRZPinAutoSave)return;
 const API='https://irekykmigdfvwozerkfa.supabase.co';
 const KEY='sb_publishable_lqI_p-_21r3gqerHxsHlLQ_2c-XWwzq';
 const EXPECTED=4011;
 // BRZ Safras-compatible white workspace and 125%-like desktop rendering.
 // Existing styles contain body{zoom:.8}; restoring 1.0 at browser 100%
 // matches the previous 125% browser zoom (.8 * 1.25 = 1.0).
 const ux=document.createElement('style');
 ux.id='brz-replacement-ux-v2';
 ux.textContent=[
  'body{zoom:1!important;min-width:100%!important;max-width:100%!important}',
  '.app{max-width:100vw!important}',
  '#inicial,#inicial .homeHero,#inicial .homeGrid,#inicial .homeQuick{background:#fff!important;color:#173249!important}',
  'body:has(#inicial.active),body:has(#inicial.active) .main,body:has(#inicial.active) #contentGrid{background:#fff!important}',
  '#inicial .homeHero{padding:30px 32px 19px!important;border-bottom:1px solid #e1e8ef!important}',
  '#inicial .homeHero h2{font:800 27px/1.18 Inter,Arial,sans-serif!important;color:#173249!important}',
  '#inicial .homeHero p{font-size:14px!important;color:#607487!important;line-height:1.55!important}',
  '#inicial .homeGrid{padding:24px 32px 26px!important;gap:17px!important}',
  '#inicial .homeCard{background:#fff!important;border:1px solid #dce5ed!important;border-radius:9px!important;box-shadow:0 2px 8px rgba(15,44,68,.045)!important;padding:23px!important;min-height:170px!important}',
  '#inicial .homeCard .eyebrow{font-size:11px!important;color:#60798d!important;letter-spacing:.065em}',
  '#inicial .homeCard h3{font-size:19px!important;color:#173c5c!important}',
  '#inicial .homeCard p{font-size:14px!important;line-height:1.53!important;color:#53687a!important}',
  '#inicial .homeCard .go{font-size:13px!important;color:#0d8f85!important}',
  '#inicial .homeQuick{padding:0 32px 30px!important}',
  '#inicial .homeQuickBox{background:#f8fafc!important;border:1px solid #e0e8f0!important;color:#526a7b!important;font-size:13px!important}',
  '@media(max-width:1100px){#inicial .homeGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}',
  '@media(max-width:700px){body{zoom:1!important}#inicial .homeGrid{grid-template-columns:1fr!important;padding:14px!important}#inicial .homeHero{padding:22px 16px 15px!important}#inicial .homeQuick{padding:0 14px 25px!important}#inicial .homeCard{min-height:0!important;padding:17px!important}}',
  '#brz-curve-last-update{display:flex;flex-wrap:wrap;align-items:baseline;gap:7px;padding:9px 13px;background:#f1f8f7;border:1px solid #cfe7e3;border-radius:5px;color:#163f45;font:600 12px Inter,Arial,sans-serif;margin:7px 0 0}',
  '#brz-curve-last-update small{color:#627986;font-weight:400;font-size:11px}'
 ].join('\n');
 document.head.appendChild(ux);

 let token=null,refreshToken=null,tokenExpiration=0;
 let connected=false,applying=false,saving=false,dirty=false,blocked=false,timer=null;
 // F75: batch startup changes and render only after F33, modules and Excel
 // are fully applied. Normal live updates continue rendering immediately.
 let initialHydrating=false;
 let remote=new Map(),operationIds=new Map();
 const $=id=>document.getElementById(id);
 function stable(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
 }
 function inv(){
  if(typeof state==='undefined'||!Array.isArray(state.negocios))throw Error('Negócios indisponíveis');
  const records=new Map();
  for(const record of state.negocios){
   const id=record?.id;
   if(typeof id!=='string'||id.length<1||id.length>150||records.has(id))
     throw Error('Negócio com ID inválido ou duplicado');
   records.set(id,record);
  }
  return records;
 }
 const css=document.createElement('style');
 css.textContent='#brzpin-badge{position:fixed;bottom:14px;right:14px;z-index:2147483009;'+
  'border:1px solid #93b1c1;border-radius:7px;padding:9px 12px;background:#142f45;color:#fff;'+
  'font:600 12px Arial,sans-serif;cursor:pointer;max-width:min(440px,90vw);box-shadow:0 4px 18px #0003}'+
  '#brzpin-panel{position:fixed;right:14px;bottom:58px;z-index:2147483010;width:min(360px,calc(100vw - 28px));'+
  'background:#fff;border:1px solid #bbcbd4;border-radius:10px;padding:16px;box-shadow:0 13px 30px #0003;'+
  'font:13px/1.5 Arial,sans-serif;color:#142c40}#brzpin-panel[hidden]{display:none!important}'+
  '#brzpin-panel button{background:#174f69;color:#fff;border:0;padding:10px 12px;border-radius:6px;'+
  'cursor:pointer;font:600 12px Arial,sans-serif}#brzpin-panel h3{margin:0 0 10px;font-size:16px}'+
  '#brzpin-alert{white-space:pre-wrap;color:#a3372a;font-size:12px;line-height:1.4;min-height:18px}';
 document.head.appendChild(css);
 const badge=document.createElement('button');
 badge.id='brzpin-badge';badge.type='button';badge.textContent='Banco · iniciando';
 const panel=document.createElement('div');panel.id='brzpin-panel';panel.hidden=true;
 panel.innerHTML='<h3>BRZ · Banco de negócios</h3>'+
  '<p id="brzpin-status">Conectando…</p>'+ 
  '<p id="brzpin-speed" style="font-size:12px;color:#60788a"></p>'+
  '<p>Negócios, curvas, fretes, prêmios e configurações editáveis são salvos automaticamente no Supabase. Dados históricos originais são preservados.</p>'+
  '<button id="brzpin-reload" type="button">Recarregar negócios do banco</button>'+ 
  '<button id="brzpin-export" type="button" style="margin-left:5px">Exportar alterações</button>'+
  '<p><b>Importar fechamentos e curvas</b></p>'+ 
  '<input id="brzpin-desk-file" type="file" accept=".json,application/json" style="width:100%;margin:5px 0 8px">'+
  '<button id="brzpin-desk-run" type="button">Validar e importar JSON</button>'+
  '<p id="brzpin-alert" role="status"></p>';
 document.body.appendChild(badge);document.body.appendChild(panel);
 badge.onclick=()=>{
  panel.hidden=!panel.hidden;
  if(!panel.hidden){
   const nav=window.__BRZ_LAST_TAB_RENDER_MS;
   let boot=null;
   try{boot=window.parent?.__BRZ_SESSION_LOAD_MS;}catch(e){}
   let reused=null;
   try{reused=window.parent?.__BRZ_SOURCE_CACHE;}catch(e){}
   $('brzpin-speed').textContent=
    'Tempo de entrada: '+(Number.isFinite(boot)?(boot/1000).toFixed(1)+' s':'não medido')+
    ' · Origem dos históricos: '+(reused==='HIT'?'cache protegido da sessão':'Supabase (carga integral)')+
    ' · Última aba: '+(Number.isFinite(nav)?nav+' ms':'não medida');
  }
 };
 function setStatus(message,kind='neutral'){
  badge.textContent='Banco · '+message;
  badge.dataset.state=kind;
  badge.style.background=kind==='error'?'#942f25':kind==='working'?'#805b1c':'#145146';
  $('brzpin-status').textContent=message;
 }
 async function refreshSession(){
  if(!refreshToken)throw Error('Sessão expirada: faça login com o PIN novamente');
  const response=await fetch(API+'/auth/v1/token?grant_type=refresh_token',{
    method:'POST',
    headers:{'apikey':KEY,'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({refresh_token:refreshToken}),cache:'no-store',redirect:'error'
  });
  if(!response.ok)throw Error('Sessão expirada: faça login com o PIN novamente');
  const data=await response.json();
  if(typeof data?.access_token!=='string'||typeof data?.refresh_token!=='string')
    throw Error('Renovação de sessão inválida');
  token=data.access_token;refreshToken=data.refresh_token;
  tokenExpiration=Date.now()+Number(data.expires_in||3000)*1000;
  try{window.parent?.__BRZ_UPDATE_TAB_TOKEN?.({
    access_token:token,refresh_token:refreshToken,
    expires_in:Number(data.expires_in||3000)
  });}catch(e){/* Parent may be unavailable in non-PIN harness */}
 }
 async function req(path,body,method='POST'){
  if(!connected&&!applying)throw Error('Banco não conectado');
  if(tokenExpiration&&Date.now()>tokenExpiration-90000)await refreshSession();
  const headers={'apikey':KEY,'Authorization':'Bearer '+token,'Accept':'application/json'};
  if(body!==null)headers['Content-Type']='application/json';
  const response=await fetch(API+path,{
    method,headers,body:body===null?undefined:JSON.stringify(body),
    cache:'no-store',redirect:'error',credentials:'omit',referrerPolicy:'no-referrer'
  });
  if(!response.ok){
   let data;try{data=await response.json();}catch{}
   const err=new Error('Supabase HTTP '+response.status+
       (data?.code?' · '+data.code:''));
   err.status=response.status;
   throw err;
  }
  return await response.json();
 }
 let frozenBaseline=null,deskChatSnapshot=null;
 let liveSignature=null,liveCurvesSignature=null,liveCheckBusy=false;
 let livePollingStarted=false;
 function signatureOfDesk(response,desk){
   if(!response||!Array.isArray(response.rows)||!desk||
       !Array.isArray(desk.trades)||!Array.isArray(desk.curves))
     throw Error('Sinal de sincronização incompleto');
   return stable({
     events:response.rows.map(e=>[e.legacy_id,e.version,e.action]),
     trades:desk.trades.map(t=>[t.legacy_id,t.record_json]),
     curves:desk.curves.map(c=>[c.source_date,c.inserted_at,c.payload?.snapshot?.snap])
   });
 }
 function curvesSignature(desk){
   return stable((desk?.curves||[]).map(c=>[
      c.source_date,c.inserted_at,c.payload?.snapshot?.snap
   ]));
 }
 async function pollLiveUpdates(){
   if(!connected||dirty||saving||blocked||applying||moduleBooting||
      liveCheckBusy||document.hidden)return;
   liveCheckBusy=true;
   try{
     const [response,desk]=await Promise.all([
       req('/rest/v1/rpc/brz_pin_fast_trade_deltas',{}),
       req('/rest/v1/rpc/brz_pin_desk_chat_snapshot',{})
     ]);
     const next=signatureOfDesk(response,desk);
     if(liveSignature===null){liveSignature=next;return;}
     if(next===liveSignature)return;
     // Re-check after the requests. Local edits always take priority to avoid
     // overwriting user input while the server response is in flight.
     if(dirty||saving||blocked||applying||moduleBooting)return;
     const curveChanged=curvesSignature(desk)!==liveCurvesSignature;
     setStatus('Recebendo alterações do Supabase…','working');
     const latest=await rows();
     if(dirty||saving||blocked)return;
     apply(latest);
     if(curveChanged){await loadModules();await loadExcelMarketOverlay();}
     const liveCount=latest.filter(r=>!r.deleted).length;
     setStatus('Sincronizado automaticamente · '+liveCount.toLocaleString('pt-BR')+' negócios');
     $('brzpin-alert').textContent='';
   }catch(error){
     // A transient network failure must neither discard local state nor log
     // out the operator. Retry on the next visibility/focus/interval event.
     console.warn('BRZ: sincronização automática adiada',error?.message);
     if(connected&&!dirty&&!blocked&&!saving)
       setStatus('Conectado · aguardando nova sincronização','warning');
   }finally{liveCheckBusy=false;}
 }
 function startLivePolling(){
   if(livePollingStarted)return;
   livePollingStarted=true;
   // Change detection reads only a tiny authenticated journal/desk snapshot.
   // SHA-validated immutable 4k/178k archives are never reloaded by the poll.
   setInterval(()=>{void pollLiveUpdates()},20000);
   window.addEventListener('focus',()=>{void pollLiveUpdates()});
   document.addEventListener('visibilitychange',()=>{
     if(!document.hidden)void pollLiveUpdates();
   });
 }
 async function rows(){
  // Source 4,011 trades were loaded and SHA-verified by F41 before this
  // bridge starts. Fetch only versioned F33 changes, not 41 redundant pages.
  if(!frozenBaseline){
    const baseline=Array.isArray(state.negocios)?state.negocios:null;
    if(!baseline||baseline.length!==EXPECTED)throw Error('Histórico canônico não carregado');
    frozenBaseline=JSON.parse(JSON.stringify(baseline));
  }
  // The private chat intake is readable only after the desk/admin PIN login.
  // Original frozen 4,011 and F33 journal remain untouched.
  const [response,desk,paymentRules]=await Promise.all([
    req('/rest/v1/rpc/brz_pin_fast_trade_deltas',{}),
    req('/rest/v1/rpc/brz_pin_desk_chat_snapshot',{}),
    req('/rest/v1/rpc/brz_pin_trade_payment_confirmations',{})
  ]);
  if(!paymentRules||!Array.isArray(paymentRules.rows))
    throw Error('Regras de pagamento não foram conciliadas com o banco.');
  if(!desk||!Array.isArray(desk.trades)||!Array.isArray(desk.curves))
    throw Error('Recebimento autenticado da mesa inválido');
  deskChatSnapshot=desk;
  liveSignature=signatureOfDesk(response,desk);
  liveCurvesSignature=curvesSignature(desk);
  if(!response||!Array.isArray(response.rows)||response.rows.length>10000)
    throw Error('Diário de negócios inválido');
  const byId=new Map();
  for(const record of frozenBaseline){
    if(!record||typeof record.id!=='string'||byId.has(record.id))
      throw Error('ID original de negócio duplicado');
    byId.set(record.id,{legacy_id:record.id,record_version:0,
      deleted:false,record_json:record});
  }
  for(const intake of desk.trades){
    if(!intake||typeof intake.legacy_id!=='string'||
       !intake.record_json||intake.record_json.id!==intake.legacy_id||
       byId.has(intake.legacy_id))
      throw Error('Negócio de chat duplicado/inválido');
    byId.set(intake.legacy_id,{
      legacy_id:intake.legacy_id,record_version:0,
      deleted:false,record_json:intake.record_json
    });
  }
  const changed=new Set();
  for(const event of response.rows){
    if(!event||typeof event.legacy_id!=='string'||!event.legacy_id
       ||changed.has(event.legacy_id)||
       !Number.isSafeInteger(Number(event.version))||event.version<1
       ||!['CREATE','UPDATE','DELETE','RESTORE'].includes(event.action))
      throw Error('Evento de alteração inválido');
    changed.add(event.legacy_id);
    if(event.action!=='DELETE'&&(!event.record_json
       ||event.record_json.id!==event.legacy_id))
      throw Error('Negócio alterado incompatível');
    if(!byId.has(event.legacy_id)&&event.action!=='CREATE')
      throw Error('Evento sem negócio original');
    byId.set(event.legacy_id,{
      legacy_id:event.legacy_id,record_version:event.version,
      deleted:event.action==='DELETE',record_json:event.record_json
    });
  }
  if(byId.size<EXPECTED)throw Error('Base de negócios incompleta');
  // F62: projetar confirmações autenticadas após as revisões F33.
  // Fonte canônica, preços e snapshot original permanecem imutáveis.
  const {applyPaymentConfirmation}=await import('./pagamento_confirmacoes.mjs?v=20261116f62');
  const payMap=new Map(paymentRules.rows.map(r=>[r.legacy_id,r]));
  for(const record of byId.values())if(!record.deleted&&record.record_json)
    record.record_json=applyPaymentConfirmation(record.record_json,payMap.get(record.legacy_id));
  return [...byId.values()];
 }
 function apply(rowsList){
  applying=true;
  try{
    const prior=Array.isArray(state.negocios)?state.negocios:[];
    const order=new Map(prior.map((r,i)=>[r?.id,i]));
    const alive=rowsList.filter(r=>!r.deleted).map(r=>r.record_json);
    alive.sort((a,b)=> (order.get(a.id)??Number.MAX_SAFE_INTEGER)-
                         (order.get(b.id)??Number.MAX_SAFE_INTEGER));
    const removed=rowsList.filter(r=>r.deleted).map(r=>r.legacy_id);
    state.negocios=alive;
    state.negociosRemovidos=removed;
    if(typeof window.__BRZ_PIN_INVALIDATE_NAV==='function')window.__BRZ_PIN_INVALIDATE_NAV();
    remote=new Map(rowsList.map(r=>[r.legacy_id,{
      version:Number(r.record_version),
      deleted:r.deleted,
      record:r.record_json,
      snapshot:r.deleted?null:stable(r.record_json)
    }]));
    if(typeof invalidateDataCache==='function')invalidateDataCache();
    if(typeof clearCalcCaches==='function')clearCalcCaches();
    if(!initialHydrating){
      if(typeof scheduleRenderAll==='function')scheduleRenderAll();
      else if(typeof renderAll==='function')renderAll();
    }
    if(window.BRZPendencias)window.BRZPendencias.refresh();
  }finally{applying=false}
 }

 // Persistent modular overlays. Original market/road archives remain immutable.
 // Save only operational edits, with optimistic revisions and automatic history.
 const MODULES=Object.freeze({
   curves:['cbot','cbotMilho','cbotFarelo','cbotOleo','dolar','curva','curvaMilho',
      'fobbins','seaFreight','curvasIntraday','dolarNotas','dolarProxies','timestamps'],
   ocean:['oceanFreight','oceanFreightPorto','oceanFreightMonthly',
      'oceanFreightCornMonthly','oceanFreightAnoAnterior','oceanFreightRotasExcel','barcaca'],
   rail:['fretesFerro'],
   premiums:['premiosMilho'],
   settings:['precosEdits','farmerSelling','r3Hidden','simulacoes','roadGeoRoutes','originGeoOverrides','marketExcelStaged','marketExcelPrevious']
 });
 let remoteModules=new Map(),roadBaseline=new Map(),moduleBooting=false;
 let excelBasisReferences=[],excelMarketStatus=null;
 async function loadExcelMarketOverlay(){
  const reply=await req('/rest/v1/rpc/brz_pin_market_excel_archive',{});
  // F77 signed-off XLSX stage supersedes the old immutable daily archive;
  // source snapshots and quoted CBOT/FX histories are never overwritten.
  const candidate=state.marketExcelStaged;
  const useStage=candidate&&candidate.status==='confirmado'&&
    /^20\d\d-\d\d-\d\d$/.test(candidate.as_of||'')&&
    (!reply?.available||candidate.as_of>reply.snapshot_day);
  if(!reply?.available&&!useStage)return;
  const mod=await import('./market_excel_overlay.mjs?v=20261116f69');
  const reconciler=await import('./market_excel_reconcile.mjs?v=20261116f67');
  const auditor=await import('./market_excel_audit.mjs?v=20261116f67');
  const patch=useStage?mod.projectExcel(candidate):await mod.decodeExcelArchive(reply);
  if(!patch)return;
  const activeCapture=useStage?candidate.curve_capture:reply.curve_capture;
  if(!activeCapture||activeCapture.source_date!==patch.as_of||
     !activeCapture.curves?.cbot||!activeCapture.curves?.dolar)
    throw Error('Captura CBOT/B3 de '+patch.as_of+' ausente; não aplicar cotação sem câmbio do dia.');
  if(typeof getPrecosBase!=='function'||typeof ppeData!=='function'||typeof r3Data!=='function')
    throw Error('Motor físico/FOB/CMA ainda não está inicializado.');
  const elPrices=$('dataPrecos');
  if(!elPrices?.textContent)throw Error('Histórico físico de origem não localizado.');
  // The immutable 59,758-row legacy archive contains fully mapped 13/11
  // histories. Load it from its source, never from F65's incomplete overlay.
  const originalPrices=JSON.parse(elPrices.textContent);
  if(!Array.isArray(originalPrices)||originalPrices.length<59000)
    throw Error('Arquivo histórico de preços incompleto.');
  // A later PIN curve edit takes precedence over an earlier desk capture.
  const capture=activeCapture;
  // F77: a later curve may supersede the imported snapshot ONLY for the SAME physical date.
  const newerSavedCurve=curveUpdatedAt&&curveSourceDate===patch.as_of&&
    Date.parse(curveUpdatedAt)>Date.parse(capture.inserted_at);
  const effectiveCapture=newerSavedCurve?{
    ...capture,curves:{
      cbot:state.cbot,cbotMilho:state.cbotMilho,
      cbotFarelo:state.cbotFarelo,cbotOleo:state.cbotOleo,dolar:state.dolar
    },capture_no:'PIN'
  }:capture;
  const enriched=reconciler.reconcileMarketPrices(
    originalPrices,patch.physical,effectiveCapture,{
      cbotContract:(produto,embarque,data)=>{
        const v=typeof brzMesesCBOT==='function'?brzMesesCBOT(produto,embarque,data):null;
        return v?.venc||null;
      },
      dolContract:embarque=>{
        const v=typeof brzDolEmbarque==='function'?brzDolEmbarque(embarque):null;
        return v?.venc||null;
      }
    },state.precosEdits||{}
  );
  if(enriched.status.sourceRows!==patch.physical.length||!enriched.status.readyCurrent)
    throw Error('Revisão de preços não conciliada; nenhuma atualização aplicada.');
  const nextPrices=reconciler.mergeReconciledMarketPrices(originalPrices,enriched.rows);
  const nextBasis=mod.mergeBasisSeries(ppeData(),patch.basis);
  const nextCMA=mod.mergeCMA(r3Data(),patch.derivatives);
  const nextOcean=mod.mergeOcean(state,patch.ocean);
  const quality=auditor.auditDailyMarketOverlay(patch,enriched,nextBasis,nextCMA,nextOcean);
  if(quality.errors.length||(useStage&&!quality.ok))throw Error('Falha na conferência do Excel: '+[...quality.errors,...quality.warnings].join('; '));
  // All validations finished: apply UI-visible market values atomically.
  if(!newerSavedCurve){
    for(const group of ['cbot','cbotMilho','cbotFarelo','cbotOleo','dolar']){
      if(capture.curves[group]&&typeof capture.curves[group]==='object')
        state[group]={...(state[group]||{}),...capture.curves[group]};
    }
    for(const [src,target] of [['cbot','curva'],['cbotMilho','curvaMilho']]){
      for(const [contract,value] of Object.entries(capture.curves[src]||{})){
        if(state[target]?.[contract]&&typeof state[target][contract]==='object')
          state[target][contract].cbot=Number(value);
      }
    }
    curveUpdatedAt=capture.inserted_at;
    curveSourceDate=capture.source_date;
    curveCaptureTime='C'+capture.capture_no+
      ' · '+new Date(capture.inserted_at).toLocaleString('pt-BR',{
      timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});
  }
  state.timestamps={...(state.timestamps||{}),cbot:patch.as_of,dolar:patch.as_of};
  state._marketSnapshotId='Excel '+patch.as_of+' · CBOT/B3 '+effectiveCapture.capture_no+(useStage?' · F77 aprovado':'');
  PRECOS_BASE_CACHE=nextPrices;
  _basisFOB=nextBasis;
  // The older soybean-paper basis adapter uses a separate series cache.
  if(typeof _brzBFOB!=='undefined')_brzBFOB=nextBasis.series;
  _r3DerivCache=nextCMA;
  state.oceanFreightMonthly=nextOcean.oceanFreightMonthly;
  state.oceanFreightCornMonthly=nextOcean.oceanFreightCornMonthly;
  state.marketExcelOceanRoutes=nextOcean.marketExcelOceanRoutes;
  state.marketExcelRawPhysical=patch.physicalRaw;
  state.marketExcelAsOf=patch.as_of;
  state.marketExcelSHA256=patch.sourceSha;
  state.marketExcelReconciliation=enriched.status;
  state.marketExcelAudit=quality;
  state._version=(Number(state._version)||0)+1;
  // The Excel/curve overlays are READ ONLY. An autosave must not turn their
  // source observations into manual operator edits of the ocean/curve modules.
  for(const moduleName of ['ocean','curves']){
    const modRevision=remoteModules.get(moduleName);
    if(modRevision)remoteModules.set(moduleName,{
      ...modRevision,snapshot:stable(groupSnapshot(moduleName))
    });
  }
  excelBasisReferences=mod.basisReferences(patch.basis);
  excelMarketStatus={...patch.counts,...enriched.status,quality};
  // Reconciliation restores the historical 13/11 snapshot; the original
  // live-sync helper must never overwrite it using CBOT/B3 from 16/11.
  if(typeof window.brzSyncPrecoMarketCurves==='function'){
    const original=window.brzSyncPrecoMarketCurves;
    if(!original.__brzF66Frozen){
      const frozen=function(rows){
        if(state?.marketExcelAsOf&&Array.isArray(rows))return rows;
        return original.apply(this,arguments);
      };
      frozen.__brzF66Frozen=true;window.brzSyncPrecoMarketCurves=frozen;
    }
  }
  // F71: invalidate the data cache, NEVER clobber its callable accessor.
  // F66 wrote null to _brzPrecosIdx (a function), breaking every port table.
  if(typeof _brzF71PrecoIndexCache!=='undefined')_brzF71PrecoIndexCache=null;
  if(typeof _r3MealCurveCache!=='undefined')_r3MealCurveCache=null;
  if(typeof _r3SpotCache!=='undefined')_r3SpotCache=null;
  if(typeof _r3PhysicalCache!=='undefined')_r3PhysicalCache=null;
  if(typeof _r3PhysicalCacheDate!=='undefined')_r3PhysicalCacheDate=null;
  if(typeof analiseBase!=='undefined'&&analiseBase==='precos'&&
    (!analiseData||analiseData<patch.as_of)){
    analiseData=patch.as_of;analiseVenc=null;analiseCompareData=null;
  }
  if(typeof invalidateDataCache==='function')invalidateDataCache();
  if(typeof clearCalcCaches==='function')clearCalcCaches();
  if(!initialHydrating&&typeof scheduleRenderAll==='function')scheduleRenderAll();
  let stamp=$('brz-market-xlsx-status');
  if(!stamp){
    stamp=document.createElement('div');stamp.id='brz-market-xlsx-status';
    stamp.style.cssText='font:600 12px Arial;color:#176a61;background:#f2fbf8;padding:7px 10px;margin:6px 0;border:1px solid #c7e8de';
    document.querySelector('#mercado .head')?.appendChild(stamp);
  }
  if(stamp){
    const q=quality.products;
    stamp.textContent='Excel '+patch.as_of.split('-').reverse().join('/')+
      ' · Soja '+q.Soja.withFinancials+'/'+q.Soja.total+
      ' · Milho '+q.Milho.withFinancials+'/'+q.Milho.total+
      ' · Basis FOB '+quality.totals.basisFOB+
      ' · Farelo '+(patch.counts.soymealNotQuoted?'N/D ('+patch.counts.soymealNotQuoted+' sem cotação)':quality.totals.soymealCMA)
      +' · Óleo '+quality.totals.soyoilCMA
      ' · CBOT/B3 C'+effectiveCapture.capture_no+
      ' · '+(quality.ok?'AUDITADO':'ATENÇÃO: '+quality.warnings.join('; '));
    stamp.style.color=quality.ok?'#176a61':'#8a4a00';
    stamp.style.background=quality.ok?'#f2fbf8':'#fff8e8';
    stamp.style.borderColor=quality.ok?'#c7e8de':'#edc87a';
  }
 }

 let curveUpdatedAt=null,curveSourceDate=null,curveCaptureTime='não informado';
 function renderCurveLastUpdate(){
   const head=document.querySelector('#mercado .head');
   if(!head)return;
   let box=document.getElementById('brz-curve-last-update');
   if(!box){box=document.createElement('div');box.id='brz-curve-last-update';head.appendChild(box);}
   if(!curveUpdatedAt){
     box.textContent='Curva CBOT/B3 · Sem data de atualização confirmada';
     return;
   }
   const date=new Date(curveUpdatedAt);
   if(!Number.isFinite(date.getTime())){box.textContent='Curva CBOT/B3 · Data indisponível';return;}
   const recorded=date.toLocaleString('pt-BR',{
     timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',
     year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false
   });
   const day=typeof curveSourceDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(curveSourceDate)
       ?curveSourceDate.split('-').reverse().join('/'):'sem data';
   box.replaceChildren();
   const title=document.createElement('strong');
   title.textContent='Última atualização: '+recorded+' (BRT)';
   const meta=document.createElement('small');
   meta.textContent='Referência: '+day+' · Horário da captura CBOT/B3: '+curveCaptureTime;
   box.append(title,meta);
 }

 function groupSnapshot(name){
   const obj={};
   for(const key of MODULES[name]){
     if(Object.prototype.hasOwnProperty.call(state,key)&&state[key]!==undefined)
       obj[key]=state[key];
   }
   return JSON.parse(JSON.stringify(obj));
 }
 function roadDiff(){
   const rows=Array.isArray(state.fretesRodo)?state.fretesRodo:[];
   const seen=new Set(),upserts=[],deletes=[];
   for(const row of rows){
     const id=row?.id;
     if(typeof id!=='string'||!id||seen.has(id))
       throw Error('Frete rodoviário sem ID único');
     seen.add(id);
     if(roadBaseline.get(id)!==JSON.stringify(row))upserts.push(row);
   }
   for(const id of roadBaseline.keys())if(!seen.has(id))deletes.push(id);
   if(upserts.length+deletes.length>2500)
      throw Error('Alterações rodoviárias em massa bloqueadas; use a ingestão controlada');
   return {upserts,deletes};
 }
 // Native JSON.stringify preserves the original parsed record's key order;
 // unlike stable() it avoids sorting keys for each of 178k freight records.
 // Both baseline and checks use the same serializer so edits remain detected.
 // Compare large road freight series in bounded chunks, yielding to browser UI.
 // Identical result to roadDiff(), without a single long blocking task.
 async function roadDiffAsync(){
   const rows=Array.isArray(state.fretesRodo)?state.fretesRodo:[];
   const seen=new Set(),upserts=[],deletes=[];
   for(let i=0;i<rows.length;i++){
     const row=rows[i],id=row?.id;
     if(typeof id!=='string'||!id||seen.has(id))
       throw Error('Frete rodoviário sem ID único');
     seen.add(id);
     if(roadBaseline.get(id)!==JSON.stringify(row))upserts.push(row);
     if((i+1)%3500===0)await new Promise(resolve=>setTimeout(resolve,0));
   }
   for(const id of roadBaseline.keys())if(!seen.has(id))deletes.push(id);
   if(upserts.length+deletes.length>2500)
      throw Error('Alterações rodoviárias em massa bloqueadas; use a ingestão controlada');
   return {upserts,deletes};
 }
 function patchRoad(overlay){
   if(!overlay||!Array.isArray(overlay.upserts)||!Array.isArray(overlay.deletes))
     throw Error('Delta rodoviário remoto incompatível');
   const original=Array.isArray(state.fretesRodo)?state.fretesRodo:[];
   const all=new Map(original.map(row=>[row.id,row]));
   for(const id of overlay.deletes)if(typeof id==='string')all.delete(id);
   for(const record of overlay.upserts){
     if(!record||typeof record.id!=='string')throw Error('Frete remoto inválido');
     all.set(record.id,record);
   }
   const ordered=[...all.values()];
   state.fretesRodo=ordered;
 }
 async function loadModules(){
   moduleBooting=true;
   try{
     const rows=await req('/rest/v1/rpc/brz_pin_module_list',{});
     if(!Array.isArray(rows)||rows.length>7)throw Error('Módulos não conciliados');
     remoteModules=new Map();
     const roadRows=Array.isArray(state.fretesRodo)?state.fretesRodo:[];
     roadBaseline=new Map();
     // Build the 178k-row comparison baseline in chunks so the browser
     // continues painting the PIN progress screen instead of freezing.
     for(let i=0;i<roadRows.length;i++){
       const record=roadRows[i];
       if(typeof record?.id!=='string'||roadBaseline.has(record.id))
         throw Error('Histórico rodoviário com ID inválido');
       roadBaseline.set(record.id,JSON.stringify(record));
       if((i+1)%2500===0)await new Promise(resolve=>setTimeout(resolve,0));
     }
     for(const record of rows){
       if(!record||!['curves','ocean','rail','premiums','settings','road_delta','basis'].includes(record.module)
         ||!Number.isSafeInteger(Number(record.revision))
         ||Number(record.revision)<1||!record.payload||typeof record.payload!=='object')
         throw Error('Seção remota inválida');
       if(remoteModules.has(record.module))throw Error('Módulo remoto duplicado');
       remoteModules.set(record.module,{revision:Number(record.revision),snapshot:null});
       if(record.module==='road_delta'){
         patchRoad(record.payload);
       }else if(record.module in MODULES){
         for(const key of MODULES[record.module]){
           if(Object.prototype.hasOwnProperty.call(record.payload,key))
             state[key]=record.payload[key];
         }
       }
     }
     // New dated market quotations are applied after source snapshots.
     // If a desk user subsequently edited the curves module, its newer
     // revision takes precedence over earlier chat-supplied quotations.
     let appliedChatCurves=false;
     const savedCurvesRow=rows.find(r=>r.module==='curves');
     curveUpdatedAt=savedCurvesRow?.updated_at||null;
     curveSourceDate=null;
     curveCaptureTime='não informado';
     for(const latest of deskChatSnapshot?.curves||[]){
       const stamp=Date.parse(latest?.inserted_at||'');
       if(!Number.isFinite(stamp))continue;
       if(!curveUpdatedAt||stamp>Date.parse(curveUpdatedAt)){
         curveUpdatedAt=latest.inserted_at;
         curveSourceDate=latest.source_date;
         curveCaptureTime=latest.payload?.snapshot?.hora||'não informado';
       }
     }
     renderCurveLastUpdate();

     for(const item of deskChatSnapshot?.curves||[]){
       const sourceDate=item?.source_date;
       const patch=item?.payload;
       if(typeof sourceDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)||
          !patch||typeof patch!=='object'||!patch.snapshot)
         throw Error('Captura de mercado do chat inválida');
       if(savedCurvesRow &&
          Date.parse(savedCurvesRow.updated_at)>=Date.parse(item.inserted_at))
          continue;
       for(const key of ['cbot','cbotMilho','cbotOleo','cbotFarelo','dolar']){
         if(!patch[key]||typeof patch[key]!=='object')throw Error('Curva incompleta: '+key);
         state[key]={...(state[key]||{}),...patch[key]};
       }
       const intraday={...(state.curvasIntraday||{})};
       const previous=Array.isArray(intraday[sourceDate])?intraday[sourceDate]:[];
       const indexed=previous.some(x=>x?.snap===patch.snapshot.snap);
       intraday[sourceDate]=indexed?previous:[...previous,patch.snapshot];
       state.curvasIntraday=intraday;
       appliedChatCurves=true;
     }
     for(const name of Object.keys(MODULES)){
       const saved=remoteModules.get(name);
       const snap=stable(groupSnapshot(name));
       remoteModules.set(name,{revision:saved?.revision||0,snapshot:snap});
     }
     const persistedRoad=remoteModules.get('road_delta');
     remoteModules.set('road_delta',{revision:persistedRoad?.revision||0,
       snapshot:persistedRoad?stable(roadDiff()):stable({upserts:[],deletes:[]})});
     if(rows.length||appliedChatCurves){
       if(typeof window.__BRZ_PIN_INVALIDATE_NAV==='function')window.__BRZ_PIN_INVALIDATE_NAV();
       if(typeof invalidateDataCache==='function')invalidateDataCache();
       if(typeof clearCalcCaches==='function')clearCalcCaches();
       if(typeof scheduleRenderAll==='function')scheduleRenderAll();
       else if(typeof renderAll==='function')renderAll();
     }
   }finally{moduleBooting=false}
 }
 async function saveModules(){
   if(moduleBooting)return;
   for(const name of [...Object.keys(MODULES),'road_delta']){
     const previous=remoteModules.get(name)||{revision:0,snapshot:null};
     const payload=name==='road_delta'?await roadDiffAsync():groupSnapshot(name);
     const shot=stable(payload);
     if(shot===previous.snapshot)continue;
     const result=await req('/rest/v1/rpc/brz_pin_module_save',{
       p_module:name,p_payload:payload,p_expected_revision:previous.revision});
     const ack=Array.isArray(result)?result[0]:result;
     if(ack?.module!==name||Number(ack.revision)!==previous.revision+1)
       throw Error('Alteração do módulo '+name+' sem confirmação do servidor');
     remoteModules.set(name,{revision:Number(ack.revision),snapshot:shot});
     if(name==='curves'){
       curveUpdatedAt=ack.updated_at||new Date().toISOString();
       curveSourceDate=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
       curveCaptureTime='não informado';
       renderCurveLastUpdate();
     }
   }
 }


 // Avoid traversing the entire 59,758-row physical price history on every
 // chart, filter or tab update. The original reconciliation still executes
 // when CBOT, BRL/USD, active trading date, rules or state version changes.
 function installMarketHotPath(){
   if(window.__BRZ_PIN_FAST_PRICE_SYNC)return;
   const legacy=window.brzSyncPrecoMarketCurves;
   if(typeof legacy!=='function')return;
   let cached=null;
   function signature(){
     const source=typeof state!=='undefined'&&state?state:{};
     const date=typeof brzMarketDate==='function'?brzMarketDate():'';
     const fxRule=typeof brzRegraParam==='function'
       ?String(brzRegraParam('cambio.precos','base','embarque')):'';
     // Market contract dictionaries are small. Hashing their content detects
     // changes even when an editor mutates a dictionary without calling persist.
     return JSON.stringify([
       source._version||0,date,fxRule,
       source.cbot||null,source.cbotMilho||null,source.dolar||null
     ]);
   }
   window.brzSyncPrecoMarketCurves=function(rows){
     if(!Array.isArray(rows))return legacy.apply(this,arguments);
     const sig=signature();
     if(cached?.rows===rows&&cached.signature===sig)return rows;
     const result=legacy.apply(this,arguments);
     cached={rows,signature:sig};
     return result;
   };
   window.__BRZ_PIN_FAST_PRICE_SYNC=true;
 }


 // Freight table renders scan and sort 178,201 historical freight entries.
 // Reopening the same page without data/filter changes can reuse the same DOM.
 function installFreightViewCache(){
   if(window.__BRZ_PIN_FREIGHT_VIEW_CACHE)return;
   const original=window.renderFreights;
   if(typeof original!=='function')return;
   let epoch=0,last=null;
   function mark(event){
     if(event.target?.closest?.('#fretes'))epoch++;
   }
   for(const type of ['input','change','click'])
     document.addEventListener(type,mark,true);
   function stamp(){
     const v=id=>document.getElementById(id)?.value||'';
     return JSON.stringify([
       state?._version||0,
       typeof freightTab!=='undefined'?freightTab:'',
       typeof rodoPage!=='undefined'?rodoPage:'',
       typeof rodoCompareMode!=='undefined'?rodoCompareMode:false,
       v('rodoFiltSemana'),v('rodoFiltDestino'),v('rodoFiltOrigem'),
       v('rodoSortBy'),epoch
     ]);
   }
   window.renderFreights=function(){
     const freight=state?.fretesRodo,rail=state?.fretesFerro;
     const key=stamp();
     const present=document.getElementById('rodoBody')?.firstChild;
     if(present&&last?.key===key&&last.road===freight&&last.rail===rail&&
       performance.now()-last.at<18000)return;
     const start=performance.now();
     const result=original.apply(this,arguments);
     last={key:stamp(),road:freight,rail,at:performance.now()};
     window.__BRZ_LAST_FREIGHT_RENDER_MS=Math.round(performance.now()-start);
     return result;
   };
   window.__BRZ_PIN_FREIGHT_VIEW_CACHE=true;
 }


 // Keep technical controls inside one regular navigation screen. Relocate the
 // actual DOM nodes, rather than cloning them, so legacy onclick handlers,
 // status messages and export buttons continue to work unchanged.
 function installSystemToolsTab(){
  if(window.__BRZ_SYSTEM_TOOLS_READY)return;
  const nav=document.querySelector('.topmenu');
  const content=document.getElementById('contentGrid');
  if(!nav||!content||typeof window.showScreen!=='function')return;
  const css=document.createElement('style');
  css.id='brzsys-styles';
  css.textContent=[
   '#sistema{padding:16px 22px 35px;box-sizing:border-box}',
   '#sistema .brzsys-head{margin-bottom:20px}',
   '#sistema .brzsys-head h2{margin:0 0 6px;font-size:23px}',
   '#sistema .brzsys-head p{margin:0;font-size:13px;color:var(--g500,#657b8f);line-height:1.5}',
   '#sistema .brzsys-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:14px;margin:14px 0}',
   '#sistema .brzsys-card{min-width:0;border:1px solid var(--g200,#dbe3eb);background:var(--card,#fff);border-radius:8px;padding:16px;box-shadow:none}',
   '#sistema .brzsys-card h3{font-size:13px;margin:0 0 11px;color:var(--g600,#52677c);font-weight:700}',
   '#sistema .brzsys-card > button{position:static!important;inset:auto!important;top:auto!important;left:auto!important;right:auto!important;bottom:auto!important;z-index:auto!important;min-height:36px;max-width:100%;width:auto;margin:0 0 6px;box-shadow:none!important;display:inline-block}',
   '#sistema .brzsys-card > .brzsys-panel{position:static!important;inset:auto!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;z-index:auto!important;max-width:100%!important;width:100%!important;max-height:min(65vh,580px)!important;overflow:auto!important;margin:10px 0 0!important;box-shadow:none!important;box-sizing:border-box!important}',
   '#sistema .brzsys-card > .brzsys-panel[hidden]{display:none!important}',
   '#sistema .brzsys-card .brzsys-panel button{max-width:100%}',
   '#sistema .brzsys-legacy{border-top:1px solid var(--g200,#dbe3eb);padding:16px 0;margin-top:22px}',
   '#sistema .brzsys-legacy summary{cursor:pointer;font-size:14px;font-weight:700;margin-bottom:9px}',
   '#sistema .brzsys-legacy small{color:var(--g500,#64748b);font-size:12px;line-height:1.5}',
   '#sistema .brzsys-card[data-legacy-hidden="true"]{display:none}',
   '@media(max-width:640px){#sistema{padding:14px 12px 30px}#sistema .brzsys-card{padding:12px}}'
  ].join('\n');
  document.head.appendChild(css);

  const button=document.createElement('button');
  button.type='button';button.dataset.screen='sistema';
  button.textContent='Sistema';
  button.title='Banco, sincronização e ferramentas técnicas';
  button.onclick=()=>window.showScreen('sistema');
  nav.appendChild(button);

  const screen=document.createElement('section');
  screen.id='sistema';screen.className='screen scrollable';
  const intro=document.createElement('div');
  intro.className='brzsys-head';
  intro.innerHTML='<h2>Sistema</h2><p>Sincronização, backup e ferramentas de suporte da plataforma em um único lugar.</p>';
  screen.appendChild(intro);
  const currentGrid=document.createElement('div');
  currentGrid.className='brzsys-grid';
  screen.appendChild(currentGrid);
  const legacy=document.createElement('details');
  legacy.className='brzsys-legacy';
  const summary=document.createElement('summary');
  summary.textContent='Ferramentas técnicas anteriores';
  legacy.appendChild(summary);
  const help=document.createElement('small');
  help.textContent='Controles de homologação preservados para referência. A operação diária utiliza a sincronização por PIN/Supabase.';
  legacy.appendChild(help);
  const oldGrid=document.createElement('div');
  oldGrid.className='brzsys-grid';legacy.appendChild(oldGrid);
  screen.appendChild(legacy);
  // Sign-out remains available under Sistema without occupying the top bar.
  const access=document.createElement('details');
  access.className='brzsys-legacy';
  const accessSummary=document.createElement('summary');
  accessSummary.textContent='Segurança da sessão';
  access.appendChild(accessSummary);
  const accessInfo=document.createElement('small');
  accessInfo.textContent='Sessão protegida nesta aba por até 60 minutos após o PIN. Para encerrar antes, use a opção abaixo.';
  access.appendChild(accessInfo);
  const closeSession=document.createElement('button');
  closeSession.type='button';
  closeSession.textContent='Encerrar sessão nesta aba';
  closeSession.style.cssText='display:block;margin-top:12px;background:#fff;color:#26455b;border:1px solid #d1dce5;border-radius:6px;padding:9px 13px;font:600 12px Arial;cursor:pointer';
  closeSession.onclick=()=>{
    if(dirty||saving||blocked){
      if(!confirm('Existem alterações pendentes. Encerrar mesmo assim?'))return;
    }
    try{window.parent?.__BRZ_END_TAB_SESSION?.()}catch(e){}
  };
  access.appendChild(closeSession);
  screen.appendChild(access);
  content.appendChild(screen);


  // F77: show measured actual load times, not fabricated performance targets.
  const perf=document.createElement('details');perf.className='brzsys-legacy';
  const perfSummary=document.createElement('summary');
  perfSummary.textContent='Desempenho real · carregamento da sessão F77';
  perf.appendChild(perfSummary);
  const perfOutput=document.createElement('pre');
  perfOutput.style.cssText='white-space:pre-wrap;font:12px/1.6 ui-monospace,monospace';
  perf.appendChild(perfOutput);
  perf.addEventListener('toggle',()=>{
    if(!perf.open)return;
    let m=null;
    try{m=window.parent?.__BRZ_F77_BOOT_AUDIT;}catch{}
    if(!m){perfOutput.textContent='Medição disponível após completar a abertura autenticada.';return;}
    const seconds=n=>(Number(n||0)/1000).toFixed(2)+'s';
    perfOutput.textContent='Tempo total: '+seconds(m.totalMs)+
      '\nCache protegido: '+String(m.cache||'N/D')+
      '\nMotor completo: '+(m.fullEngine?'SIM':'NÃO')+
      '\n'+(m.stageTimes||[]).map(x=>x.key+': '+seconds(x.ms)).join('\n')+
      '\nMedição da sessão atual; inclui rede e verificação SHA quando aplicável.';
  });
  screen.appendChild(perf);

  const controls=[
   {id:'brzpin-badge',panel:'brzpin-panel',name:'Banco · Sincronização e backup',legacy:false},
   {id:'brzf60-button',panel:'brzf60-panel',name:'Diagnóstico e recuperação',legacy:false},
   {id:'brzf33-launch',panel:'brzf33-panel',name:'F33 · Conector anterior',legacy:true},
   {id:'brzf34-launch',panel:'brzf34-panel',name:'F34 · Mercado PostgreSQL',legacy:true},
   {id:'brzf35-launch',panel:'brzf35-panel',name:'F35 · Motor PostgreSQL',legacy:true},
   {id:'brzf36-launch',panel:'brzf36-panel',name:'F36 · Validação',legacy:true},
   {id:'brzf37-open',panel:'brzf37-panel',name:'F37 · Pré-publicação',legacy:true},
   {id:'brzf37b-open',panel:'brzf37b-panel',name:'F37B · Integridade',legacy:true}
  ];
  const cards=new Map();
  function collect(){
   for(const spec of controls){
    const launch=document.getElementById(spec.id);
    const panel=document.getElementById(spec.panel);
    let card=cards.get(spec.id);
    if(!launch&&!card)continue;
    if(!card){
     card=document.createElement('div');
     card.className='brzsys-card';
     const title=document.createElement('h3');
     title.textContent=spec.name;card.appendChild(title);
     (spec.legacy?oldGrid:currentGrid).appendChild(card);
     cards.set(spec.id,card);
    }
    if(launch&&launch.parentNode!==card)card.appendChild(launch);
    if(panel&&panel.parentNode!==card){
     panel.classList.add('brzsys-panel');card.appendChild(panel);
    }
    if(spec.id==='brzf33-launch'&&launch?.style.display==='none')
      card.dataset.legacyHidden='true';
   }
   legacy.hidden=oldGrid.children.length===0;
  }
  collect();
  // Some legacy widgets attach directly to document.body after initial load.
  // Observe only direct body additions; not 178k-row table updates.
  const observer=new MutationObserver(changes=>{
   if(changes.some(change=>[...change.addedNodes].some(node=>
       node.nodeType===1&&controls.some(spec=>
         node.id===spec.id||node.id===spec.panel))))
     collect();
  });
  observer.observe(document.body,{childList:true});
  window.__BRZ_SYSTEM_TOOLS_READY=true;
 }

 function installFastNavigation(){
  if(window.__BRZ_PIN_FAST_NAV)return;
  const baseShow=window.showScreen,baseRender=window.renderScreenSafe;
  if(typeof baseShow!=='function'||typeof baseRender!=='function')return;
  let navigating=false,seq=0,dataEpoch=0;
  const cached=new Map(),uiEpoch=new Map();
  window.__BRZ_PIN_INVALIDATE_NAV=()=>{dataEpoch++;cached.clear();};
  const heavy=new Set(['analise','report','corredores','negocios','fretes',
    'mapa','mercado','curva','continuo','portos','indicadores','premios']);
  // Any interaction inside a page invalidates that page's cached rendering.
  // PIN and topnav are outside .screen and do not invalidate cached panels.
  const invalidate=event=>{
   const screen=event.target?.closest?.('.screen');
   if(screen?.id)uiEpoch.set(screen.id,(uiEpoch.get(screen.id)||0)+1);
  };
  ['input','change','click'].forEach(type=>document.addEventListener(type,invalidate,true));
  function signature(id){
   const product=typeof getActiveProduto==='function'?getActiveProduto():'';
   const base=typeof getActiveBase==='function'?getActiveBase():'';
   const version=state?._version||0;
   return [version,dataEpoch,product,base,uiEpoch.get(id)||0].join('|');
  }
  // Keep recently rendered DOM for quick tab switching, but never reuse it
  // following a data mutation, filter interaction, product/base change, or
  // after 12 seconds (so external updates cannot remain stale indefinitely).
  window.renderScreenSafe=function(screenId){
    if(!navigating){
      cached.delete(screenId);
      return baseRender.apply(this,arguments);
    }
    const pane=document.getElementById(screenId);
    if(!pane)return baseRender.apply(this,arguments);
    const stamp=signature(screenId),prior=cached.get(screenId);
    if(heavy.has(screenId)&&prior?.signature===stamp&&
       performance.now()-prior.at<12000){
      pane.removeAttribute('aria-busy');
      return;
    }
    const step=++seq;
    pane.setAttribute('aria-busy','true');
    // Show the active tab first. Heavy recalculation starts after the paint.
    requestAnimationFrame(()=>setTimeout(()=>{
      if(step!==seq||!pane.classList.contains('active')){
       pane.removeAttribute('aria-busy');return;
      }
      const began=performance.now();
      try{
       baseRender.call(window,screenId);
       cached.set(screenId,{signature:signature(screenId),at:performance.now()});
      }finally{
       pane.removeAttribute('aria-busy');
       window.__BRZ_LAST_TAB_RENDER_MS=Math.round(performance.now()-began);
      }
    },0));
  };
  window.showScreen=function(screenId){
    navigating=true;
    try{return baseShow.apply(this,arguments)}
    finally{navigating=false}
  };
  window.__BRZ_PIN_FAST_NAV=true;
 }

 async function savePendingTrade(id,change){
  if(!connected||dirty||saving||blocked||applying||moduleBooting)
   throw Error('Há sincronização pendente. Conclua as gravações antes de salvar esta conta.');
  if(typeof id!=='string'||!/^nf\d{6}_\d{2,4}$/.test(id)||
     !change||typeof change!=='object'||Array.isArray(change))
   throw Error('Atualização de negócio inválida.');
  const index=state.negocios.findIndex(d=>d?.id===id);
  if(index<0)throw Error('Negócio não encontrado.');
  const record=state.negocios[index],old=remote.get(id);
  if(!old||old.deleted)throw Error('Negócio não disponível no histórico versionado.');
  if(old.snapshot!==stable(record))
   throw Error('Existem alterações locais neste negócio. Salve-as antes.');
  if(change.replacementStatus!=='CALCULADO_INDICATIVO'||
     change.replacementIndicativo!==true||
     change.replacementPendente!==false||
     change.replacementCalculo?.executado!==false||
     !Number.isFinite(Number(change.replacementCalculo?.costUSDt)))
   throw Error('Resultado financeiro incompleto ou inválido.');
  const next={...record,...change};
  if(next.id!==id||next.status!=='FECHADO')throw Error('Identificação ou status comercial alterado.');
  const receipt=await req('/rest/v1/rpc/brz_pin_trade_mutate',{
   p_operation_id:crypto.randomUUID(),p_legacy_id:id,p_action:'UPDATE',
   p_expected_version:old.version,p_record:next
  });
  const ack=Array.isArray(receipt)?receipt[0]:receipt;
  if(!ack||ack.legacy_id!==id||ack.applied_action!=='UPDATE'||
     Number(ack.record_version)!==old.version+1||ack.deleted!==false)
   throw Error('Supabase não confirmou a revisão do negócio.');
  state.negocios[index]=next;
  remote.set(id,{version:old.version+1,deleted:false,record:next,snapshot:stable(next)});
  if(typeof window.__BRZ_PIN_INVALIDATE_NAV==='function')window.__BRZ_PIN_INVALIDATE_NAV();
  if(typeof invalidateDataCache==='function')invalidateDataCache();
  if(typeof clearCalcCaches==='function')clearCalcCaches();
  if(typeof scheduleRenderAll==='function')scheduleRenderAll();
  else if(typeof renderAll==='function')renderAll();
  setStatus('Replacement indicativo salvo · '+id);
  window.BRZPendencias?.refresh();
  return ack;
 }
 // F60: persist road-only OSRM route approvals in the existing versioned
 // Supabase 'settings' module. No changes to trades, rail, source freights or curves.
 async function saveRoadGeoRoute(input){
   if(!connected||applying||saving||blocked||dirty||moduleBooting)
     throw Error('Conclua primeiro a sincronização pendente do banco.');
   if(!input||typeof input!=='object'||Array.isArray(input)||input.approved!==true||
       typeof input.id!=='string'||!/^nf\d{6}_\d{2,4}$/.test(input.id)||
       typeof input.routeKey!=='string'||input.routeKey.length>600||
       typeof input.destination!=='string'||!input.destination||input.destination.length>120||
       typeof input.origin!=='string'||!input.origin||input.origin.length>450||
       !Number.isFinite(Number(input.km))||Number(input.km)<1||Number(input.km)>6500||
       !Number.isFinite(Number(input.tku))||Number(input.tku)<=0||Number(input.tku)>5||
       !Number.isFinite(Number(input.freteRodoIndicativo))||Number(input.freteRodoIndicativo)<=0)
     throw Error('Rota rodoviária inválida: nenhuma informação foi gravada.');
   const trade=state.negocios?.find(x=>x.id===input.id);
   if(!trade||trade.origem!==input.origin||String(trade.data||'')!==String(input.date||''))
     throw Error('O negócio mudou: recalcule a rota antes de gravar.');
   const keyExpected=JSON.stringify([input.id,
     input.origin.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),
     input.destination.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),
     String(input.date||'').slice(0,10)]);
   if(input.routeKey!==keyExpected)throw Error('Chave da rota divergente.');
   const entries=state.roadGeoRoutes&&typeof state.roadGeoRoutes==='object'&&!Array.isArray(state.roadGeoRoutes)
     ?state.roadGeoRoutes:{};
   if(Object.keys(entries).length>2000)throw Error('Limite de rotas atingido. Faça auditoria da base.');
   const clean=Object.fromEntries(['id','routeKey','origin','destination','date','port','modal',
     'kmRouted','kmAccess','km','kmTotal','tku','freteRodoIndicativo','originPrecision','originMode','checkedAt','approved','savedAt',
     'source','originLat','originLon','destinationLat','destinationLon'].map(k=>[k,input[k]??null]));
   const previous=remoteModules.get('settings')||{revision:0,snapshot:null};
   const old=state.roadGeoRoutes;
   const next={...entries,[input.routeKey]:clean};
   state.roadGeoRoutes=next;
   const payload=groupSnapshot('settings');
   try{
     const result=await req('/rest/v1/rpc/brz_pin_module_save',{
       p_module:'settings',p_payload:payload,p_expected_revision:previous.revision});
     const ack=Array.isArray(result)?result[0]:result;
     if(ack?.module!=='settings'||Number(ack.revision)!==previous.revision+1)
       throw Error('Persistência de rota sem confirmação do Supabase.');
     remoteModules.set('settings',{revision:Number(ack.revision),snapshot:stable(payload)});
     if(typeof clearCalcCaches==='function')clearCalcCaches();
     if(typeof invalidateDataCache==='function')invalidateDataCache();
     window.BRZPendencias?.refresh();
     setStatus('Rota rodoviária sincronizada · '+input.id);
     return Object.freeze({saved:true,revision:Number(ack.revision),id:input.id});
   }catch(error){
     state.roadGeoRoutes=old;
     throw error;
   }
 }

 // F77: independently versioned origin pinpoint, no change to original trade,
 // road quote, dated CBOT/FX, port route or replacement margin.
 async function saveOriginGeoOverride(input){
   if(!connected||applying||saving||blocked||dirty||moduleBooting)
     throw Error('Finalize a sincronização pendente antes de confirmar a origem.');
   if(!input||typeof input.id!=='string'||!/^nf\d{6}_\d{2,4}$/.test(input.id)||
       input.precision!=='ponto_confirmado'||input.source!=='manual_map_pin'||
       !Number.isFinite(Number(input.lat))||!Number.isFinite(Number(input.lon))||
       Number(input.lat)<-35||Number(input.lat)>6||Number(input.lon)<-75||Number(input.lon)>-32)
     throw Error('Ponto geográfico inválido: nenhuma informação foi gravada.');
   const trade=state.negocios?.find(x=>x.id===input.id);
   if(!trade||String(trade.origem||'')!==String(input.origin||''))
     throw Error('Negócio ou origem alterados; revise a marcação antes de salvar.');
   const current=state.originGeoOverrides&&typeof state.originGeoOverrides==='object'&&!Array.isArray(state.originGeoOverrides)
     ?state.originGeoOverrides:{};
   if(Object.keys(current).length>15000)throw Error('Inventário geográfico acima da capacidade permitida.');
   const next={...current,[input.id]:{
     origin:trade.origem,lat:Number(input.lat),lon:Number(input.lon),
     precision:'ponto_confirmado',source:'manual_map_pin',
     confirmedAt:new Date().toISOString()
   }};
   const previous=remoteModules.get('settings')||{revision:0,snapshot:null};
   const old=state.originGeoOverrides;
   state.originGeoOverrides=next;
   try{
     const result=await req('/rest/v1/rpc/brz_pin_module_save',{
       p_module:'settings',p_payload:groupSnapshot('settings'),
       p_expected_revision:previous.revision});
     const ack=Array.isArray(result)?result[0]:result;
     if(ack?.module!=='settings'||Number(ack.revision)!==previous.revision+1)
       throw Error('Localização não confirmada no Supabase.');
     remoteModules.set('settings',{revision:Number(ack.revision),
       snapshot:stable(groupSnapshot('settings'))});
     window.BRZGeoRegistry?.refresh?.();
     setStatus('Origem geográfica sincronizada · '+input.id);
     return Object.freeze({saved:true,id:input.id,revision:Number(ack.revision)});
   }catch(error){state.originGeoOverrides=old;throw error;}
 }

 async function confirmMarketExcelStage(pack){
  if(!connected||initialHydrating||blocked||dirty||saving||moduleBooting)
   throw Error('Conclua primeiro a sincronização pendente.');
  const day=String(pack?.as_of||''),sha=String(pack?.file_sha256||'');
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(day)||!/^[a-f0-9]{64}$/.test(sha))
   throw Error('Data ou SHA-256 do XLSX inválidos.');
  if(String(state.marketExcelAsOf||'')>=day)
   throw Error('Data já publicada no motor; não sobrescrever snapshots.');
  if(String(state.marketExcelStaged?.as_of||'')>=day)
   throw Error('Fechamento igual ou mais recente já confirmado. Faça rollback explícito.');
  if(state.timestamps?.cbot!==day||state.timestamps?.dolar!==day)
   throw Error('Atualize CBOT e dólar da própria data antes de importar o Excel.');
  const [mod,reconciler,auditor]=await Promise.all([
   import('./market_excel_overlay.mjs?v=20261116f69'),
   import('./market_excel_reconcile.mjs?v=20261116f67'),
   import('./market_excel_audit.mjs?v=20261116f67')]);
  const patch=mod.projectExcel(pack),raw=$('dataPrecos')?.textContent;
  if(!raw)throw Error('Histórico físico imutável não carregado.');
  const original=JSON.parse(raw);
  if(!Array.isArray(original)||original.length<59000)
   throw Error('Histórico incompleto: publicação bloqueada.');
  const capture={source_date:day,capture_no:'PIN-F77',inserted_at:new Date().toISOString(),
   curves:{cbot:structuredClone(state.cbot||{}),cbotMilho:structuredClone(state.cbotMilho||{}),
    cbotFarelo:structuredClone(state.cbotFarelo||{}),cbotOleo:structuredClone(state.cbotOleo||{}),
    dolar:structuredClone(state.dolar||{})}};
  const reconciled=reconciler.reconcileMarketPrices(original,patch.physical,capture,{
   cbotContract:(produto,embarque,data)=>
    typeof brzMesesCBOT==='function'?brzMesesCBOT(produto,embarque,data)?.venc||null:null,
   dolContract:embarque=>
    typeof brzDolEmbarque==='function'?brzDolEmbarque(embarque)?.venc||null:null
  },state.precosEdits||{});
  if(reconciled.status.sourceRows!==patch.physical.length||!reconciled.status.readyCurrent)
   throw Error('Referência CBOT/FX/corredor não conciliada; nenhuma publicação.');
  const prices=reconciler.mergeReconciledMarketPrices(original,reconciled.rows);
  const basis=mod.mergeBasisSeries(ppeData(),patch.basis);
  const cma=mod.mergeCMA(r3Data(),patch.derivatives);
  const ocean=mod.mergeOcean(state,patch.ocean);
  const quality=auditor.auditDailyMarketOverlay(patch,reconciled,basis,cma,ocean);
  if(!quality.ok)throw Error('Excel reprovado: '+[...quality.errors,...quality.warnings].join('; ').slice(0,900));
  const previous=remoteModules.get('settings')||{revision:0};
  const old=state.marketExcelStaged,prior=state.marketExcelPrevious;
  const approved={...pack,status:'confirmado',confirmedAt:capture.inserted_at,
   curve_capture:capture,audit:{totals:quality.totals,errors:quality.errors,
    warnings:quality.warnings,ok:quality.ok}};
  if(JSON.stringify(approved).length>1000000)throw Error('XLSX acima do limite permitido (1MB de dados normalizados).');
  state.marketExcelPrevious=old||null;
  state.marketExcelStaged=approved;
  try{
   const result=await req('/rest/v1/rpc/brz_pin_module_save',{
    p_module:'settings',p_payload:groupSnapshot('settings'),
    p_expected_revision:previous.revision});
   const ack=Array.isArray(result)?result[0]:result;
   if(ack?.module!=='settings'||Number(ack.revision)!==previous.revision+1)
    throw Error('Supabase não confirmou a importação.');
   remoteModules.set('settings',{revision:Number(ack.revision),
    snapshot:stable(groupSnapshot('settings'))});
   return Object.freeze({saved:true,day,sha,revision:Number(ack.revision)});
  }catch(error){
   if(old===undefined)delete state.marketExcelStaged;else state.marketExcelStaged=old;
   if(prior===undefined)delete state.marketExcelPrevious;else state.marketExcelPrevious=prior;
   throw error;
  }
 }
 async function rollbackMarketExcelStage(){
  if(!connected||blocked||dirty||saving||initialHydrating)
   throw Error('Sincronização pendente, rollback bloqueado.');
  if(!state.marketExcelStaged)throw Error('Sem fechamento F77 para reverter.');
  const old=state.marketExcelStaged,prior=state.marketExcelPrevious;
  const current=remoteModules.get('settings')||{revision:0};
  if(prior)state.marketExcelStaged=prior;else delete state.marketExcelStaged;
  delete state.marketExcelPrevious;
  try{
   const reply=await req('/rest/v1/rpc/brz_pin_module_save',{
    p_module:'settings',p_payload:groupSnapshot('settings'),
    p_expected_revision:current.revision});
   const ack=Array.isArray(reply)?reply[0]:reply;
   if(ack?.module!=='settings'||Number(ack.revision)!==current.revision+1)
    throw Error('Rollback sem revisão confirmada.');
   remoteModules.set('settings',{revision:Number(ack.revision),
    snapshot:stable(groupSnapshot('settings'))});
   return Object.freeze({saved:true,revision:Number(ack.revision)});
  }catch(error){state.marketExcelStaged=old;state.marketExcelPrevious=prior;throw error;}
 }
 async function initDailyExcelUpload(){
  try{
   const xlsx=await import('./f77_xlsx_upload.mjs?v=20261117f77');
   xlsx.installExcelUpload({
    getReference:async pack=>{
      const base={curveDay:String(state.timestamps?.cbot||''),
        fxDay:String(state.timestamps?.dolar||'')};
      if(!pack)return base;
      try{
        const [projection,diffModule]=await Promise.all([
          import('./market_excel_overlay.mjs?v=20261116f69'),
          import('./f77_xlsx_diff.mjs?v=20261117f77')]);
        const projected=projection.projectExcel(pack);
        const original=typeof getPrecosBase==='function'?getPrecosBase():[];
        const basis=typeof ppeData==='function'?ppeData():null;
        const cma=typeof r3Data==='function'?r3Data():null;
        const result=diffModule.compareDailyXlsx(projected,{
          physicalHistory:Array.isArray(original)?original:[],
          basisHistory:basis,
          derivativeHistory:Array.isArray(cma?.rows)?cma.rows:[],
          oceanHistory:state.marketExcelOceanRoutes||{}
        });
        return {...base,diff:result};
      }catch(error){return {...base,diffError:String(error?.message||error)};}
    },
    confirmUpload:confirmMarketExcelStage,
    rollbackUpload:rollbackMarketExcelStage
   });
  }catch(error){console.warn('[BRZ F77] Excel upload:',error?.message);}
 }

 async function initGeoRegistry(){
   try{
     const geo=await import('./f77_geo_registry.mjs?v=20261117f77');
     // Reference contains only general municipal coordinates; no farm position
     // and no protected commercial observations are exposed in this asset.
     let geoReferences={qualified:{},unqualified:{}};
     try{
       const response=await fetch('./assets/data/f77_municipal_indicative.json',{cache:'no-cache'});
       if(!response.ok)throw Error('Referência municipal não disponível: '+response.status);
       const data=await response.json();
       if(data?.schema!=='BRZ_F77_GEO_REFERENCE_V1')throw Error('Versão cartográfica divergente');
       geoReferences=data;
     }catch(err){console.warn('[BRZ F77] fallback municipal:',err.message);}
     const normalize=x=>String(x||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim();
     const official=new Map(Object.entries(geoReferences.qualified||{}).map(([k,v])=>[normalize(k),v]));
     const bare=new Map(Object.entries(geoReferences.unqualified||{}).map(([k,v])=>[normalize(k),v]));
     const qualifiedCities=new Set([...official.keys()].map(k=>k.replace(/ - [a-z]{2}$/,'')));
     const qualifiedCoord=key=>{
       const normalized=normalize(key).replace(/\\/([a-z]{2})$/,' - $1');
       let entry=official.get(normalized),source='BRZ F20 · UF conferida';
       if(!entry&&/ - [a-z]{2}$/.test(normalized)){
         const city=normalized.slice(0,-5);
         if(!qualifiedCities.has(city)){entry=bare.get(city);source='BRZ F20 · UF não verificada';}
       }else if(!entry){
         entry=bare.get(normalized);source='BRZ F20 · município sem UF';
       }
       if(Array.isArray(entry)&&entry.length===2){
         const point=[Number(entry[0]),Number(entry[1])];point.source=source;
         return point;
       }
       const old=typeof getCityCoord==='function'?getCityCoord(key):null;
       if(Array.isArray(old)){const point=[Number(old[0]),Number(old[1])];point.source='CITY_COORDS legado';return point;}
       return null;
     };
     // Scope: preexisting map source; read-only until operator confirms an exact pin.
     window.__BRZ_F77_MAP_GETTER=()=>typeof _leafletMap!=='undefined'?_leafletMap:null;
     geo.installGeoRegistry({
       getTrades:()=>Array.isArray(state.negocios)?state.negocios:[],
       getCoord:qualifiedCoord,
       extractCity:raw=>typeof extractCidadeBase==='function'?extractCidadeBase(raw):raw,
       regionOf:deal=>typeof brzF77OriginRegion==='function'?brzF77OriginRegion(deal):deal.corredor,
       getOverrides:()=>state.originGeoOverrides||{},
       saveOverride:saveOriginGeoOverride
     });
   }catch(error){console.warn('[BRZ F77] origem geográfica:',error?.message);}
 }


 async function initDailyClosing(){
  try{
   const mod=await import('./f77_daily_close.mjs?v=20261117f77');
   mod.installDailyClose({
    getTrades:()=>Array.isArray(state.negocios)?state.negocios:[],
    getState:()=>state,
    getGeo:()=>{
     // The registry is read-only and may not yet be expanded by the user.
     const registry=window.BRZGeoRegistry;
     if(!registry||typeof registry.getById!=='function')return null;
     const entries=new Map();
     for(const deal of state.negocios||[])if(deal?.id)entries.set(String(deal.id),registry.getById(deal.id));
     return {entries};
    }
   });
  }catch(error){console.warn('[BRZ F77] conciliação de fechamento:',error?.message);}
 }

 async function initPendingWorkspace(){
  if(window.BRZPendencias)return;
  try{
   const module=await import('./negocios_pendencias.mjs?v=20261116f63');
   module.installPendencias({
    getTrades:()=>Array.isArray(state.negocios)?state.negocios:[],
    getState:()=>state,
    getReferences:async()=>{
     const base=await req('/rest/v1/rpc/brz_pin_replacement_references',{});
     if(!excelBasisReferences.length)return base;
     const k=x=>[x.product,x.port,x.shipment,x.typ,x.day].join('|');
     const keys=new Map((base.basis||[]).map(x=>[k(x),x]));
     for(const x of excelBasisReferences)keys.set(k(x),x);
     return {...base,basis:[...keys.values()],as_of:state.marketExcelAsOf||base.as_of};
    },
    saveTrade:savePendingTrade
   });
  }catch(error){
   console.error('BRZ Pendências:',error);
   const box=$('brzpin-alert');
   if(box)box.textContent='Subaba Pendências indisponível: '+error.message;
  }
 }
 async function connect(arg){
  if(connected||applying)throw Error('Conexão já iniciada');
  const supplied=arg&&typeof arg==='object'?arg:{access_token:arg};
  if(typeof supplied.access_token!=='string'||supplied.access_token.length<40)
    throw Error('Sessão do banco não fornecida');
  token=supplied.access_token;
  refreshToken=typeof supplied.refresh_token==='string'?supplied.refresh_token:null;
  tokenExpiration=Date.now()+Number(supplied.expires_in||3600)*1000;
  // For the initial read only, ensure valid user JWT and complete inventory.
  connected=true;
  initialHydrating=true;
  try{
    setStatus('Lendo os negócios…','working');
    // F68 — isolated renderer only for Fechados, before live trade hydration.
    const guard=await import('./f68_deals_render_guard.mjs?v=20261116f68');
    guard.installDealsRenderIsolation(window);
    const data=await rows();
    if(data.length<EXPECTED)throw Error('Base incompleta');
    apply(data);
    setStatus('Atualizando curvas, fretes e prêmios…','working');
    await loadModules();
    try{await loadExcelMarketOverlay();}
    catch(error){console.error('BRZ Excel F64:',error);const banner=$('brzpin-alert');
      if(banner)banner.textContent='Excel F64 não ativado: '+error.message;}
    const previousButton=$('brzf33-launch');
    if(previousButton)previousButton.style.display='none';
    const base=typeof persist==='function'?persist:null;
    if(!base)throw Error('Persistência legada indisponível');
    persist=function(){
      const result=base.apply(this,arguments);
      schedule();
      return result;
    };
    installMarketHotPath();
    installFreightViewCache();
    installFastNavigation();
    // F73: audit calculations only after all authenticated source and trade
    // overlays are active; the button runs on demand, without any write.
    try{
      const audit=await import('./f73_replacement_audit.mjs?v=20261117f77');
      audit.installReplacementAudit(window,()=>state.negocios);
    }catch(e){console.warn('BRZ F73 auditoria opcional indisponível',e)}
    installSystemToolsTab();
    await initDailyExcelUpload();
    await initPendingWorkspace();
    await initGeoRegistry();
    await initDailyClosing();
    // F77: analytical classification only; contracted destination vs eligible
    // corridor candidates. No writes, inferred export volume, or route changes.
    try{
      const flows=await import('./f77_regional_flows.mjs?v=20261117f77');
      flows.installRegionalFlows({
        getTrades:()=>Array.isArray(state.negocios)?state.negocios:[],
        getRoutes:d=>typeof getRotasCorredor==='function'?getRotasCorredor(d):[]
      });
    }catch(error){console.warn('[BRZ F77] fluxos regionais:',error?.message);}
    dirty=false;blocked=false;
    initialHydrating=false;
    if(typeof scheduleRenderAll==='function')scheduleRenderAll();
    else if(typeof renderAll==='function')renderAll();
    startLivePolling();
    setStatus('Sincronizado · '+data.filter(r=>!r.deleted).length.toLocaleString('pt-BR')+' negócios');
    return Object.freeze({ready:true,records:data.length,autosave:true});
  }catch(error){
    connected=false;setStatus('Falha de conexão','error');
    throw error;
  }finally{
    initialHydrating=false;
  }
 }
 function schedule(){
  if(!connected||applying||blocked)return;
  dirty=true;
  clearTimeout(timer);
  setStatus('Alterações pendentes…','working');
  timer=setTimeout(()=>save().catch(error=>{blocked=true;setStatus('Gravação bloqueada','error');$('brzpin-alert').textContent=error.message;}),950);
 }
 async function save(){
  if(saving||!connected||blocked||!dirty)return;
  saving=true;dirty=false;
  try{
    const present=inv(),operations=[];
    for(const [id,record] of present){
      const old=remote.get(id),shot=stable(record);
      if(!old)operations.push({id,action:'CREATE',version:0,record,snapshot:shot});
      else if(old.deleted)operations.push({id,action:'RESTORE',version:old.version,record,snapshot:shot});
      else if(old.snapshot!==shot)operations.push({id,action:'UPDATE',version:old.version,record,snapshot:shot});
    }
    for(const [id,old] of remote)if(!old.deleted&&!present.has(id))
      operations.push({id,action:'DELETE',version:old.version,record:null,snapshot:null});
    if(!operations.length){
      await saveModules();
      setStatus('Sincronizado');
      return;
    }
    if(operations.length>100)throw Error('Proteção: mais de 100 alterações simultâneas; gravação interrompida');
    setStatus('Gravando '+operations.length+' alteração(ões)…','working');
    for(const op of operations){
      const opKey=op.id+'|'+op.action+'|'+op.version;
      let uuid=operationIds.get(opKey);
      if(!uuid){uuid=crypto.randomUUID();operationIds.set(opKey,uuid);}
      if(op.record&&stable(op.record).length>100000)
        throw Error('Negócio acima do limite de tamanho');
      const answer=await req('/rest/v1/rpc/brz_pin_trade_mutate',{
        p_operation_id:uuid,p_legacy_id:op.id,p_action:op.action,
        p_expected_version:op.version,p_record:op.record
      });
      const ack=Array.isArray(answer)?answer[0]:answer;
      if(!ack||ack.legacy_id!==op.id||Number(ack.record_version)!==op.version+1||
         ack.deleted!==(op.action==='DELETE'))
        throw Error('Gravação sem confirmação');
      remote.set(op.id,{
        version:op.version+1,deleted:op.action==='DELETE',
        record:op.record,snapshot:op.snapshot
      });
      operationIds.delete(opKey);
    }
    await saveModules();
    setStatus('Gravado no Supabase');
    $('brzpin-alert').textContent='';
  }catch(err){
    blocked=true;dirty=true;
    setStatus('Erro: alterações não sincronizadas','error');
    $('brzpin-alert').textContent='Nenhuma alteração será descartada automaticamente. '+err.message;
    throw err;
  }finally{
    saving=false;
    if(dirty&&!blocked)schedule();
  }
 }


 // Imports are explicitly initiated by the authenticated operator in the PIN
 // session. All writes run through the existing Supabase RLS/versioned RPCs.
 // Nothing commercial is committed to public GitHub Pages source code.
 $('brzpin-desk-run').onclick=async()=>{
  const file=$('brzpin-desk-file')?.files?.[0];
  const output=$('brzpin-alert');
  const btn=$('brzpin-desk-run');
  if(!connected||blocked||dirty||saving){
   output.textContent='Conclua as gravações pendentes antes de importar.';return;
  }
  if(!file||file.size<10||file.size>300000){
   output.textContent='Selecione um JSON de importação BRZ válido (até 300 KB).';return;
  }
  let doc;
  try{doc=JSON.parse(await file.text())}
  catch{output.textContent='Arquivo JSON inválido.';return;}
  const records=doc?.business_records,market=doc?.market_patch;
  if(doc?.schema!=='BRZ_DESK_IMPORT_V1'||!Array.isArray(records)||
     records.length<1||records.length>50||!market||
     !/^\d{4}-\d{2}-\d{2}$/.test(doc.source_date||'')){
    output.textContent='Pacote BRZ incompatível.';return;
  }
  const seen=new Set();
  for(const rec of records){
    if(!rec||typeof rec!=='object'||Array.isArray(rec)||
       typeof rec.id!=='string'||!/^nf\d{6}_\d{2,4}$/.test(rec.id)||
       seen.has(rec.id)||rec.data!==doc.source_date||
       !['Soja','Milho','Sorgo','Trigo','Farelo','Óleo'].includes(rec.produto)||
       rec.status!=='FECHADO'||!(Number(rec.volume)>0)||
       !(Number(rec.preco)>0)||typeof rec.vendedor!=='string'||
       typeof rec.comprador!=='string'||stable(rec).length>100000){
       output.textContent='Negócio duplicado ou inválido dentro do pacote.';return;
    }
    seen.add(rec.id);
  }
  const keys=['cbot','cbotMilho','cbotOleo','cbotFarelo','dolar'];
  if(!keys.every(key=>market[key]&&typeof market[key]==='object'&&
    !Array.isArray(market[key])&&Object.keys(market[key]).length>=1&&
    Object.values(market[key]).every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0))||
    !market.snapshot||market.snapshot.snap!==doc.source_date+'-C1'){
    output.textContent='Curvas ou captura de mercado incompatíveis.';return;
  }
  if(!confirm('Importar '+records.length+' negócios FECHADOS e a curva indicativa de '+
     doc.source_date+' no Supabase? Os dados serão gravados em sua sessão PIN.'))return;
  btn.disabled=true;output.textContent='Conferindo IDs no banco…';
  let created=0,unchanged=0,curveSaved=false;
  try{
    const inventory=await rows();
    const existing=new Map(inventory.map(row=>[row.legacy_id,row]));
    for(const rec of records){
      const old=existing.get(rec.id);
      if(old){
        if(!old.deleted&&stable(old.record_json)===stable(rec))unchanged++;
        else throw Error('ID já existe com dados diferentes: '+rec.id);
      }
    }
    const liveCurves=await req('/rest/v1/rpc/brz_pin_module_list',{});
    const srvCurve=liveCurves.find(r=>r.module==='curves');
    const localCurve=remoteModules.get('curves')||{revision:0,snapshot:null};
    if(Number(srvCurve?.revision||0)!==localCurve.revision)
      throw Error('Curvas atualizadas em outro dispositivo. Reabra a plataforma e importe novamente.');
    const original=groupSnapshot('curves');
    const merged=JSON.parse(JSON.stringify(original));
    for(const key of keys)merged[key]={...(merged[key]||{}),...market[key]};
    merged.curvasIntraday={...(merged.curvasIntraday||{}),
      [doc.source_date]:[market.snapshot]};
    // Save first so all subsequent deals reference the same captured curves.
    if(stable(merged)!==stable(original)){
      output.textContent='Gravando curvas indicativas no Supabase…';
      const reply=await req('/rest/v1/rpc/brz_pin_module_save',{
        p_module:'curves',p_payload:merged,p_expected_revision:localCurve.revision});
      const ack=Array.isArray(reply)?reply[0]:reply;
      if(ack?.module!=='curves'||Number(ack.revision)!==localCurve.revision+1)
        throw Error('Curvas sem confirmação de gravação.');
      for(const key of [...keys,'curvasIntraday'])state[key]=merged[key];
      remoteModules.set('curves',{revision:Number(ack.revision),snapshot:stable(merged)});
      curveSaved=true;
    }
    for(const rec of records){
      if(existing.has(rec.id))continue;
      output.textContent='Gravando negócio '+(created+1)+' de '+(records.length-unchanged)+'…';
      const ack=await req('/rest/v1/rpc/brz_pin_trade_mutate',{
        p_operation_id:crypto.randomUUID(),p_legacy_id:rec.id,
        p_action:'CREATE',p_expected_version:0,p_record:rec});
      const receipt=Array.isArray(ack)?ack[0]:ack;
      if(receipt?.legacy_id!==rec.id||Number(receipt.record_version)!==1||
         receipt.applied_action!=='CREATE'||receipt.deleted===true)
        throw Error('Negócio sem confirmação: '+rec.id);
      created++;
    }
    const all=await rows();apply(all);
    if(typeof invalidateDataCache==='function')invalidateDataCache();
    if(typeof clearCalcCaches==='function')clearCalcCaches();
    if(typeof scheduleRenderAll==='function')scheduleRenderAll();
    else if(typeof renderAll==='function')renderAll();
    setStatus('Sincronizado · '+all.filter(r=>!r.deleted).length.toLocaleString('pt-BR')+' negócios');
    output.style.color='#176940';
    output.textContent='Confirmado no Supabase: '+created+' novos negócios; '+
      unchanged+' já existentes; '+(curveSaved?'curvas atualizadas.':'curvas já atuais.');
  }catch(error){
    // PostgreSQL writes completed before an error are durable. Re-importing the
    // same file is safe: matching IDs are skipped after a fresh DB read.
    output.style.color='#a3372a';
    output.textContent='Importação interrompida: '+(error?.message||String(error))+
      '. Gravados até aqui: '+created+' negócio(s). Reabra/recupere e tente novamente.';
    setStatus('Importação incompleta · confira banco','error');
  }finally{btn.disabled=false;}
 };

 $('brzpin-export').onclick=()=>{
   try{
     const modules={};
     for(const name of Object.keys(MODULES))modules[name]=groupSnapshot(name);
     modules.road_delta=roadDiff();
     const data={
       schema:'BRZ_PIN_OPERATIONAL_BACKUP_V1',
       exportedAt:new Date().toISOString(),
       note:'Backup de alterações operacionais. Históricos-base preservados no PostgreSQL.',
       tradeCount:inv().size,trades:[...inv().values()],
       modules,revision:Object.fromEntries(
         [...remoteModules.entries()].map(([name,meta])=>[name,meta.revision]))
     };
     const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
     const url=URL.createObjectURL(blob);
     const a=document.createElement('a');
     a.href=url;a.download='BRZ_Replacement_Alteracoes_'+new Date().toISOString().slice(0,10)+'.json';
     document.body.appendChild(a);a.click();a.remove();
     setTimeout(()=>URL.revokeObjectURL(url),5000);
   }catch(e){
     $('brzpin-alert').textContent='Não foi possível exportar as alterações: '+e.message;
   }
 };

 $('brzpin-reload').onclick=async()=>{
  if(dirty||blocked||saving){
    if(!confirm('Existem mudanças locais não sincronizadas. Descartá-las e recarregar os negócios do Supabase?'))return;
  }
  try{
    blocked=false;dirty=false;setStatus('Atualizando…','working');
    const data=await rows();
    apply(data);
    setStatus('Sincronizado · '+data.filter(r=>!r.deleted).length.toLocaleString('pt-BR')+' negócios');
    $('brzpin-alert').textContent='';
  }catch(err){blocked=true;setStatus('Erro ao atualizar','error');$('brzpin-alert').textContent=err.message;}
 };
 window.addEventListener('beforeunload',event=>{
   if(dirty||saving||blocked){
     event.preventDefault();event.returnValue='';
   }
 });
 window.BRZPinAutoSave=Object.freeze({
   connect,status:()=>({connected,dirty,saving,blocked,records:remote.size}),
   save:()=>save(),saveRoadGeoRoute,saveOriginGeoOverride,
   confirmMarketExcelStage,rollbackMarketExcelStage
 });
})();