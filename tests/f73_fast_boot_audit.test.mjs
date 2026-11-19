import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildFastMarketView} from '../assets/secure/f73_fast_market.mjs';
import {auditReason,runReplacementAudit} from '../assets/secure/f73_replacement_audit.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const day='2026-11-16';
const source='a'.repeat(64);
const pack={as_of:day,sourceSha:source,sourceFile:'Excel 16-11',counts:{soymealNotQuoted:21},
 physical:[
  {id:'s',data:day,produto:'Soja',origem:'Canarana/MT',janelaFisica:'Feb-27',bid:132,offer:134,preco:133},
  {id:'m',data:day,produto:'Milho',origem:'Jataí/GO',janelaFisica:'Dec-26',bid:54,offer:56,preco:55},
  {id:'g',data:day,produto:'Sorgo',origem:'Balsas/MA',janelaFisica:'Jan-27',bid:50,offer:51,preco:50.5}
 ],
 basis:[{day:20261116,product:'Soybean',port:'Santos',side:'bid',shipment:'02-2027',value:50}],
 derivatives:[{d:day,p:'Soyoil',o:'SP',v:[7200]},{d:'2026-11-13',p:'Soymeal',o:'PR',v:[2350]}],
 ocean:[{day,shipment:'2027-02-01',route:'Santos>N.CN',value:40}]
};
const v=buildFastMarketView(pack);
assert.equal(v.counts.Soja,1);assert.equal(v.counts.Milho,1);assert.equal(v.counts.Sorgo,1);
assert.equal(v.counts['Basis FOB'],1);
assert.equal(v.counts['Farelo CMA'],0);
assert.equal(v.counts['Óleo CMA'],1);
assert.equal(v.counts.Marítimo,1);
assert.equal(v.notQuotedMeal,21);
assert.equal(v.categories.Soja[0].a,132);
assert.equal(v.categories.Soja[0].unit,'R$/sc');
assert.equal(v.categories['Basis FOB'][0].unit,'¢/bu');
assert(!JSON.stringify(v).includes('replacement'));
assert.throws(()=>buildFastMarketView({...pack,sourceSha:'bad'}),/Excel autenticado/);
const valid={id:'ok',status:'FECHADO',produto:'Soja',origem:'Jataí',corredor:'GO',
 embarque:'Feb-27',data:day,preco:133,cbot:1227.5,vencCBOT:'H27',cambio:5.8,vencCambio:'DOLG27'};
assert.equal(auditReason(valid,{bestPort:'Santos',portosComparados:[{porto:'Santos'}]},null).type,'calculado');
assert.equal(auditReason({...valid,id:'fx',cambio:null},null,null).type,'referencia_incompleta');
assert.equal(auditReason(valid,null,Error('Porto não calculável')).type,'erro_motor');
assert.equal(auditReason(valid,{bestPort:null,portosComparados:[]},null).type,'sem_rota_calculavel');
const records=[valid,{...valid,id:'missing',vencCambio:null},{...valid,id:'error'}, {...valid,id:'none'}, {...valid,id:'outside',foraMercado:true}];
const progress=[];
const audit=await runReplacementAudit({deals:records,chunk:2,
 calculate:d=>{if(d.id==='error')throw Error('missing basis');return d.id==='none'?{bestPort:null,portosComparados:[]}:{bestPort:'Santos',portosComparados:[{}]};},
 onProgress:v=>progress.push(v.current)});
assert.equal(audit.total,5);
assert.equal(audit.considered,4);
assert.equal(audit.computed,1);
assert.equal(audit.skipped,1);
assert.equal(audit.issues.length,3);
assert.equal(audit.byType.referencia_incompleta,1);
assert.equal(audit.byType.erro_motor,1);
assert.equal(audit.byType.sem_rota_calculavel,1);
assert(progress.at(-1)===5);
assert.equal(records[1].vencCambio,null,'Do not fabricate financial fields');
const boot=read('../assets/secure/pin_boot.mjs');
const login=read('../assets/secure/f40_pin_login.js');
const ui=read('../index.html');
const auto=read('../assets/secure/pin_autosave.js');
const sql=read('../migrations/20261116_f73_source_page_limits.sql');
// F77 supersedes the quick-first F73 login, but preserves the isolated F73 data decoder.
assert.match(boot,/__BRZ_VERIFY_FULL_STATIC=fullVerify/);
assert.match(boot,/quickVerified:true/);
assert.match(login,/window\.__BRZ_VERIFY_FULL_STATIC\(\)/);
assert.match(login,/await window\.__BRZ_VERIFY_FULL_STATIC\(\)/);
assert.match(login,/await preflightModules\(\)/);
assert.doesNotMatch(login,/loadFastMarket\(/);
assert.doesNotMatch(login,/brz-open-full/);
assert.doesNotMatch(login,/brz-f73-quick/);
assert.match(ui,/id="brz-boot-progress"/);
assert.doesNotMatch(ui,/id="brz-f73-market"/);
assert.doesNotMatch(ui,/id="brz-open-full"/);
assert.match(auto,/installReplacementAudit\(window,\(\)=>state.negocios\)/);
assert.match(sql,/p_limit NOT BETWEEN 1 AND 1500/);
assert.match(sql,/p_limit NOT BETWEEN 1 AND 1000/);
assert.match(sql,/p_limit NOT BETWEEN 1 AND 4000/);
console.log('F77: direct full engine; F73 decoder and audit modules remain independently testable.');
