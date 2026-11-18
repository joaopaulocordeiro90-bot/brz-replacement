import test from "node:test";
import assert from "node:assert/strict";
import {onRequest} from "../functions/api/[[path]].js";
function ctx(path,method="GET",payload,db){
 return {request:new Request("https://example.invalid/api/"+path,{
  method,headers:{"content-type":"application/json"},
  ...(payload===undefined?{}:{body:JSON.stringify(payload)})
 }),env:db?{DB:db}:{}};
}
test("D1 ausente nunca simula sucesso de gravação",async()=>{
 const res=await onRequest(ctx("trades","POST",{product:"Soja"}));
 assert.equal(res.status,503);
 assert.equal((await res.json()).ok,false);
});
test("data comercial inválida bloqueia antes da gravação",async()=>{
 const db={prepare(){throw Error("NÃO DEVE ACESSAR BANCO")}};
 const r=await onRequest(ctx("trades","POST",{
  trade_date:"ontem",product:"Soja",volume_t:1200,origin_name:"Jataí",city:"Jataí",uf:"GO"
 },db));
 assert.equal(r.status,422);
});
test("produto inválido bloqueia a gravação",async()=>{
 const db={prepare(){throw Error("NÃO DEVE ACESSAR BANCO")}};
 const r=await onRequest(ctx("trades","POST",{
  trade_date:"2026-11-17",product:"N/A",volume_t:1200,origin_name:"Jataí",city:"Jataí",uf:"GO"
 },db));
 assert.equal(r.status,422);
});
test("rota sem fonte/tarifa bloqueia gravação",async()=>{
 const db={prepare(){throw Error("NÃO DEVE ACESSAR BANCO")}};
 const r=await onRequest(ctx("routes","POST",{
  origin_city:"Jataí",origin_uf:"GO",destination_port:"Santos",modal:"Rodoviário"
 },db));
 assert.equal(r.status,422);
});
test("endpoint não existente retorna 404",async()=>{
 const r=await onRequest(ctx("qualquercoisa","GET",undefined,{prepare(){throw Error("NÃO")}}));
 assert.equal(r.status,404);
});

test("API rejeita CBOT registrada como 1.10 c/bu antes de gravar",async()=>{
 const db={prepare(){throw Error("NÃO DEVE ACESSAR BANCO")}};
 const r=await onRequest(ctx("market","POST",{
  product:"Soja",port:"Santos",ship_month:"2026-12",reference_date:"2026-11-18",
  cbot_contract:"F27",cbot_cbu:1.1,source:"Teste"
 },db));
 assert.equal(r.status,422);
 assert.match((await r.json()).error,/CBOT inválida/);
});
