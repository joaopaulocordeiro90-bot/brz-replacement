import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectExcel,mergeCMA} from '../assets/secure/market_excel_overlay.mjs';
const f40=readFileSync(new URL('../assets/secure/f40_pin_login.js',import.meta.url),'utf8');
assert.match(f40,/const MAX_HEAVY_READS=2;/);
assert.match(f40,/const width=kind==='road'\?500:250;/);
assert.match(f40,/task=concurrentPages\(pages,1,/);
assert.doesNotMatch(f40,/const ahead=await readRoadAhead\(path,body,token\)/,'Do not invoke expensive 44-anchor road RPC');
assert.match(f40,/const transient=\[429,502,503,504\].*?\|\|\s*\(response.status===500&&pgCode==='57014'&&!!route\);/s);
const sheet={as_of:'2026-11-16',file_sha256:'1'.repeat(64),source_file:'synthetic-16nov.xlsx',
 sheets:{prices:[['Soybean','Cuiabá - MT','Bid',141,'Feb-27'],['Soybean','Cuiabá - MT','Offer',143,'Feb-27']],
 'Basis FOB':[['Santos','Soybean','BS-F27','F','01-2027','Jan-2027','bid',120]],
 'Derivados CMA':[
  ...Array.from({length:21},(_,i)=>['Praça '+i+' - RS',0,'Soymeal']),
  ...Array.from({length:11},(_,i)=>['Praça '+i+' - RS',7200+i,'Soyoil'])
 ],'frete maritimo':[]}};
const patch=projectExcel(sheet);
assert.equal(patch.counts.derivatives,32,'All 32 original Excel CMA observations counted');
assert.equal(patch.counts.derivativesQuoted,11,'Only oil has actual prices');
assert.equal(patch.counts.soymealNotQuoted,21,'Zero meal means N/D');
assert.equal(patch.counts.soyoilNotQuoted,0);
assert.equal(patch.counts.sourceTotal,35,'Source hash census cannot drop zero placeholders');
assert.equal(patch.derivatives.filter(r=>r.p==='Soymeal').length,0,'No fabricated soybean meal quote R$0');
assert.equal(patch.derivatives.filter(r=>r.p==='Soyoil').length,11);
const last={rows:[{d:'2026-11-13',o:'Praça 0 - RS',p:'Soymeal',v:[2300]}]};
const merged=mergeCMA(last,patch.derivatives);
assert.equal(merged.rows.length,12);
assert.equal(merged.rows.filter(r=>r.p==='Soymeal').length,1,'Previous valid meal remains');
console.log('F69: F46 timeout protection and CMA N/D parity with 16/11 HTML passed.');
