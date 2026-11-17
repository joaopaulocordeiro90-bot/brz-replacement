
/* BRZ F37 — release-control report, homologation-only, never publishes automatically. */
(function(){
'use strict';
let working=false,last=null;
const $=id=>document.getElementById(id);
function info(msg,kind='neutral'){const el=$('brzf37-status');if(el){el.textContent=msg;el.dataset.state=kind;}}
function current(){
 const f33=window.BRZF33?.status?.()||{};
 const f35=window.BRZF35?.status?.()||{};
 const f36=window.BRZF36?.status?.()||{};
 return {f33Connected:f33.connected===true,f33Pending:!!(f33.blocked||f33.unsynced||f33.pending||f33.working),
  f35EngineActive:f35.active===true,f36LiveSmokePassed:f36.passed===true};
}
async function assess(){
 if(working)return;
 last=null;$('brzf37-report').disabled=true;
 const local=current();
 if(!local.f33Connected||local.f33Pending){info('F37: login mesa/admin e sincronização F33 exigidos.','warn');return;}
 working=true;info('Consultando integridade, RLS e referência V4FQ no PostgreSQL…');
 try{
  if(typeof window.BRZF33?.releaseReadiness!=='function')throw Error('Conector F37 indisponível');
  const response=await window.BRZF33.releaseReadiness();
  const r=Array.isArray(response)?response[0]:response;
  if(r?.gate!=='F37_RELEASE_READINESS_V1'||r.technical_ready!==true||
     r.frozen_trades!==4011||r.market_rows!==267959||r.market_deltas!==1531||
     r.ready_domains!==6||r.secured_rpc_count!==7||
     r.production_release_approved!==false||r.production_cutover_executed!==false||
     r.external_database_backup_verified!==false||r.external_database_restore_verified!==false||
     r.browser_real_jwt_uat_verified!==false||!Array.isArray(r.blocking_steps)||r.blocking_steps.length!==4){
    throw Error('F37: retorno de segurança divergente ou incompleto');
  }
  const stateNow=current();
  last=Object.freeze({format:'BRZ_F37_RELEASE_PREFLIGHT_V1',createdAt:new Date().toISOString(),
   sourceSnapshot:r.source_snapshot,sourceSHA256:r.trade_ledger_sha256,
   database:{technicalReady:true,marketRows:r.market_rows,marketDeltas:r.market_deltas,
     trades:r.frozen_trades,securedRPCs:r.secured_rpc_count,checkedAt:r.checked_at},
   uiSession:stateNow,
   release:{productionReady:false,productionCutoverExecuted:false,externalBackupVerified:false,
    externalRestoreVerified:false,liveEndToEndVerified:false,explicitOwnerAuthorization:false,
    blockers:r.blocking_steps},
   note:'Aprovado tecnicamente no banco. NAO e aceite de producao, nem substitui pg_dump/restore.'});
  $('brzf37-report').disabled=false;
  const pending=[];
  if(!stateNow.f35EngineActive)pending.push('Ativar Motor PG F35');
  if(!stateNow.f36LiveSmokePassed)pending.push('Executar Validar F36');
  pending.push('Backup externo + restore integral','Teste real de persistência/FOB-CFR/TAB','Autorização de publicação');
  info('F37: integridade técnica aprovada; PUBLICAÇÃO BLOQUEADA. Pendências: '+pending.join(' · '),'warn');
 }catch(e){info('F37: não aprovado — '+(e?.message||String(e)),'warn');}
 finally{working=false;}
}
function exportReport(){
 if(!last)return;
 const blob=new Blob([JSON.stringify(last,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 try{const a=document.createElement('a');a.href=url;a.download='BRZ_F37_GO_NO_GO_HOMOLOGACAO.json';
   document.body.appendChild(a);a.click();a.remove();}
 finally{setTimeout(()=>URL.revokeObjectURL(url),30000);}
}
const style=document.createElement('style');style.textContent=`
#brzf37-open{position:fixed;right:14px;bottom:310px;z-index:2147483005;background:#3b334e;color:white;
 border:1px solid #776c8f;border-radius:9px;padding:9px 12px;font:600 12px Arial;cursor:pointer}
#brzf37-panel{position:fixed;right:14px;bottom:352px;z-index:2147483006;width:min(395px,calc(100vw - 28px));
 background:#fff;color:#28273a;border:1px solid #c9bfd1;border-radius:10px;padding:14px;box-sizing:border-box;
 font:13px Arial;box-shadow:0 8px 22px #0003}
#brzf37-panel[hidden]{display:none!important}#brzf37-panel p{font:12px/1.5 Arial}
#brzf37-panel button{margin:4px 4px 0 0;padding:8px;border:0;border-radius:6px;background:#3b334e;color:white;cursor:pointer}
#brzf37-panel button:disabled{opacity:.4;cursor:default}
#brzf37-status{font-size:12px;background:#f0edf5;padding:9px;border-radius:5px;line-height:1.4}
#brzf37-status[data-state=warn]{color:#7e3821}`;document.head.appendChild(style);
const launcher=document.createElement('button');launcher.id='brzf37-open';launcher.type='button';
launcher.textContent='F37 · Pré-publicação';launcher.onclick=()=>{$('brzf37-panel').hidden=!$('brzf37-panel').hidden;};
document.body.appendChild(launcher);
const panel=document.createElement('section');panel.id='brzf37-panel';panel.hidden=true;
panel.innerHTML='<b>BRZ Replacement · F37</b><p>Conferência do corte funcional sem liberar produção. Requer sessão mesa/admin com F33 sincronizado.</p>'+
 '<div id="brzf37-status">Pronto para verificar. Sem publicação automática.</div>'+
 '<p><button id="brzf37-check" type="button">Verificar pré-publicação</button>'+
 '<button id="brzf37-report" type="button" disabled>Relatório Go/No-Go</button></p>'+
 '<small>Backup PostgreSQL externo, teste real de navegador e autorização expressa são obrigatórios antes do corte.</small>';
document.body.appendChild(panel);
$('brzf37-check').onclick=assess;$('brzf37-report').onclick=exportReport;
window.BRZF37=Object.freeze({assess,status:()=>({working,technicalReady:last?.database?.technicalReady===true,
 productionReady:false,reportAvailable:!!last})});
})();
