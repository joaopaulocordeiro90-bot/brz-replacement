import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const engine=read('../assets/js/part_06.js');
const login=read('../assets/secure/f40_pin_login.js');
const boot=read('../assets/secure/pin_boot.mjs');
const index=read('../index.html');
const map=read('../assets/secure/rodoviario_tku.mjs');
const css=read('../assets/css/part_01.css');
// Commercial rule: do not use the discontinued 2025 median +15% corn freight.
// Soy, corn and sorghum resolve through findRodoFreight, with dated weekly priority.
assert(!engine.includes('function _milhoAno1Rodo'));
assert(!engine.includes("fonteFrete:'milho_ano1'"));
assert.match(engine,/const ri = findRodoFreight\(deal\.origem, porto, deal\.data, deal\.corredor\)/);
assert.match(engine,/let ri = findRodoFreight\(deal\.origem, transb, deal\.data, deal\.corredor\)/);
assert.match(engine,/match\.semana === dealWeek \? 'semana_exata' : 'semana_anterior'/);
assert.match(engine,/estimateFreightRodo\(origem, destino, corredor, dealWeek\)/);
// Physical pickup drives the canonical crop label; source fields never mutated.
const from=engine.indexOf('function brzSafraPorFisico(produto, ano, mes){');
const to=engine.indexOf('function brzSafraLabel(k){',from);
assert(from>0&&to>from,'crop classifier found');
const sandbox={normalizeProduto:x=>x,brzRegraParam:()=>5,
 brzEmbParse(x){const m=String(x).match(/^([A-Z][a-z]{2})-(\d{2})$/);
  if(!m)return null;const mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(m[1]);return mon<0?null:{yy:Number(m[2]),mes:mon};}
};
vm.createContext(sandbox);vm.runInContext(engine.slice(from,to),sandbox);
const classify=d=>sandbox.brzSafraKeyDeal(d);
assert.equal(classify({produto:'Soja',data:'2026-11-16',retirada:'SPOT/Imediato',safraKey:'26_27'}),'25_26');
assert.equal(classify({produto:'Soja',data:'2026-11-16',retirada:'01/02 a 15/02/2027',safraKey:'25_26'}),'26_27');
assert.equal(classify({produto:'Soja',data:'2027-01-07',retirada:'Disponível',safraKey:'27_28'}),'26_27');
assert.equal(classify({produto:'Milho',data:'2026-11-16',retirada:'Disponível',safraKey:'safrinha_2027'}),'safrinha_2026');
assert.equal(classify({produto:'Milho',data:'2026-11-16',retirada:'15/03/2027'}),'verao_26_27');
assert.equal(classify({produto:'Milho',data:'2026-11-16',retirada:'01/07/2027'}),'safrinha_2027');
assert.match(engine,/\$\{brzSafraLabel\(safraK\)\}/);
assert.match(engine,/function setNegociosDia\(v\)/);
assert.match(engine,/function setNegociosInicio\(v\)/);
assert.match(engine,/function setNegociosFim\(v\)/);
assert.match(engine,/negociosFiltroDia && d\.data!==negociosFiltroDia/);
assert.match(engine,/negociosFiltroInicio && String\(d\.data\|\|''\)<negociosFiltroInicio/);
assert.match(map,/id="brzf60-day"/);
assert.match(map,/id="brzf60-from"/);
assert.match(map,/id="brzf60-to"/);
assert.doesNotMatch(map,/\.slice\(0,175\)/);
assert.match(map,/brzf60-route'\)\.onchange=\(\)=>\{void calculate\(\)/);
assert.match(index,/id="brz-boot-progress"/);
assert.doesNotMatch(index,/brz-open-full/);
assert.match(login,/__BRZ_VERIFY_FULL_STATIC/);
assert.doesNotMatch(login,/brz-f73-quick/);
assert.match(boot,/__BRZ_VERIFY_FULL_STATIC=fullVerify/);
assert.match(css,/#negocios \.table thead th:not\(\.dealsScrollTh\)/);
console.log('F77: freight, crop years, date filters, complete boot and light-mode contrast validated.');
