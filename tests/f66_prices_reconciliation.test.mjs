import assert from 'node:assert/strict';
import {normalizeMarketCity,reconcileMarketPrices,mergeReconciledMarketPrices} from '../assets/secure/market_excel_reconcile.mjs';
assert.equal(normalizeMarketCity('Rio Verde - GO'),normalizeMarketCity('Rio Verde/GO'));
const old=[
 {id:'p100',data:'2026-11-13',produto:'Soja',origem:'Rio Verde - GO',safra:'Soja 25/26',
  safraKey:'25_26',janelaFisica:'Nov-26',embarque:'Dec-26',retirada:'2026-11-30',
  cbot:1233.5,cambio:5.6715,vencCBOT:'F27',vencCambio:'DOLZ26',corredor:'GO Sul',
  preco:151,fontePlanilha:'Excel 13/11',curvaCbotData:'CBOT C6 13/11',curvaCambioData:'DOL C6 13/11'},
 {id:'p101',data:'2026-11-13',produto:'Milho',origem:'Rio Verde - GO',safra:'Milho Safrinha 2026',
  safraKey:'safrinha_2026',janelaFisica:'Nov-26',embarque:'Dec-26',retirada:'2026-11-30',
  cbot:445.5,cambio:5.6715,vencCBOT:'Z26',vencCambio:'DOLZ26',corredor:'GO Sul',preco:57},
 {id:'p102',data:'2026-11-13',produto:'Milho',origem:'Sorriso - MT',safra:'Milho Safrinha 2027',
  safraKey:'safrinha_2027',janelaFisica:'Jul-27',embarque:'Aug-27',retirada:'2027-07-31',
  cbot:481,cambio:6.1011,vencCBOT:'Z27',vencCambio:'DOLQ27',corredor:'MT Médio Norte',preco:44}
];
const imported=[
 {id:'px1',data:'2026-11-13',produto:'Soja',origem:'Rio Verde/GO',janelaFisica:'Nov-26',
   embarque:'Dec-26',preco:150,bid:149,offer:151,fontePlanilha:'Excel 16/11'},
 {id:'px2',data:'2026-11-16',produto:'Soja',origem:'Rio Verde/GO',janelaFisica:'Nov-26',
   embarque:'Dec-26',preco:146,bid:145,offer:147,fontePlanilha:'Excel 16/11'},
 {id:'px3',data:'2026-11-16',produto:'Milho',origem:'Sorriso/MT',janelaFisica:'Jul-27',
   embarque:'Aug-27',preco:49,bid:48,offer:50,fontePlanilha:'Excel 16/11'}
];
const cap={source_date:'2026-11-16',capture_no:3,inserted_at:'2026-11-16T18:57:29Z',
 curves:{cbot:{F27:1227.5,H27:1231.5},cbotMilho:{Z26:449,Z27:480.25},
 dolar:{Dez26:5.8035,Ago27:6.1006}}};
const refs={
 cbotContract:(p,s)=>p==='Soja'?'F27':s==='Aug-27'?'Z27':'Z26',
 dolContract:s=>s==='Aug-27'?'DOLQ27':'DOLZ26'
};
const x=reconcileMarketPrices(old,imported,cap,refs,{});
assert.equal(x.status.sourceRows,3);
assert.equal(x.status.matchedExisting,1);
assert.equal(x.status.revisedPrevious,1);
assert.equal(x.status.inserted,2);
assert.equal(x.status.readyCurrent,2);
const past=x.rows.find(r=>r.data==='2026-11-13');
assert.equal(past.id,'p100','Retain 13/11 original ID');
assert.equal(past.preco,150,'Replace only the supplied revised physical price');
assert.equal(past.precoAnteriorPlanilha,151,'Document previous price');
assert.equal(past.cbot,1233.5,'Do not retroactively apply current Chicago');
assert.equal(past.cambio,5.6715,'Do not retroactively apply current FX');
assert.equal(past.corredor,'GO Sul');
assert.equal(old[0].preco,151,'Source remains immutable');
const newSoy=x.rows.find(r=>r.data==='2026-11-16'&&r.produto==='Soja');
assert.equal(newSoy.origem,'Rio Verde - GO','Use canonical historical origin');
assert.equal(newSoy.safra,'Soja 25/26');
assert.equal(newSoy.corredor,'GO Sul');
assert.equal(newSoy.retirada,'2026-11-30');
assert.equal(newSoy.embarque,'Dec-26');
assert.equal(newSoy.vencCBOT,'F27');
assert.equal(newSoy.cbot,1227.5);
assert.equal(newSoy.vencCambio,'DOLZ26');
assert.equal(newSoy.cambio,5.8035);
assert.equal(newSoy.fonteStatus,'COMPLETO_INDICATIVO');
const july=x.rows.find(r=>r.data==='2026-11-16'&&r.produto==='Milho');
assert.equal(july.safra,'Milho Safrinha 2027');
assert.equal(july.corredor,'MT Médio Norte');
assert.equal(july.vencCBOT,'Z27');
assert.equal(july.cbot,480.25);
assert.equal(july.vencCambio,'DOLQ27');
assert.equal(july.cambio,6.1006);
const merged=mergeReconciledMarketPrices(old,x.rows);
assert.equal(merged.length,5,'No duplicated 13/11 historical identity');
assert.equal(mergeReconciledMarketPrices(merged,x.rows).length,5,'Idempotent reimport');
const overrides=reconcileMarketPrices(old,imported,cap,refs,{p100:{preco:152}});
assert.equal(overrides.rows[0].preco,152,'Preserve user manual override when present');
const sparse=reconcileMarketPrices(old,[{...imported[1],origem:'Praça Desconhecida - RR'}],cap,refs,{});
assert.equal(sparse.rows[0].corredor,null,'Never invent a road corridor');
assert.equal(sparse.status.missingCorridor,1);
assert.equal(sparse.status.readyCurrent,0);
console.log('F66: historical canonical price, 13Nov corrections, 16Nov Chicago/DOL C3, origin and crops OK.');