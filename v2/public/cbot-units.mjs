// Conversão explícita entre convenções de cotação CBOT.
// O armazenamento e o motor usam exclusivamente centavos por bushel (c/bu).
// Uma cotação "1.100" no campo number é interpretada pelo navegador como 1,10.
// Nunca converter automaticamente cotação ambígua sem escolha explícita da unidade.
export function cbToCanonical(raw,unit="cbu"){
 if(raw===null||raw===undefined||raw==="")return null;
 const value=Number(raw);
 if(!Number.isFinite(value))throw new Error("CBOT inválida: informe uma cotação numérica");
 if(unit!=="cbu"&&unit!=="usd_bu")throw new Error("Unidade CBOT inválida");
 const cents=unit==="usd_bu"?value*100:value;
 if(!(cents>=100&&cents<=4000))
  throw new Error("CBOT fora da faixa de conferência (100 a 4.000 c/bu). Para soja a US$ 11/bu, escolha US$/bu e digite 11, ou escolha c/bu e digite 1100 (sem ponto de milhar).");
 return Number(cents.toFixed(6));
}
