/* BRZ F77 · Regional flows. Authenticated UI only.
 * A theoretically eligible port or calculated Best Port is NEVER an observed shipment.
 * This module does not modify trades, source market data, TCO or freight.
 */
const PORTS=['Santos','Paranaguá','Rio Grande','Itaqui','Barcarena','Santarém','São Francisco do Sul','Aratu','Tubarão','Itacoatiara'];
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const safePort=x=>PORTS.find(p=>norm(p)===norm(x))||null;
function portInText(t){
 const v=norm(t);return PORTS.find(p=>{
  const term=norm(p);
  return v.includes(term)&&(!/[a-z]/.test(v[v.indexOf(term)-1]||'')||v[v.indexOf(term)-1]===' ')
 })||null;
}
export function contractedPort(d){
 if(!d||!['FECHADO','FECHADO AGRINVEST'].includes(String(d.status||'').toUpperCase()))return null;
 // Only a backed contractual field expressly marked confirmed qualifies.
 if(d.portoContratadoConfirmado===true)return safePort(d.portoContratado||d.portoDestinoConfirmado);
 if(d.destinoPortoConfirmado===true)return safePort(d.portoDestinoConfirmado);
 // Delivery AT the named port in the commercial contract is observable, not
 // a hypothetical route to that port. No buyer/exchange/basis inference.
 const delivery=String(d.localEntrega||d.entrega||'');
 if(!/(?:^|\W)(?:cif|fob|fas|entrega|porto|terminal)(?:\W|$)/i.test(delivery))return null;
 const p=portInText(delivery);return p||null;
}
export function buildRegionalFlowReport(trades,getRoutes=()=>[],filter={}) {
 const regionFilter=String(filter.region||''),productFilter=String(filter.product||'');
 const rows=(Array.isArray(trades)?trades:[]).filter(d=>d&&
   String(d.status||'').toUpperCase().startsWith('FECHADO')&&
   (!regionFilter||String(d.corredor||'')===regionFilter)&&
   (!productFilter||String(d.produto||'')===productFilter));
 const counted=new Map(),candidates=new Map(),regions=new Set(),products=new Set();
 let observed=0,missing=0,volumeObserved=0;
 const bump=(map,p,v,amount)=>{const rec=map.get(p)||{port:p,n:0,volume:0};rec.n+=v;rec.volume+=amount;map.set(p,rec);};
 for(const d of rows){
   if(d.corredor)regions.add(String(d.corredor));
   if(d.produto)products.add(String(d.produto));
   const volume=Number(d.volume)>0?Number(d.volume):0;
   const port=contractedPort(d);
   if(port){bump(counted,port,1,volume);observed++;volumeObserved+=volume;}
   else missing++;
   let arr=[];try{arr=getRoutes(d)||[];}catch{}
   const possible=new Set(Array.isArray(arr)?arr.map(x=>safePort(x?.porto)).filter(Boolean):[]);
   for(const p of possible)bump(candidates,p,1,0); // no indicative tonnes
 }
 const ports=[...new Set([...counted.keys(),...candidates.keys()])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 return {
  total:rows.length,observed,missing,volumeObserved,
  ports:ports.map(port=>({port,observed:counted.get(port)?.n||0,
   observedVolume:counted.get(port)?.volume||0,potentialDeals:candidates.get(port)?.n||0})),
  regions:[...regions].sort((a,b)=>a.localeCompare(b,'pt-BR')),
  products:[...products].sort((a,b)=>a.localeCompare(b,'pt-BR'))
 };
}
export function installRegionalFlows({getTrades,getRoutes}={}){
 if(typeof document==='undefined'||typeof getTrades!=='function'||typeof getRoutes!=='function')return null;
 const screen=document.getElementById('mapa');if(!screen)return null;
 if(document.getElementById('brz-f77-flows'))return window.BRZRegionalFlows||null;
 const box=document.createElement('details');box.id='brz-f77-flows';
 box.innerHTML='<summary>Fluxos regionais · observado × potencial</summary>'+
   '<div class="brz-f77-flow-controls"><label>Região <select id="brz-f77-flow-region"></select></label>'+
   '<label>Produto <select id="brz-f77-flow-product"></select></label></div>'+
   '<div id="brz-f77-flow-result" aria-live="polite"></div>';
 screen.querySelector('.head')?.insertAdjacentElement('afterend',box);
 const css=document.createElement('style');css.id='brz-f77-flows-style';
 css.textContent='#brz-f77-flows{border:1px solid var(--g200,#d9e3ec);background:var(--card,#fff);margin:10px 18px;padding:9px 13px;border-radius:5px;font:12px Inter,Arial,sans-serif;color:var(--g800,#314b60)}'+
  '#brz-f77-flows summary{cursor:pointer;font-weight:700;color:var(--g900,#19364e)}'+
  '.brz-f77-flow-controls{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}'+
  '.brz-f77-flow-controls label{display:flex;gap:5px;align-items:center}'+
  '.brz-f77-flow-controls select{padding:6px;color:var(--g900,#19364e);background:var(--card,#fff);border:1px solid var(--g200,#d9e3ec)}'+
  '#brz-f77-flows table{width:100%;border-collapse:collapse;text-align:left}'+
  '#brz-f77-flows th{color:var(--g900,#19364e);background:var(--g50,#f3f7fa);font-size:10.5px}'+
  '#brz-f77-flows th,#brz-f77-flows td{padding:7px;border-bottom:1px solid var(--g200,#d9e3ec)}'+
  '#brz-f77-flows small{display:block;color:var(--g600,#536c7b);line-height:1.45;margin-top:8px}';
 document.head.appendChild(css);
 const region=box.querySelector('#brz-f77-flow-region');
 const product=box.querySelector('#brz-f77-flow-product');
 const result=box.querySelector('#brz-f77-flow-result');
 const all=()=>buildRegionalFlowReport(getTrades(),getRoutes);
 function refresh(){
   if(!box.open)return;
   const info=all(),r=region.value,p=product.value;
   region.innerHTML='<option value="">Todas as regiões</option>'+info.regions.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
   product.innerHTML='<option value="">Todos os produtos</option>'+info.products.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
   region.value=info.regions.includes(r)?r:'';product.value=info.products.includes(p)?p:'';
   const view=buildRegionalFlowReport(getTrades(),getRoutes,{region:region.value,product:product.value});
   const fmt=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:1});
   result.innerHTML='<div><b>'+fmt(view.total)+'</b> negócios · <b>'+fmt(view.observed)+'</b> destinos contratuais identificados · <b>'+fmt(view.missing)+'</b> sem destino confirmado</div>'+
      (view.ports.length?'<table><thead><tr><th>Porto</th><th>Entrega contratual explícita</th><th>Volume explícito (t)</th><th>Negócios com rota possível</th></tr></thead><tbody>'+
      view.ports.map(x=>'<tr><td>'+esc(x.port)+'</td><td>'+fmt(x.observed)+'</td><td>'+fmt(x.observedVolume)+'</td><td>'+fmt(x.potentialDeals)+'</td></tr>').join('')+
      '</tbody></table>':'<p>Sem destinos portuários identificados nesta seleção.</p>')+
      '<small>Observado = porto explicitamente contratado como ponto de entrega, não necessariamente porto de exportação efetiva. Rota possível = corredor do motor, não comprova destino ou embarque. Volumes potenciais não são somados para evitar dupla contagem.</small>';
 }
 box.addEventListener('toggle',refresh);
 region.addEventListener('change',refresh);product.addEventListener('change',refresh);
 const api=Object.freeze({refresh,version:'F77-flow-verified-v1'});
 window.BRZRegionalFlows=api;
 return api;
}
