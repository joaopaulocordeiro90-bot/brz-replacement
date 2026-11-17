/* BRZ F77 — Geographical index. No mutation of original commercial records.
   Municipal centroids are indicative. Farm pins require explicit user confirmation
   and are versioned separately from road freight and replacement calculations. */
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const valid=p=>Array.isArray(p)&&p.length===2&&p.every(x=>Number.isFinite(Number(x)))&&
 Number(p[0])>=-35&&Number(p[0])<=6&&Number(p[1])>=-75&&Number(p[1])<=-32;
function findCity(raw,extraction){
 const t=String(raw||'').trim();
 const original=String(typeof extraction==='function'?extraction(t)||'':'').trim();
 let city=original||t.split(/[+(]/)[0].trim();
 city=city.replace(/^(?:cif|fob|fas)\s+/i,'').trim();
 const uf=(t.match(/(?:\/|\s-\s)([A-Z]{2})(?:\b|[\s(]|$)/)||[])[1]||null;
 if(city.includes('/'))city=city.split('/')[0].trim();
 if(city.includes(' - '))city=city.split(' - ')[0].trim();
 return {city,uf,key:norm(city)+'|'+(uf||'')};
}
export function createGeoRegistry({trades,getCoord,extractCity,regionOf,overrides={}}={}){
 if(!Array.isArray(trades))throw Error('F77 Geo: negócios indisponíveis');
 if(typeof getCoord!=='function')throw Error('F77 Geo: fonte cartográfica não inicializada');
 const entries=new Map(),unresolved=[],counts={total:0,confirmed:0,municipal:0,missing:0};
 for(const d of trades){
  if(!d||!d.id||!d.origem)continue;
  counts.total++;
  const id=String(d.id),place=findCity(d.origem,extractCity),chosen=overrides[id];
  let geo=null;
  if(chosen&&chosen.origin===String(d.origem)&&valid([chosen.lat,chosen.lon])){
   geo={lat:Number(chosen.lat),lon:Number(chosen.lon),precision:'ponto_confirmado',
    source:String(chosen.source||'manual_map_pin'),confirmedAt:chosen.confirmedAt||null};
   counts.confirmed++;
  }else{
   let municipal=null;
   try{municipal=(place.uf?(getCoord(place.city+' - '+place.uf)||getCoord(place.city+'/'+place.uf)):null)||getCoord(place.city);}catch{}
   if(valid(municipal)){
    geo={lat:Number(municipal[0]),lon:Number(municipal[1]),precision:'sede_municipal_indicativa',
     source:String(municipal.source||'CITY_COORDS legado · sede municipal indicativa'),confirmedAt:null};
    counts.municipal++;
   }else{
    unresolved.push({id,origem:String(d.origem),cidade:place.city,uf:place.uf,corredor:String(d.corredor||'')});
    counts.missing++;
   }
  }
  entries.set(id,{id,origem:String(d.origem),cidade:place.city,uf:place.uf,
   regiao:typeof regionOf==='function'?String(regionOf(d)||'Região a validar'):String(d.corredor||'Região a validar'),
   geo,commercialCorridor:String(d.corredor||'')});
 }
 return {counts,entries,unresolved};
}
export function installGeoRegistry({getTrades,getCoord,extractCity,regionOf,getOverrides,saveOverride}={}){
 if(typeof document==='undefined'||typeof getTrades!=='function'||typeof getCoord!=='function')return null;
 const screen=document.getElementById('mapa');if(!screen)return null;
 const existing=document.getElementById('brz-f77-geo');if(existing)return window.BRZGeoRegistry||null;
 const container=document.createElement('details');container.id='brz-f77-geo';
 container.innerHTML='<summary>Localização das origens · qualidade geográfica</summary>'+
  '<p id="brz-f77-geo-stats"></p><div class="brz-f77-geo-tools">'+
  '<input id="brz-f77-geo-search" placeholder="Buscar negócio, cidade ou região" aria-label="Buscar origem">'+
  '<select id="brz-f77-geo-id" aria-label="Selecionar origem"></select>'+
  '<button id="brz-f77-geo-find" type="button">Enquadrar no mapa</button>'+
  '<button id="brz-f77-geo-pin" type="button">Marcar ponto real</button></div>'+
  '<p id="brz-f77-geo-detail" aria-live="polite"></p>';
 screen.querySelector('.head')?.insertAdjacentElement('afterend',container);
 const css=document.createElement('style');css.id='brz-f77-geo-css';
 css.textContent='#brz-f77-geo{margin:10px 18px;padding:9px 13px;background:var(--card,#fff);color:var(--g800,#324b60);border:1px solid var(--g200,#d5e0e8);border-radius:5px;font:12px Inter,Arial,sans-serif}'+
 '#brz-f77-geo summary{cursor:pointer;font-weight:700;color:var(--g900,#173249)}'+
 '.brz-f77-geo-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center}'+
 '.brz-f77-geo-tools select,.brz-f77-geo-tools input{font:12px Arial;padding:8px;max-width:100%;min-width:155px;flex:1 1 150px;border:1px solid var(--g200,#d5e0e8);background:var(--card,#fff);color:var(--g900,#173249)}'+
 '.brz-f77-geo-tools button{padding:8px;background:white;border:1px solid #087d76;color:#087d76;border-radius:4px;cursor:pointer;font-weight:700}'+
 '#brz-f77-geo-detail{line-height:1.5;color:var(--g700,#436073)}';
 document.head.appendChild(css);
 const $=id=>container.querySelector('#'+id);
 let registry=null,pin=null,marker=null;
 const map=()=>typeof window.__BRZ_F77_MAP_GETTER==='function'?window.__BRZ_F77_MAP_GETTER():null;
 // Avoid direct references to lexical _leafletMap from an ESM module.
 const compute=()=>createGeoRegistry({trades:getTrades(),getCoord,extractCity,regionOf,
  overrides:typeof getOverrides==='function'?getOverrides():{}});
 const ensure=()=>registry||(registry=compute());
 const show=()=>{
   if(!container.open)return;
   registry=compute();
   const c=registry.counts;
   $('brz-f77-geo-stats').textContent=c.total+' negócios · '+c.confirmed+' pontos confirmados · '+c.municipal+
    ' sedes municipais indicativas · '+c.missing+' sem coordenada confiável';
   const query=norm($('brz-f77-geo-search').value),previous=$('brz-f77-geo-id').value;
   const available=[...registry.entries.values()].filter(x=>!query||
    norm([x.id,x.origem,x.cidade,x.regiao].join(' ')).includes(query));
   const max=350;
   // A limited DOM list is not a limited underlying registry: search remains
   // global and exact selections are always included.
   const selected=available.find(x=>x.id===previous);
   const shown=available.slice(0,max);
   if(selected&&!shown.includes(selected))shown.unshift(selected);
   $('brz-f77-geo-id').innerHTML='<option value="">Selecione uma origem ('+available.length+')</option>'+
    shown.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.id+' · '+x.cidade+(x.uf?'/'+x.uf:'')+' · '+x.regiao)+'</option>').join('');
   if(shown.some(x=>x.id===previous))$('brz-f77-geo-id').value=previous;
   $('brz-f77-geo-detail').textContent='A coordenada municipal é indicativa; não representa acesso rural, fazenda nem ponto preciso de retirada. Nenhuma coordenada desconhecida foi inventada.';
 };
 const selected=()=>registry?.entries.get($('brz-f77-geo-id').value);
 $('brz-f77-geo-search').oninput=show;
 $('brz-f77-geo-id').onchange=()=>{
  const v=selected();$('brz-f77-geo-detail').textContent=v?
   v.origem+' · '+v.regiao+' · '+(v.geo? v.geo.precision+' ('+v.geo.lat.toFixed(5)+', '+v.geo.lon.toFixed(5)+')':'COORDENADA PENDENTE'):
   'Selecione um negócio';
 };
 $('brz-f77-geo-find').onclick=()=>{
  const x=selected();if(!x)return;
  try{
   if(typeof window.BRZRoadGeo?.selectFromPending==='function'){window.BRZRoadGeo.selectFromPending(x.id);return;}
  }catch{}
  $('brz-f77-geo-detail').textContent='Use a ferramenta de rota rodoviária para enquadrar o ponto no mapa.';
 };
 $('brz-f77-geo-pin').onclick=()=>{
  const x=selected();if(!x||typeof saveOverride!=='function'){return;}
  const m=map();
  if(!m||typeof window.L==='undefined'){
   $('brz-f77-geo-detail').textContent='Mapa não inicializado; use a marcação de fazenda na ferramenta rodoviária.';
   return;
  }
  $('brz-f77-geo-detail').textContent='Clique na localização REAL da fazenda ou armazém, confira e confirme. Nenhum custo será regravado automaticamente.';
  m.once('click',async ev=>{
    const lat=ev.latlng.lat,lon=ev.latlng.lng;
    if(!valid([lat,lon]))return;
    if(marker)try{m.removeLayer(marker)}catch{}
    marker=window.L.circleMarker([lat,lon],{radius:7,color:'#fff',fillColor:'#bd7035',fillOpacity:1}).addTo(m);
    if(!confirm('Confirmar ponto real para '+x.id+' em '+lat.toFixed(5)+', '+lon.toFixed(5)+'?'))return;
    try{
      $('brz-f77-geo-detail').textContent='Gravando localização com controle de versão…';
      await saveOverride({id:x.id,origin:x.origem,lat,lon,precision:'ponto_confirmado',source:'manual_map_pin'});
      show();$('brz-f77-geo-id').value=x.id;$('brz-f77-geo-id').onchange();
    }catch(error){$('brz-f77-geo-detail').textContent='Falha ao salvar localização: '+error.message;}
  });
 };
 container.addEventListener('toggle',show);
 const api=Object.freeze({refresh:show,getById:id=>ensure().entries.get(String(id))||null,
  getStats:()=>ensure().counts,getIndex:ensure,version:'F77-georegistry-v1'});
 window.BRZGeoRegistry=api;return api;
}
