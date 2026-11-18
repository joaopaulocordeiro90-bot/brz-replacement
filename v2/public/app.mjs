import {cbToCanonical} from "./cbot-units.mjs";
import {routeIssues,marketIssues} from "./matching.mjs";
import {calculate} from "./engine.mjs";
const $=id=>document.getElementById(id);
const qs=(selector)=>[...document.querySelectorAll(selector)];
const state={page:"dashboard",tradeOffset:0,tradeTotal:0,tradeSearch:"",trades:[],routes:[],market:[],editing:null,editingType:null,map:null,pinMap:null,pin:null,pinMarker:null};
const spec={
 trades:[
 ["trade_date","Data do negócio","date",true],["product","Produto","select",true,["Soja","Milho","Sorgo","Farelo","Óleo"]],["crop_year","Safra","text"],["status","Status","select",false,["FECHADO","PENDENTE","CANCELADO"]],
 ["seller","Vendedor","text"],["buyer","Comprador","text"],["volume_t","Volume (t)","number",true],["price_brl_sc","Preço físico (R$/sc)","number"],
 ["delivery_basis","Condição comercial","select",false,["FOB","CIF","FAS"]],["origin_name","Fazenda / Armazém / Local","text",true],["city","Município","text",true],["uf","UF","text",true],
 ["lat","Latitude","number"],["lng","Longitude","number"],["geo_precision","Precisão geográfica","select",false,["municipio_indicativo","ponto_confirmado"]],
 ["window_start","Início retirada","date"],["window_end","Fim retirada","date"],["payment_date","Pagamento","date"],["due","DUE","text"],["fethab","FETHAB","text"],["notes","Observações","textarea"]],
 routes:[
 ["origin_city","Município origem","text",true],["origin_uf","UF origem","text",true],["destination_port","Porto destino","text",true],["terminal","Terminal / transbordo","text"],
 ["modal","Modal","select",true,["Rodoviário","Ferroviário","Rodo + Ferro","Rodo + Barcaça"]],["freight_brl_t","Frete total (R$/t)","number",true],
 ["distance_km","Distância (km)","number"],["freight_status","Tipo de referência","select",false,["COTADO","CONTRATADO","INDICATIVO"]],
 ["valid_from","Vigente desde","date"],["valid_to","Vigente até","date"],["source","Fonte da tarifa","text",true]
 ],
 market:[
 ["product","Produto","select",true,["Soja","Milho","Sorgo"]],["port","Porto","text",true],["ship_month","Embarque (AAAA-MM)","month",true],
 ["reference_date","Data de mercado","date",true],["cbot_contract","Vencimento CBOT","text",true],["cbot_cbu","Cotação CBOT — confira a unidade abaixo","number"],
 ["fx_brl_usd","Dólar (R$/US$)","number"],["fob_basis_cbu","Basis FOB (c/bu)","number"],["fobbins_usd_t","FOBBINS (US$/t)","number"],
 ["ocean_usd_t","Frete marítimo (US$/t)","number"],["side","Lado","select",false,["Bid","Offer"]],["source","Fonte","text",true]
 ]};
const entityText={trades:"negócio",routes:"rota",market:"referência de mercado"};
const fmt=(x,d=2)=>x==null?"N/D":Number(x).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
function notify(message,error=false){const el=$("notice");el.textContent=message;el.className="notice show"+(error?" error":"");}
function elem(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
async function api(resource,options={}){
 const res=await fetch("/api/"+resource,{...options,headers:{"content-type":"application/json",...(options.headers||{})}});
 let data;try{data=await res.json()}catch{throw Error("Resposta inválida do servidor");}
 if(!res.ok||!data.ok)throw Error(data.error||"Erro HTTP "+res.status);
 return data;
}
async function checkHealth(){
 try{const data=await api("health");$("connection").textContent="Banco D1 conectado";$("kpi-state").textContent="Online";return data;}
 catch(e){$("connection").textContent="Banco pendente de ativação";$("kpi-state").textContent="Pendente";notify("Banco ainda indisponível ou sem tabelas. Se o D1 já está associado, clique em ‘Inicializar o D1 do piloto’ nesta tela. Detalhe: "+e.message,true);return null;}
}
function tableAt(target,headers,records,actions){
 const el=$(target);el.replaceChildren();
 if(!records.length){el.append(elem("p","Nenhum registro cadastrado.","muted"));return;}
 const box=elem("div",null,"tablewrap"),table=elem("table"),head=elem("thead"),hr=elem("tr");
 for(const h of headers)hr.append(elem("th",h[0]));
 if(actions)hr.append(elem("th","Ações"));
 head.append(hr);table.append(head);const tbody=elem("tbody");
 for(const record of records){
  const tr=elem("tr");
  for(const h of headers){let v=h[1](record);tr.append(elem("td",v==null?"N/D":String(v)));}
  if(actions){
   const cell=elem("td"),edit=elem("button","Editar");edit.onclick=()=>openEditor(actions,record);
   const del=elem("button","Excluir","danger");del.onclick=()=>removeRecord(actions,record);
   cell.append(edit,del);tr.append(cell);
  }
  tbody.append(tr);
 }
 table.append(tbody);box.append(table);el.append(box);
}
async function refreshTrades(){
 const q=new URLSearchParams({limit:"30",offset:String(state.tradeOffset)});
 if(state.tradeSearch)q.set("search",state.tradeSearch);
 const data=await api("trades?"+q.toString());state.trades=data.rows;state.tradeTotal=data.total;
 const h=[["Data",r=>r.trade_date],["Produto",r=>r.product],["Origem",r=>r.origin_name],["Praça",r=>r.city+"/"+r.uf],["Volume (t)",r=>fmt(r.volume_t,1)],["Preço (R$/sc)",r=>fmt(r.price_brl_sc)],["Status",r=>r.status]];
 tableAt("trades-table",h,data.rows,null);
 tableAt("admin-trades-list",h,data.rows,"trades");
 $("trades-range").textContent=data.total?String(state.tradeOffset+1)+"–"+String(Math.min(state.tradeOffset+data.rows.length,data.total))+" de "+data.total:"0 negócios";
 $("prev-trades").disabled=state.tradeOffset===0;$("next-trades").disabled=state.tradeOffset+30>=data.total;
 $("kpi-trades").textContent=String(data.total);
}
async function refreshLists(){
 const [routes,market]=await Promise.all([api("routes?limit=100"),api("market?limit=100")]);
 state.routes=routes.rows;state.market=market.rows;
 $("kpi-routes").textContent=String(routes.total);$("kpi-market").textContent=String(market.total);
 tableAt("routes-table",[["Origem",r=>r.origin_city+"/"+r.origin_uf],["Porto",r=>r.destination_port],["Modal",r=>r.modal],["Frete R$/t",r=>fmt(r.freight_brl_t)],["Referência",r=>r.freight_status]],state.routes,"routes");
 tableAt("market-table",[["Produto",r=>r.product],["Porto",r=>r.port],["Embarque",r=>r.ship_month],["CBOT",r=>r.cbot_contract],["Dólar",r=>fmt(r.fx_brl_usd,3)],["Basis FOB",r=>fmt(r.fob_basis_cbu)]],state.market,"market");
}
async function refreshAudit(){
 const data=await api("audit");tableAt("audit-table",[["Data UTC",r=>r.created_at],["Entidade",r=>r.entity],["Ação",r=>r.operation],["ID",r=>r.entity_id]],data.rows,null);
}
async function refresh(){
 try{await Promise.all([refreshTrades(),refreshLists()]);fillSimulation();if(state.page==="admin-audit")await refreshAudit();if(state.page==="map")renderMap();}
 catch(e){notify(e.message,true);}
}
function nav(name){
 state.page=name;
 qs(".page").forEach(x=>x.classList.toggle("hidden",x.id!=="page-"+name));
 qs(".sidebar button").forEach(x=>x.classList.toggle("selected",x.dataset.page===name));
 if(name==="map")setTimeout(renderMap,30);
 if(name==="admin-audit")refreshAudit().catch(e=>notify(e.message,true));
 if(name==="simulation")fillSimulation();
}
function openEditor(type,record=null){
 state.editingType=type;state.editing=record;
 $("editor-title").textContent=(record?"Editar ":"Novo ")+entityText[type];
 $("editor-fields").replaceChildren();
 for(const [key,label,typeInput,required,choices] of spec[type]){
  const wrapper=elem("label",label,key==="notes"?"full":"");
  let input;
  if(typeInput==="select"){input=elem("select");input.append(new Option("Selecione…",""));for(const c of choices)input.append(new Option(c,c));}
  else if(typeInput==="textarea")input=elem("textarea");
  else{input=elem("input");input.type=typeInput;if(typeInput==="number"){input.step="any";}}
  input.name=key;input.required=!!required;
  let value=record?.[key];
  if(value==null&&type==="trades"&&key==="trade_date")value=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
  if(value==null&&key==="geo_precision")value="municipio_indicativo";
  if(value==null&&key==="delivery_basis")value="FOB";
  if(value==null&&key==="status")value="PENDENTE";
  if(value==null&&key==="freight_status")value="INDICATIVO";
  input.value=value==null?"":String(value);
  wrapper.append(input);$("editor-fields").append(wrapper);
 }
 if(type==="market"){
  const wrapper=elem("label","Unidade informada da CBOT");
  const unit=elem("select");unit.name="cbot_entry_unit";
  unit.append(new Option("c/bu (centavos/bushel) — digite 1100","cbu"),new Option("US$/bu (dólares/bushel) — digite 11","usd_bu"));
  wrapper.append(unit);$("editor-fields").append(wrapper);
  const help=elem("p","Exemplo: 1.100 c/bu = US$ 11/bu. No campo numérico, NÃO digite 1.100 para representar mil e cem; escolha a unidade e informe 1100 ou 11.","muted");
  help.style.gridColumn="1 / -1";$("editor-fields").append(help);
  if(record?.cbot_cbu!=null&&record.cbot_cbu<100){
   const warning=elem("p","Atenção: esta referência contém CBOT "+fmt(record.cbot_cbu)+" c/bu, incompatível com o exemplo. Corrija a cotação antes de calcular.","muted");
   warning.style.gridColumn="1 / -1";warning.style.color="#b45309";$("editor-fields").append(warning);
  }
 }
 $("geo-controls").classList.toggle("hidden",type!=="trades");
 const lat=$("editor-form").elements.namedItem("lat")?.value,lng=$("editor-form").elements.namedItem("lng")?.value;
 $("geo-note").textContent=lat&&lng?"Coordenadas: "+lat+", "+lng:"Nenhuma coordenada confirmada";
 $("editor").showModal();
}
async function saveEditor(event){
 event.preventDefault();
 const type=state.editingType,fields=spec[type],body={};
 for(const [key,,kind] of fields){
  const inp=$("editor-form").elements.namedItem(key);let v=inp?.value??"";
  if(kind==="number")v=v===""?null:Number(v);
  else if(!v)v=null;
  body[key]=v;
 }
 if(type==="trades"&&body.uf)body.uf=String(body.uf).trim().toUpperCase();
 if(type==="routes"&&body.origin_uf)body.origin_uf=String(body.origin_uf).trim().toUpperCase();
 if(type==="market"){
  try{body.cbot_cbu=cbToCanonical(body.cbot_cbu,$("editor-form").elements.namedItem("cbot_entry_unit").value,body.product);}
  catch(err){notify(err.message,true);return;}
 }
 if(state.editing)body.version=state.editing.version;
 try{
  await api(type+(state.editing?"/"+state.editing.id:""),{method:state.editing?"PUT":"POST",body:JSON.stringify(body)});
  $("editor").close();notify("Registro gravado no D1. Verifique após recarregar.");
  await refresh();
 }catch(e){notify("Não gravou: "+e.message,true);}
}
async function removeRecord(type,record){
 if(!confirm("Excluir logicamente "+entityText[type]+"? O histórico de auditoria será preservado."))return;
 try{await api(type+"/"+record.id,{method:"DELETE",body:JSON.stringify({version:record.version})});notify("Registro excluído logicamente.");await refresh();}
 catch(e){notify(e.message,true);}
}
function fillSelect(target,rows,display,{preferredId=null}={}){
 const el=$(target),before=el.value;
 el.replaceChildren(new Option("Selecione…",""));
 for(const item of rows)el.append(new Option(display(item),item.id));
 if(rows.some(r=>r.id===before))el.value=before;
 else if(preferredId&&rows.some(r=>r.id===preferredId))el.value=preferredId;
}
function selectedFrom(id,rows){return rows.find(x=>x.id===$(id).value);}
function hint(id,text,warn=false){
 const el=$(id);el.textContent=text;el.className="sim-hint"+(warn?" warn":"");
}
function updateSummary(){
 const t=selectedFrom("sim-trade",state.trades),r=selectedFrom("sim-route",state.routes),m=selectedFrom("sim-market",state.market);
 const routes=state.routes.filter(x=>!routeIssues(t,x).length);
 const markets=state.market.filter(x=>!marketIssues(t,r,x).length);
 $("sim-summary").textContent=state.tradeTotal+" negócio(s) · "+state.routes.length+" rota(s) · "+state.market.length+" referência(s) carregadas. "+(t?routes.length+" rota(s) compatível(is) com "+t.city+"/"+t.uf+". ":"Selecione o negócio para conferir as rotas. ")+(r?markets.length+" referência(s) compatível(is) com "+r.destination_port+".":"Selecione a rota para conferir as referências.");
 const extra=state.tradeTotal>state.trades.length?" Mostrando apenas "+state.trades.length+" negócio(s) da página atual; use a busca em Negócios para mudar a página.":"";
 hint("sim-trade-info",state.trades.length+" negócio(s) disponível(is)."+extra);
 if(!t){
  hint("sim-route-info","Escolha o negócio. Todas as rotas cadastradas estão visíveis.",true);
  hint("sim-market-info","Escolha a rota. Todas as referências cadastradas estão visíveis.",true);
  return;
 }
 if(!r){
  hint("sim-route-info",state.routes.length===0?"Nenhuma rota cadastrada. Cadastre em Administrador → Rotas e fretes.":routes.length===0?"Nenhuma rota compatível. Confira município e UF no Administrador.":routes.length+" rota(s) compatível(is). Selecione uma.",!routes.length);
  hint("sim-market-info","Escolha uma rota para validar o porto.");
  return;
 }
 const issueR=routeIssues(t,r),issueM=marketIssues(t,r,m);
 hint("sim-route-info",issueR.length?issueR.join("; "):"Origem da rota compatível com o negócio.",!!issueR.length);
 hint("sim-market-info",!m?(markets.length?markets.length+" referência(s) compatível(is). Selecione uma.":"Nenhuma referência compatível. Confira produto e porto no Administrador."):(issueM.length?issueM.join("; "):"Produto e porto da referência compatíveis."),!m?!markets.length:!!issueM.length);
}
function fillSimulation(){
 const tBefore=$("sim-trade").value;
 fillSelect("sim-trade",state.trades,r=>r.product+" | "+r.origin_name+" | "+r.city+"/"+r.uf+" | "+r.trade_date,{
  preferredId:state.trades.length===1?state.trades[0].id:null
 });
 syncSimulationRoutes();
}
function syncSimulationRoutes(){
 const t=selectedFrom("sim-trade",state.trades);
 const compatible=state.routes.filter(r=>!routeIssues(t,r).length);
 const preferred=compatible.length===1?compatible[0].id:null;
 fillSelect("sim-route",state.routes,r=>{
  const issues=routeIssues(t,r);
  return (issues.length?"⚠ ":"✓ ")+r.modal+" | "+r.origin_city+"/"+r.origin_uf+" → "+r.destination_port+" | R$ "+fmt(r.freight_brl_t)+"/t"+(issues.length?" · origem diferente":"");
 },{preferredId:preferred});
 syncSimulationMarket();
}
function syncSimulationMarket(){
 const t=selectedFrom("sim-trade",state.trades),r=selectedFrom("sim-route",state.routes);
 const compatible=state.market.filter(m=>!marketIssues(t,r,m).length);
 const preferred=compatible.length===1?compatible[0].id:null;
 fillSelect("sim-market",state.market,m=>{
  const issues=marketIssues(t,r,m);
  return (issues.length?"⚠ ":"✓ ")+m.product+" | "+m.port+" | "+m.ship_month+" | "+m.cbot_contract+" | "+m.side+(issues.length?" · incompatível":"");
 },{preferredId:preferred});
 updateSummary();
}
function simulate(){
 const t=selectedFrom("sim-trade",state.trades),r=selectedFrom("sim-route",state.routes),m=selectedFrom("sim-market",state.market);
 const el=$("sim-result"),result=calculate({trade:t,route:r,market:m});
 el.replaceChildren();
 if(!result.ok){el.append(elem("strong","N/D — cálculo bloqueado para evitar replacement sem regra homologada"),elem("p",result.reasons.join("; ")));return;}
 for(const line of [["Replacement FOB · Flat",fmt(result.flatFOB)+" c/bu"],["Replacement Basis FOB",fmt(result.basisFOB)+" c/bu"],["Replacement CFR · Flat",result.flatCFR==null?"N/D":fmt(result.flatCFR)+" c/bu"],["Replacement Basis CFR",result.basisCFR==null?"N/D":fmt(result.basisCFR)+" c/bu"],["Gross Margin FOB",result.margemFOBCbu==null?"N/D":fmt(result.margemFOBCbu)+" c/bu"+(result.marginFOBUsdT==null?"":" · "+fmt(result.marginFOBUsdT)+" US$/t")]]){
  const p=elem("p");const strong=elem("strong",line[0]+": ");p.append(strong,document.createTextNode(line[1]));el.append(p);
 }
 if(result.inputs){
  const details=elem("details");details.append(elem("summary","Conferir memória de cálculo (c/bu)"));
  const i=result.inputs;
  const p=elem("p","Preço físico convertido: "+fmt(i.priceCbu)+" | Frete interno: "+fmt(i.freightCbu)+" | FOBBINS: "+fmt(i.fobbinsCbu)+" | CBOT subtraída: "+fmt(i.cbot)+" | Marítimo: "+fmt(i.oceanCbu),"muted");
  details.append(p);el.append(details);
 }
 if(result.warnings?.length)el.append(elem("p",result.warnings.join(" · "),"muted"));
 el.append(elem("p","Status: núcleo aritmético conferido contra C49/V4GE. Não substitui a homologação comercial V4GJ/C54 nem permite fechamento operacional.","muted"));
}
function renderMap(){
 if(typeof L==="undefined"){notify("Biblioteca Leaflet indisponível.",true);return;}
 if(!state.map){state.map=L.map("map").setView([-15.8,-51.7],4);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap"}).addTo(state.map);}
 state.map.eachLayer(layer=>{if(layer instanceof L.Marker)state.map.removeLayer(layer);});
 const points=state.trades.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng));
 for(const p of points){
  const marker=L.marker([p.lat,p.lng]).addTo(state.map);
  const line=elem("div",p.product+" · "+p.origin_name+" ("+p.geo_precision+")");
  marker.bindPopup(line);
 }
 setTimeout(()=>state.map.invalidateSize(),100);
}
function openPin(){
 if(typeof L==="undefined"){notify("Mapa indisponível",true);return;}
 $("pin-dialog").showModal();
 if(!state.pinMap){
  state.pinMap=L.map("pin-map").setView([-15.8,-51.7],4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap"}).addTo(state.pinMap);
  state.pinMap.on("click",event=>{
   state.pin=[event.latlng.lat,event.latlng.lng];
   if(state.pinMarker)state.pinMap.removeLayer(state.pinMarker);
   state.pinMarker=L.marker(state.pin).addTo(state.pinMap);
   $("pin-coordinates").textContent=state.pin.map(x=>x.toFixed(6)).join(", ");
   $("confirm-pin").disabled=false;
  });
 }
 const lat=Number($("editor-form").elements.namedItem("lat")?.value),lng=Number($("editor-form").elements.namedItem("lng")?.value);
 if(lat&&lng)state.pinMap.setView([lat,lng],12);
 setTimeout(()=>state.pinMap.invalidateSize(),120);
}
function confirmPin(){
 if(!state.pin)return;
 $("editor-form").elements.namedItem("lat").value=state.pin[0].toFixed(6);
 $("editor-form").elements.namedItem("lng").value=state.pin[1].toFixed(6);
 $("editor-form").elements.namedItem("geo_precision").value="ponto_confirmado";
 $("geo-note").textContent="Ponto confirmado: "+state.pin.map(x=>x.toFixed(6)).join(", ");
 $("pin-dialog").close();
}
function wire(){
 qs("[data-page]").forEach(b=>b.onclick=()=>nav(b.dataset.page));
 qs("[data-open]").forEach(b=>b.onclick=()=>nav(b.dataset.open));
 $("bootstrap-db").onclick=async()=>{
  if(!confirm("Inicializar as tabelas no D1 vinculado? Esta ação não importa negócios reais."))return;
  try{const result=await api("bootstrap",{method:"POST"});notify("D1 inicializado. "+result.trades+" negócios cadastrados.");await checkHealth();await refresh();}
  catch(e){notify("Inicialização não realizada: "+e.message,true);}
 };
 $("new-trade").onclick=()=>openEditor("trades");$("new-route").onclick=()=>openEditor("routes");$("new-market").onclick=()=>openEditor("market");
 $("refresh-trades").onclick=refresh;$("admin-refresh").onclick=refresh;
 $("trades-search").onchange=e=>{state.tradeSearch=e.target.value.trim();state.tradeOffset=0;refreshTrades().catch(e=>notify(e.message,true));};
 $("prev-trades").onclick=()=>{state.tradeOffset=Math.max(0,state.tradeOffset-30);refreshTrades().catch(e=>notify(e.message,true));};
 $("next-trades").onclick=()=>{state.tradeOffset+=30;refreshTrades().catch(e=>notify(e.message,true));};
 $("editor-form").onsubmit=saveEditor;
 $("close-dialog").onclick=()=> $("editor").close();$("cancel-dialog").onclick=()=> $("editor").close();
 $("open-pin").onclick=openPin;$("close-pin").onclick=()=> $("pin-dialog").close();$("confirm-pin").onclick=confirmPin;
 $("sim-trade").onchange=syncSimulationRoutes;$("sim-route").onchange=syncSimulationMarket;$("sim-market").onchange=updateSummary;$("sim-run").onclick=simulate;$("sim-refresh").onclick=refresh;
}
wire();await checkHealth();await refresh();
