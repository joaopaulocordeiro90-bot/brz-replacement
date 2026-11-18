import {cbToCanonical} from "../public/cbot-units.mjs";
import {routeIssues,marketIssues} from "../public/matching.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {calculate} from "../public/engine.mjs";
const trade={product:"Soja",city:"Jataí",uf:"GO",price_brl_sc:136,trade_date:"2026-11-18"};
const route={origin_city:"Jataí",origin_uf:"GO",destination_port:"Santos",freight_brl_t:220,modal:"Rodoviário"};
const market={product:"Soja",port:"Santos",ship_month:"2026-12",fx_brl_usd:5.5,cbot_cbu:1100,
 fobbins_usd_t:12,ocean_usd_t:35,fob_basis_cbu:100,side:"Bid"};
const check=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,"Esperado "+b+", obtido "+a);
test("reprodução aritmética C49: FLAT FOB, basis FOB, FLAT CFR e basis CFR separados",()=>{
 const r=calculate({trade,route,market});assert.equal(r.ok,true);
 const f=2.2046,p=100*(136/5.5)/f,fr=100*(220*.06/5.5)/f,fb=100*(12*.06)/f,sea=100*(35*.06)/f;
 const flat=p+fr+fb,bas=flat-1100;
 check(r.flatFOB,flat);check(r.basisFOB,bas);
 check(r.flatCFR,flat+sea);check(r.basisCFR,flat+sea-1100);
 check(r.margemFOBCbu,100-bas);check(r.marginFOBUsdT,(100-bas)*f/(100*.06));
 check(r.foB,r.flatFOB);check(r.cfr,r.flatCFR);
 check(r.flatFOB,1263.14400468442);check(r.basisFOB,163.14400468442);
 check(r.flatCFR,1358.39937980915);check(r.basisCFR,258.39937980915);
});
test("screenshot antes rotulava basis como flat; a confusão é impedida",()=>{
 const r=calculate({trade,route,market});assert.equal(r.ok,true);
 assert.notEqual(r.foB,r.basisFOB);assert.notEqual(r.cfr,r.basisCFR);
 assert.ok(Math.abs(r.grossMargin+23.20121212121)<1e-9);
});
test("CBOT ambígua (1.10 em vez 1100) é bloqueada",()=>{
 const r=calculate({trade,route,market:{...market,cbot_cbu:1.1}});
 assert.equal(r.ok,false);assert.equal(r.grossMargin,null);
 assert.match(r.reasons.join(" "),/CBOT inválida/);
});
test("converter explicitamente c/bu e US$/bu, sem aceitar cotação ambígua",()=>{
 assert.equal(cbToCanonical(1100,"cbu"),1100);
 assert.equal(cbToCanonical(11,"usd_bu"),1100);
 assert.throws(()=>cbToCanonical(1.1,"cbu"),/CBOT fora da faixa/);
 assert.throws(()=>cbToCanonical(1.1,"usd_bu","Soja"),/CBOT fora da faixa/);
});
test("sem basis FOB: flat/basis continuam, Gross Margin N/D",()=>{
 const r=calculate({trade,route,market:{...market,fob_basis_cbu:null}});
 assert.equal(r.ok,true);assert.notEqual(r.basisFOB,null);
 assert.equal(r.margemFOBCbu,null);assert.equal(r.grossMargin,null);
});
test("Offer não pode assumir lugar do Bid na Gross Margin",()=>{
 const r=calculate({trade,route,market:{...market,side:"Offer"}});
 assert.equal(r.ok,true);assert.equal(r.grossMargin,null);
 assert.match(r.warnings.join(" "),/não é Bid/);
});
test("sem marítimo soja: FOB calculado; CFR N/D",()=>{
 const r=calculate({trade,route,market:{...market,ocean_usd_t:null}});
 assert.equal(r.ok,true);assert.equal(r.flatCFR,null);assert.equal(r.basisCFR,null);
 assert.ok(r.flatFOB>0);
});
test("CBOT, câmbio, FOBBINS e preço físico são obrigatórios",()=>{
 for(const [part,key] of [["market","cbot_cbu"],["market","fx_brl_usd"],["market","fobbins_usd_t"],["trade","price_brl_sc"]]){
  const input={trade:{...trade},route:{...route},market:{...market}};
  input[part][key]=null;
  assert.equal(calculate(input).ok,false,key);
 }
});
test("frete e rota incompatível bloqueiam cálculo",()=>{
 assert.equal(calculate({trade,route:{...route,origin_city:"Sorriso"},market}).ok,false);
 assert.equal(calculate({trade,route:{...route,freight_brl_t:null},market}).ok,false);
 assert.equal(calculate({trade,route,market:{...market,port:"Paranaguá"}}).ok,false);
 assert.equal(calculate({trade,route,market:{...market,product:"Milho"}}).ok,false);
});
test("accentos e grafias comerciais normalizadas preservam rota válida",()=>{
 const r={...route,origin_city:" JATAI / GO ",origin_uf:"go",destination_port:" Porto de Santos/SP "};
 const m={...market,port:"santos"};
 assert.deepEqual(routeIssues(trade,r),[]);assert.deepEqual(marketIssues(trade,r,m),[]);
 assert.equal(calculate({trade,route:r,market:m}).ok,true);
});
test("milho usa 2.3621; não exibe CFR China sem cotação real",()=>{
 const t={...trade,product:"Milho",price_brl_sc:55};
 const m={...market,product:"Milho",cbot_cbu:450,ocean_usd_t:null};
 const x=calculate({trade:t,route,market:m});assert.equal(x.ok,true);
 const expectedFlat=100*(55/5.5)/2.3621+100*(220*.06/5.5)/2.3621+100*(12*.06)/2.3621;
 check(x.flatFOB,expectedFlat);check(x.basisFOB,expectedFlat-450);
 assert.equal(x.flatCFR,null);assert.equal(x.basisCFR,null);
});
test("safrinha/embarques 2027+ bloqueados até migrar regra por modal e vigência",()=>{
 for(const month of ["2027-01","2027-09","2028-03"]){
  const r=calculate({trade,route,market:{...market,ship_month:month}});
  assert.equal(r.ok,false,month);
  assert.match(r.reasons.join(" "),/Projeção de frete/);
 }
});
test("basis negativo é permitido e mantém sinal no cálculo",()=>{
 const r=calculate({trade,route,market:{...market,fob_basis_cbu:-20}});
 assert.equal(r.ok,true);
 check(r.margemFOBCbu,-20-r.basisFOB);
});

test("vencimento físico segue o mês do embarque segundo a regra C49",()=>{
 const ok=calculate({trade,route,market:{...market,cbot_contract:"F27"}});
 assert.equal(ok.ok,true);
 const wrong=calculate({trade,route,market:{...market,cbot_contract:"X26"}});
 assert.equal(wrong.ok,false);
 assert.match(wrong.reasons.join(" "),/Vencimento CBOT incompatível/);
});
test("última retirada determina embarque e bloqueia divergência sem exceção",()=>{
 const t={...trade,window_start:"2026-12-01",window_end:"2026-12-15"};
 const wrong=calculate({trade:t,route,market:{...market,ship_month:"2026-12",cbot_contract:"F27"}});
 assert.equal(wrong.ok,false);
 assert.match(wrong.reasons.join(" "),/Mês de embarque incompatível/);
 const valid=calculate({trade:{...trade,window_start:"2026-11-01",window_end:"2026-11-30"},route,market:{...market,cbot_contract:"F27"}});
 assert.equal(valid.ok,true);
});
