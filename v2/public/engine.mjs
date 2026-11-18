import {expectedCbotContract,inferShipment} from "./commercial-calendar.mjs";
import {routeIssues,marketIssues} from "./matching.mjs";
// BRZ Replacement V2: núcleo de equivalência ARITMÉTICA verificado contra
// calcReplacement, priceCbu, freightCbu e usdTCbu do HTML operacional C49/V4GE.
// NÃO homologado em regras de calendário, desconto ferro, frete multimodal, 2027/28,
// D-1/D-7/D-30, CFR com referência CBOT distinta e execuções históricas.
export const FACTORS=Object.freeze({Soja:2.2046,Milho:2.3621,Sorgo:2.3621});
export const TON_SC=0.06;
const num=x=>x===null||x===undefined||x===""?null:Number.isFinite(Number(x))?Number(x):null;
const good=x=>x!==null&&Number.isFinite(x);
const insufficient=reason=>({ok:false,reasons:reason,foB:null,cfr:null,basisFOB:null,basisCFR:null,flatFOB:null,flatCFR:null,grossMargin:null,marginCbu:null,margemFOBCbu:null,marginFOBUsdT:null,inputs:null,stage:"NAO_HOMOLOGADO"});
/**
 * Quatro conceitos do HTML original, nunca intercambiar rótulos:
 * replacementFOB (flat) = preço+frete interno+FOBBINS, em c/bu.
 * basisFOB = replacementFOB - CBOT do vencimento físico/FOB.
 * replacementCFR (flat) = replacementFOB + frete marítimo (em c/bu).
 * basisCFR = replacementCFR - CBOT de referência CFR; nesta etapa só se
 * confirma o caso em que a referência CFR é a mesma CBOT física.
 * Gross Margin FOB = basis FOB Bid - basis de replacement FOB.
 */
export function calculate(input){
 const p=input?.trade,r=input?.route,m=input?.market;
 const reasons=[],warnings=[],product=p?.product,factor=FACTORS[product]??null;
 const physical=num(p?.price_brl_sc),fx=num(m?.fx_brl_usd),
  cbot=num(m?.cbot_cbu),freight=num(r?.freight_brl_t),
  fobbins=num(m?.fobbins_usd_t),ocean=num(m?.ocean_usd_t),
  fobQuote=num(m?.fob_basis_cbu);
 const cereal=product==="Milho"||product==="Sorgo";
 if(!factor)reasons.push("Produto sem fator de conversão verificado");
 if(!(good(physical)&&physical>0))reasons.push("Preço físico em R$/sc ausente");
 if(!(good(fx)&&fx>0))reasons.push("Dólar R$/US$ ausente");
 const minCbot=product==="Soja"?400:product==="Milho"?150:100;
 if(!good(cbot))reasons.push("CBOT ausente");
 else if(cbot<minCbot||cbot>4000)
  reasons.push("CBOT inválida para "+String(product)+": "+cbot+" c/bu; confira a unidade");
 if(!(good(freight)&&freight>=0))reasons.push("Frete interno R$/t ausente");
 if(!(good(fobbins)&&fobbins>=0))reasons.push("FOBBINS US$/t ausente");
 reasons.push(...routeIssues(p,r));
 reasons.push(...marketIssues(p,r,m).filter(x=>x!=="Selecione um negócio"&&x!=="Selecione uma rota"));
 const ship=String(m?.ship_month||"");
 if(!/^\d{4}-\d{2}$/.test(ship))reasons.push("Embarque não definido no padrão AAAA-MM");
 else if(Number(ship.slice(0,4))>=2027)
  reasons.push("Projeção de frete 2027/2028+ não homologada neste piloto; cálculo bloqueado até aplicar regras por vigência e modal");
 const calendarReference=expectedCbotContract({product,shipMonth:ship,tradeDate:p?.trade_date});
 if(calendarReference.contract&&m?.cbot_contract){
  const saved=String(m.cbot_contract).trim().toUpperCase().replace(/^(?:ZS|ZC)/,"");
  if(saved!==calendarReference.contract)
   reasons.push("Vencimento CBOT incompatível: referência "+String(m.cbot_contract)+"; esperado "+calendarReference.contract+" conforme regra vigente "+calendarReference.validSince);
 }else if(!calendarReference.contract)
  warnings.push("Calendário CBOT não identificado: "+calendarReference.reason);
 const inferredShipment=inferShipment({trade:p,product,port:r?.destination_port});
 if(inferredShipment.shipMonth&&inferredShipment.confidence==="REGRA_VIGENTE"&&inferredShipment.shipMonth!==ship)
  reasons.push("Mês de embarque incompatível com a última retirada: calculado "+inferredShipment.shipMonth+"; informado "+ship+". Corrija a janela ou cadastre a exceção comercial.");
 else if(inferredShipment.shipMonth&&inferredShipment.shipMonth!==ship)
  warnings.push("Embarque indicado difere de inferência apenas indicativa: conferir a janela");
 if(!m?.cbot_contract)warnings.push("Vencimento CBOT não informado na referência: comparação contratual parcial");
 if(reasons.length)return insufficient(reasons);
 // Fórmulas replicadas do HTML operacional; o frete deste piloto já precisa ser
 // o custo total aprovado para o modal. Não inferir distribuição rodo/ferro.
 const priceCbu=((physical/fx)/factor)*100;
 const freightCbu=(((freight*TON_SC)/fx)/factor)*100;
 const fobbinsCbu=((fobbins*TON_SC)/factor)*100;
 const flatFOB=priceCbu+freightCbu+fobbinsCbu;
 const basisFOB=flatFOB-cbot;
 const oceanCbu=!cereal&&good(ocean)&&ocean>=0?((ocean*TON_SC)/factor)*100:null;
 const flatCFR=oceanCbu===null?null:flatFOB+oceanCbu;
 const basisCFR=flatCFR===null?null:flatCFR-cbot;
 if(cereal)warnings.push("CFR China não exibido para milho/sorgo: marítimo não aplicável nesta versão");
 else if(oceanCbu===null)warnings.push("Frete marítimo indisponível: flat/basis CFR ficam N/D");
 if(r?.modal!=="Rodoviário")warnings.push("Modal multimodal: custo total aceito como entrada, mas decomposição e projeções ainda não homologadas");
 if(m?.side!=="Bid")warnings.push("Cotação FOB não é Bid: Gross Margin FOB fica N/D; Offer não substitui Bid");
 else if(!good(fobQuote))warnings.push("Basis FOB Bid ausente: Gross Margin fica N/D, sem fallback");
 const margemFOBCbu=m?.side==="Bid"&&good(fobQuote)?fobQuote-basisFOB:null;
 const marginFOBUsdT=margemFOBCbu===null?null:margemFOBCbu*factor/(100*TON_SC);
 warnings.push("Flat/basis: núcleo aritmético conciliado com C49; janelas/CBOT de embarque e fretes históricos ainda não homologados");
 return {
  ok:true,reasons:[],warnings,stage:"NUCLEO_ARITMETICO_VALIDADO_NAO_OPERACIONAL",
  flatFOB,basisFOB,flatCFR,basisCFR,margemFOBCbu,marginFOBUsdT,
  // Campos para compatibilidade com a UI, agora representando FLAT (não basis).
  foB:flatFOB,cfr:flatCFR,marginCbu:margemFOBCbu,grossMargin:marginFOBUsdT,
  inputs:{priceCbu,freightCbu,fobbinsCbu,oceanCbu,cbot,bidFOB:m?.side==="Bid"?fobQuote:null,shipMonth:ship,freightBrlT:freight,fx}
 };
}
