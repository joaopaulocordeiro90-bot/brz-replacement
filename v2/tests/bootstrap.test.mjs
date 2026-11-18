import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
import {BOOTSTRAP_SCHEMA} from "../functions/schema.js";
import {onRequest} from "../functions/api/[[path]].js";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
test("schema auto-inicializável é idêntico à migração D1",()=>{
 const file=readFileSync(resolve(root,"migrations/0001_base.sql"),"utf8").replace(/^PRAGMA foreign_keys = ON;\s*/,"");
 assert.equal(BOOTSTRAP_SCHEMA,file);
 for(const table of ["trades","routes","market_refs","audit_events"])
  assert.match(BOOTSTRAP_SCHEMA,new RegExp("CREATE TABLE IF NOT EXISTS "+table+"\\("));
});
test("inicialização D1 recusa banco ausente",async()=>{
 const res=await onRequest({request:new Request("https://example.invalid/api/bootstrap",{method:"POST"}),env:{}});
 assert.equal(res.status,503);
});
test("inicialização D1 envia SQL COMPLETO ao batch, sem cortar linha por linha",async()=>{
 let captured=null;
 let execWasCalled=false;
 const DB={
  exec:()=>{execWasCalled=true;throw Error("exec não deve ser chamado");},
  prepare:sql=>sql==="SELECT COUNT(*) AS n FROM trades"?{first:async()=>({n:0})}:{sql},
  batch:async statements=>{captured=statements;return statements.map(()=>({success:true}))}
 };
 const res=await onRequest({request:new Request("https://example.invalid/api/bootstrap",{method:"POST"}),env:{DB}});
 assert.equal(res.status,200);
 assert.equal((await res.json()).status,"D1_INICIALIZADO");
 assert.equal(execWasCalled,false);
 assert.equal(captured.length,9);
 const expected=BOOTSTRAP_SCHEMA.split(";").map(x=>x.trim()).filter(Boolean);
 assert.deepEqual(captured.map(x=>x.sql),expected);
 assert.ok(captured.every(x=>/^CREATE (TABLE|INDEX) IF NOT EXISTS/.test(x.sql)));
 assert.ok(captured[0].sql.includes("deleted_at TEXT\n)"));
});
test("falha do D1 não anuncia inicialização como sucesso",async()=>{
 const DB={prepare:sql=>({sql}),batch:async()=>{throw Error("D1 indisponível")}};
 const res=await onRequest({request:new Request("https://example.invalid/api/bootstrap",{method:"POST"}),env:{DB}});
 assert.equal(res.status,500);
 assert.equal((await res.json()).ok,false);
});
