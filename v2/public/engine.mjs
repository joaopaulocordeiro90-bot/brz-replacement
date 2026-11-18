import {routeIssues,marketIssues} from "./matching.mjs";
// BRZ Replacement piloto — NUNCA confundir com motor homologado V4GG/F77.
export const FACTORS=Object.freeze({Soja:2.2046,Milho:2.3621,Sorgo:2.3621});
const num=x=>x===null||x===undefined||x===""?null:Number.isFinite(Number(x))?Number(x):null;
const good=x=>x!==null&&Number.isFinite(x);
export function calculate(input){
 const p=input?.trade,r=input?.route,m=input?.market;
 const reasons=[];
 const product=p?.product, factor=FACTORS[product]||null;
 const physical=num(p?.price_brl_sc),fx=num(m?.fx_brl_usd),cbot=num(m?.cbot_cbu),
  freight=num(r?.freight_brl_t),fobbins=num(m?.fobbins_usd_t),
  ocean=num(m?.ocean_usd_t),fobQuote=num(m?.fob_basis_cbu);
 if(!factor)reasons.push("Produto sem fator de conversão homologado");
 if(!(good(physical)&&physical>0))reasons.push("Preço físico R$/sc ausente");
 if(!(good(fx)&&fx>0))reasons.push("Dólar ausente");
 if(!(good(cbot)&&cbot>0))reasons.push("CBOT ausente");
 if(!(good(freight)&&freight>=0))reasons.push("Frete interno ausente");
 if(!(good(fobbins)&&fobbins>=0))reasons.push("FOBBINS ausente");
 if(!(good(ocean)&&ocean>=0))reasons.push("Frete marítimo ausente");
 reasons.push(...routeIssues(p,r));
 reasons.push(...marketIssues(p,r,m).filter(x=>x!=="Selecione um negócio"&&x!=="Selecione uma rota"));
 if(reasons.length)return {ok:false,reasons,foB:null,cfr:null,grossMargin:null};
 const priceCbu=100*(physical/fx)/factor;
 const freightCbu=100*(freight*.06/fx)/factor;
 const fobbinsCbu=100*(fobbins*.06)/factor;
 const oceanCbu=100*(ocean*.06)/factor;
 const replacementFOB=priceCbu+freightCbu+fobbinsCbu-cbot;
 const replacementCFR=replacementFOB+oceanCbu;
 let marginCbu=null,marginUsdT=null;
 if(good(fobQuote)){
  marginCbu=fobQuote-replacementFOB;
  marginUsdT=marginCbu*factor/(100*.06);
 }else reasons.push("Basis FOB do mercado ausente: margem N/D");
 return {ok:true,reasons,foB:replacementFOB,cfr:replacementCFR,grossMargin:marginUsdT,
  marginCbu,inputs:{priceCbu,freightCbu,fobbinsCbu,oceanCbu,cbot}};
}
