/* F52 — account-safe receipt, read-only. Separate structural check from Access and financial signoff. */
(()=>{'use strict';
 const name='F52_REMOTE_READONLY_UAT_V1';
 function check(){
  let f50=null;try{f50=window.BRZF50?.getAudit?.();}catch{}
  const expected=window.BRZF52_REMOTE_ORIGIN;
  const trustedRemote=location.protocol==='https:'&&typeof expected==='string'&&
    !!expected&&location.origin===expected&&window.isSecureContext===true;
  const local=!!f50?.pageIsLocal;
  const matches=(obj,n)=>obj&&Object.keys(obj).length===n&&Object.values(obj).every(v=>v===true);
  const sources=matches(f50?.sourceFlags,8),counted=matches(f50?.matched,11),
    iframe=matches(f50?.iframeSourceFlags,9);
  const structural=!!f50?.appLoaded&&!!f50?.iframeRendered&&sources&&counted&&iframe&&(trustedRemote||local);
  return Object.freeze({schema:name,timestamp:new Date().toISOString(),
    accessMode:trustedRemote?'EXACT_HTTPS_ORIGIN':(local?'LOCAL_ONLY':'DENIED'),
    exactOriginConfigured:trustedRemote,localHomologation:local,
    sourceCountFlagsValid:counted,authenticatedSourceFlagsValid:sources,
    iframeSourceFlagsValid:iframe,structuralPass:structural,
    externalAccessJwtVerifiedInBrowser:false,realSupabaseLoginUatCertified:false,
    originalFinanceHistoryUatCertified:false,externalBackupRestoreCertified:false,
    productionReleaseApproved:false,writesFromProbe:0,
    explanation:'Read-only structural evidence only. Operator + external DB restore still required.'});
 }
 function download(){const content=JSON.stringify(check(),null,2)+'\n';
   const blob=new Blob([content],{type:'application/json'}),link=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=link;a.download='BRZ_F52_UAT_ORIGEM_PRIVADA_UTC.json';
   document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(link),3000);
 }
 window.BRZF52=Object.freeze({version:name,getStatus:check,download});
 document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='o'){
   e.preventDefault();download();
 }});
})();
