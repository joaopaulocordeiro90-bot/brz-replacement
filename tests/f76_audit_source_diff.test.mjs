import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 auditReason,runReplacementAudit,compareFrozenSource,exportAuditCsv
} from '../assets/secure/f73_replacement_audit.mjs';
const base={
 id:'example-closed-grain',status:'FECHADO',produto:'Milho',origem:'MT',
 corredor:'MT Noroeste',volume:480,data:'2026-10-20',preco:54,
 embarque:'Nov-26',vencCBOT:'Z26',cbot:462,vencCambio:'DOLZ26',cambio:5.064
};
const original=Object.freeze({...base});
const flagged=Object.freeze({...base,replacementPendente:true});
assert.equal(compareFrozenSource(flagged,original).type,'divergencia_snapshot');
assert.equal(compareFrozenSource(base,original),null);
assert.equal(compareFrozenSource({...base,replacementPendente:false},{...base,replacementPendente:true}),null,
 'Approved removal of a pending flag must not become a false positive');
assert.equal(compareFrozenSource(base,{...base,id:'other'}),null);
const activeOriginal=Object.freeze({...base,id:'confirmed-base',replacementPendente:true});
const currentConfirmed=Object.freeze({...activeOriginal});
const newer=Object.freeze({...base,id:'later-deal',produto:'Sorgo',replacementPendente:true});
const resolved=Object.freeze({...base,id:'ok-new'});
let calculations=0;
const summary=await runReplacementAudit({
 deals:[flagged,currentConfirmed,newer,resolved],
 baselineDeals:[original,activeOriginal],
 chunk:2,
 calculate:()=>{
   calculations++;
   return {bestPort:'Santos',portosComparados:[{porto:'Santos'}]};
 }
});
assert.equal(calculations,1,'Do not bypass explicit current pending status for pricing');
assert.equal(summary.computed,1);
assert.equal(summary.issues.length,3);
assert.equal(summary.sourceDiffs,1);
assert.equal(summary.issues[0].type,'divergencia_snapshot');
assert.match(summary.issues[0].details,/ausente do histórico F41/);
assert.equal(summary.issues[1].type,'pendencia_comercial');
assert.equal(summary.issues[2].type,'pendencia_comercial');
assert.match(summary.issues[2].details,/posterior ao F41/);
assert.equal(summary.frozenCompared,2);
assert.equal(flagged.replacementPendente,true,'Audit never alters business records');
const csv=exportAuditCsv(summary);
assert.match(csv,/divergencia_snapshot/);
assert.match(csv,/pendencia_comercial/);
assert.equal(csv.trim().split('\r\n').length,5,
 'Excel delimiter row + header + three issues');
await assert.rejects(()=>runReplacementAudit({
 deals:[base],baselineDeals:[original,original],calculate:()=>({})
}),/duplicado/);
const wired=readFileSync(new URL('../assets/secure/f73_replacement_audit.mjs',import.meta.url),'utf8');
assert.match(wired,/parent\.__BRZF41_TRADES_READY===true/);
assert.match(wired,/parent\.__BRZF41_TRADES/);
assert.doesNotMatch(wired,/persist\(/);
console.log('F76: F41 baseline vs live overlay, 3 categories, source divergence, no mutation and CSV passed.');
