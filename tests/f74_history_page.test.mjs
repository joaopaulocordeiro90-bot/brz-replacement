import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 DOMAINS,PAGE_SIZES,checkHistoryRequest,checkHistoryRows,
 historyDisplay,fetchHistoryPage
} from '../assets/secure/f74_history_pager.mjs';
assert.deepEqual(PAGE_SIZES,[10,25,50]);
assert.equal(Object.keys(DOMAINS).length,5);
const req=checkHistoryRequest({domain:'physical',from:'2026-11-01',to:'2026-11-16',after:42,limit:25});
assert.deepEqual(req,{p_domain:'physical',p_from_date:'2026-11-01',p_to_date:'2026-11-16',p_after_row_no:42,p_limit:25});
for(const p of [
 {domain:'physical',from:'2026-11-20',to:'2026-11-10',after:0,limit:25},
 {domain:'unknown',from:'2026-11-01',to:'2026-11-16',after:0,limit:25},
 {domain:'physical',from:'2024-11-01',to:'2026-11-16',after:0,limit:25},
 {domain:'physical',from:'2026-11-01',to:'2026-11-16',after:-1,limit:25},
 {domain:'physical',from:'2026-11-01',to:'2026-11-16',after:0,limit:1000}
])assert.throws(()=>checkHistoryRequest(p),/F74/);
const rows=[{row_no:11,domain:'physical',record_json:{record_text:JSON.stringify({produto:'Soja',origem:'Canarana/MT',preco:132.5,embarque:'Feb-27'})},market_date:'2026-11-13',source_key:'a'},
 {row_no:19,domain:'physical',record_json:{record_text:JSON.stringify({produto:'Milho',origem:'Jataí/GO',preco:55.2})},market_date:'2026-11-13',source_key:'b'}];
const ok=checkHistoryRows(rows,0,'physical',25);
assert.equal(ok.rows.length,2);assert.equal(ok.nextCursor,19);assert.equal(ok.hasMore,false);
assert.equal(historyDisplay(rows[0]).product,'Soja');
assert.equal(historyDisplay(rows[1]).price,'55,2');
assert.throws(()=>checkHistoryRows([rows[1],rows[0]],0,'physical',25),/cursor/);
assert.throws(()=>checkHistoryRows([rows[0],rows[0]],0,'physical',25),/cursor/);
assert.throws(()=>checkHistoryRows([...rows],15,'physical',25),/cursor/);
assert.throws(()=>checkHistoryRows([{...rows[0],domain:'ocean'}],0,'physical',25),/cursor/);
const b=historyDisplay({domain:'basis_points',record_json:{day:20261113,legacy_key:'Soybean|Santos|F|03-2027|bid',value:-18}});
assert.equal(b.price,'-18');assert.equal(b.unit,'¢/bu');
const d=historyDisplay({domain:'derivatives',record_json:{day:'2026-11-13',product:'Soymeal',location_text:'Paranaguá',values_json:[2450]}});
assert.equal(d.product,'Farelo');assert.equal(d.unit,'R$/t');
let called=0,callPath='';
const request=async(path,opt)=>{
 called++;callPath=path;
 assert.equal(opt.method,'POST');
 assert.equal(opt.body.p_limit,25);
 assert.equal(opt.token,'x'.repeat(44));
 return rows;
};
const fetched=await fetchHistoryPage({request,token:'x'.repeat(44),domain:'physical',from:'2026-11-01',to:'2026-11-16'});
assert.equal(fetched.rows.length,2);assert.equal(called,1);
assert.equal(callPath,'/rest/v1/rpc/brz_api_f74_history_page');
await assert.rejects(()=>fetchHistoryPage({request,token:'short',domain:'physical',from:'2026-11-01',to:'2026-11-16'}),/sessão/);
const login=readFileSync(new URL('../assets/secure/f40_pin_login.js',import.meta.url),'utf8');
const idx=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const boot=readFileSync(new URL('../assets/secure/pin_boot.mjs',import.meta.url),'utf8');
const sql=readFileSync(new URL('../migrations/20261116_f74_history_window_pages.sql',import.meta.url),'utf8');
assert.doesNotMatch(login,/installHistoryPanel\(\{root:container,request,token,asOf:preview\.date\}\)/);
assert.doesNotMatch(idx,/id="brz-f74-history"/);
assert.doesNotMatch(boot,/assets\/secure\/f74_history_pager\.mjs/);
assert.match(sql,/SECURITY INVOKER/);
assert.match(sql,/auth\.uid\(\)/);
assert.match(sql,/brz\.papel\(\)/);
assert.match(sql,/REVOKE ALL ON FUNCTION.*brz_api_f74_history_page/s);
assert.match(sql,/p_limit NOT IN \(10,25,50\)/);
assert.match(sql,/CREATE INDEX IF NOT EXISTS f74_market_domain_day_cursor_idx/);
assert.match(sql,/WITH dated AS MATERIALIZED/);
console.log('F74: 5 domains, cursor pager preserved but removed from F77 initial boot.');
