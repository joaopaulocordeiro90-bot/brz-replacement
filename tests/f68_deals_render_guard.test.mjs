import assert from 'node:assert/strict';
import {installDealsRenderIsolation} from '../assets/secure/f68_deals_render_guard.mjs';
function mockElement(id=''){
 return {id,style:{},children:[],textContent:'',appendChild(el){this.children.push(el);},
  replaceChildren(...xs){this.children=xs;},setAttribute(){}};
}
const elements=new Map([['negociosStats',mockElement('negociosStats')],['dealsBody',mockElement('dealsBody')]]);
const doc={getElementById(id){return elements.get(id)||null;},createElement(tag){return mockElement(tag);}};
const deals=[{id:'good1'},{id:'bad42'},{id:'good2'}];
const calls=[],oldConsole=console.error;let errors=0;
try{
 console.error=()=>{errors++;};
 const root={document:doc,
   bestRouteAudit(d){if(d.id==='bad42')throw Error('Rota inconsistente no histórico');
    return {bestPort:'Santos',replacementBasis:100,portosComparados:['Santos']};},
   renderDeals(){calls.length=0;for(const d of deals){const audit=root.bestRouteAudit(d);
     calls.push([d.id,audit.bestPort,audit.replacementBasis]);}return calls.length;}};
 assert.equal(installDealsRenderIsolation(root),true);
 assert.equal(installDealsRenderIsolation(root),false,'Idempotent install');
 assert.equal(root.renderDeals(),3);
 assert.deepEqual(calls,[['good1','Santos',100],['bad42','Pendente',null],['good2','Santos',100]]);
 const di=root.__BRZ_F68_DEALS_DIAGNOSTICS();
 assert.equal(di.affected,1);
 assert.equal(di.rows[0].id,'bad42');
 assert(elements.get('brz-f68-deals-status')==null,'Mock document does not persist created nodes');
 assert.throws(()=>root.bestRouteAudit({id:'bad42'}),/Rota inconsistente/,'Other screens retain original engine behavior');
 assert.equal(root.__BRZ_F68_DEALS_RENDER_ACTIVE,false);
 assert.equal(errors,1,'A faulty deal is logged, never silently priced');
 const root2={document:doc,bestRouteAudit(){return {portosComparados:[]};},
   renderDeals(){throw Error('Falha sintética na tabela');}};
 assert.equal(installDealsRenderIsolation(root2),true);
 assert.doesNotThrow(()=>root2.renderDeals(),'Screen provides diagnostic without falling back to generic error');
 assert.equal(elements.get('dealsBody').children.length,1,'Diagnostic table row preserved');
 assert.match(elements.get('dealsBody').children[0].children[0].textContent,/Falha sintética/);
 assert.equal(root2.__BRZ_F68_DEALS_RENDER_ACTIVE,false);
}finally{console.error=oldConsole;}
console.log('F68: isolated one damaged trade, did not change approved replacements, and kept actionable UI.');
