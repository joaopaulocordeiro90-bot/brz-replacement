import test from "node:test";
import assert from "node:assert/strict";
import {calculate} from "../public/engine.mjs";
const trade={product:"Soja",city:"Jataí",uf:"GO",price_brl_sc:135};
const route={origin_city:"Jataí",origin_uf:"GO",destination_port:"Santos",freight_brl_t:220};
const market={product:"Soja",port:"Santos",fx_brl_usd:5.5,cbot_cbu:1100,fobbins_usd_t:12,ocean_usd_t:35,fob_basis_cbu:100};
test("não aceita dados faltantes",()=>{
 assert.equal(calculate({trade,route,market:{...market,fx_brl_usd:null}}).ok,false);
 assert.equal(calculate({trade,route,market:{...market,cbot_cbu:null}}).ok,false);
 assert.equal(calculate({trade,route,market:{...market,fobbins_usd_t:null}}).ok,false);
});
test("basis FOB ausente implica gross margin N/D",()=>{
 const r=calculate({trade,route,market:{...market,fob_basis_cbu:null}});
 assert.equal(r.ok,true);assert.equal(r.grossMargin,null);
});
test("origem, destino e produto precisam coincidir",()=>{
 assert.equal(calculate({trade,route:{...route,origin_city:"Sorriso"},market}).ok,false);
 assert.equal(calculate({trade,route,market:{...market,port:"Paranaguá"}}).ok,false);
});
test("fórmula independente de conversão c/bu e $/t",()=>{
 const r=calculate({trade,route,market});assert.equal(r.ok,true);
 const f=2.2046,expectedPrice=100*(135/5.5)/f,expectedFreight=100*(220*.06/5.5)/f;
 const expectedFob=expectedPrice+expectedFreight+100*(12*.06)/f-1100;
 assert.ok(Math.abs(r.foB-expectedFob)<1e-9);
 assert.ok(Math.abs(r.cfr-expectedFob-100*(35*.06)/f)<1e-9);
 assert.ok(Math.abs(r.grossMargin-(100-expectedFob)*f/(100*.06))<1e-9);
});
test("milho mantém seu próprio fator",()=>{
 const t={...trade,product:"Milho"};
 const m={...market,product:"Milho"};assert.equal(calculate({trade:t,route,market:m}).ok,true);
});
