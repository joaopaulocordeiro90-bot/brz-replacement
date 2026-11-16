import assert from 'node:assert/strict';
import {projectExcel,mergeCMA,mergeBasisSeries} from '../assets/secure/market_excel_overlay.mjs';
const pack={as_of:'2026-11-16',source_file:'synthetic.xlsx',file_sha256:'a'.repeat(64),sheets:{
 prices:[['Corn','Confresa - MT','Bid','51',null],['Corn','Confresa - MT','Offer','53',null]],
 'Basis FOB':[['Paranaguá','Soymeal','BSM-JK27','F','04|05-2027',null,'offer','-11'],
              ['Paranaguá','Soymeal','BSM-JK27','F','04|05-2027',null,'bid','-14']],
 'Derivados CMA':[['Cambé - PR','2315','Soymeal'],['Cambé - PR','2325','Soymeal']],
 'frete maritimo':[]
}};
const r=projectExcel(pack);
assert.deepEqual(r.counts,{physicalBidOffer:2,physicalMid:1,basis:2,ocean:0,derivatives:2,sourceTotal:6});
assert.equal(r.physical[0].preco,52);
assert.equal(r.physical[0].janelaFisica,'N/D');
assert.equal(r.physical[0].embarque,null);
assert.equal(r.physical[0].janelaFisicaPendente,true);
const k='Soymeal|Paranaguá|F|04|05-2027|bid';
assert.deepEqual(mergeBasisSeries({series:{}},r.basis).series[k],[[20261116,-14]]);
const cma=mergeCMA({rows:[{d:'2026-11-10',o:'Cambé - PR',p:'Soymeal',v:[2250]}]},r.derivatives);
assert.equal(cma.rows.length,3,'Multiple CMA quotes in the same city/day must remain separate');
assert.deepEqual(cma.rows.slice(1).map(x=>x.v[0]),[2315,2325]);
assert.equal(mergeCMA(cma,r.derivatives).rows.length,3,'Repeated import remains idempotent');
console.log('F65: missing shipment, combined basis and multiple CMA observations preserved.');
