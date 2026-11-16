import assert from 'node:assert/strict';
import {reconcileMarketPrices,mergeReconciledMarketPrices} from '../assets/secure/market_excel_reconcile.mjs';
import {auditDailyMarketOverlay} from '../assets/secure/market_excel_audit.mjs';
const old=[{id:'t1',data:'2026-11-10',produto:'Soja',origem:'Porto Nacional - TO',
 safra:'Soja 25/26',safraKey:'25_26',janelaFisica:'Dec-26',embarque:'Dec-26',
 retirada:'2026-12-31',corredor:'TO Sul',vencCBOT:'F27',vencCambio:'DOLZ26',
 cbot:1229,cambio:5.6,preco:150},
 {id:'t2',data:'2026-11-10',produto:'Sorgo',origem:'Município Teste - MT',
 safra:'Sorgo Safrinha 2026',safraKey:'safrinha_2026',janelaFisica:'Nov-26',
 embarque:'Dec-26',retirada:'2026-11-30',corredor:'SORG-CORRIDOR',
 vencCBOT:'Z26',vencCambio:'DOLZ26',cbot:444,cambio:5.6,preco:50}];
const imp=[
 {id:'new1',data:'2026-11-16',produto:'Soja',origem:'Porto Nacional/TO',
  janelaFisica:'Dec-26',embarque:'Jan-27',bid:149,offer:151,preco:150},
 {id:'new2',data:'2026-11-16',produto:'Milho',origem:'Município Teste/MT',
  janelaFisica:'Dec-26',embarque:'Jan-27',bid:50,offer:52,preco:51},
 {id:'new3',data:'2026-11-16',produto:'Soja',origem:'Praça Nova/GO',
  janelaFisica:'Nov-26',embarque:'Dec-26',bid:150,offer:151,preco:150.5},
 {id:'new4',data:'2026-11-16',produto:'Soja',origem:'Praça Nova/GO',
  janelaFisica:'Jan-27',embarque:'Feb-27',bid:140,offer:142,preco:141}
];
const capture={source_date:'2026-11-16',capture_no:3,curves:{
 cbot:{F27:1227.5,H27:1231.5},cbotMilho:{H27:459.75},
 dolar:{Dez26:5.8035,Jan27:5.8323,Fev27:5.8688}}};
const resolvers={
 cbotContract:(product,ship)=>product==='Milho'?'H27':ship==='Feb-27'?'H27':'F27',
 dolContract:ship=>ship==='Dec-26'?'DOLZ26':ship==='Jan-27'?'DOLF27':'DOLG27'
};
const r=reconcileMarketPrices(old,imp,capture,resolvers);
const lane=r.rows[0];
assert.equal(lane.embarque,'Dec-26','Fixed lane must beat generic next-month shipment');
assert.equal(lane.vencCambio,'DOLZ26');
assert.equal(lane.cambio,5.8035);
assert.equal(lane.corredor,'TO Sul');
assert.equal(lane.safraKey,'25_26');
assert.equal(r.rows[1].corredor,null,'Do not transfer a sorghum route to corn');
assert.equal(r.rows[1].safraKey,'safrinha_2026','Dec26 corn is safrinha 2026');
assert.equal(r.rows[2].safraKey,'25_26','Nov26 soybean is OC 25/26');
assert.equal(r.rows[3].safraKey,'26_27','Jan27 soybean is NC 26/27');
assert.equal(mergeReconciledMarketPrices(old,r.rows).length,6);
const d=20261116, patch={as_of:'2026-11-16',sourceSha:'0'.repeat(64),physical:imp,
 basis:[{key:'Soybean|Paranaguá|F|03-2027|bid',day:d,value:-22}],
 derivatives:[{d:'2026-11-16',o:'Ponta Grossa - PR',p:'Soymeal',v:[2350],_brzExcelSeq:1,_brzExcelF64:true},
 {d:'2026-11-16',o:'São Paulo - SP',p:'Soyoil',v:[7000],_brzExcelSeq:2,_brzExcelF64:true}],
 ocean:[{day:'2026-11-16',route:'A',shipment:'CONT',value:50}]};
const goodBasis={series:{'Soybean|Paranaguá|F|03-2027|bid':[[d,-22]]}};
const goodCMA={rows:patch.derivatives};
const goodOcean={marketExcelOceanRoutes:{'2026-11-16':[['A','CONT',50]]}};
const qa=auditDailyMarketOverlay(patch,r,goodBasis,goodCMA,goodOcean);
assert.equal(qa.totals.physicalPairs,4);
assert.equal(qa.totals.soymealCMA,1);
assert.equal(qa.totals.soyoilCMA,1);
assert.equal(qa.totals.basisFOB,1);
assert.equal(qa.products.Milho.incomplete.length,1);
assert.equal(qa.ok,false,'Incomplete corridor must not be certified as 100%');
assert.equal(qa.errors.length,0,'References should warn without discarding imported bid/offer');
const wrongBasis=auditDailyMarketOverlay(patch,r,{series:{}},goodCMA,goodOcean);
assert.equal(wrongBasis.errors.length,1,'Missing FOB basis is blocking');
const badSpread=auditDailyMarketOverlay({...patch,physical:imp.map((q,i)=>i===0?{...q,bid:151,offer:149}:q)},r,goodBasis,goodCMA,goodOcean);
assert(badSpread.warnings.some(x=>x.includes('bid(s) acima da offer')));
console.log('F67: 19 daily-parity and fixed-lane checks passed.');
