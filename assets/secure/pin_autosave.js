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
 let token=null,refreshToken=null,tokenExpiration=0;
 let connected=false,applying=false,saving=false,dirty=false,blocked=false,timer=null;
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
  '<p>Negócios, curvas, fretes, prêmios e configurações editáveis são salvos automaticamente no Supabase. Dados históricos originais são preservados.</p>'+
  '<button id="brzpin-reload" type="button">Recarregar negócios do banco</button>'+ 
  '<button id="brzpin-export" type="button" style="margin-left:5px">Exportar alterações</button>'+
  '<p id="brzpin-alert" role="status"></p>';
 document.body.appendChild(badge);document.body.appendChild(panel);
 badge.onclick=()=>{panel.hidden=!panel.hidden};
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
 let frozenBaseline=null;
 async function rows(){
  // Source 4,011 trades were loaded and SHA-verified by F41 before this
  // bridge starts. Fetch only versioned F33 changes, not 41 redundant pages.
  if(!frozenBaseline){
    const baseline=Array.isArray(state.negocios)?state.negocios:null;
    if(!baseline||baseline.length!==EXPECTED)throw Error('Histórico canônico não carregado');
    frozenBaseline=JSON.parse(JSON.stringify(baseline));
  }
  const response=await req('/rest/v1/rpc/brz_pin_fast_trade_deltas',{});
  if(!response||!Array.isArray(response.rows)||response.rows.length>10000)
    throw Error('Diário de negócios inválido');
  const byId=new Map();
  for(const record of frozenBaseline){
    if(!record||typeof record.id!=='string'||byId.has(record.id))
      throw Error('ID original de negócio duplicado');
    byId.set(record.id,{legacy_id:record.id,record_version:0,
      deleted:false,record_json:record});
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
    remote=new Map(rowsList.map(r=>[r.legacy_id,{
      version:Number(r.record_version),
      deleted:r.deleted,
      record:r.record_json,
      snapshot:r.deleted?null:stable(r.record_json)
    }]));
    if(typeof invalidateDataCache==='function')invalidateDataCache();
    if(typeof clearCalcCaches==='function')clearCalcCaches();
    if(typeof scheduleRenderAll==='function')scheduleRenderAll();
    else if(typeof renderAll==='function')renderAll();
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
   settings:['precosEdits','farmerSelling','r3Hidden','simulacoes']
 });
 let remoteModules=new Map(),roadBaseline=new Map(),moduleBooting=false;
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
     if(roadBaseline.get(id)!==stable(row))upserts.push(row);
   }
   for(const id of roadBaseline.keys())if(!seen.has(id))deletes.push(id);
   if(upserts.length+deletes.length>2500)
      throw Error('Alterações rodoviárias em massa bloqueadas; use a ingestão controlada');
   return {upserts,deletes};
 }
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
     if(roadBaseline.get(id)!==stable(row))upserts.push(row);
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
     for(const record of roadRows){
       if(typeof record?.id!=='string'||roadBaseline.has(record.id))
         throw Error('Histórico rodoviário com ID inválido');
       roadBaseline.set(record.id,stable(record));
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
     for(const name of Object.keys(MODULES)){
       const saved=remoteModules.get(name);
       const snap=stable(groupSnapshot(name));
       remoteModules.set(name,{revision:saved?.revision||0,snapshot:snap});
     }
     const persistedRoad=remoteModules.get('road_delta');
     remoteModules.set('road_delta',{revision:persistedRoad?.revision||0,
       snapshot:stable(roadDiff())});
     if(rows.length){
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
   }
 }

 function installFastNavigation(){
  if(window.__BRZ_PIN_FAST_NAV)return;
  const baseShow=window.showScreen,baseRender=window.renderScreenSafe;
  if(typeof baseShow!=='function'||typeof baseRender!=='function')return;
  let navigating=false,seq=0;
  const cached=new Map(),uiEpoch=new Map();
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
   return [version,product,base,uiEpoch.get(id)||0].join('|');
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
  try{
    setStatus('Lendo os negócios…','working');
    const data=await rows();
    if(data.length<EXPECTED)throw Error('Base incompleta');
    apply(data);
    setStatus('Atualizando curvas, fretes e prêmios…','working');
    await loadModules();
    const previousButton=$('brzf33-launch');
    if(previousButton)previousButton.style.display='none';
    const base=typeof persist==='function'?persist:null;
    if(!base)throw Error('Persistência legada indisponível');
    persist=function(){
      const result=base.apply(this,arguments);
      schedule();
      return result;
    };
    installFastNavigation();
    dirty=false;blocked=false;
    setStatus('Sincronizado · '+data.filter(r=>!r.deleted).length.toLocaleString('pt-BR')+' negócios');
    return Object.freeze({ready:true,records:data.length,autosave:true});
  }catch(error){
    connected=false;setStatus('Falha de conexão','error');
    throw error;
  }
 }
 function schedule(){
  if(!connected||applying||blocked)return;
  dirty=true;
  clearTimeout(timer);
  setStatus('Alterações pendentes…','working');
  timer=setTimeout(()=>save().catch(error=>{blocked=true;setStatus('Gravação bloqueada','error');$('brzpin-alert').textContent=error.message;}),700);
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
   save:()=>save()
 });
})();