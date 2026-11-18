import {cbToCanonical} from "../public/cbot-units.mjs";
import {routeIssues,marketIssues} from "../public/matching.mjs";
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

test("diferença de acentos e espaços não oculta rota válida",()=>{
 const t={...trade,city:"Jataí",uf:"GO"};
 const r={...route,origin_city:" JATAI / GO ",origin_uf:"go",destination_port:" Porto de Santos/SP "};
 const m={...market,port:"santos"};
 assert.deepEqual(routeIssues(t,r),[]);
 assert.deepEqual(marketIssues(t,r,m),[]);
 assert.equal(calculate({trade:t,route:r,market:m}).ok,true);
});
test("rota com origem errada continua bloqueada",()=>{
 assert.notEqual(routeIssues(trade,{...route,origin_city:"Sorriso"}).length,0);
 assert.equal(calculate({trade,route:{...route,origin_city:"Sorriso"},market}).ok,false);
});
test("referência de outro porto ou produto continua bloqueada",()=>{
 assert.notEqual(marketIssues(trade,route,{...market,port:"Paranaguá"}).length,0);
 assert.notEqual(marketIssues(trade,route,{...market,product:"Milho"}).length,0);
 assert.equal(calculate({trade,route,market:{...market,port:"Paranaguá"}}).ok,false);
});

test("CBOT ambígua do print é bloqueada, sem margem falsa",()=>{
 const t={...trade,price_brl_sc:136};
 const m={...market,cbot_cbu:1.1};
 const result=calculate({trade:t,route,market:m});
 assert.equal(result.ok,false);
 assert.equal(result.grossMargin,null);
 assert.match(result.reasons.join(" "),/CBOT inválida/);
});
test("unidades CBOT são explícitas e equivalentes",()=>{
 assert.equal(cbToCanonical(1100,"cbu"),1100);
 assert.equal(cbToCanonical(11,"usd_bu"),1100);
 assert.throws(()=>cbToCanonical(1.1,"cbu"),/CBOT fora da faixa/);
 assert.throws(()=>cbToCanonical(1.1,"usd_bu","Soja"),/CBOT fora da faixa/);
});
test("screenshot reproduz erro de unidade e prova a correção aritmética",()=>{
 const t={...trade,price_brl_sc:136};
 const m={...market,cbot_cbu:1100};
 const result=calculate({trade:t,route,market:m});
 assert.equal(result.ok,true);
 assert.ok(Math.abs(result.foB-163.14400468442)<0.00001);
 assert.ok(Math.abs(result.cfr-258.39937980915)<0.00001);
 assert.ok(Math.abs(result.grossMargin+23.20121212121)<0.00001);
});
