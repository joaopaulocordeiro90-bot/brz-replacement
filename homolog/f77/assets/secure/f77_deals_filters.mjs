/* F77 · Read-only advanced deal search. No changes to state.negocios,
 * historical quotes, replacement, trade rows or autosave records. */
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const UFS=new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const yyyy=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))?String(s):'';
export function tradePlace(d,extractCity){
 const origin=String(d?.origem||'');
 const manualUF=String(d?.ufOrigem||d?.uf||'').trim().toUpperCase();
 const matches=[...origin.matchAll(/(?:^|[\s(;,])([^;,\n/()]{1,90}?)\s*\/\s*([A-Za-z]{2})(?=$|[\s),.;])/g)];
 const qualified=matches.reverse().find(m=>UFS.has(m[2].toUpperCase()));
 const uf=UFS.has(manualUF)?manualUF:qualified?qualified[2].toUpperCase():'';
 let city=String(d?.cidadeOrigem||d?.municipioOrigem||'').trim();
 if(!city&&typeof extractCity==='function'){
  try{city=String(extractCity(origin)||'').trim()}catch{}
 }
 if(!city&&qualified)city=qualified[1].split(/\s+[-–]\s+/).at(-1).trim();
 city=city.replace(/\s*\/\s*[A-Za-z]{2}$/,'').replace(/^(?:FOB|CIF|FAS)\s*[-–]?\s*/i,'').trim();
 // An unresolved free-text address must not be promoted to an identified municipality.
 if(city===origin&&!qualified&&!d?.cidadeOrigem&&!d?.municipioOrigem)city='';
 return {city,uf};
}
export function filterDeals(trades,filters={},extractCity){
 if(!Array.isArray(trades))throw Error('F77: inventário de negócios inválido');
 const day=yyyy(filters.day),from=yyyy(filters.from),to=yyyy(filters.to);
 const uf=String(filters.uf||'').toUpperCase().trim(),city=norm(filters.city);
 if(from&&to&&from>to)return [];
 return trades.filter(d=>{
  if(!d||typeof d!=='object')return false;
  const date=String(d.data||'');
  if(day&&date!==day)return false;
  if(from&&date<from)return false;
  if(to&&date>to)return false;
  if(uf||city){
   const place=tradePlace(d,extractCity);
   if(uf&&place.uf!==uf)return false;
   if(city&&!norm(place.city).includes(city))return false;
  }
  return true;
 });
}
export function pageDeals(deals,page=0,size=50){
 const limit=Math.max(1,Math.min(100,Math.floor(Number(size)||50)));
 const pages=Math.max(1,Math.ceil(deals.length/limit));
 const index=Math.max(0,Math.min(pages-1,Math.floor(Number(page)||0)));
 return {page:index,pages,total:deals.length,rows:deals.slice(index*limit,(index+1)*limit)};
}
const csvCell=x=>{
 let t=String(x??'');
 if(/^[\s]*[=+@-]/.test(t))t="'"+t;
 return '"'+t.replaceAll('"','""')+'"';
};
export function installDealsFilters({getTrades,extractCity}={}){
 if(typeof document==='undefined'||typeof getTrades!=='function')return null;
 const bar=document.getElementById('negociosToolbar');
 if(!bar)return null;
 if(document.getElementById('brz-f77-deals-filters'))return window.BRZF77DealsFilters||null;
 const host=document.createElement('section');
 host.id='brz-f77-deals-filters';
 host.innerHTML='<div class="brz-f77-title"><b>F77 · Consulta avançada de negócios</b><span>Filtro independente, somente leitura · preserva os negócios e a tabela original</span></div>'+
 '<div class="brz-f77-fields"><label>Dia<input id="brz-f77-deal-day" type="date"></label>'+
 '<label>De<input id="brz-f77-deal-from" type="date"></label>'+
 '<label>Até<input id="brz-f77-deal-to" type="date"></label>'+
 '<label>UF<select id="brz-f77-deal-uf"><option value="">Todas as UFs</option>'+
 [...UFS].map(uf=>'<option value="'+uf+'">'+uf+'</option>').join('')+'</select></label>'+
 '<label>Cidade<input id="brz-f77-deal-city" type="search" placeholder="Município de origem"></label>'+
 '<button type="button" id="brz-f77-deal-clear">Limpar</button>'+
 '<button type="button" id="brz-f77-deal-csv">Exportar filtro CSV</button></div>'+
 '<div id="brz-f77-deal-status" aria-live="polite"></div>'+
 '<div id="brz-f77-deal-results"></div>'+
 '<div class="brz-f77-pagination"><button type="button" id="brz-f77-deal-prev">Anterior</button>'+
 '<span id="brz-f77-deal-page"></span><button type="button" id="brz-f77-deal-next">Próxima</button></div>';
 bar.insertAdjacentElement('afterend',host);
 const style=document.createElement('style');style.id='brz-f77-deals-css';
 style.textContent='#brz-f77-deals-filters{margin:12px 0 16px;padding:12px 14px;border:1px solid var(--g200,#d1dce4);border-radius:5px;background:var(--card,#fff);color:var(--g900,#173249);font:12px/1.5 Inter,Arial,sans-serif}'+
 '#brz-f77-deals-filters .brz-f77-title{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-bottom:10px}'+
 '#brz-f77-deals-filters .brz-f77-title span{color:var(--g500,#62768a);font-size:11px}'+
 '#brz-f77-deals-filters .brz-f77-fields{display:flex;gap:9px;align-items:end;flex-wrap:wrap}'+
 '#brz-f77-deals-filters label{display:flex;flex-direction:column;gap:3px;font-size:11px;font-weight:650}'+
 '#brz-f77-deals-filters input,#brz-f77-deals-filters select{font:12px Arial;min-height:31px;min-width:105px;max-width:160px;padding:5px 7px;color:var(--g900,#173249);background:var(--card,#fff);border:1px solid var(--g200,#ccd8e0)}'+
 '#brz-f77-deals-filters button{font:700 11px Arial;min-height:31px;padding:5px 10px;border:1px solid #177c79;background:var(--card,#fff);color:#177c79;cursor:pointer;border-radius:3px}'+
 '#brz-f77-deals-filters button:disabled{opacity:.4;cursor:default}'+
 '#brz-f77-deal-status{margin:10px 0;color:var(--g600,#536c80)}'+
 '#brz-f77-deal-results{overflow:auto;max-height:540px}'+
 '#brz-f77-deal-results table{border-collapse:collapse;min-width:900px;width:100%}'+
 '#brz-f77-deal-results th,#brz-f77-deal-results td{border-bottom:1px solid var(--g200,#d9e1e6);text-align:left;padding:6px 8px;white-space:nowrap}'+
 '#brz-f77-deal-results th{position:sticky;top:0;background:var(--card,#fff)}'+
 '#brz-f77-deals-filters .brz-f77-pagination{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:10px}';
 document.head.appendChild(style);
 const $=id=>host.querySelector('#'+id);
 const fields={day:$('brz-f77-deal-day'),from:$('brz-f77-deal-from'),to:$('brz-f77-deal-to'),
   uf:$('brz-f77-deal-uf'),city:$('brz-f77-deal-city')};
 let page=0,matches=[];
 const active=()=>Object.values(fields).some(el=>String(el.value||'').trim());
 const values=()=>Object.fromEntries(Object.entries(fields).map(([k,el])=>[k,el.value]));
 const fmt=x=>Number(x||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
 function render(reset=false){
  if(reset)page=0;
  const records=getTrades();
  matches=active()?filterDeals(records,values(),extractCity):[];
  const p=pageDeals(matches,page,50);page=p.page;
  $('brz-f77-deal-status').textContent=active()
   ?fmt(matches.length)+' negócios encontrados em '+fmt(records.length)+' registros · apenas consulta, sem modificar a tabela principal.'
   :'Informe dia, intervalo, UF ou cidade para consultar o inventário completo.';
  $('brz-f77-deal-results').innerHTML=matches.length?
   '<table><thead><tr><th>Data</th><th>Produto</th><th>Cidade/UF</th><th>Corredor</th><th>Volume (t)</th><th>Preço original</th><th>Retirada</th><th>ID</th></tr></thead><tbody>'+
   p.rows.map(d=>{const loc=tradePlace(d,extractCity);return '<tr>'+
    [d.data,d.produto,(loc.city||'N/D')+(loc.uf?' / '+loc.uf:''),d.corredor,
     fmt(d.volume),d.preco??'N/D',d.retirada||d.janelaFisica||'N/D',d.id]
      .map(x=>'<td>'+esc(x??'')+'</td>').join('')+'</tr>';}).join('')+
   '</tbody></table>':(!active()?'':'<p>Sem negócios para os critérios informados. Cidade sem referência explícita não é presumida.</p>');
  $('brz-f77-deal-page').textContent=matches.length?'Página '+(p.page+1)+' / '+p.pages:'';
  $('brz-f77-deal-prev').disabled=p.page<=0;
  $('brz-f77-deal-next').disabled=p.page>=p.pages-1;
  $('brz-f77-deal-csv').disabled=!matches.length;
 }
 Object.values(fields).forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>render(true)));
 $('brz-f77-deal-clear').onclick=()=>{Object.values(fields).forEach(el=>el.value='');render(true);};
 $('brz-f77-deal-prev').onclick=()=>{page--;render();};
 $('brz-f77-deal-next').onclick=()=>{page++;render();};
 $('brz-f77-deal-csv').onclick=()=>{
  if(!matches.length)return;
  const rows=[['Data','Produto','Cidade','UF','Corredor','Volume_t','Preco_original','Retirada','ID']];
  for(const d of matches){const x=tradePlace(d,extractCity);
   rows.push([d.data,d.produto,x.city,x.uf,d.corredor,d.volume,d.preco,d.retirada||d.janelaFisica,d.id]);}
  const blob=new Blob(['\uFEFFsep=;\r\n'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')],
    {type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;
  a.download='BRZ_F77_Negocios_Filtrados.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
 };
 render();
 const api=Object.freeze({refresh:()=>render(false),version:'F77-deals-filters-v1',readOnly:true});
 window.BRZF77DealsFilters=api;return api;
}