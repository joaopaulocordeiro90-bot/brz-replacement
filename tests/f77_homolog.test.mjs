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
import {parseInternalFreight,compareInternalFreight} from '../homolog/f77/assets/secure/f77_internal_freight.mjs';
import {parseOfficialRoadFreight} from '../homolog/f77/assets/secure/f77_internal_freight.mjs';
import {buildDailyPack} from '../homolog/f77/assets/secure/f77_xlsx_upload.mjs';
import {compareDailyXlsx} from '../homolog/f77/assets/secure/f77_xlsx_diff.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'homolog/f77');
const r=file=>readFileSync(path.join(folder,file),'utf8');

test('F77: PIN direto sem tela Mercado diário e arquivos assinados',()=>{
 const index=r('index.html'),pin=r('assets/secure/f40_pin_login.js'),app=r('app.html');
 assert.match(index,/F77 HOMOLOGAÇÃO/);
 assert.match(pin,/__BRZ_VERIFY_FULL_STATIC/);
 assert.match(pin,/full verified replacement engine/);
 assert.match(app,/id="brz-f77-build"/);
 assert.match(index,/pin_boot\.mjs\?v=20261117hist01/);
 assert.match(r('assets/secure/pin_boot.mjs'),/f40_pin_login\.js\?v=20261117hist01/);
 assert.match(pin,/pin_autosave\.js\?v=20261117hist01/);
 assert.match(pin,/app\.html\?v=F77_HOMOLOG_20261117F/);
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

test('Frete interno: 5o campo, leitura separada e nenhuma mutacao de referencia',()=>{
 const input=[['Modal','Origem','Destino','Semana','Frete R$/t'],
  ['Rodoviário','Jataí/GO','Santos','2026-S47','215,50'],
  ['Ferroviário','Rondonópolis/MT','Santos','Nov-26',195]];
 const parsed=parseInternalFreight(input,{sheetName:'Frete interno'});
 assert.deepEqual(parsed.errors,[]);
 assert.equal(parsed.counts.rodoviario,1);
 assert.equal(parsed.counts.ferroviario,1);
 const base={road:[{tipo:'Rodoviário',origem:'Jataí/GO',destino:'Santos',semana:'2026-S46',valor:210}],
  rail:[{origem:'Rondonópolis/MT',destino:'Santos',meses:{Nov:193}}]};
 const snapshot=JSON.stringify(base);
 const diff=compareInternalFreight(parsed.records,base);
 assert.equal(diff.counts.total,2);
 assert.equal(diff.counts.comparado,1);
 assert.equal(diff.counts.alterado,1);
 assert.equal(diff.counts.sem_referencia,1);
 assert.equal(diff.counts.ferro_sem_ano,1);
 assert.equal(diff.changes[0].delta,5.5);
 assert.equal(diff.changes[1].anterior,null);
 assert.equal(JSON.stringify(base),snapshot);
});

test('Frete interno: bloqueia duplicidades, periodo invalido e preco ausente',()=>{
 const x=[['Modal','Origem','Destino','Período','Valor'],
 ['Rodoviário','Sorriso/MT','Santos','2026-S47',200],
 ['Rodoviário','Sorriso/MT','Santos','2026-S47',200],
 ['Ferroviário','Rondonópolis/MT','Santos','Nov-26',''],
 ['Rodoviário','Sorriso','Santos','2026-S47',190]];
 const out=parseInternalFreight(x,{sheetName:'Frete interno'});
 assert.equal(out.records.length,1);
 assert.ok(out.errors.some(x=>x.includes('duplicado')));
 assert.ok(out.errors.some(x=>x.includes('inválido')));
 assert.ok(out.errors.some(x=>x.includes('UF explícita')));
 const ui=r('assets/secure/f77_xlsx_upload.mjs');
 assert.match(ui,/5 · Frete interno/);
 assert.match(ui,/brz-f77-internal-file/);
 assert.match(ui,/brz-f77-internal-sheet/);
 assert.match(ui,/nenhuma cotação de frete interno será publicada/);
});

test('Arquivo real: schema oficial de cinco abas normaliza as quatro fontes diárias',()=>{
 const asOf='2026-11-16';
 const book={officialDaily:true,asOf,
  dateBySheet:{prices:asOf,'Basis FOB':asOf,'Derivados CMA':asOf,'frete maritimo':asOf,'frete rodoviario':'2026-11-08'},
  file_sha256:'a'.repeat(64),source_file:'Dados para João Cordeiro Atualizado.xlsx',
  sheets:{
   prices:[['Date','Commodity','City','Player','Price (BRL/ton)','Shipment'],
    ['46342','Soybean','Jataí - GO','Bid','132','Feb-27'],
    ['46342','Soybean','Jataí - GO','Offer','134','Feb-27']],
   'Basis FOB':[['reference_date','porto','commodity','code','type','shipment','shipment2','player','basis'],
    ['46342','Paranaguá','Soymeal','BSM-JK27','F','04|05-2027','','offer','-11']],
   'Derivados CMA':[['dt_date','city_st','value','commodity'],
    ['46342','Uberlândia - MG','0','Soymeal']],
   'frete maritimo':[['DATE(a.created_at)','route','shipment','value'],
    ['46342','[ECSA] Santos>N.CN SOYB','2026-12-01','36']],
   'frete rodoviario':[['created_at','name','value'],
    ['46334','Jataí - Goiás -> São Simão - São Paulo','79']]
  }};
 const map={prices:'prices','Basis FOB':'Basis FOB','Derivados CMA':'Derivados CMA',
  'frete maritimo':'frete maritimo'};
 const built=buildDailyPack(book,asOf,map);
 assert.deepEqual(built.errors,[]);
 assert.deepEqual(built.counts,{prices:2,'Basis FOB':1,'Derivados CMA':1,'frete maritimo':1});
 assert.deepEqual(built.pack.records.prices[asOf][0],['Soybean','Jataí - GO','Bid',132,'Feb-27']);
 assert.deepEqual(built.pack.records['Basis FOB'][asOf][0],
  ['Paranaguá','Soymeal','BSM-JK27','F','04|05-2027','','offer',-11]);
 assert.equal(built.pack.records['Derivados CMA'][asOf][0][1],0);
 assert.equal(buildDailyPack(book,'2026-11-17',map).errors.length>0,true);
});
test('Frete original created_at/name/value: semana seguinte ao domingo, 514 linhas preserváveis',()=>{
 const rows=[['created_at','name','value'],
  ['46334','Jataí - Goiás -> São Simão - São Paulo',79],
  ['46334','Campo Grande - Mato Grosso do Sul -> Santos - São Paulo',360]];
 const parsed=parseOfficialRoadFreight(rows);
 assert.deepEqual(parsed.errors,[]);
 assert.equal(parsed.counts.total,2);
 assert.equal(parsed.sourceDate,'2026-11-08');
 assert.equal(parsed.sourceWeek,'2026-S46');
 assert.equal(parsed.records[0].origem,'Jataí/GO');
 assert.equal(parsed.records[0].destino,'São Simão/SP');
 assert.equal(parsed.records[1].origem,'Campo Grande/MS');
});
test('Leitura historica incremental requerida e sem dados privados no repositorio',()=>{
 const code=r('assets/secure/f77_official_daily_xlsx.mjs');
 assert.match(code,/MAX_TOTAL=460/);
 assert.match(code,/parseOfficialDailyXlsx/);
 assert.match(code,/read!==entry.expanded/);
 assert.match(code,/rows\.length>50000/);
 assert.match(r('assets/secure/f77_xlsx_upload.mjs'),/officialDaily/);
 assert.match(r('assets/secure/f77_xlsx_upload.mjs'),/f77_official_daily_xlsx\.mjs/);
});

test('F77 diff: dados do proprio dia nao podem mascarar variacao anterior',()=>{
 const asOf='2026-11-16',key='Soybean|Santos|F|02-2027|bid';
 const projected={as_of:asOf,sourceSha:'a'.repeat(64),
  physical:[{produto:'Soja',origem:'Jataí - GO',janelaFisica:'Feb-27',bid:136,offer:138}],
  basis:[{key,value:120}],
  derivatives:[{d:asOf,o:'Jataí - GO',p:'Soyoil',v:[6200]}],
  ocean:[{day:asOf,route:'Santos>China',shipment:'2027-02-01',value:37}]};
 const reference={
  physicalHistory:[
   {data:'2026-11-13',produto:'Soja',origem:'Jataí - GO',janelaFisica:'Feb-27',bid:130,offer:132},
   {data:asOf,produto:'Soja',origem:'Jataí - GO',janelaFisica:'Feb-27',bid:136,offer:138}],
  basisHistory:{series:{[key]:[[20261113,110],[20261116,120]]}},
  derivativeHistory:[
   {d:'2026-11-13',o:'Jataí - GO',p:'Soyoil',v:[6000]},
   {d:asOf,o:'Jataí - GO',p:'Soyoil',v:[6200]}],
  oceanHistory:{
   '2026-11-13':[['Santos>China','2027-02-01',32]],
   [asOf]:[['Santos>China','2027-02-01',37]]}};
 const result=compareDailyXlsx(projected,reference);
 assert.equal(result.comparisonRule,'strictly_previous_date');
 assert.equal(result.counts.total,4);
 assert.equal(result.counts.alterado,4);
 assert.equal(result.counts.sem_alteracao,0);
 assert.ok(result.changes.every(x=>String(x.oldDate).replaceAll('-','')<'20261116'));
 assert.equal(result.changes[0].bidDelta,6);
 assert.equal(result.changes[1].delta,10);
 assert.equal(result.changes[2].delta,200);
 assert.equal(result.changes[3].delta,5);
});

test('F77 diff: sem historico anterior vira N/D e nunca autocomparacao',()=>{
 const day='2026-11-16';
 const projected={as_of:day,physical:[{produto:'Soja',origem:'Jataí - GO',janelaFisica:'Feb-27',bid:136,offer:138}],basis:[],derivatives:[],ocean:[]};
 const got=compareDailyXlsx(projected,{physicalHistory:[{data:day,produto:'Soja',origem:'Jataí - GO',janelaFisica:'Feb-27',bid:136,offer:138}]});
 assert.equal(got.counts.sem_referencia,1);
 assert.equal(got.counts.comparado,0);
 assert.equal(got.changes[0].oldDate,null);
 assert.equal(got.changes[0].bidDelta,null);
});

test('F77 frete interno: comparar ultima semana do MESMO XLSX',()=>{
 const records=[
  {modal:'Rodoviário',origem:'Jataí/GO',destino:'São Simão/SP',periodo:'2026-S46',valor:79},
  {modal:'Rodoviário',origem:'Redenção/PA',destino:'Santos/SP',periodo:'2026-S46',valor:490},
 ];
 const previousRoad=[
  {modal:'Rodoviário',origem:'Jataí/GO',destino:'São Simão/SP',periodo:'2026-S45',valor:75},
  {modal:'Rodoviário',origem:'Redenção/PA',destino:'Santos/SP',periodo:'2026-S45',valor:490}];
 const result=compareInternalFreight(records,{previousRoad,road:[
  {tipo:'Rodoviário',origem:'Jataí/GO',destino:'São Simão/SP',semana:'2026-S46',valor:79}
 ]});
 assert.equal(result.counts.total,2);
 assert.equal(result.counts.comparado,2);
 assert.equal(result.counts.alterado,1);
 assert.equal(result.counts.sem_alteracao,1);
 assert.equal(result.counts.sem_referencia,0);
 assert.equal(result.changes[0].anteriorPeriodo,'2026-S45');
 assert.equal(result.changes[0].delta,4);
 assert.equal(result.changes[0].referencia,'xlsx_semana_anterior');
 assert.equal(result.changes[1].delta,0);
 assert.match(r('assets/secure/f77_official_daily_xlsx.mjs'),/previousSheets/);
});
