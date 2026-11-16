/* BRZ Replacement: indicative FOB replacement calculator, independent of UI. */
const mons=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
export const num=x=>x===null||x===undefined||x===''?null:(Number.isFinite(Number(String(x).replace(',','.')))?Number(String(x).replace(',','.')):null);
export const normal=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function month(x){
 const s=String(x||'');
 let m=s.match(/\b\d{1,2}\/(\d{1,2})\/(20\d\d)\b/);
 if(m)return {m:Number(m[1]),y:Number(m[2])};
 m=s.match(/\b(20\d\d)[-\/](\d{1,2})\b/);if(m)return {m:Number(m[2]),y:Number(m[1])};
 m=s.match(/\b(\d{1,2})\/(20\d\d)\b/);if(m&&Number(m[1])<=12)return {m:Number(m[1]),y:Number(m[2])};
 m=s.match(/\b(jan|feb|fev|mar|apr|abr|may|mai|jun|jul|aug|ago|sep|set|oct|out|nov|dec|dez)[a-z]*[-\/ ]*(20)?(\d\d)\b/i);
 if(m){const i=['jan','feb','fev','mar','apr','abr','may','mai','jun','jul','aug','ago','sep','set','oct','out','nov','dec','dez'].indexOf(m[1].toLowerCase().slice(0,3));const a=[1,2,2,3,4,4,5,5,6,7,8,8,9,9,10,10,11,12,12];return i>=0?{m:a[i],y:2000+Number(m[3])}:null;}
 return null;
}
export const label=m=>m&&m.m>=1&&m.m<=12?mons[m.m-1]+'-'+String(m.y).slice(-2):'';
export const shift=(m,n=1)=>{if(!m)return null;const d=new Date(Date.UTC(m.y,m.m-1+n,1));return{m:d.getUTCMonth()+1,y:d.getUTCFullYear()};};
export const commodity=d=>{const p=normal(d?.produto||'').trim();if(/farelo|casca|oleo|trigo|derivado/.test(p))return null;return p.includes('sorgo')?'Sorgo':p.startsWith('soja')?'Soja':p.startsWith('milho')?'Milho':null;};
export const isCif=d=>normal(d.modalidadeComercial)==='cif'||/^\s*cif\b/i.test(d.localEntrega||'');
export function cbotContract(d,m){
 if(!m)return '';
 const kind=commodity(d),codes=kind==='Soja'?['F','H','H','K','K','N','N','Q','U','X','X','F']:['H','H','H','K','K','N','N','U','U','Z','Z','Z'];
 return codes[m.m-1]+String(m.y+(kind==='Soja'&&m.m===12?1:0)).slice(-2);
}
export function fxContract(m){
 const a=shift(m);return a?'DOL'+['F','G','H','J','K','M','N','Q','U','V','X','Z'][a.m-1]+String(a.y).slice(-2):'';
}
export function fxValue(state,m){
 const a=shift(m);return a?num(state?.dolar?.[mons[a.m-1]+String(a.y).slice(-2)]):null;
}
export function origin(d){
 const s=normal((d.origem||'')+' '+(d.localEntrega||''));
 if(s.includes('montividiu'))return {city:'Rio Verde/GO',proxy:true};
 if(s.includes('jatai'))return {city:'Jataí/GO',proxy:false};
 if(s.includes('laguna carapa'))return {city:'Amambaí/MS',proxy:true};
 if(s.includes('luizmangues')||s.includes('porto nacional'))return {city:'Porto Nacional/TO',proxy:s.includes('luizmangues')};
 if(s.includes('rio verde'))return {city:'Rio Verde/GO',proxy:false};
 const m=String(d.origem||'').match(/([\p{L}\s]+)\s*[-\/]\s*([A-Z]{2})/u);
 return {city:m?m[1].trim()+'/'+m[2]:'',proxy:false};
}
export function months(d){
 const months=[];
 const list=d.replacementCenario?.embarquePortoCenarios;
 if(Array.isArray(list))for(const s of list){const x=month(s);if(x)months.push(x);}
 const named=month(d.embarque)||month(d.replacementCenario?.embarquePorto);
 if(named)months.unshift(named);
 if(!months.length){
  const x=month(d.retirada)||month(d.entrega);
  if(x)months.push(isCif(d)?x:shift(x));
 }
 return [...new Map(months.map(m=>[label(m),m])).values()].slice(0,4);
}
export function calculate(d,p){
 if(!commodity(d))return null;
 const price=num(p.preco??d.preco),fx=num(p.fx),cbot=num(p.cbot);
 const rod=num(p.freteRodo),fer=num(p.freteFerro??0),extra=num(p.despesas??0);
 if([price,fx,cbot,rod,fer,extra].some(v=>v===null||v<0)||!price||!fx||!cbot)return null;
 const bpt=commodity(d)==='Soja'?36.74371:39.36825;
 const due=num(p.due);
 if(due!==null&&due<0)return null;
 const dueApplied=due===null?0:due;
 const freight=rod+fer+extra;
 // DUE, when explicitly quantified, is an additional physical cost R$/sc.
 // Unknown DUE is never invented: the indicative result flags it as N/D.
 const totalBRLt=(price+dueApplied)*1000/60+freight;
 const costUSDt=totalBRLt/fx;
 const replacementBasis_cbu=costUSDt*100/bpt-cbot;
 const basis=num(p.basis);
 const marginUSDt=basis===null?null:((cbot+basis)*bpt/100-costUSDt);
 return {totalBRLt,costUSDt,freight,replacementBasis_cbu,replacementFOB_cbu:cbot+replacementBasis_cbu,
  marginUSDt,marketFOB_USDt:basis===null?null:(cbot+basis)*bpt/100,buPerTon:bpt,
  basisAvailable:basis!==null,dueKnown:due!==null,dueAppliedRSsc:dueApplied,indicativo:true,executado:false,proxySorgo:commodity(d)==='Sorgo'};
}
function bid(ref,d,port,m){
 const prod=commodity(d);if(prod==='Sorgo'||!m)return null;
 const target=String(m.m).padStart(2,'0')+'-'+m.y;
 const list=(ref?.basis||[]).filter(x=>x.product===(prod==='Soja'?'Soybean':'Corn')&&
  normal(x.port)===normal(port)&&x.shipment===target&&num(x.value)!==null);
 list.sort((a,b)=>['F','FH','LH'].indexOf(a.typ)-['F','FH','LH'].indexOf(b.typ)||b.day-a.day);
 return list[0]||null;
}
export function candidates(d,state,ref){
 if(!commodity(d))return [];
 const o=origin(d),mths=months(d),sc=d.replacementCenario||{},list=[];
 const ports=['Santos','Paranaguá','Itaqui','Barcarena','Rio Grande','São Francisco do Sul'];
 const portRule=normal(String(d.portoReferencia||sc.porto||''));
 const restricted=ports.find(p=>portRule.includes(normal(p)))||null;
 const pstr=normal(d.pagamentoRegra||'');
 const pay=month(d.pagamentoRegra)||((/72\s*h|sobre rodas|apos cada (?:retirada|entrega)/.test(pstr))?(month(d.retirada)||month(d.data)):null)||mths[0];
 for(const m of mths){
  const cc=cbotContract(d,m);
  const cbot=num((commodity(d)==='Soja'?state.cbot:state.cbotMilho)?.[cc])??num(d.cbot);
  const fx=fxValue(state,pay)??num(d.cambio);
  for(const port of ports){
   if(restricted&&port!==restricted)continue;
   const dest=port==='Itaqui'?'São Luís':port;
   const opts=(ref?.road||[]).filter(x=>normal(x.origin_text)===normal(o.city)&&normal(x.destination_text)===normal(dest)&&num(x.value)!==null)
    .sort((a,b)=>String(b.iso_week).localeCompare(String(a.iso_week)));
   const row=opts.find(x=>!x.iso_week||Number(x.iso_week.slice(0,4))>=2026&&Number(x.iso_week.slice(-2))>=38)||null,otherPort=normal(sc.porto||'');
   const fallback=otherPort.includes(normal(port))?num(sc.freteRodoviarioBRZ_RSt):null;
   const geo=window.BRZRoadGeo?.getApproved?.(d.id,d.origem,dest,d.data);
   let roadLookup=null;try{if(typeof window.findRodoFreight==='function')
      roadLookup=window.findRodoFreight(d.origem,dest,d.data,d.corredor,d.id);}catch{}
   const deliveredPort=isCif(d)&&['Rio Grande','São Francisco do Sul'].some(p=>normal(d.origem).startsWith(normal(p))&&port===p);
   const road=deliveredPort?0:(num(roadLookup?.valor)??(row?num(row.value):(geo?num(geo.freteRodoIndicativo):fallback)));
   if(road===null)continue;
   const b=bid(ref,d,port,m);
   const p={porto:port,mesPorto:label(m),modal:'Rodoviário',freteRodo:road,freteFerro:0,
    despesas:0,cbot,contratoCBOT:cc,fx,contratoDOL:d.vencCambio||fxContract(pay),
    basis:b?num(b.value):null,freteFonte:roadLookup?.fonteFrete||(geo?'OSRM F60 · km × TKU':row?.iso_week||'Cenário BRZ'),
    rota:(d.origem||o.city)+' → '+dest,proxy:o.proxy||!row,basisData:b?.day||null,
    basisJanela:b?.typ||null,preco:num(d.preco),incoterm:isCif(d)?'CIF':'FOB'};
   const calc=calculate(d,p);if(calc)list.push({...p,calc});
  }
  // Multi-modal alternatives must have BOTH an actual road quote to the
  // rail terminal and an indicated rail rate for the same shipping month.
  // Never treat CIF at a nearby city as CIF at a railway terminal.
  for(const rail of ref?.rail||[]){
   if(!rail||!rail.meses||!['Santos','Paranaguá','Itaqui','São Luís'].some(x=>
     normal(x)===normal(rail.destino)))continue;
   const railPrice=num(rail.meses[['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][m.m-1]]);
   if(railPrice===null||railPrice<0)continue;
   if(restricted&&normal(rail.destino)!==normal(restricted)&&!(restricted==='Itaqui'&&normal(rail.destino)==='sao luis'))continue;
   const hub=String(rail.origem||'').split('·')[0].trim();
   const hubName=normal(hub.split('/')[0]);
   const roadToHub=(ref.road||[]).filter(r=>
      normal(r.origin_text)===normal(o.city)&&
      (normal(r.destination_text)===hubName||normal(r.destination_text)===normal(hub))&&
      num(r.value)!==null).sort((a,b)=>String(b.iso_week).localeCompare(String(a.iso_week)))[0];
   const sameTerminal=normal(o.city)===normal(hub)&&!o.proxy;
   let roadHubLookup=null;try{if(typeof window.findRodoFreight==='function')
      roadHubLookup=window.findRodoFreight(d.origem,hub,d.data,d.corredor,d.id);}catch{}
   const roadLeg=sameTerminal?0:(num(roadHubLookup?.valor)??(roadToHub?num(roadToHub.value):null));
   if(roadLeg===null)continue;
   const port=normal(rail.destino)==='sao luis'?'Itaqui':rail.destino;
   const basis=bid(ref,d,port,m);
   const p={porto:port,mesPorto:label(m),modal:'Rodoviário + Ferroviário',
     freteRodo:roadLeg,
     freteFerro:railPrice,despesas:0,cbot,contratoCBOT:cc,fx,
     contratoDOL:d.vencCambio||fxContract(pay),basis:basis?num(basis.value):null,
     freteFonte:(roadHubLookup?.fonteFrete||roadToHub?.iso_week||'Terminal')+' + '+(rail.fonte||'Tabela ferroviária'),
     rota:(d.origem||o.city)+' → '+hub+' → '+port,proxy:o.proxy,
     basisData:basis?.day||null,basisJanela:basis?.typ||null,
     preco:num(d.preco),incoterm:isCif(d)?'CIF':'FOB'};
   const calc=calculate(d,p);if(calc)list.push({...p,calc});
  }
 }
 list.sort((a,b)=>(b.calc.marginUSDt??-999999)-(a.calc.marginUSDt??-999999)||
  a.calc.costUSDt-b.calc.costUSDt);
 return list;
}
