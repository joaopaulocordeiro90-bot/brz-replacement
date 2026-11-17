import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {filterDeals,tradePlace,pageDeals} from '../homolog/f77/assets/secure/f77_deals_filters.mjs';
import {contractedPort,buildRegionalFlowReport} from '../homolog/f77/assets/secure/f77_regional_flows.mjs';
import {summarizeClose} from '../homolog/f77/assets/secure/f77_daily_close.mjs';
import {createGeoRegistry} from '../homolog/f77/assets/secure/f77_geo_registry.mjs';
import {validatedRailPath} from '../homolog/f77/assets/secure/f77_rail_network.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'homolog/f77');
const r=file=>readFileSync(path.join(folder,file),'utf8');

test('F77: PIN direto sem tela Mercado diário e arquivos assinados',()=>{
 const index=r('index.html'),pin=r('assets/secure/f40_pin_login.js'),app=r('app.html');
 assert.match(index,/F77 HOMOLOGAÇÃO/);
 assert.match(pin,/__BRZ_VERIFY_FULL_STATIC/);
 assert.match(pin,/full verified replacement engine/);
 assert.match(app,/id="brz-f77-build"/);
 assert.match(index,/pin_boot\.mjs\?v=20261117qa01/);
 assert.match(r('assets/secure/pin_boot.mjs'),/f40_pin_login\.js\?v=20261117qa01/);
 assert.match(pin,/pin_autosave\.js\?v=20261117qa01/);
 assert.match(pin,/app\.html\?v=F77_HOMOLOG_20261117C/);
 const m=JSON.parse(r('MANIFEST_F58_PUBLIC_SHA256.json'));
 assert.ok(Object.keys(m.files).length>100);
 for(const [name,record] of Object.entries(m.files)){
  const file=path.join(folder,name);
  assert.ok(existsSync(file),'F77 sem arquivo do manifesto: '+name);
  const bytes=readFileSync(file);
  assert.equal(bytes.length,record.bytes,'tamanho divergente '+name);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256,'SHA divergente '+name);
 }
 assert.ok(m.files['assets/secure/f77_deals_filters.mjs']);
});

test('Negócios: dia, período, UF, cidade, paginação sem modificar fonte',()=>{
 const trades=[
  {id:'a',data:'2026-11-17',origem:'FOB - Jataí/GO',volume:1200,produto:'Soja'},
  {id:'b',data:'2026-11-16',origem:'FOB - Sorriso/MT',volume:900,produto:'Milho'},
  {id:'c',data:'2026-10-30',origem:'Não identificada',volume:150,produto:'Sorgo'}
 ];
 const before=JSON.stringify(trades);
 assert.deepEqual(filterDeals(trades,{day:'2026-11-17'}).map(x=>x.id),['a']);
 assert.deepEqual(filterDeals(trades,{from:'2026-11-01',to:'2026-11-17'}).map(x=>x.id),['a','b']);
 assert.deepEqual(filterDeals(trades,{uf:'MT',city:'sorri'}).map(x=>x.id),['b']);
 assert.equal(filterDeals(trades,{uf:'GO',city:'Sorriso'}).length,0);
 assert.equal(filterDeals(trades,{from:'2026-11-18',to:'2026-11-01'}).length,0);
 assert.deepEqual(tradePlace(trades[2]),{city:'',uf:''});
 assert.equal(pageDeals(trades,1,2).rows[0].id,'c');
 assert.equal(JSON.stringify(trades),before);
});

test('Fluxos: somente porto explicitamente contratado entra em observado',()=>{
 const trades=[{status:'FECHADO AGRINVEST COMMODITIES',produto:'Soja',corredor:'GO',
    volume:1200,portoContratado:'Santos',portoContratadoConfirmado:true},
  {status:'FECHADO',produto:'Milho',corredor:'GO',volume:900,comprador:'Santos'}];
 assert.equal(contractedPort(trades[0]),'Santos');
 assert.equal(contractedPort(trades[1]),null);
 const data=buildRegionalFlowReport(trades,()=>[{porto:'Santos'}]);
 assert.equal(data.observed,1);assert.equal(data.missing,1);
 assert.equal(data.volumeObserved,1200);
 assert.equal(data.ports.find(x=>x.port==='Santos').potentialDeals,2);
});

test('Fechamento: falta de frete, auditoria, CBOT e Excel impedem aprovação',()=>{
 const date='2026-11-17';
 const payload={date,trades:[{id:'a',data:date,status:'FECHADO',produto:'Soja',volume:1200,
  origem:'Jataí/GO',retirada:'01/02/2027'}],
  cbotDate:date,fxDate:date,excelDate:date,excelAudit:{ok:true},
  freights:[{semana:'2026-S47'}],
  geo:{entries:new Map([['a',{geo:{lat:-17.8,lon:-51.7}}]])},
  tradeAudits:{checked:true,failed:0}};
 assert.equal(summarizeClose(payload).ready,true);
 assert.equal(summarizeClose({...payload,freights:[]}).ready,false);
 assert.equal(summarizeClose({...payload,tradeAudits:{checked:false,failed:0}}).ready,false);
 assert.equal(summarizeClose({...payload,cbotDate:'2026-11-16'}).ready,false);
 assert.equal(summarizeClose({...payload,excelAudit:null}).ready,false);
});

test('Coordenadas municipais não são pontos de fazenda confirmados',()=>{
 const trades=[{id:'a',origem:'Jataí/GO',corredor:'GO'}];
 const out=createGeoRegistry({trades,getCoord:()=>[-17.9,-51.7],extractCity:()=> 'Jataí'});
 assert.equal(out.counts.municipal,1);
 assert.equal(out.counts.confirmed,0);
 assert.equal(out.entries.get('a').geo.precision,'sede_municipal_indicativa');
});

test('Ferrovia: somente topologia conectada pode ser validada',()=>{
 const source=[{geometry:{type:'LineString',coordinates:[[-50,-15],[-49.99,-15],[-49.98,-15]]}}];
 assert.equal(validatedRailPath(source,[-50,-15],[-49.98,-15]).ok,true);
 assert.equal(validatedRailPath([],[-50,-15],[-49.98,-15]).ok,false);
});

test('F77: módulos integrados e nenhum marcador de envio automático na consulta',()=>{
 const b=r('assets/secure/pin_autosave.js');
 assert.match(b,/installDealsFilters/);
 assert.match(b,/initDailyExcelUpload/);
 assert.match(b,/initDailyClosing/);
 assert.match(b,/initGeoRegistry/);
 const f=r('assets/secure/f77_deals_filters.mjs');
 assert.doesNotMatch(f,/brz_pin_module_save|fetch\(|localStorage|state\.negocios\s*=/);
 assert.ok(r('assets/secure/f77_xlsx_upload.mjs').includes('rollbackUpload'));
});
