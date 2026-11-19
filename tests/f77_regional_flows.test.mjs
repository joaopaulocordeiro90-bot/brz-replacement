import assert from 'node:assert/strict';
import {buildRegionalFlowReport,contractedPort} from '../assets/secure/f77_regional_flows.mjs';
const a={status:'FECHADO',data:'2026-11-16',produto:'Soja',volume:1200,
  corredor:'MT Leste',localEntrega:'FOB Fazenda, Querência/MT',
  portoReferencia:'Santos',replacementIndicativo:true};
const b={...a,id:'2',volume:800,localEntrega:'CIF Terminal do Porto de Barcarena - PA'};
const c={...a,id:'3',volume:300,produto:'Milho',localEntrega:'FOB Santos/SP'};
const d={...a,id:'4',status:'PEDIDO',volume:500,localEntrega:'CIF Porto de Santos'};
assert.equal(contractedPort(a),null,'FOB farm, theoretical port and freight NOT observed flow');
assert.equal(contractedPort(b),'Barcarena');
assert.equal(contractedPort(c),'Santos');
assert.equal(contractedPort(d),null,'not closed');
const route=()=>[{porto:'Santos',modal:'T'},{porto:'Barcarena',modal:'T+B'}];
const x=buildRegionalFlowReport([a,b,c,d],route);
assert.equal(x.total,3);
assert.equal(x.observed,2);
assert.equal(x.missing,1);
assert.equal(x.volumeObserved,1100);
assert.equal(x.ports.find(t=>t.port==='Santos').potentialDeals,3);
assert.equal(x.ports.find(t=>t.port==='Barcarena').observedVolume,800);
const soy=buildRegionalFlowReport([a,b,c],route,{region:'MT Leste',product:'Soja'});
assert.equal(soy.total,2);
assert.equal(soy.observed,1);
assert.equal(soy.ports.find(t=>t.port==='Santos').observedVolume,0);
console.log('F77: observed contractual port != estimated Best Port; no hypothetical volume mixing.');
