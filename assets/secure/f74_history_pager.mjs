/* BRZ F74 — secured, demand-driven PostgreSQL historical pages.
 * No prefetch, no persistent client cache, no replacement estimation.
 * Values remain private behind Supabase JWT and mesa/admin authorization.
 */
export const DOMAINS=Object.freeze({
 physical:'Físico · soja, milho e sorgo',
 curves:'Curvas · CBOT e câmbio',
 basis_points:'Basis FOB histórico',
 derivatives:'Farelo e óleo · CMA',
 ocean:'Frete marítimo'
});
export const PAGE_SIZES=Object.freeze([10,25,50]);
const DATE=/^20\d\d-\d\d-\d\d$/;
const make=(doc,tag,value)=>{
 const el=doc.createElement(tag);
 if(value!==undefined)el.textContent=String(value);
 return el;
};
export function checkHistoryRequest(args){
 const {domain,from,to,after,limit}=args||{};
 if(!Object.hasOwn(DOMAINS,domain)||!DATE.test(from)||!DATE.test(to)||
    from>to || !Number.isInteger(after)||after<0 || !PAGE_SIZES.includes(limit))
   throw Error('F74: domínio, período ou página inválidos');
 const start=new Date(from+'T12:00:00Z').getTime(),end=new Date(to+'T12:00:00Z').getTime();
 if(!Number.isFinite(start)||!Number.isFinite(end)||end-start>366*86400000)
   throw Error('F74: período máximo de 366 dias');
 return {p_domain:domain,p_from_date:from,p_to_date:to,p_after_row_no:after,p_limit:limit};
}
export function checkHistoryRows(reply,after,domain,limit){
 if(!Array.isArray(reply)||reply.length>limit)
   throw Error('F74: resposta paginada inválida');
 let last=after;
 for(const row of reply){
   if(!row||row.domain!==domain||!Number.isSafeInteger(Number(row.row_no))||
      Number(row.row_no)<=last || !row.record_json || typeof row.record_json!=='object')
     throw Error('F74: cursor ou integridade de linha inválidos');
   last=Number(row.row_no);
 }
 return {rows:reply,nextCursor:last,hasMore:reply.length===limit};
}
export function historyDisplay(row){
 const r=row.record_json||{},domain=row.domain;
 let entry=r;
 if(domain==='physical'){
   try{entry=typeof r.record_text==='string'?JSON.parse(r.record_text):r;}catch{entry=r;}
 }
 const date=String(row.market_date||entry.data||r.day||entry.quote_date||'');
 let place='',product='',window='',price='',unit='';
 if(domain==='physical'){
   place=entry.origem||entry.local||entry.praca||'N/D';
   product=entry.produto||'N/D';
   window=entry.embarque||entry.janelaFisica||'N/D';
   price=entry.preco;
   unit='R$/sc';
 }else if(domain==='curves'){
   place=r.contract||r.contrato||'';
   product=r.domain||r.product||'CBOT/DOL';
   window='';price=r.value;unit='Referência da curva';
 }else if(domain==='basis_points'){
   place=r.legacy_key||'';
   product='Basis FOB';window='';price=r.value;unit='¢/bu';
 }else if(domain==='derivatives'){
   place=r.location_text||'';
   product=r.product==='Soymeal'?'Farelo':r.product==='Soyoil'?'Óleo':r.product||'Derivados';
   window='';price=Array.isArray(r.values_json)?r.values_json[0]:null;unit='R$/t';
 }else{
   place=[r.port||'',r.destination||'',r.key_value||''].filter(Boolean).join(' · ');
   product=r.structure||'Marítimo';window='';price=r.value;unit='US$/t (referência)';
 }
 const n=Number(price);
 return {date,place:String(place),product:String(product),window:String(window),
   price:price==null||!Number.isFinite(n)?'N/D':n.toLocaleString('pt-BR',{maximumFractionDigits:4}),
   unit};
}
export async function fetchHistoryPage({request,token,domain,from,to,after=0,limit=25}){
 if(typeof request!=='function'||typeof token!=='string'||token.length<40)
   throw Error('F74: sessão autenticada exigida');
 const body=checkHistoryRequest({domain,from,to,after,limit});
 const reply=await request('/rest/v1/rpc/brz_api_f74_history_page',{
   method:'POST',token,body});
 return checkHistoryRows(reply,after,domain,limit);
}
export function installHistoryPanel({root,request,token,asOf}){
 if(!root?.ownerDocument||!DATE.test(asOf))
   throw Error('F74: painel histórico sem data válida');
 const doc=root.ownerDocument;
 const wrap=make(doc,'section');
 wrap.className='brz-f74-history';
 wrap.style.cssText='margin-top:18px;padding:16px;background:#f6f9fb;border:1px solid #d5e3eb;border-radius:6px';
 const title=make(doc,'strong','Histórico sob demanda · Supabase');
 const help=make(doc,'p','Somente os registros da data e da página solicitadas são enviados pelo banco. Para replacement, utilize o motor completo.');
 const form=make(doc,'div');form.style.cssText='display:flex;gap:8px;flex-wrap:wrap;align-items:center';
 const domain=make(doc,'select');
 for(const [value,label] of Object.entries(DOMAINS)){const opt=make(doc,'option',label);opt.value=value;domain.appendChild(opt)}
 const begin=make(doc,'input');begin.type='date';begin.setAttribute('aria-label','Data inicial');
 const finish=make(doc,'input');finish.type='date';finish.setAttribute('aria-label','Data final');
 finish.value=asOf;
 const dt=new Date(asOf+'T12:00:00Z');
 dt.setUTCDate(dt.getUTCDate()-30);
 begin.value=dt.toISOString().slice(0,10);
 const size=make(doc,'select');size.setAttribute('aria-label','Linhas por página');
 for(const n of PAGE_SIZES){const opt=make(doc,'option',String(n)+' linhas');opt.value=String(n);if(n===25)opt.selected=true;size.appendChild(opt)}
 const search=make(doc,'button','Consultar período');search.type='button';
 search.style.cssText='width:auto;margin:0;padding:9px 12px';
 form.append(domain,begin,finish,size,search);
 const status=make(doc,'p','Escolha a base e consulte o período desejado.');
 status.setAttribute('role','status');
 const table=make(doc,'table');table.className='brz-fast-table';
 const thead=make(doc,'thead'),theadRow=make(doc,'tr');
 for(const label of ['Data','Produto','Praça / referência','Janela','Valor','Unidade'])
   theadRow.appendChild(make(doc,'th',label));
 thead.appendChild(theadRow);
 const body=make(doc,'tbody');table.append(thead,body);
 const pager=make(doc,'div');pager.className='brz-fast-pager';
 const previous=make(doc,'button','‹ Anterior'),next=make(doc,'button','Próxima ›');
 previous.type=next.type='button';previous.disabled=next.disabled=true;
 previous.style.width=next.style.width='auto';
 const indicator=make(doc,'span','Página 1');
 pager.append(previous,indicator,next);
 wrap.append(title,help,form,status,table,pager);
 root.replaceChildren(wrap);
 let tokenCycle=0,history=[0],pageIndex=0,rows=[],hasMore=false;
 function reset(){history=[0];pageIndex=0;rows=[];hasMore=false;previous.disabled=next.disabled=true;body.replaceChildren()}
 async function load(){
   const cycle=++tokenCycle;
   const from=begin.value,to=finish.value,category=domain.value,
         after=history[pageIndex]||0,limit=Number(size.value);
   let args;
   try{args=checkHistoryRequest({domain:category,from,to,after,limit})}
   catch(e){status.textContent=e.message;return}
   search.disabled=previous.disabled=next.disabled=true;
   status.textContent='Consultando registros autenticados…';
   try{
     const reply=await fetchHistoryPage({request,token,domain:category,from,to,after,limit});
     if(cycle!==tokenCycle)return;
     rows=reply.rows;hasMore=reply.hasMore;
     body.replaceChildren();
     for(const r of rows){
       const line=make(doc,'tr'),data=historyDisplay(r);
       for(const cell of [data.date,data.product,data.place,data.window,data.price,data.unit])
         line.appendChild(make(doc,'td',cell));
       body.appendChild(line);
     }
     if(!rows.length){const line=make(doc,'tr'),cell=make(doc,'td','Sem observações nesta página.');
       cell.colSpan=6;line.appendChild(cell);body.appendChild(line)}
     if(rows.length===limit && history[pageIndex+1]===undefined)history[pageIndex+1]=reply.nextCursor;
     previous.disabled=pageIndex===0;next.disabled=!hasMore;
     indicator.textContent='Página '+(pageIndex+1)+' · '+rows.length+' registros';
     status.textContent='Consulta concluída · somente '+rows.length+' registros transferidos nesta página. Nenhum cálculo ou gravação.';
   }catch(e){
     if(cycle!==tokenCycle)return;
     status.textContent='Falha na consulta histórica: '+String(e?.message||e).slice(0,200);
   }finally{if(cycle===tokenCycle)search.disabled=false}
 }
 search.addEventListener('click',()=>{reset();void load()});
 previous.addEventListener('click',()=>{if(pageIndex>0){pageIndex--;void load()}});
 next.addEventListener('click',()=>{if(!hasMore)return;pageIndex++;void load()});
 for(const x of [domain,begin,finish,size])
   x.addEventListener('change',()=>{tokenCycle++;reset();status.textContent='Seleção alterada. Clique em Consultar período.'});
 return Object.freeze({getStatus:()=>({page:pageIndex+1,transferred:rows.length,hasMore})});
}
