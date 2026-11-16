import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {webcrypto} from 'node:crypto';
import {projectExcel,decodeExcelArchive,mergePrices,mergeBasisSeries,mergeCMA,mergeOcean,basisReferences} from '../assets/secure/market_excel_overlay.mjs';
const sha='a'.repeat(64),pack={as_of:'2026-11-16',source_file:'synthetic.xlsx',file_sha256:sha,
 sheets:{
  prices:[
   ['Soybean','Rio Verde - GO','Bid','134','Feb-27'],
   ['Soybean','Rio Verde - GO','Offer','142','Feb-27'],
   ['Corn','Santos - SP','Bid','57','Dec-26'],
   ['Corn','Santos - SP','Offer','60','Dec-26']],
  'Basis FOB':[
   ['Santos','Soybean','BS-H27','F','03-2027','Mar-2027','bid','34'],
   ['Santos','Soybean','BS-H27','F','03-2027','Mar-2027','offer','46']],
  'frete maritimo':[
   ['[ECSA] Santos>N.CN 66k/10 SOYB KMX','2027-03-01','40.5'],
   ['[USA] USG>N.CN 66k/10 SOYB KMX','2027-03-01','60']],
  'Derivados CMA':[
   ['Ponta Grossa - PR','2210','Soymeal'],
   ['São Paulo - SP','7300','Soyoil']]
 }};
const plan=projectExcel(pack);
assert.deepEqual(plan.counts,{physicalBidOffer:4,physicalMid:2,basis:2,ocean:2,derivatives:2,sourceTotal:10});
assert.equal(plan.physical.find(x=>x.produto==='Soja').preco,138);
assert.equal(plan.physical.find(x=>x.produto==='Soja').embarque,'Mar-27');
assert.equal(plan.physicalRaw[0].Bid,134);
assert.equal(plan.physicalRaw[0].Offer,142);
const basis=mergeBasisSeries({series:{}},plan.basis);
const key='Soybean|Santos|F|03-2027|bid';
assert.deepEqual(basis.series[key],[[20261116,34]]);
assert.equal(basisReferences(plan.basis).length,1,'Bid only for replacement');
assert.equal(mergeBasisSeries(basis,plan.basis).series[key].length,1,'Basis upsert idempotent');
const cma=mergeCMA({rows:[]},plan.derivatives);
assert.equal(mergeCMA(cma,plan.derivatives).rows.length,2,'CMA upsert idempotent');
const prices=mergePrices([],plan.physical);
assert.equal(mergePrices(prices,plan.physical).length,2,'Price upsert idempotent');
const state={oceanFreightMonthly:{},oceanFreightCornMonthly:{},fretesFerro:{keep:true},cbot:{H27:1230},dolar:{Mar27:5.8}};
const ocean=mergeOcean(state,plan.ocean);
assert.equal(ocean.oceanFreightMonthly['2026-11-16'].China.Santos['Mar-27'],40.5);
assert.deepEqual(ocean.fretesFerro,{keep:true},'Rail remains unchanged');
assert.deepEqual(ocean.cbot,{H27:1230},'CBOT remains unchanged');
assert.deepEqual(ocean.dolar,{Mar27:5.8},'FX remains unchanged');
assert.equal(ocean.marketExcelOceanRoutes['2026-11-16'].length,2,'All routes retained, including USA');
const str=JSON.stringify(pack),gz=gzipSync(str,{mtime:0});
const cryptoSha=Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',gz)))
 .map(n=>n.toString(16).padStart(2,'0')).join('');
const archive={available:true,snapshot_day:'2026-11-16',file_sha256:sha,
 compressed_b64:Buffer.from(gz).toString('base64'),gzip_sha256:cryptoSha,
 raw_size_bytes:Buffer.byteLength(str),record_count:10};
const fromArchive=await decodeExcelArchive(archive);
assert.equal(fromArchive.counts.sourceTotal,10);
await assert.rejects(()=>decodeExcelArchive({...archive,gzip_sha256:'0'.repeat(64)}),/SHA-256/);
assert.throws(()=>projectExcel({...pack,sheets:{...pack.sheets,prices:[pack.sheets.prices[0]]}}),/incompleto/);
console.log('F64: 18 checks passed, including gzip SHA-256, bids/offers, FOB basis, CMA, ocean and rail immutability.');
