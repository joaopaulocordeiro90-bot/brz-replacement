import assert from 'node:assert/strict';
import {commodity,month,candidates,calculate} from '../assets/secure/pendencias_calc.mjs';
import {installRoadGeo} from '../assets/secure/rodoviario_tku.mjs';

// No credentials, no market history, no network, no live database writes.
assert.equal(commodity({produto:'Soja'}),'Soja');
assert.equal(commodity({produto:'Milho'}),'Milho');
assert.equal(commodity({produto:'Sorgo'}),'Sorgo');
for (const produto of ['Farelo','Óleo','Trigo','Casca de soja'])
  assert.equal(commodity({produto}),null,'Produto fora do motor: '+produto);
assert.deepEqual(month('Fev-27'),{m:2,y:2027});

const d={id:'nf261116_99',data:'2026-11-16',produto:'Soja',origem:'Jataí - GO',
  corredor:'GO Sudoeste',modalidadeComercial:'FOB',embarque:'Fev-27',
  retirada:'01/01/2027 a 31/01/2027',pagamentoRegra:'01/02/2027',preco:134};
const state={cbot:{H27:1200},cbotMilho:{},dolar:{Mar27:5.2}};
const rails=[{origem:'Rondonópolis/MT',destino:'Santos',meses:{Fev:200},fonte:'Tabela original'}];
globalThis.window={findRodoFreight:(origin,dest)=>({
  valor:dest.startsWith('Rondonópolis')?240:250,estimado:true,fonteFrete:'tku_estimado'})};
const list=candidates(d,state,{basis:[],road:[],rail:rails});
const multi=list.find(x=>x.modal==='Rodoviário + Ferroviário'&&x.porto==='Santos');
assert.ok(multi,'Rodo + ferro calculado');
assert.equal(multi.freteRodo,240,'Somente trecho rodoviário usa novo custo');
assert.equal(multi.freteFerro,200,'Tarifa ferroviária intacta');
assert.equal(multi.calc.freight,440,'Soma rodoviário + ferrovia');
assert.equal(multi.calc.dueKnown,false,'DUE desconhecido explicitamente marcado');
assert.ok(calculate(d,{preco:134,fx:5.2,cbot:1200,freteRodo:240,freteFerro:200,despesas:0}));

// OSRM approval is hydrated from Supabase's state, not browser localStorage.
// An exact quoted road freight must win over a geo/TKU estimate.
const norm=x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const k=JSON.stringify([d.id,norm(d.origem),norm('Santos'),d.data]);
const saved={approved:true,km:120,tku:.4,freteRodoIndicativo:48,savedAt:'2026-11-16T19:00:00Z'};
globalThis.document={getElementById:()=>null};
globalThis.window={findRodoFreight:(origin,dest)=>({
  valor:dest==='Paranaguá'?95:120,estimado:dest!=='Paranaguá',tku:.4})};
const active={roadGeoRoutes:{[k]:saved}};
const geo=installRoadGeo({getTrades:()=>[d],getState:()=>active,refresh:()=>{}});
assert.equal(geo.getApproved(d.id,d.origem,'Santos',d.data)?.km,120);
assert.equal(window.findRodoFreight(d.origem,'Santos',d.data,d.corredor,d.id).valor,48);
assert.equal(window.findRodoFreight(d.origem,'Paranaguá',d.data,d.corredor,d.id).valor,95);
assert.equal(geo.status().storage,'Supabase/settings');
assert.equal(geo.status().railModified,false);
console.log('BRZ F60: 15 verificações de regressão concluídas.');
