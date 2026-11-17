/* BRZ F71 · real-map loading strategy verified against Trading Games Level 1/2.
 * Leaflet CDN fallback; Esri street/topographic/imagery tiles with tileload,
 * tileerror and timeout. No fabricated routes, distance or freight calculation. */
(function(){
'use strict';
if(window.__BRZ_F71_MAP_PATCH__)return;
const BASES=[
 ['Ruas Esri','https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'],
 ['Topográfico Esri','https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
 ['Satélite Esri','https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
 ['OpenStreetMap','https://tile.openstreetmap.org/{z}/{x}/{y}.png']
];
const ATTR='Mapa: Esri e provedores cartográficos · dados OpenStreetMap';
let baseOverrides=0,tileFallbacks=0,panelsProtected=0,ready=false,libraryFailures=0;
const safe=x=>String(x?.message||x||'erro não identificado').slice(0,200)
 .replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
function status(msg,bad=false){
 const box=document.getElementById('mapaContainer');
 if(!box)return;
 let child=box.querySelector('#brz-f71-map-status');
 if(!msg){child?.remove();return;}
 if(!child){child=document.createElement('div');child.id='brz-f71-map-status';
  child.setAttribute('role','status');
  child.style.cssText='position:absolute;top:12px;left:12px;right:12px;z-index:850;padding:9px 13px;border:1px solid #bdd9d0;border-radius:6px;background:#ffffffed;color:#214538;font-size:12px;font-weight:650;pointer-events:none';
  box.appendChild(child);
 }
 child.textContent=msg;
 child.style.color=bad?'#9c392e':'#214538';
}
function patchLeaflet(){
 const L=window.L;
 if(!L?.TileLayer?.prototype||ready)return;
 ready=true;
 const baseInit=L.TileLayer.prototype.initialize;
 L.TileLayer.prototype.initialize=function(url,opts){
  if(!/^(?:https?:)?\/\/(?:\{s\}\.)?tile\.openstreetmap\.org\//i.test(String(url||'')))
   return baseInit.call(this,url,opts);
  baseOverrides++;
  const layer=this;let index=0,errors=0,loaded=false,clock=null;
  const options={...(opts||{}),attribution:ATTR,maxZoom:19,maxNativeZoom:17,minZoom:3,subdomains:'abc',crossOrigin:false};
  const result=baseInit.call(layer,BASES[0][1],options);
  function stopTimer(){if(clock)clearTimeout(clock);clock=null;}
  function next(){
   if(loaded)return;
   stopTimer();errors=0;index++;tileFallbacks++;
   if(index>=BASES.length){status('Serviços de mapa indisponíveis nesta conexão. Tente reabrir a aba Mapa.',true);return;}
   status('Carregando mapa real · '+BASES[index][0]+'…');
   layer.setUrl(BASES[index][1]);
   clock=setTimeout(next,8500);
  }
  layer.on('add',()=>{if(loaded)return;status('Carregando mapa real…');clock=setTimeout(next,8500)});
  layer.on('remove',stopTimer);
  layer.on('tileload',()=>{if(!loaded){loaded=true;stopTimer();status('')}});
  layer.on('tileerror',()=>{if(!loaded&&++errors>=2)next()});
  return result;
 };
 // Leaflet map is initialized in the existing replacement engine.
 // Reuse it: never create a competing canvas or recompute routes.
 if(typeof L.Map?.addInitHook==='function') L.Map.addInitHook(function(){
  if(this._container?.id!=='mapaContainer')return;
  const map=this;
  if(typeof ResizeObserver==='function'){
   const observer=new ResizeObserver(()=>{if(map._loaded)map.invalidateSize(false)});
   observer.observe(this._container);
   map.on('unload',()=>observer.disconnect());
  }
  setTimeout(()=>map.invalidateSize(false),60);
 });
}
function mountPanels(){
 for(const [name,id] of [
  ['renderMapaSummary','mapaSummary'],['renderMapaCorredorDetail','mapaCorredorDetail'],
  ['renderMapaVplTabela','mapaVplTabela'],['renderMapaNarrativa','mapaNarrativa'],
  ['renderMapaTable','mapaTableBody']]){
  const fn=window[name];
  if(typeof fn!=='function'||fn.__brzF71Guard)continue;
  const wrap=function(){try{return fn.apply(this,arguments)}catch(error){
   console.error('[BRZ F71] '+name,error);
   const dest=document.getElementById(id);
   if(dest)dest.innerHTML='<div class="note" role="alert" style="padding:10px;border-left:3px solid #bd6d33">Painel '+name+': '+safe(error)+'</div>';
  }};
  wrap.__brzF71Guard=true;window[name]=wrap;panelsProtected++;
 }
 const old=window.safeScreenError;
 if(typeof old==='function'&&!old.__brzF71Guard){
  const wrap=function(screen,error){
   if(screen==='mapa'){
    console.error('[BRZ F71] mapa',error);
    const panel=document.getElementById('mapaNarrativa');
    if(panel){panel.innerHTML='<div class="note" role="alert">Painel analítico: '+safe(error)+'</div>';return}
   }
   return old.apply(this,arguments);
  };
  wrap.__brzF71Guard=true;window.safeScreenError=wrap;
 }
}
function reRenderMap(){
 let tries=0;
 function tick(){
  if(typeof window.renderMapa==='function'){
   if(document.getElementById('mapa')?.classList.contains('active')){
    try{window.renderMapa()}catch(e){console.error('[BRZ F71] re-render',e)}
   }
   return;
  }
  if(++tries<40)setTimeout(tick,100);
 }
 tick();
}
function rescueLeaflet(){
 if(window.L){patchLeaflet();return}
 const urls=[
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'
 ];
 function next(i){
  if(window.L){patchLeaflet();reRenderMap();return}
  if(i>=urls.length){libraryFailures++;status('Leaflet indisponível nas fontes alternativas. As tabelas continuam acessíveis.',true);return}
  const script=document.createElement('script');
  script.src=urls[i];script.async=true;script.crossOrigin='anonymous';
  script.onload=()=>{if(window.L){patchLeaflet();reRenderMap()}else next(i+1)};
  script.onerror=()=>next(i+1);
  document.head.appendChild(script);
 }
 next(0);
}
if(window.L)patchLeaflet();else rescueLeaflet();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountPanels,{once:true});else mountPanels();
window.__BRZ_F71_MAP_PATCH__=Object.freeze({status:()=>({baseOverrides,esriTileOverrides:baseOverrides,tileFallbacks,failovers:tileFallbacks,panelsProtected,libraryFailures,leafletLoaded:!!window.L,railModified:false})});
window.__BRZ_F61_MAP_PATCH__=window.__BRZ_F71_MAP_PATCH__;
})();