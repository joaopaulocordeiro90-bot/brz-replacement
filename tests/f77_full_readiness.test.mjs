import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareDailyXlsx} from '../assets/secure/f77_xlsx_diff.mjs';
const day='2026-11-17';
const newPack={
 as_of:day,sourceSha:'f'.repeat(64),
 physical:[{produto:'Soja',origem:'Jataí/GO',janelaFisica:'Feb-27',bid:137,offer:139}],
 basis:[{key:'Soybean|Santos|FOB|02-2027|bid',day:20261117,value:125}],
 derivatives:[{d:day,o:'Paranaguá',p:'Soymeal',v:[2460]}],
 ocean:[{day,route:'Santos>N.CN',shipment:'CONT',value:47.25}]
};
const old={
 physicalHistory:[{data:'2026-11-16',produto:'Soja',origem:'Jataí/GO',
    janelaFisica:'Feb-27',bid:135,offer:138}],
 basisHistory:{series:{'Soybean|Santos|FOB|02-2027|bid':[[20261116,120]]}},
 derivativeHistory:[{d:'2026-11-16',o:'Paranaguá',p:'Soymeal',v:[2425]}],
 oceanHistory:{'2026-11-16':[['Santos>N.CN','CONT',46.5]]}
};
const x=compareDailyXlsx(newPack,old);
assert.equal(x.counts.total,4);
assert.equal(x.counts.alterado,4);
assert.equal(x.counts.sem_referencia,0);
assert.equal(x.changes.find(z=>z.tab==='Preços').bidDelta,2);
assert.equal(x.changes.find(z=>z.tab==='Preços').offerDelta,1);
assert.equal(x.changes.find(z=>z.tab==='Basis FOB').delta,5);
assert.equal(x.changes.find(z=>z.tab==='Derivados CMA').delta,35);
assert.equal(x.changes.find(z=>z.tab==='frete maritimo').delta,.75);
const y=compareDailyXlsx(newPack,{physicalHistory:[],basisHistory:null,derivativeHistory:[],oceanHistory:null});
assert.equal(y.counts.sem_referencia,4);
assert.equal(y.changes[0].oldBid,null);
assert.equal(y.changes[0].bidDelta,null);
const app=readFileSync(new URL('../assets/js/part_06.js',import.meta.url),'utf8');
assert.match(app,/function setNegociosUF\(v\)/);
assert.match(app,/function setNegociosCidade\(v\)/);
assert.match(app,/const citySelectOptions/);
assert.match(app,/id="brzF77MapCityDetail"/);
assert.match(app,/renderMapaLeaflet\(data,col,dealsFiltro\)/);
const rail=readFileSync(new URL('../assets/secure/f77_rail_network.mjs',import.meta.url),'utf8');
assert.match(rail,/f:'json'/);
assert.match(rail,/record\?\.geometry\?\.paths/);
assert.doesNotMatch(rail,/f:'geojson'/);
const pin=readFileSync(new URL('../assets/secure/pin_autosave.js',import.meta.url),'utf8');
assert.match(pin,/f77_municipal_indicative\.json/);
assert.match(pin,/f77_xlsx_diff\.mjs/);
assert.match(pin,/getReference:async pack=>/);
const src=JSON.parse(readFileSync(new URL('../assets/data/f77_municipal_indicative.json',import.meta.url),'utf8'));
assert.equal(src.schema,'BRZ_F77_GEO_REFERENCE_V1');
assert.ok(src.ufQualified>=60);
assert.ok(src.cityOnly>=290);
console.log('F77: complete day diff, N/D preservation, corridor-city drilldown, native UF/city and ArcGIS JSON checks OK.');
