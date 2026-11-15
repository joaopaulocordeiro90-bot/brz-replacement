
/* BRZ F36 | One-click live JWT operational preflight + export | Homologacao */
(function(){
'use strict';
let busy=false,last=null;
const $=id=>document.getElementById(id);
function mark(message,kind='neutral'){
 const el=$('brzf36-status');if(el){el.textContent=message;el.dataset.state=kind;}
}
function hasSession(){return !!window.BRZF33?.status?.().connected;}
async function run(){
 if(busy)return;
 if(!hasSession()){mark('Faça login mesa/admin em Banco F33 antes do diagnóstico.','warn');return;}
 busy=true;mark('Executando testes transacionais no PostgreSQL…');
 try{
  const a=await window.BRZF33.operationalSmoke();
  const ans=Array.isArray(a)?a[0]:a;
  const c=ans?.checks;
  const pass=ans?.status==='passed'&&c?.frozen_trades===4011&&c?.market_rows===267959&&
   c?.market_domains===6&&c?.source_delta_rows===1531&&c?.rollback_clean===true&&
   c?.idempotent_retry===true&&c?.stale_version_rejected===true&&c?.soft_delete===true&&
   c?.restore===true&&c?.audit_versions===4&&c?.frozen_record_immutable===true;
  if(!pass)throw Error('F36: resultado do servidor incompleto ou divergente');
  const motor=!!window.BRZF35?.status?.().active;
  last=Object.freeze({test:'BRZ_F36_OPERATIONAL_V1',status:'passed',
   testedAt:ans.tested_at||new Date().toISOString(),checks:c,
   engineOverlayActive:motor,productionApproved:false,
   note:'Verificado sob JWT desta sessão; não substitui teste de telas e backup/restauração completa'});
  $('brzf36-report').disabled=false;
  mark('F36: banco aprovado em sessão autenticada. Motor F35 '+
     (motor?'ATIVO':'ainda não ativado')+'. Dados de teste revertidos.','ok');
 }catch(e){last=null;$('brzf36-report').disabled=true;mark('F36: não aprovado — '+(e?.message||String(e)),'warn');}
 finally{busy=false;}
}
async function backup(){
 if(busy)return;
 if(!hasSession()){mark('Conecte ao Banco F33 para exportar negócios.','warn');return;}
 if(!confirm('Exportar todos os negócios e suas versões para um arquivo LOCAL, contendo informações comerciais confidenciais? Guarde somente em pasta privada.'))return;
 busy=true;mark('Preparando backup local dos negócios…');
 try{
  const info=await window.BRZF33.exportTradeBackup();
  mark('Backup local solicitado: '+info.count+' negócios · SHA-256 '+info.sha256.slice(0,12)+'… Não substitui dump completo do banco.','ok');
 }catch(e){mark('Exportação incompleta — '+(e?.message||String(e)),'warn');}
 finally{busy=false;}
}
function exportReport(){
 if(!last)return;
 const blob=new Blob([JSON.stringify(last,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 try{
  const a=document.createElement('a');a.href=url;a.download='BRZ_F36_RELATORIO_HOMOLOGACAO.json';
  document.body.appendChild(a);a.click();a.remove();
 }finally{setTimeout(()=>URL.revokeObjectURL(url),30000);}
}
const style=document.createElement('style');style.textContent=`
#brzf36-launch{position:fixed;right:14px;bottom:216px;z-index:2147483003;background:#263e48;color:white;
 border:1px solid #576e77;border-radius:9px;padding:9px 12px;font:600 12px Arial;cursor:pointer}
#brzf36-panel{position:fixed;right:14px;bottom:258px;z-index:2147483004;width:min(380px,calc(100vw - 28px));
 background:#fff;color:#17303b;border:1px solid #acc2cb;border-radius:10px;padding:14px;box-sizing:border-box;
 font:13px Arial;box-shadow:0 8px 22px #0003}
#brzf36-panel[hidden]{display:none!important}#brzf36-panel p{font:12px/1.45 Arial}
#brzf36-panel button{margin:4px 4px 0 0;padding:8px;border:0;border-radius:6px;background:#263e48;color:white;cursor:pointer}
#brzf36-panel button:disabled{opacity:.4;cursor:default}
#brzf36-status{font-size:12px;background:#edf3f5;padding:8px;border-radius:5px;line-height:1.4}
#brzf36-status[data-state=warn]{color:#a42b24}#brzf36-status[data-state=ok]{color:#176940}
`;document.head.appendChild(style);
const launch=document.createElement('button');launch.id='brzf36-launch';launch.type='button';launch.textContent='Validar F36';
launch.onclick=()=>{$('brzf36-panel').hidden=!$('brzf36-panel').hidden;};document.body.appendChild(launch);
const panel=document.createElement('section');panel.id='brzf36-panel';panel.hidden=true;
panel.innerHTML='<b>BRZ · F36 — Homologação operacional</b><p>Diagnóstico de leitura, versão, gravação, restauração e rollback SEM persistir dados de teste. Requer login real mesa/admin.</p>'+
 '<div id="brzf36-status">Aguardando autenticação F33.</div>'+
 '<p><button type="button" id="brzf36-run">Testar banco (rollback)</button><button type="button" id="brzf36-backup">Exportar negócios</button>'+
 '<button type="button" id="brzf36-report" disabled>Relatório JSON</button></p>'+
 '<small>Somente homologação. Exportação contém dados comerciais e exige armazenamento privado. Backup de negócios não substitui pg_dump.</small>';
document.body.appendChild(panel);
$('brzf36-run').onclick=run;$('brzf36-backup').onclick=backup;$('brzf36-report').onclick=exportReport;
window.BRZF36=Object.freeze({run,backup,status:()=>({busy,passed:last?.status==='passed',engineOverlayActive:last?.engineOverlayActive||false})});
})();
