
/* F37B Integrity Manifest: authenticated, read-only, private, never deploys. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const REF=Object.freeze({
 basis_points:['031b9e8f6535bd68461425b6406211611204ddaa6fe8bdd5310eab2def05ddb5',107184],
 basis_series:['0f4dabe852a515a225f1d033d1d7635b766cb076f3d944d8a278a85e6173ea23',1405],
 curves:['fa229fe90bba305676702d61fd3b8f1789e4c0a7a51cadc0ac3c8cd131b2a7bc',16418],
 derivatives:['21bff574f09dbf13a70b8cc21702e3d41bb799acda292368407d6e95d72a29ba',14235],
 ocean:['645bbb45802db24563e3680fbccccabb304179f795a11072019605f660335833',68959],
 physical:['665f12c97a03f969f564180f31efd8c0ce3ad091440a2e9f97fdbdc025df6705',59758]
});
const TRADE='9697b87d6b2db893e5d5b40ca0f25a09a48b733b1ca27134747aa876c81cc890';
let busy=false,last=null;
function setStatus(message,kind='neutral'){
 const el=$('brzf37b-status');if(el){el.textContent=message;el.dataset.state=kind;}
}
async function run(){
 if(busy)return;
 last=null;$('brzf37b-export').disabled=true;
 const st=window.BRZF33?.status?.();
 if(!st?.connected||st?.blocked||st?.pending||st?.unsynced||st?.working){
  setStatus('F37B: conectar como mesa/admin e eliminar gravações pendentes antes de verificar.','warn');return;
 }
 if(typeof window.BRZF33?.integrityManifest!=='function'){
  setStatus('F37B: conector de integridade não disponível.','warn');return;
 }
 busy=true;setStatus('Conferindo os sete ledgers SHA-256 diretamente no PostgreSQL…');
 try{
  const response=await window.BRZF33.integrityManifest();
  const m=Array.isArray(response)?response[0]:response;
  if(!m||m.manifest!=='BRZ_F37B_V4FQ_INTEGRITY_V1'||
     m.reference_cutoff!=='2026-11-13'||m.source_snapshot_integrity_verified!==true||
     m.trades_match_reference!==true||m.frozen_trades!==4011||m.trade_sha256!==TRADE||
     m.market_rows!==267959||m.domains_matching!==6||m.domains_expected!==6||
     !Array.isArray(m.market_domains)||m.market_domains.length!==6||
     m.external_dump_verified!==false||m.isolated_restore_verified!==false||
     m.production_release_approved!==false)throw Error('manifesto incompleto ou inseguro');
  const seen=new Set();
  for(const d of m.market_domains){
   if(!d||!Object.hasOwn(REF,d.domain)||seen.has(d.domain)||
     d.sha256!==REF[d.domain][0]||d.rows!==REF[d.domain][1]||
     d.expected_rows!==REF[d.domain][1]||d.matches_v4fq!==true)
     throw Error('SHA divergente em '+(d?.domain||'domínio desconhecido'));
   seen.add(d.domain);
  }
  if(seen.size!==6)throw Error('F37B: domínio não encontrado');
  last=Object.freeze({format:'BRZ_F37B_INTEGRITY_REPORT_V1',createdAt:new Date().toISOString(),
   source:'V4FQ_C35_2026-11-13',snapshotVerified:true,
   tradeCount:m.frozen_trades,tradeSHA256:m.trade_sha256,
   marketCount:m.market_rows,domainLedgers:m.market_domains,
   f33JournalEvents:m.change_events_current,checkedAt:m.checked_at,
   externalBackupRestored:false,liveHTMLUATAccepted:false,productionApproved:false,
   note:'Hashes conferidos no Supabase. NÃO é backup externo nem restore validado.'});
  $('brzf37b-export').disabled=false;
  setStatus('F37B: sete ledgers conferidos (4.011 negócios; 267.959 observações). Backup externo e teste real ainda pendentes.','ok');
 }catch(e){setStatus('F37B NÃO APROVADA — '+(e?.message||String(e)),'warn');}
 finally{busy=false;}
}
function download(){
 if(!last)return;
 const blob=new Blob([JSON.stringify(last,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 try{const a=document.createElement('a');a.href=url;a.download='BRZ_F37B_INTEGRIDADE_SHA256.json';
  document.body.appendChild(a);a.click();a.remove();}
 finally{setTimeout(()=>URL.revokeObjectURL(url),30000);}
}
const style=document.createElement('style');style.textContent=`
#brzf37b-open{position:fixed;right:14px;bottom:405px;z-index:2147483007;background:#213b31;color:#fff;
 border:1px solid #56836c;border-radius:9px;padding:9px 12px;font:600 12px Arial;cursor:pointer}
#brzf37b-panel{position:fixed;right:14px;bottom:447px;z-index:2147483008;width:min(390px,calc(100vw - 28px));
 background:#fff;color:#253a32;border:1px solid #a4c5ae;border-radius:10px;padding:14px;box-sizing:border-box;
 font:13px Arial;box-shadow:0 8px 22px #0003}
#brzf37b-panel[hidden]{display:none!important}
#brzf37b-panel button{margin:4px;padding:8px;border:0;border-radius:5px;background:#213b31;color:white;cursor:pointer}
#brzf37b-panel button:disabled{opacity:.4;cursor:default}
#brzf37b-status{background:#eaf2ed;border-radius:5px;padding:8px;font-size:12px;line-height:1.45}
#brzf37b-status[data-state=warn]{color:#8c331b}`;document.head.appendChild(style);
const launcher=document.createElement('button');launcher.id='brzf37b-open';launcher.type='button';
launcher.textContent='F37B · Integridade';launcher.onclick=()=>{$('brzf37b-panel').hidden=!$('brzf37b-panel').hidden;};
document.body.appendChild(launcher);
const panel=document.createElement('section');panel.id='brzf37b-panel';panel.hidden=true;
panel.innerHTML='<b>BRZ · F37B — Manifesto de recuperação</b><p>Compara os 7 SHA-256 do PostgreSQL com a fonte V4FQ. Exige F33 conectado e sem pendências.</p>'+
'<div id="brzf37b-status">Aguardando sessão mesa/admin.</div>'+
'<p><button id="brzf37b-verify" type="button">Conferir integridade</button>'+
'<button id="brzf37b-export" type="button" disabled>Exportar manifesto</button></p>'+
'<small>Não executa backup, restore ou deploy. Somente valida a base de referência.</small>';
document.body.appendChild(panel);
$('brzf37b-verify').onclick=run;$('brzf37b-export').onclick=download;
window.BRZF37B=Object.freeze({run,status:()=>({busy,verified:!!last,productionApproved:false})});
})();

