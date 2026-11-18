import test from "node:test";
import assert from "node:assert/strict";
import {parseShipMonth,nextMonth,inferShipment,expectedCbotContract,expectedDolContract,railDiscount,projectFreight} from "../public/commercial-calendar.mjs";
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,"esperado "+b+" obtido "+a);
const ref=(product,shipMonth,tradeDate="2026-11-18")=>expectedCbotContract({product,shipMonth,tradeDate}).contract;
test("aceita competência ISO, MMM-YY em inglês e português",()=>{
 assert.equal(parseShipMonth("2026-12"),"2026-12");
 assert.equal(parseShipMonth("Dec-26"),"2026-12");
 assert.equal(parseShipMonth("Dez-26"),"2026-12");
 assert.equal(parseShipMonth("Fev-27"),"2027-02");
 assert.equal(parseShipMonth("2026-13"),null);
 assert.equal(nextMonth("2026-12"),"2027-01");
});
test("soja vence pelo embarque e pela vigência, sem substituir histórico",()=>{
 assert.equal(ref("Soja","2026-12"),"F27");
 assert.equal(ref("Soja","2027-01"),"H27");
 assert.equal(ref("Soja","2027-03"),"H27");
 assert.equal(ref("Soja","2027-04"),"K27");
 assert.equal(ref("Soja","2027-05"),"N27");
 assert.equal(ref("Soja","2027-08"),"U27");
 assert.equal(ref("Soja","2027-09"),"X27");
 assert.equal(ref("Soja","2027-08","2026-10-20"),"X27");
 assert.equal(ref("Soja","2027-03","2026-10-20"),"K27");
 assert.equal(ref("Soja","2027-03","2026-11-01"),"H27");
 assert.equal(ref("Soja","2027-08","2026-08-25"),"X27");
 assert.equal(ref("Soja","2026-03","2026-07-01"),null);
});
test("milho/sorgo usam tabela C49 e exceção U27 da auditoria C53",()=>{
 assert.equal(ref("Milho","2027-01"),"H27");
 assert.equal(ref("Milho","2027-04"),"K27");
 assert.equal(ref("Milho","2027-05"),"K27");
 assert.equal(ref("Milho","2027-06"),"N27");
 assert.equal(ref("Milho","2027-07"),"Z27");
 assert.equal(ref("Milho","2026-12"),"Z26");
 assert.equal(ref("Milho","2027-09","2026-11-16"),"Z27");
 assert.equal(ref("Milho","2027-09","2026-11-17"),"U27");
 assert.equal(ref("Sorgo","2027-09","2026-11-18"),"U27");
 assert.equal(ref("Milho","2027-04","2026-10-15"),"Z27");
 assert.equal(ref("Milho","2027-01","2026-09-15"),"Z27");
});
test("dólar vinculado ao mês do embarque, sem copiar CBOT",()=>{
 assert.deepEqual(expectedDolContract("2026-12"),{contract:"DOLZ26",key:"Dez26"});
 assert.deepEqual(expectedDolContract("2027-01"),{contract:"DOLF27",key:"Jan27"});
 assert.deepEqual(expectedDolContract("2027-09"),{contract:"DOLU27",key:"Set27"});
});
test("embarque: última retirada +1; milho Santos Dec => Dec",()=>{
 const trade={trade_date:"2026-11-18",window_start:"2026-12-01",window_end:"2026-12-15"};
 assert.equal(inferShipment({trade,product:"Soja",port:"Santos"}).shipMonth,"2027-01");
 const c=inferShipment({trade,product:"Milho",port:"Santos"});
 assert.equal(c.shipMonth,"2026-12");assert.ok(c.exception);
 assert.equal(inferShipment({trade,product:"Milho",port:"Paranaguá"}).shipMonth,"2027-01");
});
test("sem retirada mas spot explícito usa mês seguinte ao fechamento; sem data não inventa",()=>{
 assert.equal(inferShipment({trade:{trade_date:"2026-11-18",status:"DISPONIVEL"},product:"Soja",port:"Santos"}).shipMonth,"2026-12");
 assert.equal(inferShipment({trade:{trade_date:"2026-11-18",status:"PENDENTE"},product:"Soja",port:"Santos"}).shipMonth,null);
});
test("ferro Santos 2026: 15%, transição GO agosto, safra nova sem desconto",()=>{
 near(railDiscount({port:"Santos",originUf:"MT",shipMonth:"2026-12",tradeDate:"2026-08-01"}).factor,.85);
 near(railDiscount({port:"Santos",originUf:"GO",shipMonth:"2026-12",tradeDate:"2026-08-17"}).factor,.85);
 near(railDiscount({port:"Santos",originUf:"GO",shipMonth:"2026-12",tradeDate:"2026-08-20"}).factor,.925);
 near(railDiscount({port:"Santos",originUf:"GO",shipMonth:"2026-12",tradeDate:"2026-08-25"}).factor,1);
 near(railDiscount({port:"Santos",originUf:"MT",shipMonth:"2027-02",tradeDate:"2026-11-18"}).factor,1);
});
test("frete 2026 rodo piso R$50/t e exceção tabela final",()=>{
 const x=projectFreight({tradeDate:"2026-11-18",shipMonth:"2026-12",roadBrlT:25});
 assert.equal(x.ok,true);near(x.road,50);near(x.totalBrlT,50);
 near(projectFreight({tradeDate:"2026-11-18",shipMonth:"2026-12",roadBrlT:25,freightFinalTable:true}).road,25);
});
test("safra 2027: rodovia +0%, ferro +10% a partir de 26/10",()=>{
 const x=projectFreight({tradeDate:"2026-11-18",shipMonth:"2027-01",roadBrlT:220,railBrlT:200});
 near(x.road,220);near(x.rail,220);near(x.totalBrlT,440);
 assert.equal(x.projected2027,true);
});
test("histórico antes de 26/10 preserva +12% rodo e +14% ferro",()=>{
 const x=projectFreight({tradeDate:"2026-10-25",shipMonth:"2027-02",roadBrlT:100,railBrlT:200});
 near(x.road,112);near(x.rail,228);
});
test("2028 aplica +20% em todos os modais, sem somar 2027",()=>{
 const x=projectFreight({tradeDate:"2026-11-18",shipMonth:"2028-02",roadBrlT:100,railBrlT:200,bargeBrlT:300});
 near(x.road,120);near(x.rail,240);near(x.barge,360);
 assert.equal(x.projected2028,true);
});
test("frete total manual não recebe projeção",()=>{
 const x=projectFreight({tradeDate:"2026-11-18",shipMonth:"2028-01",roadBrlT:100,railBrlT:200,freightTotalManual:true});
 near(x.road,100);near(x.rail,200);assert.equal(x.projected2028,false);
});
test("adicional fixo depois da projeção, e ágio apenas Pedro/Santos",()=>{
 const x=projectFreight({tradeDate:"2026-11-18",shipMonth:"2026-12",roadBrlT:100,railBrlT:200,fixedAdditionalBrlT:10,extraPct:.10,
  tradeId:"nf261117_22",port:"Santos",pedroRoadAgioPct:.15});
 near(x.road,110*1.10*1.15);near(x.rail,220);
 const normal=projectFreight({tradeDate:"2026-11-18",shipMonth:"2026-12",roadBrlT:100,tradeId:"n1",port:"Santos",pedroRoadAgioPct:.15});
 near(normal.road,100);
});
test("tarifa ferroviária cheia e desconto explicitamente solicitado",()=>{
 const a=projectFreight({tradeDate:"2026-08-10",shipMonth:"2026-12",railBrlT:200,port:"Santos",originUf:"MT",railTariffUndiscounted:true});
 near(a.rail,170);
 const b=projectFreight({tradeDate:"2026-08-10",shipMonth:"2026-12",railBrlT:200,port:"Santos",originUf:"MT",railTariffUndiscounted:false});
 near(b.rail,200);
});
test("não assume rota ausente e não calcula com data inválida",()=>{
 assert.equal(projectFreight({tradeDate:"2026-11-18",shipMonth:"2027-01"}).ok,false);
 assert.equal(projectFreight({tradeDate:"não sei",shipMonth:"2027-01",roadBrlT:200}).ok,false);
});

test("sorgo não herda exceção que foi aprovada somente para milho Santos",()=>{
 const tr={trade_date:"2026-11-18",window_end:"2026-12-10"};
 assert.equal(inferShipment({trade:tr,product:"Sorgo",port:"Santos"}).shipMonth,"2027-01");
 assert.equal(inferShipment({trade:tr,product:"Milho",port:"Santos"}).shipMonth,"2026-12");
});

test("início de retirada sem data final é indicativo, não confirmação de embarque",()=>{
 const tr={trade_date:"2026-11-18",window_start:"2026-12-01"};
 const shipment=inferShipment({trade:tr,product:"Soja",port:"Santos"});
 assert.equal(shipment.shipMonth,"2027-01");
 assert.equal(shipment.confidence,"INDICATIVO");
});
