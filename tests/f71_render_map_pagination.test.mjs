import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const utf8=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const engine=utf8('../assets/js/part_06.js');
const pin=utf8('../assets/secure/pin_autosave.js');
const carto=utf8('../assets/secure/f61_map_patch.js');
const app=utf8('../app.html');
assert(!pin.includes("_brzPrecosIdx=null"),'F66 corrupted callable index by null assignment');
assert.match(pin,/if\(typeof _brzF71PrecoIndexCache!=='undefined'\)_brzF71PrecoIndexCache=null/);
assert.match(engine,/function brzF71PrecoIndex\(\)/);
assert.doesNotMatch(engine,/function _brzPrecosIdx\(/);
const begin=engine.indexOf('var _brzF71PrecoIndexCache=null;');
const end=engine.indexOf('/* V4AT',begin);
assert(begin>0&&end>begin);
const sandbox={
 getPrecosBase:()=>[
  {id:'a',data:'2026-11-16',produto:'Soja',vencCBOT:'F27',cbot:1244},
  {id:'b',data:'2026-11-16',produto:'Milho',vencCBOT:'H27',cbot:459}
 ],
 brzMarketDate:()=>null,
 brzCurvaValor:()=>null
};
vm.createContext(sandbox);
vm.runInContext(engine.slice(begin,end),sandbox);
assert.equal(typeof sandbox.brzF71PrecoIndex,'function');
assert.equal(sandbox.brzTemDado('2026-11-16'),true);
assert.equal(sandbox.brzCbotNaData('Soja','F27','2026-11-16'),1244);
sandbox._brzF71PrecoIndexCache=null;
assert.equal(sandbox.brzCbotNaData('Milho','H27','2026-11-16'),459);
const a=engine.indexOf('  const visibleLimit = [10,25,50]'),
 b=engine.indexOf("  document.getElementById('dealsBody')",a);
assert(a>0&&b>a,'DOM page slice is required');
const pager=engine.slice(a,b);
for(const size of [10,25,50]){
 const context={ds:Array.from({length:3058},(_,i)=>({id:i})),negociosRenderLimit:size,negociosRenderPage:0};
 vm.createContext(context);
 const result=vm.runInContext(pager+';({pageCount,pageStart,visibleDs,visibleLimit})',context);
 assert.equal(result.visibleDs.length,size);
 assert.equal(result.pageCount,Math.ceil(3058/size));
 assert.equal(result.pageStart,0);
}
const last={ds:Array.from({length:3058},(_,i)=>({id:i})),negociosRenderLimit:50,negociosRenderPage:99};
vm.createContext(last);
const endPage=vm.runInContext(pager+';({pageCount,pageStart,visibleDs})',last);
assert.equal(endPage.visibleDs.length,8);
assert.equal(last.negociosRenderPage,61);
assert.match(engine,/function negociosSetPageSize\(size\)/);
assert.match(engine,/onchange="negociosSetPageSize\(this.value\)"/);
assert.match(carto,/World_Street_Map/);
assert.match(carto,/World_Topo_Map/);
assert.match(carto,/World_Imagery/);
assert.match(carto,/tileload/);
assert.match(carto,/tileerror/);
assert.match(carto,/cdn.jsdelivr.net\/npm\/leaflet@1\.9\.4/);
assert.match(carto,/cdnjs.cloudflare.com\/ajax\/libs\/leaflet/);
assert.match(app,/assets\/secure\/f61_map_patch\.js\?v=20261117f72/);
assert(!/L\.map\(/.test(carto),'No duplicate cartographic canvas');
console.log('F71: price index regression, 3 pagination sizes, last page, Leaflet CDN/tile fallback OK.');
