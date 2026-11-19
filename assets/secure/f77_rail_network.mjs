/* BRZ F77 — geometria ferroviária validada da malha concedida em operação.
 * Source: Infra S.A. / ANTT FeatureServer. Queried only on explicit route
 * selection. Reject incomplete, disconnected, ambiguous or out-of-reach paths.
 * No inferred geometry, no freight/TCO write, no railway-access assumptions.
 */
export const INFRA_RAIL_SOURCE='https://geo.infrasa.gov.br/server/rest/services/Ferrovias_Concedidas_em_opera%C3%A7%C3%A3o/FeatureServer/0/query';
const valid=p=>Array.isArray(p)&&p.length>=2&&p.every((x,i)=>i<2?Number.isFinite(+x):true);
const km=(a,b)=>{
 const x=Math.PI/180,R=6371,p=(b[1]-a[1])*x,q=(b[0]-a[0])*x;
 const z=Math.sin(p/2)**2+Math.cos(a[1]*x)*Math.cos(b[1]*x)*Math.sin(q/2)**2;
 return R*2*Math.atan2(Math.sqrt(z),Math.sqrt(Math.max(0,1-z)));
};
const key=p=>Math.round(Number(p[0])*10000)+','+Math.round(Number(p[1])*10000);
function links(features){
 const graph=new Map(),pos=new Map();
 const link=(a,b)=>{
  const ak=key(a),bk=key(b);if(ak===bk)return;
  const cost=km(a,b);if(!(cost>.003&&cost<60))return;
  pos.set(ak,a);pos.set(bk,b);
  if(!graph.has(ak))graph.set(ak,[]);
  if(!graph.has(bk))graph.set(bk,[]);
  graph.get(ak).push({to:bk,cost});graph.get(bk).push({to:ak,cost});
 };
 for(const f of features||[]){
  const g=f?.geometry;
  const lines=g?.type==='LineString'?[g.coordinates]:
   g?.type==='MultiLineString'?g.coordinates:[];
  for(const row of lines)if(Array.isArray(row)){
   for(let i=1;i<row.length;i++)if(valid(row[i-1])&&valid(row[i]))
    link(row[i-1],row[i]);
  }
 }
 return {graph,pos};
}
function nearest(nodes,target){
 let best=null,d=Infinity;
 for(const [k,p] of nodes){
  const q=km(p,target);
  if(q<d){best=k;d=q;}
 }
 return {key:best,km:d};
}
function heap(){
 const a=[];
 return {
  push(x){a.push(x);let i=a.length-1;while(i){let j=(i-1)>>1;if(a[j][0]<=x[0])break;a[i]=a[j];i=j;}a[i]=x;},
  pop(){if(!a.length)return null;const top=a[0],v=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(a[j][0]>=v[0])break;a[i]=a[j];i=j;}a[i]=v;}return top;},
  get length(){return a.length;}
 };
}
export function validatedRailPath(features,startLonLat,endLonLat,{maxSnapKm=15}={}){
 if(!valid(startLonLat)||!valid(endLonLat))return {ok:false,reason:'terminal ou porto sem coordenada validada'};
 const {graph,pos}=links(features);
 if(graph.size<3)return {ok:false,reason:'rede ferroviária insuficiente'};
 const a=nearest(pos,startLonLat),b=nearest(pos,endLonLat);
 if(!a.key||!b.key||a.km>maxSnapKm||b.km>maxSnapKm)
  return {ok:false,reason:'acesso ao terminal/porto ferroviário sem confirmação geométrica',terminalGapKm:a.km,portGapKm:b.km};
 const dist=new Map([[a.key,0]]),prev=new Map(),queue=heap(),done=new Set();
 queue.push([0,a.key]);
 while(queue.length){
  const [cost,node]=queue.pop();
  if(done.has(node))continue;
  done.add(node);if(node===b.key)break;
  for(const edge of graph.get(node)||[]){
   const next=cost+edge.cost;
   if(next<(dist.get(edge.to)??Infinity)){dist.set(edge.to,next);prev.set(edge.to,node);queue.push([next,edge.to]);}
  }
 }
 if(!dist.has(b.key))return {ok:false,reason:'trechos ferroviários não conectados na fonte oficial'};
 const route=[];let at=b.key;
 while(at){route.push(pos.get(at));if(at===a.key)break;at=prev.get(at);}
 route.reverse();
 if(route.length<2||route.length>180000)
  return {ok:false,reason:'sequência ferroviária sem geometria contínua'};
 const calculated=dist.get(b.key),direct=km(startLonLat,endLonLat);
 if(calculated<direct*.75||calculated>direct*4+200)
  return {ok:false,reason:'traçado ferroviário geometricamente incompatível'};
 return {ok:true,coords:route,km:calculated,source:'Infra S.A. / ANTT — ferrovias concedidas em operação',
  accessKm:[a.km,b.km],validatedAs:'conexão geométrica; não comprova autorização comercial, bitola ou capacidade'};
}
const urlFor=(params)=>INFRA_RAIL_SOURCE+'?'+new URLSearchParams(params);
const lastCache=new Map();
async function requestJson(params,signal){
 const u=urlFor(params),response=await fetch(u,{signal,mode:'cors',cache:'force-cache',
  referrerPolicy:'no-referrer',credentials:'omit'});
 if(!response.ok)throw Error('Fonte oficial HTTP '+response.status);
 const data=await response.json();if(data?.error)throw Error('ArcGIS: '+String(data.error.message||'resposta inválida'));
 return data;
}
export async function fetchOfficialRail({from,to,signal,maxFeatures=4500}={}){
 if(!valid(from)||!valid(to))throw Error('Terminal/porto sem coordenada');
 const minLon=Math.min(from[0],to[0])-1.5,maxLon=Math.max(from[0],to[0])+1.5;
 const minLat=Math.min(from[1],to[1])-1.5,maxLat=Math.max(from[1],to[1])+1.5;
 const bbox=[minLon,minLat,maxLon,maxLat].join(',');
 const keyCache=bbox;
 if(lastCache.has(keyCache))return lastCache.get(keyCache);
 const base={where:'1=1',geometry:bbox,geometryType:'esriGeometryEnvelope',
  spatialRel:'esriSpatialRelIntersects',inSR:'4326',outSR:'4326'};
 const ids=await requestJson({...base,returnIdsOnly:'true',f:'json'},signal);
 const all=[...new Set((ids.objectIds||[]).filter(x=>Number.isInteger(Number(x))))];
 if(!all.length)throw Error('Não há linhas férreas oficiais nesse corredor');
 if(all.length>maxFeatures)throw Error('Malha ferroviária além do limite de processamento; divida o corredor');
 const field=String(ids.objectIdFieldName||'OBJECTID');
 const features=[];
 for(let i=0;i<all.length;i+=175){
  if(signal?.aborted)throw Error('Consulta ferroviária cancelada');
  // The operational Infra S.A. layer advertises ArcGIS JSON; requesting
  // GeoJSON may return a server error. Convert esriPolyline paths locally.
  const obj=await requestJson({objectIds:all.slice(i,i+175).join(','),
   outFields:field,returnGeometry:'true',outSR:'4326',f:'json'},signal);
  if(!Array.isArray(obj.features))throw Error('Resposta ArcGIS ferroviária inválida');
  for(const record of obj.features){
    const paths=record?.geometry?.paths;
    if(!Array.isArray(paths)||!paths.length)continue;
    const lines=paths.filter(x=>Array.isArray(x)&&x.length>=2);
    if(!lines.length)continue;
    features.push({type:'Feature',
      geometry:lines.length===1?{type:'LineString',coordinates:lines[0]}:
        {type:'MultiLineString',coordinates:lines},
      properties:record.attributes||{}});
  }
 }
 if(features.length<Math.floor(all.length*.97))throw Error('Geometria ferroviária incompleta; não desenhar rota');
 const answer={features,source:INFRA_RAIL_SOURCE,received:features.length};
 if(lastCache.size>2)lastCache.clear();
 lastCache.set(keyCache,answer);
 return answer;
}
export async function displayValidatedRail({map,group,from,to,signal}={}){
 if(!map||!group||typeof L==='undefined')return {ok:false,reason:'Leaflet indisponível'};
 try{
  const source=await fetchOfficialRail({from,to,signal});
  const route=validatedRailPath(source.features,from,to);
  if(!route.ok)return route;
  const latlngs=route.coords.map(p=>[p[1],p[0]]);
  const poly=L.polyline(latlngs,{color:'#6351aa',weight:5,opacity:.95}).addTo(group);
  L.circleMarker([latlngs[0][0],latlngs[0][1]],{radius:5,color:'#6351aa'}).addTo(group);
  L.circleMarker(latlngs.at(-1),{radius:5,color:'#6351aa'}).addTo(group);
  if(poly.getBounds().isValid())map.fitBounds(poly.getBounds().pad(.15),{animate:false,maxZoom:11});
  return route;
 }catch(error){return {ok:false,reason:error?.message||String(error)};}
}
