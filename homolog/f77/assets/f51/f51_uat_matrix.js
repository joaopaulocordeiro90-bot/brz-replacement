/* F51 read-only operator UAT matrix. Exports ONLY counts, boolean flags and test status.
   Never reads or exports passwords, JWTs, names, quotes, trade IDs, route keys or prices.
   No network requests, no database writes, no automatic download.
*/
(()=>{'use strict';
 const version='F51_READONLY_UAT_MATRIX_V1';
 function inspect(){
  const previous=window.BRZF50?.getAudit?.();
  const empty={schema:version,aggregatePass:false,reason:'F50 probe unavailable',
   loginUatCertified:false,financeUatCertified:false,externalRestoreCertified:false,goLiveApproved:false};
  if(!previous||previous.schema!=='F50_LOCAL_READONLY_UAT_V1')return Object.freeze(empty);
  const iframe=document.getElementById('app');let frame=null;
  try{frame=iframe?.contentWindow;}catch{}
  const frameUI=!!(frame&&frame.document&&frame.document.body);
  let ui={buttons:0,tables:0,canvas:0,svg:0,navElements:0};
  let engine=false;
  if(frameUI){
   try{
    const d=frame.document;
    ui={buttons:d.querySelectorAll('button').length,
     tables:d.querySelectorAll('table').length,
     canvas:d.querySelectorAll('canvas').length,
     svg:d.querySelectorAll('svg').length,
     navElements:d.querySelectorAll('nav, [role=navigation]').length};
    engine=typeof frame.calcReplacement==='function';
   }catch{ui={buttons:0,tables:0,canvas:0,svg:0,navElements:0};engine=false;}
  }
  const local=previous.pageIsLocal===true;
  const countPass=Object.values(previous.matched||{}).every(x=>x===true)
    && Object.keys(previous.matched||{}).length===11;
  const sourcePass=Object.values(previous.sourceFlags||{}).every(x=>x===true)
    && Object.keys(previous.sourceFlags||{}).length===8;
  const framePass=Object.values(previous.iframeSourceFlags||{}).every(x=>x===true)
    && Object.keys(previous.iframeSourceFlags||{}).length===9;
  const rendered=frameUI && ui.buttons>0 && engine;
  const structuralPass=local&&previous.appLoaded===true&&previous.iframeRendered===true
   && countPass&&sourcePass&&framePass&&rendered;
  return Object.freeze({schema:version,createdAtUTC:new Date().toISOString(),
   originLocal:local,appLoaded:previous.appLoaded===true,
   historicalCountsMatch:countPass,sourceFlagsMatch:sourcePass,
   iframeFlagsMatch:framePass,legacyEngineAvailable:engine,
   uiStructure:ui,structuralPass,loginUatCertified:false,
   financeUatCertified:false,externalRestoreCertified:false,goLiveApproved:false,
   businessWritesByProbe:0,operatorAttestationOnly:true,
   review:'This receipt is structural evidence, not proof of real JWT login or finance parity.'});
 }
 function download(){const x=inspect();const data=JSON.stringify(x,null,2)+'\n';
  const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='BRZ_F51_UAT_ESTRUTURAL_UTC.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  return x;
 }
 window.BRZF51=Object.freeze({getAudit:inspect,downloadAudit:download,version});
 document.addEventListener('keydown',e=>{
  if(e.ctrlKey&&e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='u'){
    e.preventDefault();download();
  }
 });
})();
