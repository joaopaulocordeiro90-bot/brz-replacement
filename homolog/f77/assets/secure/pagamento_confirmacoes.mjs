/* BRZ F62 — projeção de vencimentos a partir de confirmações privadas.
 * Não reescreve snapshots, não infere preço, não altera ferroviário.
 * Fonte dos IDs e exceções: RPC autenticada brz_pin_trade_payment_confirmations. */
const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const formatBR=iso=>{const a=String(iso||'').match(/^(20\d{2})-(\d{2})-(\d{2})$/);
 return a?a[3]+'/'+a[2]+'/'+a[1]:null;};
const addDays=(iso,days)=>{
 const m=String(iso||'').match(/^(20\d{2})-(\d{2})-(\d{2})$/);
 if(!m||!Number.isInteger(Number(days))||Number(days)<0||Number(days)>365)return null;
 const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
 if(d.toISOString().slice(0,10)!==iso)return null;
 d.setUTCDate(d.getUTCDate()+Number(days));return d.toISOString().slice(0,10);
};
const ruleText=(base,days,first)=>{
 if(base==='PRIMEIRA_ENTREGA')return days+' dias após a primeira entrega'+(first?' ('+formatBR(first)+')':'');
 if(base==='RETIRADA')return days+' dias após cada retirada';
 if(base==='ENTREGA')return days+' dias após cada entrega';
 return '';
};
const infer=(deal)=>{
 const text=normalize(deal.pagamentoRegra);
 const hit=text.match(/^(\d{1,3})\s*(dias?|d)\b/);
 if(!hit||!/(marco(?: inicial)? nao (?:informado|declarado))/.test(text))return null;
 const inc=normalize(deal.modalidadeComercial);
 const base=inc.startsWith('fob')?'RETIRADA':inc.startsWith('cif')?'ENTREGA':null;
 return base?{payment_basis:base,payment_days:Number(hit[1]),source_reference:'REGRA_BRZ_F62'}:null;
};
export function applyPaymentConfirmation(deal,confirmation){
 if(!deal||typeof deal!=='object'||!deal.id)return deal;
 const explicit=confirmation&&confirmation.legacy_id===deal.id?confirmation:null;
 const rule=explicit||infer(deal);
 if(!rule)return deal;
 const next={...deal};
 if(rule.payment_basis&&Number.isInteger(Number(rule.payment_days))&&Number(rule.payment_days)>=0){
  next.pagamentoMarcoConfirmado=rule.payment_basis;
  next.pagamentoDiasConfirmados=Number(rule.payment_days);
  next.pagamentoRegra=ruleText(rule.payment_basis,Number(rule.payment_days),rule.first_delivery_date);
  next.pagamentoFonteRegra=explicit?'CONFIRMACAO_USUARIO':'REGRA_BRZ_F62';
  if(rule.payment_basis==='PRIMEIRA_ENTREGA'){
   const due=addDays(rule.first_delivery_date,rule.payment_days);
   if(due)next.pagamentoVencimentoIndicativo=due;
  }
 }
 if(explicit?.price_unit==='BRL_T'){
  next.precoUnidadeConfirmada='R$/t';
  const existing=normalize(next.unidadePreco||'');
  if(!existing){next.unidadePreco='R$/t';}
  else if(existing!=='r$/t'&&existing!=='brl/t'&&existing!=='r$/ton'){
   // O cadastro pode conter proposta USD/t; nunca converter nem substituir
   // seu texto original ou criar um valor nominal sem confirmação adicional.
   next.precoUnidadeConflito=true;
   next.precoUnidadeConflitoDescricao='Unidade R$/t informada pelo usuário, mas histórico contém '+next.unidadePreco+'; validar preço numérico antes de alterar.';
  }
  next.precoUnidadeFonte='CONFIRMACAO_USUARIO';
 }
 return next;
}
export function applyPaymentConfirmations(trades,records){
 if(!Array.isArray(trades)||!Array.isArray(records))throw Error('Confirmações de pagamento inválidas');
 if(records.length>500)throw Error('Quantidade de confirmações incompatível');
 const map=new Map();
 for(const x of records){if(!x||typeof x.legacy_id!=='string'||!/^nf\d{6}_\d{2,4}$/.test(x.legacy_id)||map.has(x.legacy_id))
    throw Error('Chave de confirmação inconsistente');map.set(x.legacy_id,x);}
 return trades.map(d=>applyPaymentConfirmation(d,map.get(d?.id)));
}
export const __test={normalize,addDays,infer,ruleText};
