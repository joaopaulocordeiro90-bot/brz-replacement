
/* BRZ F33 | Homologacao | 2026-11-14 | Opt-in, never writes to legacy production. */
(function(){
'use strict';
const API='https://irekykmigdfvwozerkfa.supabase.co';
const KEY='sb_publishable_lqI_p-_21r3gqerHxsHlLQ_2c-XWwzq'; // Supabase publishable key; NOT service_role.
let token=null,connected=false,applying=false,working=false,needSync=false,blocked=false,readOnly=false;
let remote=new Map(),pending=new Map(),retryTimer=null;
function operationUUID(){
 if(typeof crypto==='undefined'||typeof crypto.getRandomValues!=='function')throw Error('Criptografia segura indisponível');
 const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
function $(id){return document.getElementById(id);}
function status(msg,kind='neutral'){
 const el=$('brzf33-status');if(!el)return;
 el.textContent=msg;el.dataset.state=kind;
}
async function req(path,method='GET',body=null,useToken=true){
 const h={'apikey':KEY,'Accept':'application/json'};
 if(useToken&&token)h.Authorization='Bearer '+token;
 if(body!==null)h['Content-Type']='application/json';
 const r=await fetch(API+path,{method,headers:h,body:body!==null?JSON.stringify(body):undefined,
   credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
 const txt=await r.text();let payload=null;try{payload=txt?JSON.parse(txt):null;}catch{}
 if(!r.ok){const err=new Error('HTTP '+r.status+' / '+(payload?.code||'sem-codigo'));
   err.status=r.status;err.code=payload?.code;throw err;}
 return payload;
}
const stable=(obj)=>JSON.stringify(obj,function(k,v){if(v&&typeof v==='object'&&!Array.isArray(v)){
  const sorted={};for(const key of Object.keys(v).sort())sorted[key]=v[key];return sorted;
 }return v;});
function inventory(){
 if(typeof state==='undefined'||!Array.isArray(state.negocios))throw Error('Estado dos negócios indisponível');
 const m=new Map();for(const rec of state.negocios){
  if(!rec||typeof rec.id!=='string'||!rec.id||m.has(rec.id))throw Error('ID de negócio ausente ou duplicado');
  m.set(rec.id,rec);
 }return m;
}
async function allRows(){
 const rows=[],ids=new Set();let cursor=null;
 for(let i=0;i<150;i++){
  const page=await req('/rest/v1/rpc/brz_api_f33_trade_page','POST',{
    p_limit:100,p_after_legacy_id:cursor,p_include_deleted:true});
  if(!Array.isArray(page)||page.length>100)throw Error('Página inesperada do banco');
  for(const r of page){
   if(!r||typeof r.legacy_id!=='string'||ids.has(r.legacy_id)||
      !Number.isInteger(Number(r.record_version))||typeof r.deleted!=='boolean'||
      (!r.deleted&&(!r.record_json||r.record_json.id!==r.legacy_id))||
      (r.deleted&&r.record_json!==null))throw Error('Registro inválido ou duplicado no banco');
   ids.add(r.legacy_id);rows.push(r);
  }
  if(page.length<100)return rows;
  if(cursor!==null&&page.at(-1).legacy_id<=cursor)throw Error('Cursor de dados não avançou');
  cursor=page.at(-1).legacy_id;
 }
 throw Error('Limite de paginação excedido');
}
// F57: same authenticated session as outer gate, read-only until explicit release.
// It does not overwrite the selected V4FQ snapshot or trigger commercial writes.
async function attachAuthenticatedReadOnly(parentToken){
 if(working||connected||readOnly)throw Error('F57: sessão já inicializada');
 if(window===window.parent||window.parent.__BRZF57_READ_ONLY_STAGING!==true)
   throw Error('F57: homologação somente leitura ausente');
 if(typeof parentToken!=='string'||parentToken.length<30)
   throw Error('F57: JWT ausente');
 working=true;token=parentToken;
 try{
  const user=await req('/auth/v1/user');
  if(!user||typeof user.id!=='string'||!user.id)throw Error('F57: usuário inválido');
  const sess=await req('/rest/v1/rpc/brz_api_session');
  const role=Array.isArray(sess)?sess[0]?.role:sess?.role;
  if(!['mesa','admin'].includes(role))throw Error('F57: acesso mesa/admin exigido');
  const rows=await allRows();
  if(rows.length!==4011)throw Error('F57: leitura F33 incompleta ('+rows.length+'/4011)');
  // Data already hydrated from F41+F42 on first login. Only check DB inventory here.
  const map=new Map();for(const r of rows)
   map.set(r.legacy_id,{version:Number(r.record_version),deleted:r.deleted,
    record:r.record_json,snapshot:r.deleted?null:stable(r.record_json)});
  remote=map;pending.clear();needSync=false;blocked=false;
  readOnly=true;connected=true;
  $('brzf33-login').hidden=true;$('brzf33-ops').hidden=true;
  $('brzf33-launch').textContent='F33 · leitura';
  status('F57 · sessão autenticada; 4.011 negócios conferidos. Escrita bloqueada.','ok');
  return Object.freeze({verified:true,readOnly:true,readRows:rows.length,role,writeActions:0});
 }catch(e){
  token=null;connected=false;readOnly=false;remote.clear();pending.clear();
  status('F57 bloqueado: '+e.message,'warn');throw e;
 }finally{working=false;}
}

function applyRows(rows){
 const m=new Map(),live=[],removed=[];
 for(const r of rows){
   m.set(r.legacy_id,{version:Number(r.record_version),deleted:r.deleted,
     record:r.record_json,snapshot:r.deleted?null:stable(r.record_json)});
   if(r.deleted)removed.push(r.legacy_id);else live.push(r.record_json);
 }
 applying=true;
 try{
  state.negocios=live;
  state.negociosRemovidos=removed;
  if(typeof invalidateDataCache==='function')invalidateDataCache();
  if(typeof clearCalcCaches==='function')clearCalcCaches();
  if(typeof freightRodoIndex!=='undefined')freightRodoIndex=null;
  if(typeof selectedId!=='undefined'&&!live.some(d=>d.id===selectedId))selectedId=live[0]?.id||null;
  if(typeof scheduleRenderAll==='function')scheduleRenderAll();
  else if(typeof renderAll==='function')renderAll();
 }finally{applying=false;}
 remote=m;pending.clear();needSync=false;blocked=false;
}
async function login(){
 if(window.parent!==window && window.parent.__BRZF57_READ_ONLY_STAGING===true){
  status('F57: utilize somente a autenticação da página inicial.','warn');return;
 }
 if(working)return;
 const mail=$('brzf33-mail')?.value?.trim(),pass=$('brzf33-pass')?.value||'';
 if(!mail||!pass){status('Informe usuário e senha.','warn');return;}
 if(!confirm('Conectar à homologação F33? Os negócios locais serão substituídos pela versão do PostgreSQL; edições locais não sincronizadas não serão importadas.'))return;
 working=true;status('Autenticando com perfil mesa/admin…');
 try{
  const auth=await req('/auth/v1/token?grant_type=password','POST',{email:mail,password:pass},false);
  if(!auth?.access_token||!auth?.user?.id)throw Error('Token de autenticação inválido');
  token=auth.access_token;
  const user=await req('/auth/v1/user');if(user?.id!==auth.user.id)throw Error('Sessão inválida');
  const sess=await req('/rest/v1/rpc/brz_api_session');
  const role=Array.isArray(sess)?sess[0]?.role:sess?.role;
  if(!['mesa','admin'].includes(role))throw Error('Perfil sem autorização comercial');
  const rows=await allRows();if(rows.length<4011)throw Error('Base incompleta: '+rows.length);
  applyRows(rows);
  connected=true;
  $('brzf33-pass').value='';
  $('brzf33-login').hidden=true;$('brzf33-ops').hidden=false;
  status('Conectado · '+rows.filter(r=>!r.deleted).length+' negócios · 0 pendências','ok');
 }catch(e){connected=false;token=null;status('Sem conexão: '+e.message,'warn');
 }finally{working=false;}
}
function schedule(){
 if(readOnly||!connected||applying||blocked)return;
 needSync=true;
 clearTimeout(retryTimer);retryTimer=setTimeout(()=>{sync().catch(e=>status('Erro de gravação: '+e.message,'warn'));},500);
}
async function sync(){
 if(readOnly)throw Error('F57: gravação bloqueada no modo somente leitura');
 if(!connected||applying||blocked||working)return;
 working=true;needSync=false;
 try{
  const local=inventory();const operations=[];
  for(const [id,rec] of local){
   const previous=remote.get(id);const shot=stable(rec);
   if(!previous)operations.push({id,action:'CREATE',version:0,record:rec,snapshot:shot});
   else if(previous.deleted)operations.push({id,action:'RESTORE',version:previous.version,record:rec,snapshot:shot});
   else if(previous.snapshot!==shot)operations.push({id,action:'UPDATE',version:previous.version,record:rec,snapshot:shot});
  }
  for(const [id,previous] of remote)if(!previous.deleted&&!local.has(id))
   operations.push({id,action:'DELETE',version:previous.version,record:null,snapshot:null});
  if(!operations.length){status('Conectado · dados sincronizados','ok');return;}
  status('Sincronizando '+operations.length+' alteração(ões)…');
  for(const op of operations){
   if(!connected)throw Error('Sessão não conectada');
   const key=op.id+'|'+op.action+'|'+op.version;
   let uuid=pending.get(key);
   if(!uuid){uuid=operationUUID();pending.set(key,uuid);}
   const ack=await req('/rest/v1/rpc/brz_api_f33_trade_mutate','POST',{
     p_operation_id:uuid,p_legacy_id:op.id,p_action:op.action,
     p_expected_version:op.version,p_record:op.record});
   const a=Array.isArray(ack)?ack[0]:ack;
   if(!a||a.legacy_id!==op.id||a.applied_action!==op.action||
     Number(a.record_version)!==op.version+1||a.deleted!==(op.action==='DELETE'))
     throw Error('Confirmação de gravação inconsistente');
   pending.delete(key);
   remote.set(op.id,{version:op.version+1,deleted:op.action==='DELETE',
     record:op.record,snapshot:op.snapshot});
  }
  status('Conectado · '+operations.length+' operação(ões) confirmada(s) no PostgreSQL','ok');
 }catch(e){
  blocked=true;status('PENDENTE — '+e.message+'. Recarregue do banco após resolver o conflito.','warn');
 }finally{working=false;if(needSync&&!blocked)schedule();}
}
async function refresh(){
 if(readOnly)throw Error('F57: recarregue a página para renovar a leitura autenticada');
 if(!connected||working)return;
 if(needSync||blocked||pending.size){
   if(!confirm('Há alterações locais ou conflito pendente. Descartá-los e restaurar a versão confirmada do banco?'))return;
 }
 working=true;status('Lendo versão confirmada do banco…');
 try{const rows=await allRows();applyRows(rows);status('Banco recarregado · '+rows.filter(r=>!r.deleted).length+' negócios','ok');}
 catch(e){status('Erro de recarga: '+e.message,'warn');}
 finally{working=false;}
}
async function restore(){
 if(readOnly)throw Error('F57: restauração bloqueada no modo somente leitura');
 if(!connected||working||blocked)return;
 const id=prompt('ID exato do negócio excluído a restaurar:');if(!id)return;
 const data=remote.get(id);
 if(!data||!data.deleted){status('ID não encontrado entre os negócios excluídos.','warn');return;}
 if(!confirm('Restaurar negócio '+id+' pela última versão válida do PostgreSQL?'))return;
 working=true;
 try{
  const uuid=operationUUID();const ack=await req('/rest/v1/rpc/brz_api_f33_trade_restore','POST',{
   p_operation_id:uuid,p_legacy_id:id,p_expected_version:data.version});
  const a=Array.isArray(ack)?ack[0]:ack;
  if(a?.legacy_id!==id||a?.applied_action!=='RESTORE'||Number(a?.record_version)!==data.version+1)
    throw Error('Confirmação inválida');
  const rows=await allRows();applyRows(rows);status('Negócio '+id+' restaurado e confirmado','ok');
 }catch(e){blocked=true;status('Restauração pendente: '+e.message,'warn');}
 finally{working=false;}
}
async function logout(){
 if(readOnly){window.top.location.reload();return;}
 if(needSync||pending.size||blocked){
   if(!confirm('Existem pendências de gravação. Encerrar a sessão mesmo assim?'))return;
 }
 const old=token;
 if(old){try{await req('/auth/v1/logout','POST',{},true);}catch{}}
 token=null;connected=false;blocked=false;pending.clear();remote.clear();
 $('brzf33-ops').hidden=true;$('brzf33-login').hidden=false;
 status('Desconectado · HTML local não equivale ao banco','warn');
}
const css=document.createElement('style');css.textContent=`
#brzf33-launch{position:fixed;right:14px;bottom:14px;z-index:2147483000;background:#102a43;color:#fff;
 border:1px solid #6d8294;border-radius:10px;padding:10px 14px;font:600 12px Arial,sans-serif;box-shadow:0 6px 18px #0004;cursor:pointer}
#brzf33-panel{position:fixed;right:14px;bottom:58px;z-index:2147483000;width:min(360px,calc(100vw - 28px));box-sizing:border-box;
 background:#fff;color:#172638;border:1px solid #bcc8d3;border-radius:12px;padding:15px;box-shadow:0 12px 32px #0003;
 font:13px Arial,sans-serif}
#brzf33-panel[hidden],#brzf33-login[hidden],#brzf33-ops[hidden]{display:none!important}
#brzf33-panel h3{font-size:15px;margin:0 0 7px}#brzf33-panel p{margin:5px 0 10px;line-height:1.4}
#brzf33-panel input{width:100%;box-sizing:border-box;border:1px solid #b8c7d4;border-radius:6px;padding:9px;margin:4px 0;font-size:13px}
#brzf33-panel button{cursor:pointer;border:1px solid #bdcbd6;background:#f3f7fa;color:#17324d;border-radius:7px;padding:9px;font-weight:600;margin:4px 4px 0 0}
#brzf33-panel button.primary{background:#102a43;color:#fff;border-color:#102a43}
#brzf33-status{padding:8px;background:#f2f5f8;border-radius:6px;font-size:12px;line-height:1.45}
#brzf33-status[data-state='ok']{color:#17663e}#brzf33-status[data-state='warn']{color:#a32921}
`;document.head.appendChild(css);
const launch=document.createElement('button');launch.id='brzf33-launch';launch.textContent='Banco F33 · local';
launch.type='button';launch.onclick=()=>{$('brzf33-panel').hidden=!$('brzf33-panel').hidden;};
document.body.appendChild(launch);
const panel=document.createElement('div');panel.id='brzf33-panel';panel.hidden=true;
panel.innerHTML='<h3>BRZ Replacement · F33</h3><p>Homologação PostgreSQL. O HTML original permanece funcional. Conecte para usar a persistência remota dos negócios.</p>'+
 '<div id="brzf33-status" data-state="warn">Desconectado · negócios somente locais</div>'+
 '<div id="brzf33-login"><input id="brzf33-mail" type="email" autocomplete="username" placeholder="Email mesa/admin" />'+
 '<input id="brzf33-pass" type="password" autocomplete="current-password" placeholder="Senha" />'+
 '<button class="primary" id="brzf33-connect" type="button">Conectar e carregar dados</button></div>'+
 '<div id="brzf33-ops" hidden><button class="primary" id="brzf33-sync" type="button">Gravar alterações</button>'+
 '<button id="brzf33-refresh" type="button">Recarregar banco</button><button id="brzf33-restore" type="button">Restaurar excluído</button>'+
 '<button id="brzf33-logout" type="button">Sair</button></div>';
document.body.appendChild(panel);
$('brzf33-connect').onclick=login;
$('brzf33-sync').onclick=()=>sync();
$('brzf33-refresh').onclick=refresh;
$('brzf33-restore').onclick=restore;
$('brzf33-logout').onclick=logout;
const originalPersist=typeof persist==='function'?persist:null;
if(originalPersist){persist=function(){const result=originalPersist.apply(this,arguments);schedule();return result;};}
window.BRZF33=Object.freeze({
 attachAuthenticatedReadOnly,
 integrityManifest:async()=>{
   if(!connected||!token||working||blocked||needSync||pending.size)
     throw Error('F37B: conecte F33 com mesa/admin e confirme todas as gravações');
   return req('/rest/v1/rpc/brz_api_f37_integrity_manifest','POST',{});
 },
 releaseReadiness:async()=>{
   if(!connected||!token||working||blocked||needSync||pending.size)
      throw Error('F37: conecte F33 com mesa/admin e confirme as gravações pendentes');
   return req('/rest/v1/rpc/brz_api_f37_release_readiness','POST',{});
 },
 operationalSmoke:async()=>{
   if(!connected||!token||working||blocked||needSync||pending.size)
      throw Error('F36: conecte F33 e sincronize/solucione todas as pendências antes do teste');
   return req('/rest/v1/rpc/brz_api_f36_operational_smoke','POST',{});
 },
 exportTradeBackup:async()=>{
   if(!connected||!token||working||blocked||needSync||pending.size)
      throw Error('F36: sincronize o F33 antes de exportar negócios');
   const rows=await allRows();
   if(rows.length<4011)throw Error('Backup incompleto: '+rows.length+' negócios');
   const markets=await req('/rest/v1/rpc/brz_api_f34_market_counts');
   if(!Array.isArray(markets)||markets.length!==6||markets.some(m=>!m.ready))
      throw Error('F36: manifesto de mercado incompleto');
   const payload={format:'BRZ_F36_TRADE_SNAPSHOT_V1',exportedAt:new Date().toISOString(),
      src:'V4FQ/C35 + F33 events',trades:rows,marketManifest:markets,
      coverage:'negócios atuais, versões e manifesto; NÃO substitui pg_dump nem backup financeiro completo'};
   const text=JSON.stringify(payload);
   const bytes=new TextEncoder().encode(text);
   if(!globalThis.crypto?.subtle)throw Error('F36: abra pelo servidor localhost (contexto seguro) para gerar SHA-256');
   const hash=await crypto.subtle.digest('SHA-256',bytes);
   const hex=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
   const backup={sha256OfPayload:hex,...payload};
   const blob=new Blob([JSON.stringify(backup)],{type:'application/json'});
   const url=URL.createObjectURL(blob);
   try{
      const a=document.createElement('a');a.href=url;
      a.download='BRZ_F36_BACKUP_NEGOCIOS_'+new Date().toISOString().slice(0,10)+'.json';
      document.body.appendChild(a);a.click();a.remove();
   }finally{setTimeout(()=>URL.revokeObjectURL(url),30000);}
   return Object.freeze({count:rows.length,sha256:hex,bytes:blob.size});
 },
 status:()=>({connected,working,blocked,pending:pending.size,unsynced:needSync,readOnly}),
 sync:()=>sync(),refresh:()=>refresh(),
 marketDeltaCounts:async()=>{
   if(!connected||!token)throw Error('F35 requer sessão mesa/admin');
   return req('/rest/v1/rpc/brz_api_f35_market_delta_counts');
 },
 marketDeltaPage:async({domain,afterRowNo=0,limit=200}={})=>{
   if(!connected||!token)throw Error('F35 requer sessão mesa/admin');
   const allowed=['physical','curves','basis_points','basis_series','derivatives','ocean'];
   if(!allowed.includes(domain)||!Number.isSafeInteger(afterRowNo)||afterRowNo<0||
      !Number.isSafeInteger(limit)||limit<1||limit>250)throw Error('F35 parâmetros inválidos');
   return req('/rest/v1/rpc/brz_api_f35_market_delta_page','POST',{
     p_domain:domain,p_after_row_no:afterRowNo,p_limit:limit});
 },
 marketCounts:async()=>{
   if(!connected||!token)throw Error('F33: conectar com perfil mesa/admin');
   return req('/rest/v1/rpc/brz_api_f34_market_counts');
 },
 marketPage:async({domain,afterRowNo=0,limit=100,fromDate=null}={})=>{
   if(!connected||!token)throw Error('F33: conectar com perfil mesa/admin');
   const ok=['physical','curves','basis_points','basis_series','derivatives','ocean'];
   if(!ok.includes(domain)||!Number.isSafeInteger(afterRowNo)||afterRowNo<0||
     !Number.isSafeInteger(limit)||limit<1||limit>250||
     (fromDate!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)))throw Error('F34 parâmetros inválidos');
   return req('/rest/v1/rpc/brz_api_f34_market_page','POST',{
     p_domain:domain,p_after_row_no:afterRowNo,p_limit:limit,p_from_date:fromDate});
 },
 marketLookup:async({domain,sourceKey}={})=>{
   if(!connected||!token)throw Error('F33: conectar com perfil mesa/admin');
   const ok=['physical','curves','basis_points','basis_series','derivatives','ocean'];
   if(!ok.includes(domain)||typeof sourceKey!=='string'||sourceKey.length<1||sourceKey.length>256)
     throw Error('F34 parâmetros inválidos');
   return req('/rest/v1/rpc/brz_api_f34_market_lookup','POST',{
     p_domain:domain,p_source_key:sourceKey});
 }
});
window.addEventListener('beforeunload',event=>{
 if(connected&&(working||needSync||pending.size||blocked)){
  event.preventDefault();event.returnValue='Existem alterações F33 não confirmadas.';
 }
});
})();

