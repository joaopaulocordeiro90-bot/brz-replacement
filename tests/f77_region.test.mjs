import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const engine=readFileSync(new URL('../assets/js/part_06.js',import.meta.url),'utf8');
const start=engine.indexOf('/* F77: geographical-origin region');
const end=engine.indexOf('function brzDeskRailModal(d,modal){',start);
assert(start>0&&end>start,'canonical F77 origin region functions available');
const sandbox={
 PRACA_TO_CORREDOR:{'Querência':'MT Leste','Canarana':'MT Leste','Jataí':'GO Sul',
  'Montividiu':'GO Sul','São Francisco do Sul':'FAS SFS','Rio Grande':'FAS Rio Grande'},
 extractCidadeBase:origin=>String(origin).split(/[+(/]/)[0].split(' - ')[0].trim()
};
vm.createContext(sandbox);vm.runInContext(engine.slice(start,end),sandbox);
function region(origem,corredor){return sandbox.brzF77OriginRegion({origem,corredor});}
assert.equal(region('Querência/MT (Fazenda Paraíso +130km)','MT'),'MT Leste');
assert.equal(region('Canarana/MT (Fazenda +125km)','MT'),'MT Leste');
assert.equal(region('Jataí - GO +60 km','GO Sudoeste'),'GO Sudoeste','preserve precise commercial corridor');
assert.equal(region('São Francisco do Sul/SC (CIF)','MG'),'FAS SFS','never present wrong state as origin');
assert.equal(region('Município desconhecido/TO','TO'),'TO · região a validar');
const full=sandbox.brzDeskRegionLabel({origem:'Querência/MT (Fazenda)',corredor:'MT'});
assert.match(full,/Querência\/MT · MT Leste/);
assert.match(engine,/\$\{brzF77OriginRegion\(d\)\}/);
console.log('F77 region: generic/invalid UF normalized by city; original commercial corridor remains untouched.');
