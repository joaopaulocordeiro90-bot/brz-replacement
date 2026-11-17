import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeShipmentLegs,auditReason,runReplacementAudit} from '../assets/secure/f73_replacement_audit.mjs';
const after=()=>({bestPort:'Santos',portosComparados:['Santos']});
const base={
 id:'nf261112_30',data:'2026-11-12',status:'FECHADO',produto:'Soja',
 origem:'São Jorge do Ivaí - PR',corredor:'PR Noroeste',
 preco:135,volume:1800,retirada:'por lote',embarque:'Mar-27 / Apr-27',
 vencCBOT:null,cbot:null,vencCambio:'DOLK27',cambio:5.8407,
 replacementPendente:false,
 lotesEmbarque:[
  {idLote:'nf261112_30@F27',volume:900,embarqueOrigem:'Feb-27',
   embarquePorto:'Mar-27',retirada:'20/02 a 28/02/2027',
   vencCBOT:'H27',cbot:1225.5,vencCambio:'DOLK27',cambio:5.8407},
  {idLote:'nf261112_30@M27',volume:900,embarqueOrigem:'Mar-27',
   embarquePorto:'Apr-27',retirada:'01/03 a 10/03/2027',
   vencCBOT:'K27',cbot:1232.75,vencCambio:'DOLK27',cambio:5.8407}
 ]
};
assert.deepEqual(analyzeShipmentLegs(base).reasons,[]);
assert.equal(analyzeShipmentLegs(base).valid,true);
assert.equal(analyzeShipmentLegs(base).volume,1800);
assert.equal(auditReason(base,after(),null).type,'calculado',
 'Valid 2x900t lots should NOT require a single parent-level CBOT');
assert.equal(auditReason({...base,lotesEmbarque:base.lotesEmbarque.map((x,i)=>i?{...x,volume:899}:x)},after(),null).type,'referencia_incompleta');
assert.equal(auditReason({...base,lotesEmbarque:base.lotesEmbarque.map((x,i)=>i?{...x,cbot:null}:x)},after(),null).type,'referencia_incompleta');
assert.equal(auditReason({...base,lotesEmbarque:base.lotesEmbarque.map((x,i)=>i?{...x,vencCambio:null,cambio:null}:x),vencCambio:null,cambio:null},after(),null).type,'referencia_incompleta');
const paraguai={...base,id:'nf261112_01',produto:'Milho',volume:1200,
 origem:'Miraguaí - RS (destino CIP de origem Paraguai)',
 corredor:'Paraguai / entrega RS',lotesEmbarque:null,embarque:null,
 vencCBOT:null,vencCambio:null,cbot:null,cambio:null};
assert.equal(auditReason(paraguai,null,null).type,'fora_paridade_domestica');
const altoParaguai={...ordinary,id:'alto_paraguai_mt',origem:'Alto Paraguai - MT + 11.9km',
 corredor:'MT Médio Norte',produto:'Milho'};
assert.equal(auditReason(altoParaguai,after(),null).type,'calculado',
 'Alto Paraguai/MT é praça brasileira e não deve ser confundida com importação');
const spot={...base,id:'nf261112_20',produto:'Milho',origem:'Boituva - SP',
 corredor:'SP Interior',lotesEmbarque:null,embarque:'Dec-26',
 vencCBOT:'Z26',cbot:443,vencCambio:null,cambio:null,replacementPendente:true};
assert.equal(auditReason(spot,null,null).type,'pendencia_comercial');
assert.equal(auditReason({...spot,replacementPendente:'true'},null,null).type,'pendencia_comercial');
const ordinary={...base,id:'ordinary',lotesEmbarque:null,vencCBOT:'H27',cbot:1225.5};
assert.equal(auditReason(ordinary,after(),null).type,'calculado');
assert.equal(auditReason({...ordinary,cambio:null},after(),null).type,'referencia_incompleta');
const d=[base,paraguai,spot,ordinary,{...ordinary,id:'farelo',produto:'Farelo'}];
let calls=0;let progress=[];
const result=await runReplacementAudit({deals:d,chunk:2,
 calculate:async rec=>{calls++;return after();},
 onProgress:x=>progress.push(x)});
assert.equal(calls,2,'Never compute a Brazilian export basis for Paraguay/pending trade');
assert.equal(result.computed,2);
assert.equal(result.issues.length,2);
assert.equal(result.byType.pendencia_comercial,1);
assert.equal(result.byType.fora_paridade_domestica,1);
assert.equal(result.skipped,1);
assert.equal(progress.at(-1).current,d.length);
const boot=readFileSync(new URL('../assets/secure/f40_pin_login.js',import.meta.url),'utf8');
const encrypted=readFileSync(new URL('../assets/secure/tab_cache.mjs',import.meta.url),'utf8');
assert.match(boot,/BRZ_SOURCE_CACHE_ABI_F75_V1/);
assert.doesNotMatch(boot,/deployedScript:document\.querySelector/);
assert.match(boot,/marketStats:stats,marketMeta:protected55\.f44_meta/);
assert.match(boot,/roadMeta:protected55\.f46_meta/);
assert.match(boot,/tradesSha:F41_STATE_CANONICAL_SHA/);
assert.match(boot,/requestIdleCallback\(writeCache,\{timeout:9000\}\)/);
assert.match(boot,/__BRZ_CACHE_STATUS='SCHEDULED'/);
assert.match(encrypted,/AES-GCM/);
assert.match(encrypted,/MAX_LIFETIME_MS=3600000/);
console.log('F75: rateio CBOT por lote, exceções Paraguai/SPOT, classificação sem falsos positivos e cache imutável aprovado.');
