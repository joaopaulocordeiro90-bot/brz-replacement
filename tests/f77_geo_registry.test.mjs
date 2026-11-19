import assert from 'node:assert/strict';
import {createGeoRegistry} from '../assets/secure/f77_geo_registry.mjs';
const source=[
 {id:'nf261116_01',origem:'Querência/MT (Fazenda Paraíso +130 km)',corredor:'MT',data:'2026-11-16'},
 {id:'nf261116_02',origem:'Rio Verde/GO +50 km',corredor:'GO Sul'},
 {id:'nf261116_03',origem:'Fazenda desconhecida sem praça',corredor:'MT'}
];
const coords={ 'Querência - MT':[-12.58,-52.2], 'Rio Verde - GO':[-17.79,-50.92],
 'Rio Verde':[-20.2,-45.1] };
const options={trades:source,getCoord:k=>coords[k]||null,
 extractCity:s=>String(s).split(/[\/+(]/)[0],
 regionOf:d=>d.id==='nf261116_01'?'MT Leste':d.corredor};
const index=createGeoRegistry(options);
assert.equal(index.counts.total,3);
assert.equal(index.counts.municipal,2);
assert.equal(index.counts.missing,1);
assert.equal(index.entries.get('nf261116_01').regiao,'MT Leste');
assert.equal(index.entries.get('nf261116_01').geo.precision,'sede_municipal_indicativa');
assert.equal(index.entries.get('nf261116_02').geo.lat,-17.79,
 'UF-specific municipal coordinates must outrank ambiguous city homonyms');
const confirmed=createGeoRegistry({...options,overrides:{
 nf261116_01:{origin:source[0].origem,lat:-12.652,lon:-52.345,
 source:'manual_map_pin',confirmedAt:'2026-11-17T10:00:00Z'},
 nf261116_02:{origin:'Another origin!',lat:-17,lon:-51}
}});
assert.equal(confirmed.counts.confirmed,1);
assert.equal(confirmed.entries.get('nf261116_01').geo.precision,'ponto_confirmado');
assert.equal(confirmed.entries.get('nf261116_02').geo.precision,'sede_municipal_indicativa');
assert.equal(options.trades[0].originGeoOverrides,undefined,'Original immutable trade is never changed');
console.log('F77 GEO: registry 3 cases, UF precision, non-mutating, confirmed manual pin and 1 missing.');
