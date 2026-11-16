import assert from 'node:assert/strict';
import {candidates,months,calculate} from '../assets/secure/pendencias_calc.mjs';
globalThis.window={};
const state={cbot:{F27:1225,H27:1230.5,H28:1193.25},cbotMilho:{Z26:444.75,H27:455.25,N27:469.25},dolar:{Dez26:5.73,Jan27:5.76,Mar27:5.83,Abr27:5.87,Out27:6.11}};
const refs={as_of:'2026-11-16',road:[],basis:[],rail:[]};
const d={id:'nf990101_01',data:'2026-11-16',produto:'Milho',origem:'Santa Fé de Goiás/GO',
 modalidadeComercial:'FOB',retirada:'IMEDIATO',pagamentoRegra:'04/12/2026',preco:55};
assert.deepEqual(months(d),[{m:12,y:2026}],'Immediate withdrawal rolls to December port');
const two={...d,retirada:'Novembro/Dezembro 2026'};
assert.deepEqual(months(two),[{m:12,y:2026},{m:1,y:2027}],
 'Both port months preserved; no invented monthly tonnage');
const cif={...d,produto:'Milho',origem:'Rio Grande/RS (CIF)',modalidadeComercial:'CIF',
 retirada:'Fevereiro/2027',pagamentoRegra:'30/03/2027',preco:75};
const placed=candidates(cif,state,refs).find(x=>x.porto==='Rio Grande');
assert.ok(placed&&placed.freteRodo===0,'CIF already delivered in port town has no pre-CIF road cost');
const old={...d,origem:'Mineiros/GO',retirada:'Dezembro/2026'};
const stale=candidates(old,state,{...refs,road:[{origin_text:'Mineiros/GO',destination_text:'Santos',value:185,iso_week:'2021-S43'}]});
assert.equal(stale.length,0,'2021 quote never treated as current 2026 freight');
const toc={...d,origem:'Luizmangues - TO',corredor:'TO',modalidadeComercial:'CIF',
 retirada:'Julho/2027',pagamentoRegra:'30/09/2027',
 replacementCenario:{porto:'Itaqui/MA (hipótese de corredor)',freteRodoviarioBRZ_RSt:300}};
const t=candidates(toc,state,refs);
assert.ok(t.length>0&&t.every(x=>x.porto==='Itaqui'),'CIF Luizmangues hypothesis stays in Itaqui, never Santos');
const far={...d,produto:'Soja',origem:'Querência/MT',retirada:'Fevereiro/2028',
 pagamentoRegra:'26/04/2028',preco:127};
assert.equal(candidates(far,state,refs).length,0,'2028 FX absent: never invent a future quote');
assert.equal(calculate(d,{preco:55,freteRodo:300,freteFerro:0,despesas:0,cbot:444,fx:5.73,basis:null,due:null})?.indicativo,true);
console.log('F63 regression: CIF, spot, multi-window, stale freight and forward FX safety OK.');
