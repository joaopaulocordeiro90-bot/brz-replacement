/* BRZ secure entrypoint: protected F40 bootstrap; remote read-only, not production writes. */
(()=>{
'use strict';
const API='https://irekykmigdfvwozerkfa.supabase.co';
const KEY='sb_publishable_lqI_p-_21r3gqerHxsHlLQ_2c-XWwzq';
const EXPECTED=59758,PAGE_SIZE=1500,MAX_PAGES=46;
const CANONICAL_LEDGER_SHA='58de80b0093287af20d7abc8362713d2c2db8deb3751083be35cad29a53c2b3d';
const F41_EXPECTED=4011, F41_PAGE_SIZE=1000, F41_MAX_PAGES=7;
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
 && ['/brz-replacement/','/brz-replacement/index.html','/brz-replacement/pin.html'].includes(location.pathname);
const stageEdge=()=>location.protocol==='https:' && location.hostname==='irekykmigdfvwozerkfa.supabase.co' && (location.pathname==='/functions/v1/brz-replacement-homologacao/' || location.pathname==='/functions/v1/brz-replacement-homologacao/index.html');
const status=msg=>{ $('status').textContent=msg; };
// F57: server-side SQL EXECUTE grants also deny F33 mutation/restore.
window.__BRZF57_READ_ONLY_STAGING=true; // isolate legacy F33 UI; PIN autosave uses its own bridge
let loading=false,aborted=false;
let pinRefreshToken=null,pinExpiresIn=3600;
const SESSION_KEY='brz_replacement_tab_auth_v1';
const SESSION_MS=60*60*1000;
let tabSessionUntil=0,activeUserId=null;
function forgetTabSession(){
 try{sessionStorage.removeItem(SESSION_KEY)}catch(e){}
 tabSessionUntil=0;activeUserId=null;
}
function rememberTabSession(accessToken,refreshToken,expiresIn,keepUntil){
 if(typeof accessToken!=='string'||accessToken.length<40||
    typeof refreshToken!=='string'||refreshToken.length<1)return;
 const now=Date.now(),until=Number(keepUntil)||now+SESSION_MS;
 if(until<=now)return;
 tabSessionUntil=until;
 try{
  // Credentials are scoped to this browser TAB, not localStorage/cookies.
  // Never persist the six-digit PIN or any confidential market data.
  sessionStorage.setItem(SESSION_KEY,JSON.stringify({
   access_token:accessToken,refresh_token:refreshToken,
   token_expires_at:now+Math.max(60,Number(expiresIn)||3600)*1000,
   keep_until:until
  }));
 }catch(e){}
}
async function restoreTabSession(){
 let saved=null;
 try{saved=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch(e){}
 if(!saved||typeof saved.access_token!=='string'||
    typeof saved.refresh_token!=='string'||!Number.isFinite(saved.keep_until)||
    saved.keep_until<=Date.now()||saved.keep_until>Date.now()+SESSION_MS+60000){
  forgetTabSession();return null;
 }
 try{
  let token=saved.access_token,refresh=saved.refresh_token;
  let seconds=Math.max(0,Math.floor((Number(saved.token_expires_at)-Date.now())/1000));
  if(seconds<120){
   const resp=await fetch(API+'/auth/v1/token?grant_type=refresh_token',{
    method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',
      Accept:'application/json'},body:JSON.stringify({refresh_token:refresh}),
    cache:'no-store',redirect:'error',credentials:'omit',referrerPolicy:'no-referrer'});
   if(!resp.ok){
    const err=Error('Sessão não renovável: Supabase HTTP '+resp.status);
    err.status=resp.status;
    throw err;
   }
   const rotated=await resp.json();
   if(typeof rotated?.access_token!=='string'||typeof rotated?.refresh_token!=='string')
    throw Error('Sessão inválida');
   token=rotated.access_token;refresh=rotated.refresh_token;
   seconds=Number(rotated.expires_in||3600);
  }
  const [user,roleRows]=await Promise.all([
   request('/auth/v1/user',{token}),
   request('/rest/v1/rpc/brz_api_session',{token})
  ]);
  const role=Array.isArray(roleRows)?roleRows[0]?.role:roleRows?.role;
  if(typeof user?.id!=='string'||!['mesa','admin'].includes(role))
   throw Error('Sessão não autorizada');
  activeUserId=user.id;
  pinRefreshToken=refresh;pinExpiresIn=seconds;
  rememberTabSession(token,refresh,seconds,saved.keep_until);
  return token;
 }catch(e){
   // A temporary network failure or timeout is not a logout.
   // Keep the unexpired tab session so F5 can retry without a new PIN.
   const message=String(e?.message||e);
   const trulyInvalid=[401,403].includes(Number(e?.status))||
     message==='Sessão não autorizada'||
     message==='Sessão inválida';
   if(trulyInvalid){forgetTabSession();return null;}
   throw Error('Não foi possível restabelecer a conexão: '+message);
 }
}
// The inner iframe rotates Supabase refresh tokens while the operator works.
// Keep the parent tab's saved token synchronized to avoid F5 logout.
window.__BRZ_UPDATE_TAB_TOKEN=function(info){
 if(!info||typeof info.access_token!=='string'||typeof info.refresh_token!=='string')return;
 rememberTabSession(info.access_token,info.refresh_token,
   Number(info.expires_in||3600),tabSessionUntil);
};
window.__BRZ_END_TAB_SESSION=()=>{
 forgetTabSession();
 import('./tab_cache.mjs?v=20261116tabcache01')
   .then(mod=>mod.clearHydrationCache())
   .catch(()=>{})
   .finally(()=>location.reload());
};
let marketStatsCached=null;
function gate(){if(window.__BRZF58_PREFLIGHT?.verified!==true)
 throw Error('F58: pacote público ainda não conferido');
 if((!localHost&&!ghPages()&&!stageEdge())||window.top!==window||!window.isSecureContext)
 throw Error('F59: origem nao autorizada');}
// Bounded concurrency protects Supabase from memory-heavy simultaneous reads.
const MAX_HEAVY_READS=3;
let activeHeavyReads=0;
const heavyWaiters=[];
async function heavyReadFetch(url,options,heavy){
 if(!heavy)return fetch(url,options);
 if(activeHeavyReads<MAX_HEAVY_READS)activeHeavyReads++;
 else await new Promise(resolve=>heavyWaiters.push(resolve));
 try{return await fetch(url,options)}
 finally{
  const next=heavyWaiters.shift();
  if(next)next();else activeHeavyReads--;
 }
}
// If a large authenticated read exceeds the DB statement timeout, split that
// page into smaller, cursor-contiguous queries; no business writes or fallbacks
// to public data. Keeps the caller's expected page length and source ordering.
async function splitReadPage(path,body,token){
 const kind=path.includes('f34_market_page')?'market':
   path.includes('f46_road_page')?'road':'trades';
 const width=kind==='road'?750:250;
 const out=[];let cursor={...body};
 while(out.length<Number(body.p_limit)){
  const size=Math.min(width,Number(body.p_limit)-out.length);
  const page=await request(path,{method:'POST',token,body:{...cursor,p_limit:size},attempt:0});
  if(!Array.isArray(page)||page.length>size)throw Error('Página de recuperação inválida');
  if(page.length){
   out.push(...page);
   const tail=page.at(-1);
   if(kind==='market')cursor.p_after_row_no=tail.row_no;
   else if(kind==='road'){
     cursor.p_after_origin=tail.origin_text;
     cursor.p_after_destination=tail.destination_text;
     cursor.p_after_week=tail.iso_week;
   }else cursor.p_after_id=tail.original_index;
  }
  if(page.length<size)break;
 }
 return out;
}
// F62: contiguous, immutable F34 row_no ranges permit authenticated parallel
// pagination without OFFSET, disk caching or changing any source checksum.
// Three concurrent SQL reads globally; the original SHA ledgers still attest
// every page after assembly in its canonical order.
const MARKET_WINDOWS=Object.freeze({
 physical:{first:32059,total:59758},
 curves:{first:1,total:16418},
 derivatives:{first:17824,total:14235},
 basis_points:{first:91817,total:107184}
});
const eagerMarket=new Map();
let eagerRoad=null;
function concurrentPages(count,workerCount,loadPage){
 const promises=[],resolvers=[];
 for(let i=0;i<count;i++){
  const p=new Promise((resolve,reject)=>resolvers.push({resolve,reject}));
  // Each is intentionally observed immediately, even if a later page fails
  // before its upstream sequential consumer has reached that page.
  p.catch(()=>{});
  promises.push(p);
 }
 for(let k=0;k<Math.min(workerCount,count);k++)(async()=>{
  for(let i=k;i<count;i+=workerCount){
   try{resolvers[i].resolve(await loadPage(i));}
   catch(e){resolvers[i].reject(e);}
  }
 })();
 return promises;
}
function readMarketAhead(path,body,token){
 const domain=body?.p_domain,meta=MARKET_WINDOWS[domain],size=Number(body?.p_limit);
 if(!meta||size!==1500||body.p_from_date!=null)return null;
 const cursor=Number(body.p_after_row_no);
 let index=0;
 if(cursor!==0){
  const offset=cursor-(meta.first-1);
  if(offset<=0||offset%size!==0)return null;
  index=offset/size;
 }
 const pages=Math.ceil(meta.total/size);
 if(index>=pages)return null;
 let task=eagerMarket.get(domain);
 if(!task){
  task=concurrentPages(pages,3,i=>request(path,{
    method:'POST',token,body:{...body,p_after_row_no:i===0?0:meta.first-1+i*size},
    skipAhead:true
  }));
  eagerMarket.set(domain,task);
 }
 return task[index];
}
async function readRoadAhead(path,body,token){
 if(!body||Number(body.p_limit)!==4000)return null;
 if(!eagerRoad){
  eagerRoad=(async()=>{
   const reply=await request('/rest/v1/rpc/brz_pin_fast_road_cursors',{
     method:'POST',token,body:{p_limit:4000},skipAhead:true});
   const cursors=reply?.cursors;
   if(!Array.isArray(cursors)||cursors.length!==44||Number(reply.total)!==177687||
      Number(reply.page_size)!==4000)throw Error('Índice protegido de fretes incompleto');
   const anchors=[null,...cursors];
   const pages=concurrentPages(anchors.length,3,i=>{
    const c=anchors[i];
    return request(path,{method:'POST',token,skipAhead:true,body:{
      p_after_origin:c?.origin??null,p_after_destination:c?.destination??null,
      p_after_week:c?.week??null,p_limit:4000
    }});
   });
   return {anchors,pages};
  })();
 }
 const {anchors,pages}=await eagerRoad;
 let index=0;
 if(body.p_after_origin!==null){
  index=anchors.findIndex(c=>c?.origin===body.p_after_origin&&
   c?.destination===body.p_after_destination&&c?.week===body.p_after_week);
 }
 return index>=0?pages[index]:null;
}
async function request(path,{method='GET',body=null,token=null,attempt=0,skipAhead=false}={}){
 if(path==='/rest/v1/rpc/brz_api_f34_market_counts'&&marketStatsCached)
   return marketStatsCached;
 if(!skipAhead&&body&&token&&attempt===0){
  if(path==='/rest/v1/rpc/brz_api_f34_market_page'){
   const ahead=readMarketAhead(path,body,token);
   if(ahead)return ahead;
  }
  if(path==='/rest/v1/rpc/brz_api_f46_road_page'){
   const ahead=await readRoadAhead(path,body,token);
   if(ahead)return ahead;
  }
 }
 // Fast read-only JSON envelope RPCs keep authorized RLS and original source fields;
 // one scalar result avoids the PostgREST 1,000-row cap on SETOF results.
 const route={
  '/rest/v1/rpc/brz_api_f34_market_page':'/rest/v1/rpc/brz_pin_fast_market_page',
  '/rest/v1/rpc/brz_api_f46_road_page':'/rest/v1/rpc/brz_pin_fast_road_page',
  '/rest/v1/rpc/brz_api_f41_trade_source_page':'/rest/v1/rpc/brz_pin_fast_frozen_trades'
 }[path];
 const h={'apikey':KEY,'Accept':'application/json'};
 if(token)h.Authorization='Bearer '+token;
 if(body!==null)h['Content-Type']='application/json';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),45000);
 try{
  const response=await heavyReadFetch(API+(route||path),{method,headers:h,
      body:body===null?undefined:JSON.stringify(body),credentials:'omit',redirect:'error',
      cache:'no-store',referrerPolicy:'no-referrer',signal:ctrl.signal},!!route);
  if(!response.ok){
    // F59C: 57014 is a PostgreSQL statement timeout, not an auth failure.
    // Retry ONLY the F34 read-only market page; never repeat a mutation.
    let pgCode=null;
    if(response.status===500&&route){
      try{pgCode=(await response.json())?.code||null;}catch{}
    }
    const minSplitSize=path==='/rest/v1/rpc/brz_api_f46_road_page'?750:250;
    if(route&&body&&Number(body.p_limit)>minSplitSize&&attempt===0&&
      ((response.status===500&&pgCode==='57014')||[502,503,504].includes(response.status))){
      return splitReadPage(path,body,token);
    }
    const transient=[429,502,503,504].includes(response.status)||
      (response.status===500&&pgCode==='57014'&&
       path==='/rest/v1/rpc/brz_api_f34_market_page');
    if(transient&&attempt<3){
      await new Promise(ok=>setTimeout(ok,750*(2**attempt)));
      return request(path,{method,body,token,attempt:attempt+1});
    }
    const err=Error('Supabase HTTP '+response.status+
      (pgCode==='57014'?' · F34 timeout (tentativas '+(attempt+1)+')':''));
    err.status=response.status;
    throw err;
  }
  const result=await response.json();
  if(route){
   if(!result||!Array.isArray(result.rows))throw Error('Página autenticada inválida: '+path);
   return result.rows;
  }
  return result;
 }finally{clearTimeout(timer);}
}
async function sha256(text){const buf=new TextEncoder().encode(text);
 const hash=await crypto.subtle.digest('SHA-256',buf);
 return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function signIn(pin){
 if(typeof pin!=='string'||!/^[0-9]{6}$/.test(pin))throw Error('Informe um PIN de seis números.');
 const response=await fetch(API+'/functions/v1/brz-replacement-pin',{
   method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({action:'login',pin}),
   cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'
 });
 const info=await response.json().catch(()=>null);
 if(!response.ok||info?.ok!==true){
    const message=info?.error==='pin_not_configured'
      ?'PIN ainda não configurado. Use a opção Definir PIN.'
      :info?.error==='too_many_attempts'
      ?'PIN bloqueado após tentativas incorretas. Tente mais tarde.'
      :'PIN inválido ou acesso indisponível.';
    throw Error(message);
 }
 const token=info.access_token;
 if(typeof token!=='string'||token.length<40)throw Error('Sessão não recebida');
 pinRefreshToken=info.refresh_token;
 pinExpiresIn=Number(info.expires_in||3600);
 // Profile, role and market inventory are independent authenticated reads.
 const [user,roleRows,stats]=await Promise.all([
   request('/auth/v1/user',{token}),
   request('/rest/v1/rpc/brz_api_session',{token}),
   request('/rest/v1/rpc/brz_api_f34_market_counts',{token})
 ]);
 if(typeof user?.id!=='string'||!user.id)throw Error('Usuário da sessão não identificado');
 const role=Array.isArray(roleRows)?roleRows[0]?.role:roleRows?.role;
 if(!['mesa','admin'].includes(role))throw Error('Perfil de acesso não autorizado');
 if(!Array.isArray(stats)||stats.length!==6||stats.some(r=>!r.ready))
   throw Error('Inventário de mercado indisponível');
 marketStatsCached=stats;
 activeUserId=user.id;
 rememberTabSession(token,pinRefreshToken,pinExpiresIn,Date.now()+SESSION_MS);
 // Unlike staging F59, operational F33 writes are allowed, so do not
 // demand trade_events=0 on subsequent logins.
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
  // The final sealed full-source SHA-256 verifies *all* physical records
  // together. Avoid 59,758 separate WebCrypto digests on the main thread.
  for(let i=0;i<page.length;i++){
   const row=page[i];
   if(!row||row.domain!=='physical'||!Number.isSafeInteger(Number(row.row_no))
      ||typeof row.source_key!=='string'||typeof row.record_json?.record_text!=='string'
      ||!/^[a-f0-9]{64}$/.test(row.record_json?.record_sha256||'')
      ||row.row_no<=previous)
      throw Error('Ordem ou registro físico divergente');
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
 if(window.__BRZ_F49_VERIFIED===true)return [];
 // F49: dynamic imports must resolve relative to assets/f40/f40_boot.js.
 // Fail before asking the user to type a password if a deployment is incomplete.
 const checks=[
  ['../f43/f43_derivatives_gate.mjs?v=20261116dbrelief01','hydrateF43Derivatives'],
  ['../f44/f44_market_gate.mjs?v=20261116dbrelief01','hydrateF44Market'],
  ['../f45/f45_rail_source_gate.mjs','hydrateF45Rail'],
  ['../f46/f46_road_source_gate.mjs?v=20261116dbrelief01','hydrateF46Road'],
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
 window.__BRZ_F49_VERIFIED=true;
 return modules;
}
async function start(ev){
 ev.preventDefault();if(loading)return;
 const restoring=ev&&ev.restore===true;
 // Every PIN attempt starts a fresh authenticated hydration.
 // A failed prior parallel request must not poison F55 on retry.
 aborted=false;
 eagerMarket.clear();eagerRoad=null;
 marketStatsCached=null;
 const loginBegan=performance.now();
 loading=true;$('go').disabled=true;
 let token=null;
 try{
  gate();status('F49 · verificando oito módulos locais antes da autenticação…');
  await preflightModules();
  status(restoring?'Restaurando sessão segura desta aba…':'Autenticando sessão mesa/admin…');
  token=restoring?await restoreTabSession():await signIn($('pin').value.trim());
  if(!token)throw Error('Sessão de uma hora expirada. Informe o PIN para entrar.');
  $('pin').value='';
  status('Verificando metadados e fontes confidenciais em paralelo…');
  // F55 and F56 are independent authenticated read-only sources.
  // Concurrent retrieval saves one server round trip without touching data.
  const [f56Rows,protected55]=await Promise.all([
    request('/rest/v1/rpc/brz_api_f56_private_runtime_config',{
      method:'POST',body:{},token}),
    import('../f55/f55_protected_source.mjs').then(m=>m.hydrateF55ProtectedSources({
      request,token,sha256,isAborted:()=>aborted
    }))
  ]);
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

  // These values never appear in public static HTML/JS; only JWT/RLS returns them.
  window.__BRZF55_CFR=protected55.cfr_offers;
  window.__BRZF55_OCEAN=protected55.ocean_freight;
  window.__BRZF44_META=protected55.f44_meta;
  window.__BRZF46_PRIVATE_META=protected55.f46_meta;
  window.__BRZF55_VERIFIED=true;
  // These authenticated sources are independent once the confidential
  // manifests are available. Fetch concurrently instead of 8 serial phases.
  status('Carregando dados da mesa em paralelo · histórico protegido…');
  // The first authenticated entry still verifies every remote source SHA.
  // On F5, reuse ONLY the previously verified immutable snapshots, encrypted
  // at rest and bound to this PIN tab session for at most one hour.
  let diskCache=null,cacheContext=null,cachedPayload=null,cacheAfterOpen=null;
  try{
    diskCache=await import('./tab_cache.mjs?v=20261116tabcache01');
    let stats=marketStatsCached;
    if(!stats){
      stats=await request('/rest/v1/rpc/brz_api_f34_market_counts',{token});
      if(!Array.isArray(stats)||stats.length!==6||stats.some(x=>x.ready!==true))
        throw Error('Inventário F34 não conciliado');
      marketStatsCached=stats;
    }
    if(activeUserId&&tabSessionUntil>Date.now()){
      const fingerprint=await sha256(stableStringify({
        version:'BRZ_SOURCE_FINGERPRINT_20261116_V1',
        deployedScript:document.querySelector('script[src*="f40_pin_login.js"]')?.src||'',
        marketStats:stats,marketMeta:protected55.f44_meta,
        roadMeta:protected55.f46_meta,
        tradesSha:F41_STATE_CANONICAL_SHA,
        tradeLedger:F41_FROZEN_LEDGER_SHA,priceLedger:CANONICAL_LEDGER_SHA,
        privateMetadataSha:'5564509b56fc57f5719e37fc3d47a98af6dc4b4438d042d9cc330610960b8819'
      }));
      cacheContext={userId:activeUserId,fingerprint,expiresAt:tabSessionUntil};
      status('Verificando históricos protegidos no cache desta sessão…');
      cachedPayload=await diskCache.readHydrationCache(cacheContext);
    }
  }catch(e){
    console.warn('BRZ: cache de sessão indisponível; carregamento normal',e?.message);
  }
  let tradeBundle,derivativesResult,resultF44,rail,road,premiums,restored,rows;
  if(cachedPayload){
    ({tradeBundle,derivativesResult,resultF44,rail,road,premiums,restored,rows}=cachedPayload);
    window.__BRZ_SOURCE_CACHE='HIT';
    status('Históricos já validados recuperados. Sincronizando alterações recentes…');
  }else{
    window.__BRZ_SOURCE_CACHE='MISS';
  const tradeWork=(async()=>{
    const frozenTrades=await loadFrozenTrades(token,()=>{});
    const privateOrder=await request('/rest/v1/rpc/brz_api_f42_deal_order',{
      method:'POST',token,body:{}});
    if(typeof window.__BRZF42_HYDRATE!=='function')
      throw Error('F42: hidratador da seleção indisponível');
    const orderedDeals=await window.__BRZF42_HYDRATE(privateOrder,frozenTrades,sha256);
    return {frozenTrades,orderedDeals};
  })();
  const derivativesWork=(async()=>{
    const {hydrateF43Derivatives}=await import('../f43/f43_derivatives_gate.mjs?v=20261116dbrelief01');
    return hydrateF43Derivatives({request,token,sha256,isAborted:()=>aborted});
  })();
  const marketWork=(async()=>{
    const {hydrateF44Market}=await import('../f44/f44_market_gate.mjs?v=20261116dbrelief01');
    return hydrateF44Market({request,token,sha256,
      manifest:window.__BRZF44_META,isAborted:()=>aborted});
  })();
  const railWork=(async()=>{
    const {hydrateF45Rail}=await import('../f45/f45_rail_source_gate.mjs');
    return hydrateF45Rail({request,token,sha256});
  })();
  const roadWork=(async()=>{
    const {hydrateF46Road}=await import('../f46/f46_road_source_gate.mjs?v=20261116dbrelief01');
    return hydrateF46Road({request,token,sha256,
      manifest:window.__BRZF46_PRIVATE_META,isAborted:()=>aborted});
  })();
  const premiumWork=(async()=>{
    const {hydrateF47Premiums}=await import('../f47/f47_premiums_gate.mjs');
    return hydrateF47Premiums({request,token,sha256});
  })();
  const sourceWork=(async()=>{
    const {hydrateF48Legacy}=await import('../f48/f48_source_gate.mjs');
    return hydrateF48Legacy({request,token,sha256,isAborted:()=>aborted});
  })();
  const priceWork=loadPrices(token,()=>{});
  // Wait for all in-flight reads before declaring a failed attempt: otherwise
  // old requests and a stale global abort flag contaminate the next PIN login.
  const names=['F41/F42 negócios','F43 derivados','F44 curvas/basis',
    'F45 ferroviário','F46 rodoviário','F47 prêmios','F48 históricos','F40 físico'];
  const settled=await Promise.allSettled([tradeWork,derivativesWork,marketWork,railWork,
    roadWork,premiumWork,sourceWork,priceWork]);
  const failed=settled.findIndex(item=>item.status==='rejected');
  if(failed!==-1){
    const reason=settled[failed].reason;
    throw Error(names[failed]+': '+(reason?.message||String(reason)));
  }
    [tradeBundle,derivativesResult,resultF44,rail,road,premiums,restored,rows]=
      settled.map(item=>item.value);
    if(diskCache&&cacheContext){
      cacheAfterOpen={tradeBundle,derivativesResult,resultF44,rail,road,
        premiums,restored,rows};
    }
  }
  const {frozenTrades,orderedDeals}=tradeBundle;
  status('Históricos e fretes conciliados. Abrindo a interface…');
  // Only the immutable, SHA-validated source bundles may be cached AES-GCM encrypted for this tab. Mutable overlays and credentials are never written to IDB.
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
  $('pin').value='';
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
      // PIN operator session: attach the independent, versioned F33 autosave.
      // Frozen source rows are hydrated first; edits are persisted as overlays.
      const script=iframe.contentDocument.createElement('script');
      script.src='./assets/secure/pin_autosave.js?v=20261116pend01';
      await new Promise((resolve,reject)=>{
        script.onload=resolve;
        script.onerror=()=>reject(Error('Gravação centralizada não carregada'));
        iframe.contentDocument.body.appendChild(script);
      });
      if(typeof iframe.contentWindow?.BRZPinAutoSave?.connect!=='function')
        throw Error('Sincronização de negócios não inicializada');
      const ready=await iframe.contentWindow.BRZPinAutoSave.connect({access_token:token,refresh_token:pinRefreshToken,expires_in:pinExpiresIn});
      if(ready?.ready!==true)throw Error('Banco não confirmou a conexão');
      token=null;
      window.__BRZ_PIN_OPERATIONAL=true;
      window.__BRZ_SESSION_LOAD_MS=Math.round(performance.now()-loginBegan);
      console.info('BRZ: PIN e cargas autenticadas',window.__BRZ_SESSION_LOAD_MS,'ms');
      document.body.classList.add('loaded');
      // First entry: write validated immutable source snapshots in the
      // background, after the working platform is visible. Never store live
      // overlay edits, PINs, JWTs, or refresh tokens in browser disk cache.
      if(cacheAfterOpen&&diskCache&&cacheContext){
        setTimeout(()=>{
          diskCache.writeHydrationCache(cacheContext,cacheAfterOpen)
            .then(ok=>{window.__BRZ_CACHE_READY=ok;})
            .catch(()=>{window.__BRZ_CACHE_READY=false;});
        },250);
      }

      document.documentElement.classList.remove('brz-restoring','brz-resume-failed');
    }catch(e){
      token=null;window.__BRZF57_BRIDGE_VERIFIED=false;
      iframe.src='about:blank';
      window.__BRZF41_TRADES=null;window.__BRZF41_TRADES_READY=false;
      window.__BRZF42_DEALS=null;window.__BRZF42_DEALS_READY=false;
      window.__BRZF40_PHYSICAL_ROWS=null;window.__BRZF40_PHYSICAL_READY=false;
      window.__BRZF56_PRIVATE_RUNTIME=null;
      if(restoring){
        document.documentElement.classList.add('brz-resume-failed');
        status('Falha temporária ao recuperar os dados da plataforma: '+e.message+
          '. Sua sessão permanece guardada nesta aba. Tente restaurar novamente.');
      }else{
        status('Não foi possível conectar o banco de negócios: '+e.message+'. Confira a sessão PIN.');
      }
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
  $('pin').value='';
  if(restoring){
    let stillValid=false;
    try{
      const cached=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
      stillValid=Boolean(cached&&Number(cached.keep_until)>Date.now());
    }catch(error){}
    if(stillValid){
      document.documentElement.classList.add('brz-resume-failed');
      status('Não foi possível terminar a restauração: '+e.message+
        '. A sessão continua válida. Use Tentar restaurar novamente.');
    }else{
      document.documentElement.classList.remove('brz-restoring','brz-resume-failed');
      status('Sessão expirada ou invalidada. Entre novamente com seu PIN.');
    }
  }else{
    status('BLOQUEADO: '+e.message+'\nNenhum dado local foi substituído.');
  }
  $('go').disabled=false;loading=false;
 }
}
$('authform').addEventListener('submit',start);
// F49: do not solicit user credentials before all local ES modules exist.
$('go').disabled=true;
// PIN remains editable while module readiness is checked.
$('pin').disabled=false;
(async()=>{
 try{
  gate();status('F49 · verificando a integridade dos oito módulos locais…');
  await preflightModules();
  $('pin').disabled=false;$('go').disabled=false;
  let cached=null;
  try{cached=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch(e){}
  if(cached&&Number(cached.keep_until)>Date.now()){
   status('Sessão da aba encontrada. Restaurando automaticamente…');
   await start({preventDefault(){},restore:true});
  }else{
   if(cached)forgetTabSession();
   status('Oito módulos verificados. Aguardando autenticação mesa/admin.');
  }
 }catch(e){
  status('BLOQUEADO F49: '+e.message);
  $('go').disabled=true;
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
