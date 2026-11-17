import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=JSON.parse(read('MANIFEST_F58_PUBLIC_SHA256.json'));
const special=[];
for(const p of Object.keys(manifest.files)){
 if(!/\.(?:m?js)$/.test(p))continue;
 const s=read(p);
 if(s.includes('location.pathname')&&s.includes('/brz-replacement/'))special.push(p);
}
const preview='/brz-replacement/homolog/f77/';
const approved=new Set(['assets/f40/f40_boot.js','assets/secure/f40_pin_login.js','assets/secure/pin_boot.mjs']);
for(const p of special){
 assert(approved.has(p),'Unexpected F77 hard-coded host/path blocker in '+p);
 assert(read(p).includes(preview),'Preview path missing from '+p);
}
for(const p of approved)assert(special.includes(p),'Expected PIN access module not detected: '+p);
const idx=read('index.html');
assert.match(idx,/id="brz-f77-preview-banner"/);
assert.match(idx,/html\.brz-f77-preview/);
const boot=read('assets/secure/pin_boot.mjs');
assert.match(boot,/__BRZ_VERIFY_FULL_STATIC=fullVerify/);
assert.match(boot,/credentials:'same-origin'/);
assert(manifest.files['assets/data/f77_municipal_indicative.json']);
assert(manifest.files['assets/secure/f77_xlsx_diff.mjs']);
console.log('F77: all root-origin PIN gates recognize preview; complete manifest + visible staging banner validated.');
