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
test("inicialização D1 executa somente SQL embarcado e consulta saúde",async()=>{
 let sql=null;
 const DB={
  exec:async x=>{sql=x;return {count:4};},
  prepare:x=>{assert.equal(x,"SELECT COUNT(*) AS n FROM trades");return {first:async()=>({n:0})}}
 };
 const res=await onRequest({request:new Request("https://example.invalid/api/bootstrap",{method:"POST"}),env:{DB}});
 assert.equal(res.status,200);
 assert.equal(sql,BOOTSTRAP_SCHEMA);
 assert.equal((await res.json()).status,"D1_INICIALIZADO");
});
