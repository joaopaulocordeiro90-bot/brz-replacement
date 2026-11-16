/* BRZ F60 | Roteirização exclusiva do trecho rodoviário. Nenhuma tarifa ferroviária é alterada. */
export function installRoadGeo(api){
 if(window.BRZRoadGeo)return window.BRZRoadGeo;
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 let id='',result=null,pin=null,layer=null,requestId=0,activeCtrl=null,activePin=null;
 const approved=()=>{const p=api.getState()?.roadGeoRoutes;return p&&typeof p==='object'&&!Array.isArray(p)?p:{};};
 const key=(tid,origin,dest,date)=>JSON.stringify([String(tid||''),norm(origin),norm(dest),String(date||'').slice(0,10)]);
 const getApproved=(tid,origin,dest,date)=>{const entries=approved();const places=[dest];if(norm(dest)==='sao luis')places.push('Itaqui');if(norm(dest)==='itaqui')places.push('São Luís');for(const p of places){const r=entries[key(tid,origin,p,date)];if(r?.approved===true&&Number.isFinite(+r.km)&&r.km>0)return r;}return null;};
 const deal=()=>api.getTrades().find(d=>String(d.id)===id);
 const routes=d=>{try{return d&&typeof getRotasCorredor==='function'?getRotasCorredor(d).filter(r=>r&&['T','T+R','T+B'].includes(r.modal)&&!r.terminalEconomicoCIF&&!r.cifNaoSomarFreteAntesDaPraca):[];}catch{return[];}};
 const route=()=>routes(deal())[Number($('brzf60-route')?.value)]||null;
 const dest=r=>r?.modal==='T'?r.porto:r?.transbordo;
 const coords=(name,port=false)=>{let c=null;
  try{if(port&&typeof MAP_DATA!=='undefined')c=MAP_DATA.portos?.[name]||null;}catch{}
  if(!c)try{c=getCityCoord(name);}catch{}
  if(!c&&name==='Itaqui')try{c=MAP_DATA.portos.Itaqui;}catch{}
  if(!c&&name==='São Luís')try{c=MAP_DATA.portos.Itaqui;}catch{}
  if(!c)try{c=CITY_COORDS['_porto_'+name];}catch{}
  return Array.isArray(c)&&c.length===2&&c.every(v=>Number.isFinite(+v))?c.map(Number):null;
 };
 const origin=d=>{if(pin)return {pos:pin,source:'ponto marcado'};
  let name=d?.origem||'';try{name=extractCidadeBase(name)||name;}catch{}
  const c=coords(name);return c?{pos:c,source:'sede municipal (indicativo)'}:null;};
 const extra=s=>{const m=String(s||'').match(/\+\s*(\d+(?:[.,]\d+)?)\s*km/i);return m?Number(m[1].replace(',','.')):0;};
 const status=(v,error=false)=>{const n=$('brzf60-status');if(n){n.innerHTML=v;n.dataset.error=error?'1':'0';}};
 const map=()=>{try{return typeof _leafletMap!=='undefined'?_leafletMap:null;}catch{return null;}};
 function clear(){requestId++;if(activeCtrl){activeCtrl.abort();activeCtrl=null;}if(layer&&map())try{map().removeLayer(layer);}catch{}layer=null;result=null;if($('brzf60-apply'))$('brzf60-apply').disabled=true;}
 function show(){
  const all=api.getTrades().filter(d=>d?.id&&d?.origem).slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
  const q=norm($('brzf60-search')?.value);
  const rows=all.filter(d=>!q||norm([d.id,d.origem,d.vendedor,d.comprador,d.produto].join(' ')).includes(q)).slice(0,175);
  const x=$('brzf60-deal');if(!x)return;
  x.innerHTML='<option value="">Selecionar negócio ('+all.length+')</option>'+rows.map(d=>'<option value="'+esc(d.id)+'">'+esc([d.id,d.produto,d.origem].join(' · ').slice(0,130))+'</option>').join('');
  if(rows.some(d=>String(d.id)===id))x.value=id;
 }
 function choose(tid){
  clear();pin=null;if(activePin&&map())try{map().removeLayer(activePin);}catch{}activePin=null;
  id=tid||'';if($('brzf60-deal'))$('brzf60-deal').value=id;
  const d=deal(),r=d?routes(d):[];const x=$('brzf60-route');if(!x)return;
  x.innerHTML=r.map((o,i)=>'<option value="'+i+'">'+esc(o.porto+' · '+(o.modal==='T'?'caminhão até porto':'caminhão até '+o.transbordo+' + '+(o.modal==='T+R'?'ferrovia':'barcaça')))+'</option>').join('');
  status(!d?'Selecione um negócio.':!r.length?'Negócio sem trecho rodoviário elegível. A ferrovia e o CIF não serão alterados.':esc('Origem: '+d.origem+' · Destino rodoviário: '+dest(r[0])));
 }
 async function calculate(){
  const d=deal(),r=route();if(!d||!r){status('Selecione um negócio com trecho rodoviário.',true);return;}
  const a=origin(d),b=coords(dest(r),r.modal==='T');if(!a||!b){status('Coordenada ausente: marque a origem ou regularize a praça. Não foi aplicada distância fictícia.',true);return;}
  if(Math.abs(a.pos[0]-b[0])+Math.abs(a.pos[1]-b[1])<.0008){status('Origem e destino coincidentes: não estimar acesso rural sem ponto definido.',true);return;}
  clear();const seq=requestId;activeCtrl=new AbortController();const controller=activeCtrl;
  status('Consultando a malha rodoviária real via OSRM/OpenStreetMap…');$('brzf60-calc').disabled=true;
  const timeout=setTimeout(()=>controller.abort(),22000);
  try{
   const u='https://router.project-osrm.org/route/v1/driving/'+a.pos[1]+','+a.pos[0]+';'+b[1]+','+b[0]+'?overview=full&geometries=geojson&steps=false&alternatives=false';
   const resp=await fetch(u,{signal:controller.signal,mode:'cors',cache:'no-store'});
   if(!resp.ok)throw Error('Serviço HTTP '+resp.status);
   const data=await resp.json();const road=data?.routes?.[0];
   if(data?.code!=='Ok'||!road?.geometry||!Number.isFinite(road.distance)||road.distance<=0)throw Error('Rota não encontrada');
   if(seq!==requestId)return;
   const kmRoad=road.distance/1000,kmAccess=pin?0:extra(d.origem),km=+(kmRoad+kmAccess).toFixed(2);
   if(km>6500||km<1)throw Error('Distância incompatível');
   let estimate=null;try{if(typeof estimateFreightRodo==='function')estimate=estimateFreightRodo(d.origem,dest(r),d.corredor,typeof dateToWeek==='function'?dateToWeek(d.data):null);}catch{}
   let tk=Number(estimate?.tku)||0;if(!tk)try{tk=Number(getTkuMedioPorPorto()?.[dest(r)])||0;}catch{}
   if(!tk)tk=.30;
   result={id:String(d.id),routeKey:key(d.id,d.origem,dest(r),d.data),origin:d.origem,destination:dest(r),date:String(d.data||''),port:r.porto,modal:r.modal,
     kmRouted:+kmRoad.toFixed(2),kmAccess,km,kmTotal:km,tku:tk,freteRodoIndicativo:+(km*tk).toFixed(2),originPrecision:a.source,originMode:a.source,
     originLat:a.pos[0],originLon:a.pos[1],destinationLat:b[0],destinationLon:b[1],source:'OSRM/OpenStreetMap',
     checkedAt:new Date().toISOString()};
   const m=map();
   if(m&&typeof L!=='undefined'){layer=L.layerGroup().addTo(m);const line=L.geoJSON(road.geometry,{style:{color:'#087d76',weight:5,opacity:.94}}).addTo(layer);
    L.circleMarker(a.pos,{radius:6,color:'#fff',fillColor:'#087d76',fillOpacity:1}).addTo(layer);
    L.circleMarker(b,{radius:6,color:'#fff',fillColor:'#bd7035',fillOpacity:1}).addTo(layer);
    m.fitBounds(line.getBounds().pad(.15),{maxZoom:11,animate:true});}
   $('brzf60-apply').disabled=false;
   status('<b>'+fmt(km)+' km rodoviários</b> · '+fmt(kmRoad)+' km de rede viária'+(kmAccess?' + '+fmt(kmAccess)+' km de acesso informado':'')+
    ' · TKU indicativo R$ '+fmt(tk)+'/t.km · <b>Frete R$ '+fmt(result.freteRodoIndicativo)+'/t</b>'+
    '<div style="font-size:11px;margin-top:5px">'+esc(a.source)+' · Ferrovias, fretes cotados e snapshots preservados. Confirme para usar em cálculo indicativo.</div>');
  }catch(err){if(seq===requestId)status('Roteirização não confirmada: '+esc(err.message)+'. Nenhum cálculo foi alterado.',true);}
  finally{clearTimeout(timeout);if(activeCtrl===controller)activeCtrl=null;$('brzf60-calc').disabled=false;}
 }
 async function apply(){
  if(!result||!result.km)return;
  const btn=$('brzf60-apply');btn.disabled=true;
  status('Salvando a rota aprovada no Supabase (com controle de versão)…');
  try{
   const routeData={...result,approved:true,savedAt:new Date().toISOString()};
   const ack=await window.BRZPinAutoSave?.saveRoadGeoRoute?.(routeData);
   if(ack?.saved!==true)throw Error('Supabase não confirmou a rota');
   if(typeof api.refresh==='function')api.refresh();
   status('Trecho rodoviário gravado no Supabase para <b>'+esc(routeData.id)+'</b>: '+fmt(routeData.km)+
     ' km · frete indicativo R$ '+fmt(routeData.freteRodoIndicativo)+'/t. Ferrovia e cotações originais preservadas.');
   result=null;
  }catch(error){
   status('A rota não foi gravada: '+esc(error?.message||error)+'. Nenhum negócio foi alterado.',true);
   btn.disabled=false;
  }
 }
 function selectFromPending(id0){const d=api.getTrades().find(x=>x.id===id0);if(!d)return;
  try{if(typeof showScreen==='function')showScreen('mapa');}catch{}
  $('brzf60-search').value=id0;show();choose(id0);setTimeout(()=>{try{map()?.invalidateSize();}catch{}void calculate();},350);}
 function markOrigin(){const m=map();if(!m||typeof L==='undefined'){status('Abra o mapa para marcar a origem.',true);return;}
  status('Clique sobre a fazenda ou armazém no mapa. A medição será refeita a partir desse ponto.');
  m.once('click',ev=>{pin=[ev.latlng.lat,ev.latlng.lng];clear();
   if(activePin)try{m.removeLayer(activePin);}catch{}
   activePin=L.circleMarker(pin,{radius:7,color:'#fff',fillColor:'#bd7035',fillOpacity:1}).addTo(m);
   status('Ponto de origem marcado: '+pin.map(v=>v.toFixed(5)).join(', ')+'. Clique em calcular.');
  });}
 function exportRoutes(){const blob=new Blob([JSON.stringify({schema:'BRZ_F60_ROAD_ONLY_SUPABASE',exportedAt:new Date().toISOString(),routes:Object.values(approved())},null,2)],{type:'application/json'});
  const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='BRZ_Rotas_Rodoviarias_F60.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);}
 const screen=$('mapa');
 if(screen){const div=document.createElement('section');div.id='brzf60-panel';div.innerHTML=
  '<div style="font-weight:800;margin-bottom:9px">Mapa rodoviário · TKU por negócio</div>'+
  '<div class="brzf60-controls"><input id="brzf60-search" placeholder="Buscar ID, município ou vendedor">'+
  '<select id="brzf60-deal"></select><select id="brzf60-route"></select>'+
  '<button type="button" id="brzf60-pin">Marcar fazenda</button><button type="button" id="brzf60-calc">Calcular km</button>'+
  '<button type="button" id="brzf60-apply" disabled>Aplicar km indicativos</button>'+
  '<button type="button" id="brzf60-export">Exportar rotas</button></div>'+
  '<div id="brzf60-status" role="status">Selecione um negócio. A lógica ferroviária permanece inalterada.</div>';
  screen.querySelector('.head')?.insertAdjacentElement('afterend',div);
  const css=document.createElement('style');css.id='brzf60-style';css.textContent=
   '#brzf60-panel{padding:13px 18px;margin:10px 16px;border:1px solid var(--g200,#d7e2e8);background:var(--card,#fff);border-radius:5px}'+
   '.brzf60-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}'+
   '.brzf60-controls select,.brzf60-controls input{padding:8px;border:1px solid #cbd6df;border-radius:4px;min-width:140px;max-width:100%;font:12px Arial}'+
   '#brzf60-deal{flex:2 1 250px}#brzf60-search{flex:1 1 160px}'+
   '.brzf60-controls button{padding:8px 10px;border:1px solid #087d76;background:#fff;color:#087d76;cursor:pointer;border-radius:4px;font:700 12px Arial}'+
   '.brzf60-controls button:disabled{opacity:.4;cursor:not-allowed}'+
   '#brzf60-status{font:12px/1.5 Arial;color:var(--g800,#3e5361);padding:9px 0}#brzf60-status[data-error="1"]{color:#983e29}';
  document.head.appendChild(css);
  $('brzf60-search').oninput=()=>show();
  $('brzf60-deal').onchange=e=>{choose(e.target.value);if(e.target.value)void calculate();};
  $('brzf60-route').onchange=()=>{clear();status('Trecho alterado. Clique em calcular.');};
  $('brzf60-pin').onclick=markOrigin;
  $('brzf60-calc').onclick=calculate;
  $('brzf60-apply').onclick=apply;
  $('brzf60-export').onclick=exportRoutes;
  show();
 }
 // Wrapped road lookup only. The railway calculators remain byte-identical.
 const old=window.findRodoFreight;
 if(typeof old==='function'&&!old.__brzf60){
  const wrapped=function(origem,destino,date,corredor,tid){
   const out=old.apply(this,arguments);
   if(out&&out.estimado===false)return out;
   let a=getApproved(tid,origem,destino,date);
   if(!a&&!tid){const matches=api.getTrades().filter(t=>t?.origem===origem&&String(t.data||'')===String(date||'')&&
     routes(t).some(rt=>dest(rt)===destino));
    if(matches.length===1)a=getApproved(matches[0].id,origem,destino,date);}
   if(!a)return out;
   let tku=Number(out?.tku)||Number(a.tku)||0;
   if(!tku)tku=.30;
   return {...(out||{}),valor:+(a.km*tku).toFixed(2),km:a.km,tku,estimado:true,
     fonteFrete:'tku_rota_osrm_f60',kmFonte:'OSRM/OpenStreetMap',geoOrigemTipo:a.originPrecision};
  };
  wrapped.__brzf60=true;window.findRodoFreight=wrapped;
 }
 const exposed=Object.freeze({getApproved,selectFromPending,calculate,status:()=>({routes:Object.keys(approved()).length,storage:'Supabase/settings',railModified:false}),version:'F60-road-only'});
 window.BRZRoadGeo=exposed;return exposed;
}
