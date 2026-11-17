import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runHydrationStages} from '../assets/secure/f70_hydration_scheduler.mjs';

const f40=readFileSync(new URL('../assets/secure/f40_pin_login.js',import.meta.url),'utf8');
assert.match(f40,/const MAX_HEAVY_READS=1;/);
assert.doesNotMatch(f40,/function readMarketAhead\(/);
assert.doesNotMatch(f40,/function readRoadAhead\(/);
assert.doesNotMatch(f40,/concurrentPages\(/);
assert.doesNotMatch(f40,/eagerMarket\.clear\(/);
assert.doesNotMatch(f40,/Promise\.allSettled\(\[tradeWork/);
assert.match(f40,/runHydrationStages\(/);
assert.match(f40,/const route=\{/,'Secure PostgREST routes still required');
assert.match(f40,/CANONICAL_LEDGER_SHA/,'Preserve complete physical ledger verification');
assert.match(f40,/F41_FROZEN_LEDGER_SHA/,'Preserve trade ledger');

const events=[];let running=0,peak=0;
const stages=Array.from({length:8},(_,i)=>({
 key:'source'+i,label:'Module '+i,run:async()=>{
  events.push('start'+i);running++;peak=Math.max(peak,running);
  await Promise.resolve();running--;events.push('end'+i);
  return {result:i};
 }
}));
const status=[];
const result=await runHydrationStages(stages,{onStage:({key,index,total})=>status.push([key,index,total])});
assert.equal(peak,1,'No concurrent authenticated historical streams');
assert.deepEqual(Object.keys(result),stages.map(s=>s.key));
assert.deepEqual(events,stages.flatMap((s,i)=>['start'+i,'end'+i]));
assert.equal(status.length,8);
assert.equal(status[7][2],8);

let afterFailure=false;
await assert.rejects(()=>runHydrationStages([
 {key:'physical',label:'F40 físico',run:async()=>{throw Error('HTTP 500 57014');}},
 {key:'basis',label:'F44 basis',run:async()=>{afterFailure=true;}}
]),/F40 físico: HTTP 500 57014/);
assert.equal(afterFailure,false,'On failure, no additional source work starts');
await assert.rejects(()=>runHydrationStages(stages,{isAborted:()=>true}),/interrompido/);
await assert.rejects(()=>runHydrationStages([
 {key:'a',label:'A',run:async()=>1},{key:'a',label:'Duplicado',run:async()=>2}
]),/repetida/);
console.log('F70: sem pré-busca concorrente; 8 fontes sequenciais; falha encerra sem tarefas órfãs.');
