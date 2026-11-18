// Correspondência comercial: diferenças de caixa, espaços e acentos não podem esconder dados.
export const norm=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().replace(/\s+/g," ").toLowerCase();
const city=(name,uf)=>{
 const normalized=norm(name),state=norm(uf);
 return state?normalized.replace(new RegExp("\\s*(?:/|-)\\s*"+state+"$"),"").trim():normalized;
};
const port=value=>norm(value).replace(/^porto\s+(?:de|do|da)\s+/,"").replace(/\s*\/\s*[a-z]{2}$/,"").trim();
export function routeIssues(trade,route){
 const problems=[];
 if(!trade)return ["Selecione um negócio"];
 if(!route)return ["Selecione uma rota"];
 if(city(route.origin_city,route.origin_uf)!==city(trade.city,trade.uf)||norm(route.origin_uf)!==norm(trade.uf))
  problems.push("Origem incompatível: negócio "+String(trade.city||"?")+"/"+String(trade.uf||"?")+"; rota "+String(route.origin_city||"?")+"/"+String(route.origin_uf||"?"));
 return problems;
}
export function marketIssues(trade,route,market){
 const problems=[];
 if(!trade)return ["Selecione um negócio"];
 if(!route)return ["Selecione uma rota"];
 if(!market)return ["Selecione uma referência de mercado"];
 if(norm(market.product)!==norm(trade.product))
  problems.push("Produto incompatível: negócio "+String(trade.product||"?")+"; mercado "+String(market.product||"?"));
 if(port(market.port)!==port(route.destination_port))
  problems.push("Porto incompatível: rota "+String(route.destination_port||"?")+"; mercado "+String(market.port||"?"));
 return problems;
}
