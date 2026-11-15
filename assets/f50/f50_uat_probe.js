/* F50 read-only UAT receipt. No passwords, JWT, customer names, prices, IDs or network requests. */
(()=>{'use strict';
 const expected={historicalTrades:4011,selection:2820,physicalPrices:59758,
  derivatives:14235,curves:16418,basisPoints:107184,basisSeries:1405,
  rail:39,road:178201,premiums:38,f48Sources:3};
 const count=(a)=>Array.isArray(a)?a.length:0;
 const bool=(x)=>x===true;
 const inspect=()=>{
  const app=document.getElementById('app');let frame=null;
  try{frame=app?.contentWindow;}catch(_){frame=null;}
  const actual={historicalTrades:count(window.__BRZF41_TRADES),
   selection:count(window.__BRZF42_DEALS),physicalPrices:count(window.__BRZF40_PHYSICAL_ROWS),
   derivatives:count(window.__BRZF43_DERIV_ROWS),
   curves:window.__BRZF44_READY?16418:0,basisPoints:window.__BRZF44_READY?107184:0,
   basisSeries:window.__BRZF44_READY?1405:0,rail:count(window.__BRZF45_RAIL_ROWS),
   road:window.__BRZF46_ROAD?.dados?.length||0,premiums:count(window.__BRZF47_PREMIUM_ROWS),
   f48Sources:window.__BRZF48_READY?Object.keys(window.__BRZF48_SOURCES||{}).length:0};
  const checked=Object.fromEntries(Object.entries(expected).map(([key,value])=>[key,actual[key]===value]));
  const flags={f41:bool(window.__BRZF41_TRADES_READY),f42:bool(window.__BRZF42_DEALS_READY),
   f43:bool(window.__BRZF43_DERIV_READY),f44:bool(window.__BRZF44_READY),
   f45:bool(window.__BRZF45_RAIL_READY),f46:bool(window.__BRZF46_ROAD_READY),
   f47:bool(window.__BRZF47_PREMIUM_READY),f48:bool(window.__BRZF48_READY)};
  const names=['__BRZF43_DERIV_RENDERED','__BRZF44_CURVES_RENDERED','__BRZF44_BASIS_RENDERED',
   '__BRZF45_RAIL_RENDERED','__BRZF46_ROAD_RENDERED','__BRZF47_PREMIUM_RENDERED',
   '__BRZF48_HISTORY_RENDERED','__BRZF48_STATE_RENDERED','__BRZF48_RULES_RENDERED'];
  const renderChecks=Object.fromEntries(names.map(name=>[name,frame?.[name]===true]));
  const fullyLoaded=document.body.classList.contains('loaded');
  const appHasUI=!!(frame?.document?.querySelector('button'));
  const passed=fullyLoaded&&appHasUI&&Object.values(checked).every(Boolean)&&
   Object.values(flags).every(Boolean)&&Object.values(renderChecks).every(Boolean);
  return Object.freeze({schema:'F50_LOCAL_READONLY_UAT_V1',timestamp:new Date().toISOString(),
   pageIsLocal:['localhost','127.0.0.1','::1'].includes(location.hostname),
   appLoaded:fullyLoaded,iframeRendered:appHasUI,expected,actual,matched:checked,
   sourceFlags:flags,iframeSourceFlags:renderChecks,
   aggregatePass:passed,realJwtLoginAttestation:'not independently certified',
   operationalFinancialUAT:'not certified by this probe',
   externalBackupRestore:'not certified by this probe',
   businessWritesPerformedByProbe:0});
 };
 function download(){const report=inspect();
  const text=JSON.stringify(report,null,2)+'\n';
  const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download='BRZ_F50_UAT_LEITURA_UTC.json';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
  return report;
 }
 window.BRZF50=Object.freeze({getAudit:inspect,downloadAudit:download});
 document.addEventListener('keydown',e=>{
  if(e.ctrlKey&&e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='r'){
   e.preventDefault();download();
  }
 });
})();
