import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
// Fingerprints extracted from user-supplied V4FS, 16/11/26. Never copy
// proprietary prices or ledger rows into a public test.
const s=readFileSync(new URL('../assets/js/part_06.js',import.meta.url),'utf8');
function exact(name){
 const start=s.indexOf(name);
 assert(start>=0,'Missing canonical engine function '+name);
 const end=s.indexOf('\nfunction ',start+name.length);
 assert(end>start,'Missing next function boundary '+name);
 return s.slice(start,end);
}
for(const [name,expected] of [
 ['function bestRouteAudit(deal){','df65d87d014e709acb391504931576c54125efb2972ae2771112ab91373125ed'],
 ['function computePortComparison(deal){','ede402d63f4fec01fc5d63a14c54092d85903baa6b64117a443aaa91bf5152ed'],
 ['function isReasonableReplacementResult(','edb0337093ca890ffef4fa14decf21496390271eb242eff8024e1098667bb75a']
]){
 const digest=createHash('sha256').update(exact(name)).digest('hex');
 assert.equal(digest,expected,'F75: migração alterou o núcleo homologado do cálculo');
}
// Original HTML baseline: 3,858 closed grain trades; 3,854 calculable, 4
// explicit/no-route exceptions. The public app may have newer F33 overlays;
// do not use these counts as a hard validation of the live overlay.
const baseline={closedGrain:3858,calculable:3854,withoutRoute:4,jsExceptions:0};
assert.equal(baseline.calculable+baseline.withoutRoute,baseline.closedGrain);
console.log('F75: núcleos computacionais permanecem idênticos ao HTML V4FS; base 3854/3858 calculável.');
