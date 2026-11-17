
/* BRZ F35 — V4FQ economic source adapter | Homologation, opt-in, no price fabrication.
   Only the 1531 source deltas are loaded from JWT-protected PostgreSQL; the legacy JS
   formula engine, layout and all frozen historical input remain intact. */
(function(){
'use strict';
const EXPECTED=Object.freeze({physical:464,curves:152,basis_points:130,basis_series:4,derivatives:114,ocean:667});
const DOMAINS=Object.keys(EXPECTED),TOTAL=Object.values(EXPECTED).reduce((a,b)=>a+b,0);
let busy=false,active=false,lastError='',lastApplied=null;
const $=id=>document.getElementById(id);
function mark(msg,color='neutral'){
 const el=$('brzf35-status');if(el){el.textContent=msg;el.dataset.state=color;}
}
function bridge(){
 const b=window.BRZF33,st=b?.status?.();
 if(!st?.connected||st.blocked||st.unsynced||st.pending||st.working)
  throw Error('Conecte à F33 e confirme todas as gravações antes de ativar o mercado PostgreSQL');
 if(typeof b.marketDeltaPage!=='function'||typeof b.marketDeltaCounts!=='function')
  throw Error('Conector de mercado F35 indisponível');
 return b;
}
function take(row,domain){
 if(!row||row.domain!==domain||row.source_kind==='BASELINE'||
    typeof row.source_key!=='string'||!row.source_key||!row.record_json||
    typeof row.record_json!=='object'||Array.isArray(row.record_json)||
    !Number.isSafeInteger(Number(row.row_no))||Number(row.row_no)<1||
    !/^[a-f0-9]{64}$/i.test(row.record_fingerprint||''))
    throw Error('F35: fonte inválida em '+domain);
 return row.record_json;
}
const numeric=x=>x!==null&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const iso=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
function setDeep(root,path,value){
 let node=root;
 for(let i=0;i<path.length-1;i++){
  const k=path[i];if(typeof k!=='string'||!k||k==='__proto__'||k==='constructor')throw Error('F35: chave inválida');
  if(!node[k]||typeof node[k]!=='object'||Array.isArray(node[k]))node[k]={};
  node=node[k];
 }
 const k=path[path.length-1];if(typeof k!=='string'||!k||k==='__proto__'||k==='constructor')throw Error('F35: chave inválida');
 node[k]=value;
}
async function collect(b,domain){
 const out=[],ids=new Set();let cursor=0;
 for(let i=0;i<30;i++){
  const page=await b.marketDeltaPage({domain,afterRowNo:cursor,limit:200});
  if(!Array.isArray(page)||page.length>200)throw Error('F35: página inválida em '+domain);
  for(const row of page){
   take(row,domain);
   const n=Number(row.row_no);
   if(n<=cursor||ids.has(row.source_key))throw Error('F35: cursor ou chave duplicada em '+domain);
   ids.add(row.source_key);cursor=n;out.push(row);
   if(out.length>EXPECTED[domain])throw Error('F35: excesso de linhas em '+domain);
  }
  if(page.length<200){
   if(out.length!==EXPECTED[domain])throw Error('F35: faltam linhas em '+domain+': '+out.length);
   return out;
  }
 }
 throw Error('F35: paginação incompleta em '+domain);
}
function stage(deltas){
 // Complete all checks and mappings BEFORE mutating the visible app state.
 if(typeof state==='undefined'||!state||typeof structuredClone!=='function'||
    typeof getPrecosBase!=='function'||typeof ppeData!=='function'||typeof r3Data!=='function')
    throw Error('F35: motor legado não inicializado');
 const elCv=$('dataCurvas');if(!elCv)throw Error('F35: dataCurvas ausente');
 const curves=JSON.parse(elCv.textContent||'{}');
 if(!curves.cbot||!curves.dol)throw Error('F35: curvas legadas inválidas');
 const basis=structuredClone(ppeData());
 if(!basis.series||typeof basis.series!=='object')throw Error('F35: basis legados inválidos');
 const derivatives=structuredClone(r3Data());
 if(!Array.isArray(derivatives.rows))throw Error('F35: derivados legados inválidos');
 // Do not mutate previous price objects or the 40MB embedded dataPrecos blob.
 const prices=(typeof PRECOS_BASE_CACHE!=='undefined'&&Array.isArray(PRECOS_BASE_CACHE))
   ?PRECOS_BASE_CACHE.slice():JSON.parse($('dataPrecos')?.textContent||'[]');
 if(!Array.isArray(prices))throw Error('F35: base física ilegível');
 const priceKeys=new Map(prices.map((r,i)=>[r.id,i]));
 const next={...state,
   cbot:{...(state.cbot||{})},cbotMilho:{...(state.cbotMilho||{})},
   cbotFarelo:{...(state.cbotFarelo||{})},cbotOleo:{...(state.cbotOleo||{})},
   dolar:{...(state.dolar||{})},curva:structuredClone(state.curva||{}),
   curvaMilho:structuredClone(state.curvaMilho||{}),
   oceanFreight:structuredClone(state.oceanFreight||{}),
   oceanFreightPorto:structuredClone(state.oceanFreightPorto||{}),
   oceanFreightMonthly:structuredClone(state.oceanFreightMonthly||{}),
   oceanFreightCornMonthly:structuredClone(state.oceanFreightCornMonthly||{})};
 // Ordered source records; no mutation of deal-specific fixed CBOT/FX or derivatives.
 for(const row of deltas.physical){
  const raw=take(row,'physical');let r;
  try{r=JSON.parse(raw.record_text);}catch{throw Error('F35: cotação física JSON inválido');}
  if(!r||r.id!==raw.legacy_id||!iso(r.data)||!r.produto||r.id!==row.source_key)
   throw Error('F35: cotação física de origem inconsistente');
  const ix=priceKeys.get(r.id);
  if(ix===undefined){priceKeys.set(r.id,prices.length);prices.push(r);}
  else prices[ix]=r;
 }
 for(const row of deltas.basis_series){
  const r=take(row,'basis_series');if(!r.legacy_key||r.legacy_key!==row.source_key)throw Error('F35: série sem identidade');
  if(!Object.hasOwn(basis.series,r.legacy_key))basis.series[r.legacy_key]=[];
 }
 for(const row of deltas.basis_points){
  const r=take(row,'basis_points');let day=Number(r.day),value=numeric(r.value);
  if(!r.legacy_key||!Number.isInteger(day)||day<20150101||day>21000101||value===null)
   throw Error('F35: ponto de basis inválido');
  if(!basis.series[r.legacy_key])throw Error('F35: série basis não declarada '+r.legacy_key);
  const src=basis.series[r.legacy_key];
  const i=src.findIndex(pair=>Number(pair[0])===day);
  if(i<0)src.push([day,value]);else src[i]=[day,value];
 }
 for(const k of Object.keys(basis.series))basis.series[k].sort((a,b)=>Number(a[0])-Number(b[0]));
 for(const row of deltas.derivatives){
  const r=take(row,'derivatives');const n=Number(r.seq);
  if(!Number.isInteger(n)||n<1||n>150000||!iso(r.day)
    ||typeof r.location_text!=='string'||typeof r.product!=='string'
    ||!Array.isArray(r.values_json))throw Error('F35: derivados CMA inválidos');
  const item={d:r.day,o:r.location_text,p:r.product,v:r.values_json};
  const prev=derivatives.rows[n-1];
  if(prev&&(!prev.d||prev.d!==r.day||prev.o!==r.location_text||prev.p!==r.product))
   throw Error('F35: ordem CMA divergente no registro '+n);
  if(n>derivatives.rows.length+1)throw Error('F35: lacuna de sequência CMA');
  derivatives.rows[n-1]=item;
 }
 for(const row of deltas.curves){
  const r=take(row,'curves');
  const v=numeric(r.value),contract=String(r.contract||'').toUpperCase();
  if(!iso(r.day)||!contract||v===null||v<=0||!['cbot_daily','dol_daily'].includes(r.domain))
   throw Error('F35: curva inválida');
  const target=r.domain==='cbot_daily'?curves.cbot:curves.dol;
  if(!target[contract])target[contract]={};
  target[contract][r.day]=v;
  // Only the newest dated reading becomes current. Never fabricate a missing contract.
  if(r.day==='2026-11-13'){
   if(r.domain==='cbot_daily'){
    const product=contract.slice(0,2),expiry=contract.slice(2);
    const key=product==='ZS'?'cbot':product==='ZC'?'cbotMilho':
       product==='ZM'?'cbotFarelo':product==='ZL'?'cbotOleo':null;
    if(key&&/^[FGHJKMNQUVXZ]\d{2}$/.test(expiry))next[key][expiry]=v;
   }else{
    const months={F:'Jan',G:'Fev',H:'Mar',J:'Abr',K:'Mai',M:'Jun',N:'Jul',Q:'Ago',U:'Set',V:'Out',X:'Nov',Z:'Dez'};
    const m=months[contract[3]],yr=contract.slice(4);
    if(contract.startsWith('DOL')&&m&&/^\d{2}$/.test(yr))next.dolar[m+yr]=v;
   }
  }
 }
 // Preserve port/corridor month mappings from the legacy engine.
 const oceanTargets={soja_por_contrato:'oceanFreight',soja_porto_contrato:'oceanFreightPorto',
    soja_mensal:'oceanFreightMonthly',milho_mensal:'oceanFreightCornMonthly'};
 for(const row of deltas.ocean){
  const r=take(row,'ocean');const v=numeric(r.value),target=oceanTargets[r.structure];
  if(!target||!iso(r.day)||!r.destination||!r.key_value||v===null||v<0)
    throw Error('F35: referência marítima inválida');
  const path=(r.structure==='soja_por_contrato')
     ?[r.day,r.destination,r.key_value]:[r.day,r.destination,r.port,r.key_value];
  if(path.some(x=>!x))throw Error('F35: corredor marítimo incompleto');
  setDeep(next[target],path,v);
 }
 // Recompute current curve display using the established mapping; fixed trades are immutable.
 for(const [expiry,v] of Object.entries(next.cbot)){
  if(next.curva[expiry]&&typeof next.curva[expiry]==='object')next.curva[expiry].cbot=v;
 }
 for(const [expiry,v] of Object.entries(next.cbotMilho)){
  if(next.curvaMilho[expiry]&&typeof next.curvaMilho[expiry]==='object')next.curvaMilho[expiry].cbot=v;
 }
 return {next,prices,curves,basis,derivatives};
}
function activate(plan){
 const prev={state,prices:typeof PRECOS_BASE_CACHE!=='undefined'?PRECOS_BASE_CACHE:null,
  basis:typeof _basisFOB!=='undefined'?_basisFOB:null,
  derivatives:typeof _r3DerivCache!=='undefined'?_r3DerivCache:null,
  curvesText:$('dataCurvas').textContent};
 try{
  state=plan.next;state._version=(state._version||0)+1;
  PRECOS_BASE_CACHE=plan.prices;
  _basisFOB=plan.basis;
  _r3DerivCache=plan.derivatives;
  $('dataCurvas').textContent=JSON.stringify(plan.curves);
  if(typeof _r3MealCurveCache!=='undefined')_r3MealCurveCache=null;
  if(typeof _r3SpotCache!=='undefined')_r3SpotCache=null;
  if(typeof _r3PhysicalCache!=='undefined')_r3PhysicalCache=null;
  if(typeof _r3PhysicalCacheDate!=='undefined')_r3PhysicalCacheDate=null;
  if(typeof invalidateDataCache==='function')invalidateDataCache();
  if(typeof clearCalcCaches==='function')clearCalcCaches();
  if(typeof scheduleRenderAll==='function')scheduleRenderAll();
 }catch(err){
  state=prev.state;PRECOS_BASE_CACHE=prev.prices;_basisFOB=prev.basis;
  _r3DerivCache=prev.derivatives;$('dataCurvas').textContent=prev.curvesText;
  throw err;
 }
}
async function run(){
 if(busy)return;
 busy=true;mark('Validando inventário e diferenças no PostgreSQL…');
 try{
  const b=bridge();const [full,counts]=await Promise.all([b.marketCounts(),b.marketDeltaCounts()]);
  if(!Array.isArray(full)||full.length!==6||!Array.isArray(counts)||counts.length!==6)
    throw Error('F35: inventário remoto incompleto');
  const expectedTotal={physical:59758,curves:16418,basis_points:107184,basis_series:1405,
     derivatives:14235,ocean:68959};
  const fullMap=new Map(full.map(r=>[r.domain,r]));
  const countMap=new Map(counts.map(r=>[r.domain,r]));
  if(fullMap.size!==6||countMap.size!==6)throw Error('F35: duplicidade no inventário remoto');
  for(const d of DOMAINS){
   const f=fullMap.get(d),c=countMap.get(d);
   if(!f||!c||Number(f.loaded_rows)!==expectedTotal[d]||f.ready!==true
     ||Number(c.delta_rows)!==EXPECTED[d])throw Error('F35: divergência do inventário '+d);
  }
  const deltas={};
  for(const d of DOMAINS){
   mark('Lendo '+d+' · fonte autenticada…');
   deltas[d]=await collect(b,d);
  }
  if(Object.values(deltas).reduce((n,arr)=>n+arr.length,0)!==TOTAL)
    throw Error('F35: total de diferenças inconsistente');
  if(!b.status()?.connected)throw Error('F35: sessão expirada durante a leitura');
  mark('Validando e preparando '+TOTAL+' referências para o motor…');
  const plan=stage(deltas);
  if(!confirm('Aplicar '+TOTAL+' fontes V4FQ verificadas ao motor financeiro local desta sessão? Não altera negócios fixados, fórmulas nem dados do servidor.')){
   mark('Validação concluída. Ativação cancelada.','neutral');return;
  }
  if(!b.status()?.connected)throw Error('F35: sessão desconectada');
  activate(plan);active=true;lastError='';lastApplied=Date.now();
  mark('Fontes PostgreSQL ativas no motor · '+TOTAL+' diferenças aplicadas · leitura 13/11/2026','ok');
 }catch(err){lastError=err?.message||String(err);mark('F35 NÃO ATIVADA — '+lastError,'warn');}
 finally{busy=false;}
}
const css=document.createElement('style');css.textContent=`
#brzf35-launch{position:fixed;right:14px;bottom:114px;z-index:2147483001;background:#14536a;color:white;
 border:1px solid #147f9d;border-radius:9px;padding:9px 12px;font:600 12px Arial;cursor:pointer}
#brzf35-panel{position:fixed;right:14px;bottom:156px;z-index:2147483002;width:min(370px,calc(100vw - 28px));
 box-sizing:border-box;background:white;color:#162f3e;border:1px solid #b2c9d1;border-radius:11px;padding:14px;
 font:13px Arial;box-shadow:0 8px 22px #0003}
#brzf35-panel[hidden]{display:none!important}#brzf35-status{font-size:12px;padding:7px;border-radius:5px;background:#edf3f5}
#brzf35-status[data-state=warn]{color:#a42b24}#brzf35-status[data-state=ok]{color:#176940}
#brzf35-panel button{background:#14536a;color:white;border:0;padding:9px;border-radius:6px;cursor:pointer;font-weight:600}
`;document.head.appendChild(css);
const btn=document.createElement('button');btn.type='button';btn.id='brzf35-launch';btn.textContent='Motor PG · F35';
btn.onclick=()=>{$('brzf35-panel').hidden=!$('brzf35-panel').hidden;};document.body.appendChild(btn);
const panel=document.createElement('div');panel.id='brzf35-panel';panel.hidden=true;
panel.innerHTML='<b>BRZ · F35 — Fontes do motor</b><p>Integra apenas as diferenças da V4FQ ao motor existente. Não altera cálculos nem publica produção.</p>'+
 '<div id="brzf35-status">Aguardando conexão F33 mesa/admin.</div>'+
 '<p><button type="button" id="brzf35-run">Validar e ativar fontes PostgreSQL</button></p>'+
 '<small>Homologação · bases de 13/11/2026 · não substitui a certificação financeira do motor SQL.</small>';
document.body.appendChild(panel);
$('brzf35-run').onclick=run;
window.BRZF35=Object.freeze({run,status:()=>({busy,active,lastError,lastApplied,expected:TOTAL})});
})();

