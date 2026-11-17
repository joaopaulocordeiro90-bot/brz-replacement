import assert from 'node:assert/strict';
import {suggestedSheets,buildDailyPack} from '../assets/secure/f77_xlsx_upload.mjs';
import {projectExcel} from '../assets/secure/market_excel_overlay.mjs';
const source={source_file:'BRZ_Diario_17Nov2026.xlsx',
 file_sha256:'a'.repeat(64),
 sheets:{
  'Preços':[
   ['Produto','Praça','Bid/Offer','Valor','Janela'],
   ['Soybean','Querência/MT','Bid',131,'Feb-27'],
   ['Soybean','Querência/MT','Offer',133,'Feb-27'],
   ['Corn','Jataí/GO','Bid',54,'Dec-26'],
   ['Corn','Jataí/GO','Offer',56,'Dec-26']
  ],
  'Basis FOB':[['Port','Produto','Fonte','Tipo','Safra','Ref','Lado','Valor'],
   ['Santos','Soybean','B3','F','03-2027','C','bid',100]],
  'Derivados CMA':[['Praça','Preço','Produto'],['Paranaguá',0,'Soymeal'],['Paranaguá',2500,'Soymeal']],
  'frete maritimo':[['Rota','Embarque','Frete'],['SOYB Santos N.CN','CONT',46]]
 }};
const map=suggestedSheets(source.sheets);
assert.equal(map.prices,'Preços');
assert.equal(map['Derivados CMA'],'Derivados CMA');
const {pack,total,errors,counts}=buildDailyPack(source,'2026-11-17',map);
assert.deepEqual(errors,[]);
assert.equal(total,8);
assert.equal(counts.prices,4);
const p=projectExcel(pack);
assert.equal(p.physical.length,2);
assert.equal(p.counts.soymealNotQuoted,1);
assert.equal(p.counts.derivativesQuoted,1);
assert.equal(p.counts.basis,1);
assert.equal(p.counts.ocean,1);
const bad=buildDailyPack({...source,sheets:{...source.sheets,
 'Preços':[['Soybean','Querência/MT','Bid',132,'Feb-27'],
          ['Soybean','Querência/MT','Offer','-','Feb-27']]}},'2026-11-17',map);
assert.ok(bad.errors.length>0);
const dateBad=()=>buildDailyPack(source,'2026-11-XX',map);
assert.throws(dateBad,/Data/);
console.log('F77 XLSX: four sheets, exact bid/offer pairs, N/D CMA, basis/ocean and unsafe rows rejected.');
