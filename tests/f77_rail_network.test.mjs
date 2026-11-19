import assert from 'node:assert/strict';
import {validatedRailPath,INFRA_RAIL_SOURCE} from '../assets/secure/f77_rail_network.mjs';
const line=(...points)=>({type:'Feature',geometry:{type:'LineString',coordinates:points},properties:{}});
assert.match(INFRA_RAIL_SOURCE,/geo\.infrasa\.gov\.br/);
const road=[
 line([-51.9,-17.8],[-51.5,-17.5],[-51.1,-17.2]),
 line([-51.1,-17.2],[-50.9,-16.8])
];
const p=validatedRailPath(road,[-51.9,-17.8],[-50.9,-16.8]);
assert.equal(p.ok,true);
assert.equal(p.coords.length,4);
assert.ok(p.km>100);
const disjoint=validatedRailPath([...road,
 line([-49,-16],[-48.5,-16])],[-51.9,-17.8],[-48.5,-16]);
assert.equal(disjoint.ok,false);
assert.match(disjoint.reason,/não conectados/);
const far=validatedRailPath(road,[-60,-5],[-50.9,-16.8]);
assert.equal(far.ok,false);
assert.match(far.reason,/terminal|porto/);
const invalid=validatedRailPath([{type:'Feature',geometry:{type:'Point',coordinates:[-50,-16]}}],
 [-51.9,-17.8],[-50.9,-16.8]);
assert.equal(invalid.ok,false);
console.log('F77 RAIL: connected official geometry only; reject disjoint and unverified terminal access.');
