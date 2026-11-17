import assert from 'node:assert/strict';
import {exportAuditCsv,auditReason} from '../assets/secure/f73_replacement_audit.mjs';
const issues=Array.from({length:149},(_,i)=>({
 id:'nf261116_'+String(i+1).padStart(3,'0'),date:'2026-11-16',
 product:i%2?'Milho':'Soja',
 type:i%3===0?'erro_motor':'sem_rota_calculavel',
 details:'CBOT não disponível; basis da janela sem referência'
}));
issues[0].id='=HYPERLINK("https://example.invalid","attack")';
const report={issues,total:4011,considered:3850,computed:3701,skipped:161};
const csv=exportAuditCsv(report);
assert.match(csv,/^\uFEFFsep=;/);
const lines=csv.trim().split('\r\n');
assert.equal(lines.length,151,'one Excel separator, one header and ALL 149 cases');
assert.match(lines[1],/"ID";"Data";"Produto";"Categoria";"Motivo"/);
assert.match(lines[2],/^"'=HYPERLINK/,'Spreadsheet formula prefix sanitized');
assert(csv.includes('"nf261116_149"'),'Last pending case not silently truncated');
const flagged=auditReason({id:'id',produto:'Soja',origem:'GO',corredor:'GO',embarque:'Feb-27',
 preco:120,cbot:1230,vencCBOT:'H27',cambio:null,vencCambio:null},null,null);
assert.equal(flagged.type,'referencia_incompleta');
assert(flagged.details.some(x=>x.includes('Câmbio')));
assert.throws(()=>exportAuditCsv({}),/diagnóstico ausente/);
console.log('F74: exportação privada de 149 IDs completos, CRLF, sem fórmulas executáveis e sem correções fictícias.');
