/* F73 — authenticated, read-only operational market preview.
 * Uses the SAME SHA-checked Excel as the legacy platform, but loads no 59k
 * historic physical quotes, 107k basis points, or 178k freight observations.
 * This preview NEVER computes or claims a replacement and never persists data.
 */
const pageSizes=Object.freeze([10,25,50]);
export function buildFastMarketView(patch) {
 if (!patch || !/^20\d\d-\d\d-\d\d$/.test(patch.as_of) ||
     !/^[a-f0-9]{64}$/.test(patch.sourceSha || '') ||
     !patch.counts || !Array.isArray(patch.physical) ||
     !Array.isArray(patch.basis) || !Array.isArray(patch.derivatives) ||
     !Array.isArray(patch.ocean)) throw Error('F73: Excel autenticado não conciliado');
 const date=patch.as_of,filters={};
 const physical=patch.physical.filter(x=>x.data===date);
 for(const product of ['Soja','Milho','Sorgo']){
   filters[product]=physical.filter(x=>x.produto===product).map(x=>({
      window:x.janelaFisica||'N/D',place:String(x.origem||''),a:x.bid,b:x.offer,
      avg:x.preco,unit:'R$/sc'
   }));
 }
 filters['Basis FOB']=patch.basis.filter(x=>x.day===Number(date.replaceAll('-',''))).map(x=>({
    window:x.shipment||'N/D',place:x.product+' · '+x.port+' · '+x.side,
    a:x.value,b:null,avg:null,unit:'¢/bu'
 }));
 filters['Farelo CMA']=patch.derivatives.filter(x=>x.d===date && x.p==='Soymeal').map(x=>({
    window:date,place:x.o,a:x.v?.[0],b:null,avg:null,unit:'R$/t'
 }));
 filters['Óleo CMA']=patch.derivatives.filter(x=>x.d===date && x.p==='Soyoil').map(x=>({
    window:date,place:x.o,a:x.v?.[0],b:null,avg:null,unit:'R$/t'
 }));
 filters['Marítimo']=patch.ocean.filter(x=>x.day===date).map(x=>({
    window:x.shipment,place:x.route,a:x.value,b:null,avg:null,unit:'valor de origem'
 }));
 const counts={};
 for(const [k,rows] of Object.entries(filters))counts[k]=rows.length;
 return Object.freeze({date,sourceSha:patch.sourceSha,counts:Object.freeze(counts),
   sourceFile:patch.sourceFile,notQuotedMeal:patch.counts.soymealNotQuoted||0,
   categories:filters});
}
const make=(doc,tag,cls,txt)=>{
 const e=doc.createElement(tag);if(cls)e.className=cls;
 if(txt!==undefined)e.textContent=String(txt);
 return e;
};
export function renderFastMarket(root,view) {
 if(!root||!root.ownerDocument||!view?.categories)throw Error('F73: contêiner inválido');
 const doc=root.ownerDocument,all=Object.keys(view.categories);
 let selected=all[0],page=0,size=25,query='';
 const main=make(doc,'div','brz-fast-wrap');
 const header=make(doc,'div','brz-fast-header');
 header.append(make(doc,'strong','',view.date.split('-').reverse().join('/')+' · Excel verificado'),
  make(doc,'span','', 'Fonte '+view.sourceSha.slice(0,12)+'… · sem replacement'));
 const tabs=make(doc,'div','brz-fast-tabs'),search=make(doc,'input','brz-fast-search');
 search.type='search';search.placeholder='Buscar praça ou janela';search.setAttribute('aria-label','Buscar praça');
 const tools=make(doc,'div','brz-fast-tools');
 const sizeSelect=make(doc,'select','brz-fast-size');
 sizeSelect.setAttribute('aria-label','Linhas por página');
 for(const n of pageSizes){const opt=make(doc,'option','',n+' linhas');opt.value=String(n);if(n===25)opt.selected=true;sizeSelect.appendChild(opt)}
 const table=make(doc,'table','brz-fast-table'),thead=make(doc,'thead'),tbody=make(doc,'tbody');
 const th=make(doc,'tr');
 for(const title of ['Janela','Praça / referência','Bid / valor','Offer','Média','Unidade'])
   th.appendChild(make(doc,'th','',title));
 thead.appendChild(th);table.append(thead,tbody);
 const pager=make(doc,'div','brz-fast-pager'),previous=make(doc,'button','', '‹ Anterior'),
  next=make(doc,'button','', 'Próxima ›'),indicator=make(doc,'span');
 previous.type='button';next.type='button';
 const empty=make(doc,'div','brz-fast-note','Farelo com zero no Excel = N/D; não gera cotação de R$ 0/t. Dados indicativos, não equivalem a replacement.');
 pager.append(previous,indicator,next);tools.append(search,sizeSelect);main.append(header,tabs,tools,table,pager,empty);
 const fmt=n=>n==null?'—':Number.isFinite(Number(n))?Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2}):'—';
 const choose=x=>{selected=x;page=0;query='';search.value='';update()};
 function update(){
  tabs.replaceChildren();
  for(const key of all){
   const btn=make(doc,'button',key===selected?'selected':'',key+' ('+(view.counts[key]||0)+')');
   btn.type='button';btn.setAttribute('aria-pressed',key===selected?'true':'false');
   btn.addEventListener('click',()=>choose(key));tabs.appendChild(btn);
  }
  let rows=view.categories[selected];
  if(query)rows=rows.filter(x=>(x.place+' '+x.window).toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  const total=Math.max(1,Math.ceil(rows.length/size));
  page=Math.max(0,Math.min(total-1,page));
  tbody.replaceChildren();
  const current=rows.slice(page*size,(page+1)*size);
  if(!current.length){
   const tr=make(doc,'tr'),td=make(doc,'td','','Sem cotação para esta seleção.');
   td.colSpan=6;tr.appendChild(td);tbody.appendChild(tr);
  }else for(const q of current){
   const tr=make(doc,'tr');
   for(const x of [q.window,q.place,fmt(q.a),fmt(q.b),fmt(q.avg),q.unit])
     tr.appendChild(make(doc,'td','',x));
   tbody.appendChild(tr);
  }
  previous.disabled=page===0;next.disabled=page>=total-1;
  indicator.textContent=(rows.length?1+page*size:0)+'–'+Math.min(rows.length,(page+1)*size)+' / '+rows.length+' · página '+(page+1)+'/'+total;
  empty.textContent=(selected==='Farelo CMA'&&view.notQuotedMeal
     ?view.notQuotedMeal+' registros sem cotação no farelo ('+view.date+'). Última cotação válida deve ser consultada no motor completo.'
     :'Fonte verificada; sem cálculos de replacement, frete ou margem nesta visualização rápida.');
 }
 search.addEventListener('input',()=>{query=search.value.trim();page=0;update()});
 sizeSelect.addEventListener('change',()=>{size=pageSizes.includes(Number(sizeSelect.value))?Number(sizeSelect.value):25;page=0;update()});
 previous.addEventListener('click',()=>{page=Math.max(0,page-1);update()});
 next.addEventListener('click',()=>{page++;update()});
 root.replaceChildren(main);update();
 return Object.freeze({getStatus:()=>({date:view.date,selected,page,size,total:view.categories[selected].length})});
}
export async function loadFastMarket({request,token}) {
 if(typeof request!=='function'||typeof token!=='string'||token.length<40)
   throw Error('F73: autenticação exigida');
 const [reply,mod]=await Promise.all([
   request('/rest/v1/rpc/brz_pin_market_excel_archive',{method:'POST',body:{},token}),
   import('./market_excel_overlay.mjs?v=20261116f69')
 ]);
 if(!reply?.available)throw Error('Nenhum Excel diário disponível');
 const patch=await mod.decodeExcelArchive(reply);
 return buildFastMarketView(patch);
}
