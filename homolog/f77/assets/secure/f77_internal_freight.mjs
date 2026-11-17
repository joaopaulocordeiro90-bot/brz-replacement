/* F77 | Frete interno: leitura e comparacao EXCLUSIVAMENTE consultiva.
 * Rodoviario: rota + semana ISO (R$/t). Ferroviario: rota + mes/ano (R$/t).
 * Nunca sintetiza valor, data, corredor ou sobrescreve F46/F45.
 */
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const digits=x=>{if(x===undefined||x===null||x==='')return null;const s=String(x).trim().replace(/\s/g,'');const v=Number(s.includes(',')&&s.includes('.')?s.replace(/\./g,'').replace(',','.') : s.replace(',','.'));return Number.isFinite(v)?v:null;};
const roadAliases=new Set(['rodoviario','rodovia','rodo','truck','road']);
const railAliases=new Set(['ferroviario','ferrovia','ferro','rail','railway']);
const aliases={
 mode:['modal','tipo','transporte','modalidade','meio transporte'],
 origin:['origem','origem uf','origin','local origem','praca origem','cidade origem'],
 destination:['destino','destination','porto','terminal','local destino','destino porto'],
 period:['semana','semana iso','iso week','periodo','referencia','competencia','mes','mes referencia','data'],
 value:['valor','preco','preco r$/t','frete','frete r$/t','frete interno','r$/t','tarifa','custo r$/t']
};
const UFS='AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const english={jan:1,feb:2,fev:2,mar:3,apr:4,abr:4,may:5,mai:5,jun:6,jul:7,aug:8,ago:8,sep:9,set:9,oct:10,out:10,nov:11,dec:12,dez:12};
const mode=x=>roadAliases.has(norm(x))?'Rodoviário':railAliases.has(norm(x))?'Ferroviário':null;
const week=x=>{
 const s=String(x||'').trim().toUpperCase();
 let m=s.match(/^(20\d{2})[-/ ]?[SW](\d\d?)$/)||s.match(/^(\d{4})[-/]W(\d\d?)$/);
 if(m){const w=Number(m[2]);return w>=1&&w<=53?m[1]+'-S'+String(w).padStart(2,'0'):null;}
 m=s.match(/^S(\d\d?)[ /-](20\d\d)$/);
 if(m){const w=Number(m[1]);return w>=1&&w<=53?m[2]+'-S'+String(w).padStart(2,'0'):null;}
 return null;
};
const month=x=>{
 const s=norm(x);
 let m=s.match(/^(20\d\d)[-/](\d\d?)$/);
 if(m)return Number(m[2])>=1&&Number(m[2])<=12?m[1]+'-'+m[2].padStart(2,'0'):null;
 m=s.match(/^(\d\d?)[-/](20\d\d)$/);
 if(m)return Number(m[1])>=1&&Number(m[1])<=12?m[2]+'-'+m[1].padStart(2,'0'):null;
 m=s.match(/^([a-z]{3})[-/ ](\d\d|\d{4})$/);
 if(!m||!english[m[1]])return null;
 const y=m[2].length===2?'20'+m[2]:m[2];
 return y+'-'+String(english[m[1]]).padStart(2,'0');
};
const key=x=>[x.modal,norm(x.origem).replace(/\s*[-/]\s*([a-z]{2})$/,'/$1'),norm(x.destino),x.periodo].join('|');
const expected=x=>aliases[x].some(a=>norm(a)===norm(x));
function headerIndex(row){
 const names=(Array.isArray(row)?row:[]).map(norm),found={};
 for(const [field,words] of Object.entries(aliases)){
  const n=names.findIndex(x=>words.includes(x)||words.some(w=>x===w+' (r$/t)'));
  if(n>=0)found[field]=n;
 }
 return ['origin','destination','period','value'].every(n=>Number.isInteger(found[n]))?found:null;
}
export function parseInternalFreight(rows,{sheetName='Frete interno'}={}){
 if(!Array.isArray(rows))throw Error('Frete interno: aba indisponível');
 const errors=[],result=[],seen=new Set();
 const headerPos=rows.slice(0,12).findIndex(row=>headerIndex(row));
 const header=headerPos>=0?headerIndex(rows[headerPos]):null;
 const start=headerPos>=0?headerPos+1:0;
 const defaultModal=norm(sheetName).includes('rodovi')?'Rodoviário':norm(sheetName).includes('ferrovi')?'Ferroviário':null;
 if(!header)errors.push('Cabeçalho não reconhecido. Use: Modal, Origem, Destino, Semana/Mês, Valor R$/t.');
 else for(let i=start;i<rows.length;i++){
  const r=rows[i];if(!Array.isArray(r)||!r.some(v=>String(v??'').trim()))continue;
  const md=mode(r[header.mode])||defaultModal,origem=String(r[header.origin]??'').trim(),
   destino=String(r[header.destination]??'').trim(),rawPeriod=r[header.period],
   periodo=md==='Rodoviário'?week(rawPeriod):md==='Ferroviário'?month(rawPeriod):null,
   valor=digits(r[header.value]);
  if(!md||!origem||!destino||!periodo||valor===null||valor<=0||valor>10000){
   errors.push('Linha '+(i+1)+': modal, origem, destino, período ou frete R$/t inválido');continue;
  }
  if(!/(?:\/| - )[A-Za-z]{2}(?:$|\s)/.test(origem)&&!UFS.includes(origem.slice(-2).toUpperCase())){
   errors.push('Linha '+(i+1)+': origem sem UF explícita; correspondência de rota bloqueada');continue;
  }
  const item={modal:md,origem,destino,periodo,valor,fonteLinha:i+1};
  const id=key(item);
  if(seen.has(id)){errors.push('Linha '+(i+1)+': rota/período duplicado');continue;}
  seen.add(id);result.push(item);
  if(errors.length>=50)break;
 }
 if(!result.length)errors.push('Nenhum frete interno válido identificado');
 return {records:result,errors,counts:{
  total:result.length,rodoviario:result.filter(x=>x.modal==='Rodoviário').length,
  ferroviario:result.filter(x=>x.modal==='Ferroviário').length
 }};
}
export function compareInternalFreight(records,{road=[],rail=[]}={}){
 if(!Array.isArray(records))throw Error('Frete interno: registros inválidos');
 const relevantRoad=new Set(records.filter(r=>r.modal==='Rodoviário').map(key));
 const histories=new Map();
 for(const r of Array.isArray(road)?road:[]){
  if(!r||r.tipo!=='Rodoviário'||!r.semana||!r.origem||!r.destino)continue;
  const item={modal:'Rodoviário',origem:r.origem,destino:r.destino,periodo:r.semana};
  const k=key(item);if(!relevantRoad.has(k))continue;
  const n=digits(r.valor);
  if(n!==null&&n>0&&!histories.has(k))histories.set(k,n);
 }
 const changes=[],status={total:records.length,comparado:0,alterado:0,sem_alteracao:0,sem_referencia:0,ferro_sem_ano:0};
 for(const item of records){
  let before=null,reference='historico_exato';
  if(item.modal==='Rodoviário')before=histories.get(key(item))??null;
  else {
   // F45 rail tariff has Jan–Dez but NO year. Comparing it against
   // 2026/2027 would falsely assert dated continuity; keep baseline N/D.
   reference='ferro_sem_ano';
   status.ferro_sem_ano++;
  }
  const delta=before===null?null:+(item.valor-before).toFixed(2);
  const tag=before===null?'sem_referencia':delta===0?'sem_alteracao':'alterado';
  status[tag]++;if(before!==null)status.comparado++;
  changes.push({modal:item.modal,origem:item.origem,destino:item.destino,periodo:item.periodo,
   unidade:'R$/t',anterior:before,novo:item.valor,delta,status:tag,referencia:reference,
   sourceLine:item.fonteLinha});
 }
 return {schema:'BRZ_F77_INTERNAL_FREIGHT_PREVIEW_V1',counts:status,changes,
  warnings:['A conferência de frete interno não grava tarifas nem altera replacement.',
   'Frete rodoviário comparado somente por origem, destino e semana idênticos.',
   'Ferroviário F45 possui tarifas mensais sem ano; a comparação temporal é N/D.']};
}
