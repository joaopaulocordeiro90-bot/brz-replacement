/* BRZ secure entrypoint: protected F40 bootstrap; remote read-only, not production writes. */
(()=>{
'use strict';
const API='https://irekykmigdfvwozerkfa.supabase.co';
const KEY='sb_publishable_lqI_p-_21r3gqerHxsHlLQ_2c-XWwzq';
const EXPECTED=59758,PAGE_SIZE=250,MAX_PAGES=250;
const CANONICAL_LEDGER_SHA='58de80b0093287af20d7abc8362713d2c2db8deb3751083be35cad29a53c2b3d';
const F41_EXPECTED=4011, F41_PAGE_SIZE=250, F41_MAX_PAGES=20;
const F41_FROZEN_LEDGER_SHA='9697b87d6b2db893e5d5b40ca0f25a09a48b733b1ca27134747aa876c81cc890';
const F41_STATE_CANONICAL_SHA='cc388f2468fd598e87b47a29232f7c3b58c92334f8bcd8829c483dbcb8cd8954';
const $=id=>document.getElementById(id);
const localHost=location.protocol==='http:'&&(['127.0.0.1','localhost','[::1]','::1'].includes(location.hostname));
// F55: GitHub Pages may publish only the cleaned HTML and generic code.
// Confidential offers, historical rows and route metadata are fetched after
// Supabase Auth + mesa/admin RLS. A static password screen is NOT file security.
const ghPages=()=>location.protocol==='https:'
 && location.hostname==='joaopaulocordeiro90-bot.github.io'
 && location.port===''
 && (location.pathname==='/brz-replacement/acesso.html');
const stageEdge=()=>location.protocol==='https:' && location.hostname==='irekykmigdfvwozerkfa.supabase.co' && (location.pathname==='/functions/v1/brz-replacement-homologacao/' || location.pathname==='/functions/v1/brz-replacement-homologacao/index.html');
const status=msg=>{ $('status').textContent=msg; };
// F57: server-side SQL EXECUTE grants also deny F33 mutation/restore.
window.__BRZF57_READ_ONLY_STAGING=true;
let loading=false,aborted=false;
function gate(){if(window.__BRZF58_PREFLIGHT?.verified!==true)
 throw Error('F58: pacote público ainda não conferido');
 if((!localHost&&!ghPages()&&!stageEdge())||window.top!==window||!window.isSecureContext)
 throw Error('F59: origem nao autorizada');}
async function request(path,{method='GET',body=null,token=null,attempt=0}={}){
 const h={'apikey':KEY,'Accept':'application/json'};
 if(token)h.Authorization='Bearer '+token;
 if(body!==null)h['Content-Type']='application/json';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),45000);
 try{
  const response=await fetch(API+path,{method,headers:h,
      body:body===null?undefined:JSON.stringify(body),credentials:'omit',redirect:'error',
      cache:'no-store',referrerPolicy:'no-referrer',signal:ctrl.signal});
  if(!response.ok){
    // F59C: 57014 is a PostgreSQL statement timeout, not an auth failure.
    // Retry ONLY the F34 read-only market page; never repeat a mutation.
    let pgCode=null;
    if(response.status===500&&path==='/rest/v1/rpc/brz_api_f34_market_page'){
      try{pgCode=(await response.json())?.code||null;}catch{}
    }
    const transient=[429,502,503,504].includes(response.status)||
      (response.status===500&&pgCode==='57014'&&
       path==='/rest/v1/rpc/brz_api_f34_market_page');
    if(transient&&attempt<3){
      await new Promise(ok=>setTimeout(ok,750*(2**attempt)));
      return request(path,{method,body,token,attempt:attempt+1});
    }
    throw Error('Supabase HTTP '+response.status+
      (pgCode==='57014'?' · F34 timeout (tentativas '+(attempt+1)+')':''));
  }
  return await response.json();
 }finally{clearTimeout(timer);}
}
async function sha256(text){const buf=new TextEncoder().encode(text);
 const hash=await crypto.subtle.digest('SHA-256',buf);
 return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function signIn(email,password){
 const auth=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
 if(!auth?.access_token||!auth?.user?.id||auth.access_token.length<30)throw Error('Sessão inválida');
 const token=auth.access_token;
 const user=await request('/auth/v1/user',{token});
 if(user.id!==auth.user.id)throw Error('Usuário não corresponde à sessão');
 const roleRows=await request('/rest/v1/rpc/brz_api_session',{token});
 const role=Array.isArray(roleRows)?roleRows[0]?.role:roleRows?.role;
 if(!['mesa','admin'].includes(role))throw Error('Acesso reservado à mesa/admin');
 // F59: read-only verified live RPC under the SAME Supabase JWT.
 const res=await request('/rest/v1/rpc/brz_api_f59_readonly_preflight',{method:'POST',body:{},token});
 const f59=Array.isArray(res)?(res.length===1?res[0]:null):res;
 if(!f59||f59.schema!=='BRZ_F59_AUTH_READONLY_PREFLIGHT_V1'||f59.status!=='READ_ONLY'||
   f59.role!==role||f59.trade_count!==4011||f59.market_count!==267959||
   f59.market_deltas!==1531||f59.trade_events!==0||f59.replacement_runs!==0||
   f59.replacement_items!==0||f59.write_enabled!==false||
   f59.real_browser_uat_verified!==false||f59.external_restore_verified!==false||
   f59.production_approved!==false)throw Error('F59: preflight de leitura nao certificado');
 return token;
}
async function loadPrices(token,onProgress){
 const stats=await request('/rest/v1/rpc/brz_api_f34_market_counts',{token});
 if(!Array.isArray(stats)||stats.length!==6||stats.some(r=>!r.ready))throw Error('Fontes F34 não conciliadas');
 const physical=stats.find(r=>r.domain==='physical');
 if(!physical||Number(physical.loaded_rows)!==EXPECTED||Number(physical.expected_rows)!==EXPECTED)
    throw Error('Inventário de preços físicos divergente');
 const records=[],canonical=[],seen=new Set();let cursor=0,pages=0;
 for(;pages<MAX_PAGES;pages++){
  if(aborted)throw Error('Carregamento interrompido');
  const page=await request('/rest/v1/rpc/brz_api_f34_market_page',{
   method:'POST',token,body:{p_domain:'physical',p_after_row_no:cursor,p_limit:PAGE_SIZE,p_from_date:null}});
  if(!Array.isArray(page)||page.length>PAGE_SIZE||page.length===0)break;
  let previous=cursor;
  // Digest per page is validated against the source record SHA captured in F34.
  const digests=await Promise.all(page.map(async r=>{
    if(!r||r.domain!=='physical'||!Number.isSafeInteger(Number(r.row_no))||r.row_no<=0
       ||typeof r.source_key!=='string'||typeof r.record_json?.record_text!=='string'
       ||!/^[a-f0-9]{64}$/.test(r.record_json?.record_sha256||''))
      throw Error('Linha F34 malformada');
    return sha256(r.record_json.record_text);
  }));
  for(let i=0;i<page.length;i++){
   const row=page[i];
   if(row.row_no<=previous||digests[i]!==row.record_json.record_sha256)
      throw Error('Ordem ou SHA de registro físico divergente');
   previous=row.row_no;
   let obj;try{obj=JSON.parse(row.record_json.record_text);}catch{throw Error('Registro físico não é JSON');}
   if(!obj||obj.id!==row.source_key||seen.has(obj.id))throw Error('ID físico duplicado/divergente');
   seen.add(obj.id);records.push(obj);canonical.push(row.record_json.record_text);
  }
  cursor=previous;onProgress(records.length,pages+1);
  if(page.length<PAGE_SIZE)break;
 }
 if(pages>=MAX_PAGES||records.length!==EXPECTED||seen.size!==EXPECTED)
    throw Error('Fonte física incompleta: '+records.length+' / '+EXPECTED);
 // F40 fix: the F34 row_no preserves ingestion order. The final 464
 // observations were appended after the initial 59,294 records even though
 // the original V4FQ dataPrecos array is ordered by quote date, then ID.
 // Restore EXACT original order before comparing the sealed source ledger
 // and before handing the 59,758 records to the legacy renderer.
 const ordered=records.map((record,i)=>({record,canonical:canonical[i]}));
 for(const item of ordered){
   if(typeof item.record.data!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(item.record.data)||
      typeof item.record.id!=='string')
     throw Error('F40: data ou ID de preço físico inválido');
 }
 ordered.sort((a,b)=>
   a.record.data<b.record.data?-1:a.record.data>b.record.data?1:
   a.record.id<b.record.id?-1:a.record.id>b.record.id?1:0);
 const ledger=await sha256(ordered.map(item=>item.canonical).join('\n')+'\n');
 if(ledger!==CANONICAL_LEDGER_SHA)throw Error('F40: conteúdo físico divergente da V4FQ após ordenação original');
 return ordered.map(item=>item.record);
}

// F41: all original 4.011 trades are read-only. Never calls F33 mutation RPCs.
function stableStringify(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';
}
async function loadFrozenTrades(token,onProgress){
 const rows=[], hashes=[],seen=new Set();let cursor=0,pages=0;
 for(;pages<F41_MAX_PAGES;pages++){
   if(aborted)throw Error('F41: leitura interrompida');
   const page=await request('/rest/v1/rpc/brz_api_f41_trade_source_page',{
     method:'POST',token,body:{p_after_id:cursor,p_limit:F41_PAGE_SIZE}});
   if(!Array.isArray(page)||page.length>F41_PAGE_SIZE)throw Error('F41: página de negócios inválida');
   if(!page.length)break;
   for(const r of page){
     const ord=Number(r?.original_index);
     if(!Number.isSafeInteger(ord)||ord!==rows.length+1||
       typeof r.legacy_id!=='string'||!r.legacy_id||seen.has(r.legacy_id)||
       !r.source_json||typeof r.source_json!=='object'||Array.isArray(r.source_json)||
       r.source_json.id!==r.legacy_id||!/^[a-f0-9]{64}$/.test(r.record_sha256||''))
       throw Error('F41: ordem ou identidade histórica divergente');
     seen.add(r.legacy_id);rows.push(r.source_json);
     hashes.push({id:r.legacy_id,sha:r.record_sha256});cursor=ord;
   }
   onProgress(rows.length,pages+1);
   if(page.length<F41_PAGE_SIZE)break;
 }
 if(pages>=F41_MAX_PAGES||rows.length!==F41_EXPECTED||seen.size!==F41_EXPECTED)
   throw Error('F41: histórico incompleto ('+rows.length+'/'+F41_EXPECTED+')');
 const ledger=await sha256(hashes.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(x=>x.id+'|'+x.sha+'\n').join(''));
 if(ledger!==F41_FROZEN_LEDGER_SHA)throw Error('F41: fonte PostgreSQL não confere com ledger V4FQ');
 // Hash of the entire ORIGINAL ORDERED business object array in JS canonical form.
 // Detects changed payload despite a replayed/matching server ledger.
 const stateSha=await sha256(stableStringify(rows));
 if(stateSha!==F41_STATE_CANONICAL_SHA)
   throw Error('F41: fonte completa ou sequência de negócios divergente da V4FQ');
 return rows;
}
async function preflightModules(){
 // F49: dynamic imports must resolve relative to assets/f40/f40_boot.js.
 // Fail before asking the user to type a password if a deployment is incomplete.
 const checks=[
  ['../f43/f43_derivatives_gate.mjs','hydrateF43Derivatives'],
  ['../f44/f44_market_gate.mjs','hydrateF44Market'],
  ['../f45/f45_rail_source_gate.mjs','hydrateF45Rail'],
  ['../f46/f46_road_source_gate.mjs','hydrateF46Road'],
  ['../f47/f47_premiums_gate.mjs','hydrateF47Premiums'],
  ['../f48/f48_source_gate.mjs','hydrateF48Legacy'],
  ['../f55/f55_protected_source.mjs','hydrateF55ProtectedSources'],
  ['../f57/f57_auth_handoff.mjs','assertF57ReadOnlyHandoff']
 ];
 const modules=await Promise.all(checks.map(async ([path,name])=>{
  let mod;try{mod=await import(path);}catch(e){throw Error('F49: módulo '+name+' indisponível: '+e.message);}
  if(typeof mod?.[name]!=='function')throw Error('F49: exportação '+name+' ausente');
  return name;
 }));
 return modules;
}
async function start(ev){
 ev.preventDefault();if(loading)return;
 loading=true;$('go').disabled=true;
 let token=null;
 try{
  gate();status('F49 · verificando oito módulos locais antes da autenticação…');
  await preflightModules();
  status('Autenticando sessão mesa/admin…');
  token=await signIn($('user').value.trim(),$('pass').value);
  $('pass').value='';
  status('F56 · protegendo metadados e exceções comerciais específicas…');
  const f56Rows=await request('/rest/v1/rpc/brz_api_f56_private_runtime_config',{
    method:'POST',body:{},token});
  if(!Array.isArray(f56Rows)||f56Rows.length!==1||
     typeof f56Rows[0]?.source_text!=='string'||
     f56Rows[0]?.source_sha256!=='5564509b56fc57f5719e37fc3d47a98af6dc4b4438d042d9cc330610960b8819'||
     await sha256(f56Rows[0].source_text)!=='5564509b56fc57f5719e37fc3d47a98af6dc4b4438d042d9cc330610960b8819')
    throw Error('F56: source metadata SHA mismatch or session access denied');
  const f56Config=JSON.parse(f56Rows[0].source_text);
  if(f56Config?.schema!=='BRZ_F56_PRIVATE_RUNTIME_V1'||
     !f56Config.derivativesMeta||typeof f56Config.derivativesMeta!=='object'||
     !Array.isArray(f56Config.forcedTRIds)||f56Config.forcedTRIds.length!==4||
     typeof f56Config.specialPortId!=='string'||typeof f56Config.specialPortDate!=='string')
    throw Error('F56: private source fields invalid');
  window.__BRZF56_PRIVATE_RUNTIME=Object.freeze(f56Config);
  status('F55 · autenticando fontes confidenciais para hospedagem estática…');
  const {hydrateF55ProtectedSources}=await import('../f55/f55_protected_source.mjs');
  const protected55=await hydrateF55ProtectedSources({request,token,sha256,
    isAborted:()=>aborted});
  // These values never appear in public static HTML/JS; only JWT/RLS returns them.
  window.__BRZF55_CFR=protected55.cfr_offers;
  window.__BRZF55_OCEAN=protected55.ocean_freight;
  window.__BRZF44_META=protected55.f44_meta;
  window.__BRZF46_PRIVATE_META=protected55.f46_meta;
  window.__BRZF55_VERIFIED=true;
  status('Autenticado · verificando os 4.011 negócios históricos originais…');
  const frozenTrades=await loadFrozenTrades(token,(n,p)=>{
    if(p===1||p%4===0)status('Lendo negócios V4FQ via PostgreSQL: '+n.toLocaleString('pt-BR')+' / 4.011 · '+p+' páginas');
  });
  status('Histórico V4FQ conciliado. Reconstituindo seleção legada de 2.820 negócios…');
  const privateOrder=await request('/rest/v1/rpc/brz_api_f42_deal_order',{
    method:'POST',token,body:{}});
  if(typeof window.__BRZF42_HYDRATE!=='function')
    throw Error('F42: hidratador da seleção indisponível');
  const orderedDeals=await window.__BRZF42_HYDRATE(privateOrder,frozenTrades,sha256);
  status('Seleção conciliada. Autenticando 14.235 cotações de derivados CMA SPOT…');
  const {hydrateF43Derivatives}=await import('../f43/f43_derivatives_gate.mjs');
  const derivativesResult=await hydrateF43Derivatives({request,token,sha256,
    onProgress:(n,p)=>{if(p===1||p%8===0)status('Lendo derivados CMA via PostgreSQL: '+n.toLocaleString('pt-BR')+' / 14.235 · '+p+' páginas');},
    isAborted:()=>aborted});
  status('Derivados conciliados. Autenticando curvas CBOT/DOL e histórico FOB…');
  const {hydrateF44Market}=await import('../f44/f44_market_gate.mjs');
  const resultF44=await hydrateF44Market({request,token,sha256,
    manifest:window.__BRZF44_META,
    onProgress:(domain,n,expected)=>{
      if(n===250||n%4000<250||n===expected)
        status('F44 · '+domain+': '+n.toLocaleString('pt-BR')+' / '+expected.toLocaleString('pt-BR')+' pontos verificados');
    },
    isAborted:()=>aborted});
  status('Tarifas ferroviárias da V4FQ · autenticando 39 rotas e verificando SHA-256…');
  const {hydrateF45Rail}=await import('../f45/f45_rail_source_gate.mjs');
  const rail=await hydrateF45Rail({request,token,sha256});
  status('F46 · autenticando 178.201 fretes rodoviários, incluindo S46/2026…');
  const {hydrateF46Road}=await import('../f46/f46_road_source_gate.mjs');
  const road=await hydrateF46Road({request,token,sha256,
    manifest:window.__BRZF46_PRIVATE_META,
    onProgress:(n,expected,p)=>{
      if(p===1||p%20===0||n===expected)
        status('F46 · histórico rodoviário: '+n.toLocaleString('pt-BR')+' / '+expected.toLocaleString('pt-BR')+' · '+p+' páginas');
    },isAborted:()=>aborted});
  status('F47 · autenticando os 38 registros de prêmios FOB históricos…');
  const {hydrateF47Premiums}=await import('../f47/f47_premiums_gate.mjs');
  const premiums=await hydrateF47Premiums({request,token,sha256});
  status('F48 · hidratando histórico de auditoria, estado e regras via PostgreSQL…');
  const {hydrateF48Legacy}=await import('../f48/f48_source_gate.mjs');
  const restored=await hydrateF48Legacy({request,token,sha256,
   onProgress:(s,n,total)=>{if(n===1||n===total)status('F48 · '+s+': '+n+'/'+total+' fragmentos');},
   isAborted:()=>aborted});
  status('F48 · três fontes históricas verificadas. Verificando 59.758 preços físicos…');
  const rows=await loadPrices(token,(n,p)=>{
    if(p===1||p%8===0)status('Carregando preços físicos via PostgreSQL: '+n.toLocaleString('pt-BR')+' / 59.758 · '+p+' páginas');
  });
  // Do not persist data to localStorage, IndexedDB, sessionStorage, URL, cache or disk.
  window.__BRZF48_SOURCES=restored.sources;
  window.__BRZF48_READY=true;
  window.__BRZF47_PREMIUM_ROWS=premiums.records;
  window.__BRZF47_PREMIUM_READY=true;
  window.__BRZF46_ROAD=road.payload;
  window.__BRZF46_ROAD_READY=true;
  window.__BRZF45_RAIL_ROWS=rail.rows;
  window.__BRZF45_RAIL_READY=true;
  window.__BRZF44_CURVES=resultF44.curves;
  window.__BRZF44_BASIS=resultF44.basis;
  window.__BRZF44_READY=true;
  window.__BRZF43_DERIV_ROWS=derivativesResult.rows;
  window.__BRZF43_DERIV_READY=true;
  window.__BRZF42_DEALS=orderedDeals;
  window.__BRZF42_DEALS_READY=true;
  window.__BRZF41_TRADES=frozenTrades;
  window.__BRZF41_TRADES_READY=true;
  window.__BRZF40_PHYSICAL_ROWS=rows;
  window.__BRZF40_PHYSICAL_READY=true;
  $('user').value='';
  status('Fonte autenticada verificada: 59.758 registros. Inicializando motor legado preservado…');
  const iframe=$('app');
  iframe.addEventListener('load',async()=>{
    let valid=false;
    try{valid=iframe.contentWindow?.__BRZF43_DERIV_RENDERED===true
      &&iframe.contentWindow?.__BRZF44_CURVES_RENDERED===true
      &&iframe.contentWindow?.__BRZF44_BASIS_RENDERED===true
      &&iframe.contentWindow?.__BRZF45_RAIL_RENDERED===true
      &&iframe.contentWindow?.__BRZF46_ROAD_RENDERED===true
      &&iframe.contentWindow?.__BRZF47_PREMIUM_RENDERED===true
      &&iframe.contentWindow?.__BRZF48_HISTORY_RENDERED===true
      &&iframe.contentWindow?.__BRZF48_STATE_RENDERED===true
      &&iframe.contentWindow?.__BRZF48_RULES_RENDERED===true;}catch{}
    try{
      if(!valid)throw Error('fontes do motor não foram verificadas');
      const connector=iframe.contentWindow?.BRZF33;
      if(typeof connector?.attachAuthenticatedReadOnly!=='function')
        throw Error('ponte F33 de sessão única ausente');
      const attestation=await connector.attachAuthenticatedReadOnly(token);
      const {assertF57ReadOnlyHandoff}=await import('../f57/f57_auth_handoff.mjs');
      assertF57ReadOnlyHandoff(attestation);
      token=null;
      window.__BRZF57_BRIDGE_VERIFIED=true;
      document.body.classList.add('loaded');
    }catch(e){
      token=null;window.__BRZF57_BRIDGE_VERIFIED=false;
      iframe.src='about:blank';
      window.__BRZF41_TRADES=null;window.__BRZF41_TRADES_READY=false;
      window.__BRZF42_DEALS=null;window.__BRZF42_DEALS_READY=false;
      window.__BRZF40_PHYSICAL_ROWS=null;window.__BRZF40_PHYSICAL_READY=false;
      window.__BRZF56_PRIVATE_RUNTIME=null;
      status('F57 BLOQUEADO: '+e.message+'. Recarregue para tentar novamente.');
      $('go').disabled=true;loading=false;
    }
  },{once:true});
  iframe.src='app.html';
  // JWT held only in this closure until iframe inventory attestation completes.

 }catch(e){
  window.__BRZF56_PRIVATE_RUNTIME=null;
  window.__BRZF55_CFR=null;window.__BRZF55_OCEAN=null;window.__BRZF44_META=null;
  window.__BRZF46_PRIVATE_META=null;window.__BRZF55_VERIFIED=false;
  window.__BRZF48_SOURCES=null;window.__BRZF48_READY=false;
  window.__BRZF47_PREMIUM_ROWS=null;window.__BRZF47_PREMIUM_READY=false;
  window.__BRZF46_ROAD=null;window.__BRZF46_ROAD_READY=false;
  window.__BRZF45_RAIL_ROWS=null;window.__BRZF45_RAIL_READY=false;
  window.__BRZF44_CURVES=null;window.__BRZF44_BASIS=null;window.__BRZF44_READY=false;
  window.__BRZF43_DERIV_ROWS=null;window.__BRZF43_DERIV_READY=false;
  window.__BRZF42_DEALS=null;window.__BRZF42_DEALS_READY=false;
  window.__BRZF41_TRADES=null;window.__BRZF41_TRADES_READY=false;
  window.__BRZF40_PHYSICAL_ROWS=null;window.__BRZF40_PHYSICAL_READY=false;
  $('pass').value='';status('BLOQUEADO: '+e.message+'\nNenhum dado local foi substituído.');
  $('go').disabled=false;loading=false;
 }
}
$('authform').addEventListener('submit',start);
// F49: do not solicit user credentials before all local ES modules exist.
$('go').disabled=true;$('user').disabled=true;$('pass').disabled=true;
(async()=>{
 try{
  gate();status('F49 · verificando a integridade dos oito módulos locais…');
  await preflightModules();
  $('user').disabled=false;$('pass').disabled=false;$('go').disabled=false;
  status('Oito módulos verificados. Aguardando autenticação mesa/admin.');
 }catch(e){
  status('BLOQUEADO F49: '+e.message);
  $('go').disabled=true;$('user').disabled=true;$('pass').disabled=true;
 }
})();
// Explicit lightweight probe for offline test harness; read-only, no credentials exposed.
window.BRZF40=Object.freeze({version:'F40_PRECOS_REMOTOS_LOCAL',getStatus:()=>Object.freeze({
  ready:window.__BRZF40_PHYSICAL_READY===true,
  count:Array.isArray(window.__BRZF40_PHYSICAL_ROWS)?window.__BRZF40_PHYSICAL_ROWS.length:0,
  loader:'physical',writes:0,backend:'F34_JWT',productionApproved:false})});
window.BRZF41=Object.freeze({version:'F41_STATE_TRADES_POSTGRES_LOCAL',getStatus:()=>Object.freeze({
  ready:window.__BRZF41_TRADES_READY===true,
  count:Array.isArray(window.__BRZF41_TRADES)?window.__BRZF41_TRADES.length:0,
  source:'F32_V4FQ_JWT',writes:0,productionApproved:false})});
window.BRZF42=Object.freeze({version:'F42_SELECTION_POSTGRES_LOCAL',getStatus:()=>Object.freeze({
 ready:window.__BRZF42_DEALS_READY===true,
 count:Array.isArray(window.__BRZF42_DEALS)?window.__BRZF42_DEALS.length:0,
 source:'F42_V4FQ_ORDER_JWT',writes:0,productionApproved:false})});
window.BRZF43=Object.freeze({version:'F43_DERIVATIVES_POSTGRES_LOCAL',getStatus:()=>Object.freeze({
 ready:window.__BRZF43_DERIV_READY===true,
 count:Array.isArray(window.__BRZF43_DERIV_ROWS)?window.__BRZF43_DERIV_ROWS.length:0,
 source:'F34_DERIVATIVES_JWT',writes:0,productionApproved:false})});

window.BRZF44=Object.freeze({version:'F44_CURVAS_BASIS_PG_JWT',getStatus:()=>Object.freeze({
 ready:window.__BRZF44_READY===true,
 curves:window.__BRZF44_READY===true?16418:0,
 basisPoints:window.__BRZF44_READY===true?107184:0,
 basisSeries:window.__BRZF44_READY===true?1405:0,
 writes:0,productionApproved:false})});
})();

window.BRZF45=Object.freeze({version:'F45_RAIL_JWT_LOCAL',getStatus:()=>Object.freeze({ready:window.__BRZF45_RAIL_READY===true,count:Array.isArray(window.__BRZF45_RAIL_ROWS)?window.__BRZF45_RAIL_ROWS.length:0,writes:0,productionApproved:false})});

window.BRZF46=Object.freeze({version:'F46_ROAD_JWT_LOCAL',getStatus:()=>Object.freeze({
 ready:window.__BRZF46_ROAD_READY===true,
 rows:window.__BRZF46_ROAD_READY===true?178201:0,
 s46:window.__BRZF46_ROAD_READY===true?514:0,
 writes:0,productionApproved:false})});

window.BRZF47=Object.freeze({version:'F47_PREMIOS_JWT_HOMOLOG',getStatus:()=>Object.freeze({ready:window.__BRZF47_PREMIUM_READY===true,count:window.__BRZF47_PREMIUM_ROWS?.length||0,writes:0,productionApproved:false})});

window.BRZF48=Object.freeze({version:'F48_PRIVATE_SNAPSHOT_GATED',getStatus:()=>Object.freeze({ready:window.__BRZF48_READY===true,sources:window.__BRZF48_READY===true?3:0,writes:0,productionApproved:false})});
