import assert from 'node:assert/strict';
import {summarizeClose} from '../assets/secure/f77_daily_close.mjs';
const input={date:'2026-11-16',trades:[
 {id:'nf261116_01',data:'2026-11-16',produto:'Soja',volume:1200,status:'FECHADO',origem:'Querência/MT',retirada:'01/12/2026'},
 {id:'nf261116_02',data:'2026-11-16',produto:'Milho',volume:500,status:'PEDIDO',origem:'',retirada:''},
 {id:'nf261113_01',data:'2026-11-13',produto:'Soja',volume:900,status:'FECHADO',origem:'Jataí/GO'}
 ],cbotDate:'2026-11-16',fxDate:'2026-11-16',excelDate:'2026-11-16',
 excelAudit:{ok:true,errors:[]},freights:[{iso_week:'2026-S45'},{iso_week:'2026-S46'}],
 geo:{entries:new Map([['nf261116_01',{geo:{lat:-12.5,lon:-52.1}}]])}};
const a=summarizeClose(input);
assert.equal(a.records,2);
assert.equal(a.closed,1);
assert.equal(a.volume,1700);
assert.equal(a.missingOrigin,1);
assert.equal(a.missingCoords,1);
assert.equal(a.freightWeek,'2026-S46');
assert.equal(a.ready,false);
assert.ok(a.warnings.some(x=>x.includes('Replacement/TCO')));
const b=summarizeClose({...input,tradeAudits:{checked:true,failed:0},
 trades:[input.trades[0]],geo:null});
assert.equal(b.ready,true);
const c=summarizeClose({...input,fxDate:'2026-11-15',tradeAudits:{checked:true,failed:0},
 trades:[input.trades[0]],geo:null});
assert.equal(c.ready,false);
assert.ok(c.warnings.some(x=>x.includes('Dólar')));
console.log('F77 closing: date totals, missing location, current week and financial audit gating OK.');
