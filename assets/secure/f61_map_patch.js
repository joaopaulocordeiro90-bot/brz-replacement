/* BRZ Replacement F61 | Basemap 403 recovery + map module isolation.
 * Road-only overlay. Does not modify rail rates, financial curves or trades. */
(function(){
'use strict';
if(window.__BRZ_F61_MAP_PATCH__)return;
const Lf=window.L;
const ESRI_STREETS='https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const ESRI_IMAGERY='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ATTR='Tiles &copy; <a target="_blank" rel="noopener" href="https://www.esri.com/">Esri</a>, HERE, Garmin, USGS, OpenStreetMap contributors and the GIS User Community';
let diverted=0, fallbackCount=0, panelsProtected=0;
if(Lf&&Lf.TileLayer&&typeof Lf.TileLayer.prototype.initialize==='function'){
 const native=Lf.TileLayer.prototype.initialize;
 Lf.TileLayer.prototype.initialize=function(url,settings){
  if(typeof url==='string'&&/^(?:https?:)?\/\/(?:\{s\}\.)?tile\.openstreetmap\.org\//i.test(url)){
   diverted++;
   const options={...(settings||{}),attribution:ATTR,maxZoom:Math.max(Number(settings?.maxZoom)||0,16),maxNativeZoom:16,subdomains:undefined,crossOrigin:false};
   const result=native.call(this,ESRI_STREETS,options);
   let errors=0;
   this.on('tileerror',()=>{
    if(this._brzF61Fallback||++errors<4)return;
    this._brzF61Fallback=true;fallbackCount++;
    console.warn('[BRZ F61] Esri ruas indisponível; usando imagem Esri como fallback.');
    this.setUrl(ESRI_IMAGERY);
   });
   return result;
  }
  return native.call(this,url,settings);
 };
}
function safeMessage(error){
 const s=String(error?.message||error||'erro não identificado');
 return s.slice(0,260).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
}
function section(name,container){
 const fn=window[name];
 if(typeof fn!=='function'||fn.__brzf61guard)return;
 const guarded=function(){
  try{return fn.apply(this,arguments);}
  catch(err){
   console.error('[BRZ F61] Falha isolada em '+name+':',err);
   const element=document.getElementById(container);
   if(element)element.innerHTML='<div class="note" style="border-left:3px solid #be6d2c;padding:9px 12px">Mapa carregado; revisão do painel complementar <strong>'+name+'</strong>: '+safeMessage(err)+'</div>';
   return undefined;
  }
 };
 guarded.__brzf61guard=true;
 window[name]=guarded;panelsProtected++;
}
function install(){
 for(const [fn,el] of [
  ['renderMapaSummary','mapaSummary'],
  ['renderMapaCorredorDetail','mapaCorredorDetail'],
  ['renderMapaVplTabela','mapaVplTabela'],
  ['renderMapaNarrativa','mapaNarrativa'],
  ['renderMapaTable','mapaTableBody']
 ])section(fn,el);
 const old=window.safeScreenError;
 if(typeof old==='function'&&!old.__brzf61guard){
  const guard=function(screen,error){
   if(screen==='mapa'){
    console.error('[BRZ F61] Falha no mapa:',error);
    const box=document.getElementById('mapaNarrativa');
    if(box){
     box.innerHTML='<div class="note" role="alert" style="border-left:3px solid #be6d2c;padding:10px">Erro no painel analítico: '+safeMessage(error)+'. A camada geográfica e os dados já desenhados foram preservados.</div>';
     return;
    }
   }
   return old.apply(this,arguments);
  };
  guard.__brzf61guard=true;window.safeScreenError=guard;
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
window.__BRZ_F61_MAP_PATCH__=Object.freeze({status:()=>({esriTileOverrides:diverted,failovers:fallbackCount,panelsProtected,railModified:false})});
})();
