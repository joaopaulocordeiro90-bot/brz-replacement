import {BOOTSTRAP_SCHEMA} from "../schema.js";
const SCHEMAS={
 trades:{table:"trades",required:["trade_date","product","volume_t","origin_name","city","uf"],fields:["trade_date","product","crop_year","seller","buyer","volume_t","price_brl_sc","delivery_basis","origin_name","city","uf","lat","lng","geo_precision","window_start","window_end","payment_date","due","fethab","status","notes"]},
 routes:{table:"routes",required:["origin_city","origin_uf","destination_port","modal","freight_brl_t","source"],fields:["origin_city","origin_uf","destination_port","terminal","modal","freight_brl_t","distance_km","freight_status","source","valid_from","valid_to"]},
 market:{table:"market_refs",required:["product","port","ship_month","reference_date","cbot_contract","source"],fields:["product","port","ship_month","reference_date","cbot_contract","cbot_cbu","fx_brl_usd","fob_basis_cbu","fobbins_usd_t","ocean_usd_t","side","source"]}
};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":"*"}});
const failure=(message,status)=>json({ok:false,error:message},status);
function validate(name,src){
 const cfg=SCHEMAS[name];
 if(!src||typeof src!=="object"||Array.isArray(src))throw Error("Dados inválidos");
 const item={};
 for(const f of cfg.fields){if(Object.prototype.hasOwnProperty.call(src,f))item[f]=src[f]=== "" ? null:src[f];}
 for(const f of cfg.required)if(item[f]===null||item[f]===undefined||String(item[f]).trim()==="")throw Error("Campo obrigatório: "+f);
 const numfields=["volume_t","price_brl_sc","lat","lng","freight_brl_t","distance_km","cbot_cbu","fx_brl_usd","fob_basis_cbu","fobbins_usd_t","ocean_usd_t"];
 for(const f of numfields)if(item[f]!==undefined&&item[f]!==null){const n=Number(item[f]);if(!Number.isFinite(n))throw Error("Número inválido: "+f);item[f]=n;}
 if(name==="trades"){if(!["Soja","Milho","Sorgo","Farelo","Óleo"].includes(item.product))throw Error("Produto inválido");if(!(item.volume_t>0))throw Error("Volume inválido");if(item.price_brl_sc!=null&&item.price_brl_sc<=0)throw Error("Preço inválido");if(!/^\d{4}-\d{2}-\d{2}$/.test(item.trade_date))throw Error("Data inválida");if(item.lat!=null&&!(item.lat>=-35&&item.lat<=6))throw Error("Latitude fora do Brasil");if(item.lng!=null&&!(item.lng>=-75&&item.lng<=-32))throw Error("Longitude fora do Brasil");if((item.lat==null)!=(item.lng==null))throw Error("Coordenadas incompletas");}
 if(name==="routes"&&!(item.freight_brl_t>=0))throw Error("Frete inválido");
 if(name==="market"&&(!/^\d{4}-\d{2}$/.test(item.ship_month)||!/^\d{4}-\d{2}-\d{2}$/.test(item.reference_date)))throw Error("Competência inválida");
 if(name==="market"&&item.cbot_cbu!=null&&(item.cbot_cbu<100||item.cbot_cbu>4000))throw Error("CBOT inválida: informe em c/bu, por exemplo 1100 (equivalente a US$ 11/bu).");
 return item;
}
async function audit(DB,entity,id,operation,before,after){
 await DB.prepare("INSERT INTO audit_events(id,entity,entity_id,operation,before_json,after_json) VALUES(?,?,?,?,?,?)")
  .bind(crypto.randomUUID(),entity,id,operation,before?JSON.stringify(before):null,after?JSON.stringify(after):null).run();
}
async function list(DB,name,url){
 const cfg=SCHEMAS[name], limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit"))||30));
 const offset=Math.max(0,Number(url.searchParams.get("offset"))||0);
 const clauses=["deleted_at IS NULL"], args=[];
 if(name==="trades"){
  const product=url.searchParams.get("product");
  if(product){clauses.push("product=?");args.push(product);}
  const search=url.searchParams.get("search");
  if(search){clauses.push("(origin_name LIKE ? OR seller LIKE ? OR buyer LIKE ? OR city LIKE ?)");for(let i=0;i<4;i++)args.push("%"+search.slice(0,80)+"%");}
 }
 const where=clauses.join(" AND "),order=name==="trades"?"trade_date DESC,created_at DESC":"updated_at DESC";
 const rows=await DB.prepare("SELECT * FROM "+cfg.table+" WHERE "+where+" ORDER BY "+order+" LIMIT ? OFFSET ?").bind(...args,limit,offset).all();
 const cnt=await DB.prepare("SELECT COUNT(*) AS n FROM "+cfg.table+" WHERE "+where).bind(...args).first();
 return json({ok:true,rows:rows.results||[],total:cnt?.n||0,limit,offset});
}
async function readBody(req){const txt=await req.text();if(txt.length>30000)throw Error("Requisição maior que o limite");try{return JSON.parse(txt)}catch{throw Error("JSON inválido")}}
export async function onRequest({request,env}){
 if(request.method==="OPTIONS")return new Response(null,{headers:{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS","access-control-allow-headers":"content-type"}});
 if(!env.DB)return failure("D1 não vinculado: configurar binding DB na Cloudflare",503);
 const pathname=new URL(request.url).pathname,parts=pathname.split("/").filter(Boolean),name=parts[1],id=parts[2],cfg=SCHEMAS[name];
 try{
  if(name==="bootstrap"&&request.method==="POST"){
   // D1.exec() separa SQL por QUEBRA DE LINHA e falha com CREATE TABLE multilinha.
   // D1.batch() recebe instruções completas, sequenciais e atômicas.
   const statements=BOOTSTRAP_SCHEMA.split(";").map(sql=>sql.trim()).filter(Boolean);
   if(statements.length!==9||statements.some(sql=>!/^(?:CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS)\b/i.test(sql)))
    throw Error("Esquema D1 inesperado: inicialização bloqueada");
   await env.DB.batch(statements.map(sql=>env.DB.prepare(sql)));
   const initialized=await env.DB.prepare("SELECT COUNT(*) AS n FROM trades").first();
   return json({ok:true,status:"D1_INICIALIZADO",trades:initialized?.n||0,stage:"PILOTO_NAO_HOMOLOGADO"});
  }
  if(name==="health"&&request.method==="GET"){
   await env.DB.prepare("SELECT COUNT(*) AS n FROM trades").first();
   return json({ok:true,db:"online",stage:"PILOTO_NAO_HOMOLOGADO"});
  }
  if(name==="audit"&&request.method==="GET"){
   const result=await env.DB.prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 40").all();
   return json({ok:true,rows:result.results||[]});
  }
  if(!cfg)return failure("Rota não encontrada",404);
  if(request.method==="GET"&&!id)return list(env.DB,name,new URL(request.url));
  if(request.method==="GET"&&id){
   const old=await env.DB.prepare("SELECT * FROM "+cfg.table+" WHERE id=? AND deleted_at IS NULL").bind(id).first();
   return old?json({ok:true,row:old}):failure("Não encontrado",404);
  }
  if(request.method==="POST"&&!id){
   const item=validate(name,await readBody(request)),newId=crypto.randomUUID(),cols=Object.keys(item);
   const sql="INSERT INTO "+cfg.table+"(id,"+cols.join(",")+") VALUES(?,"+cols.map(()=>"?").join(",")+")";
   await env.DB.prepare(sql).bind(newId,...cols.map(k=>item[k])).run();
   const row=await env.DB.prepare("SELECT * FROM "+cfg.table+" WHERE id=?").bind(newId).first();
   await audit(env.DB,name,newId,"CREATE",null,row);
   return json({ok:true,row},201);
  }
  if(id&&(request.method==="PUT"||request.method==="DELETE")){
   const body=await readBody(request),old=await env.DB.prepare("SELECT * FROM "+cfg.table+" WHERE id=? AND deleted_at IS NULL").bind(id).first();
   if(!old)return failure("Registro inexistente",404);
   if(!Number.isInteger(body.version)||body.version!==old.version)return failure("Conflito de versão; atualize a tela",409);
   if(request.method==="DELETE"){
    const r=await env.DB.prepare("UPDATE "+cfg.table+" SET deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=?").bind(id,old.version).run();
    if(r.meta.changes!==1)return failure("Registro alterado por outra sessão",409);
    await audit(env.DB,name,id,"DELETE",old,null);return json({ok:true});
   }
   const item=validate(name,body),fields=Object.keys(item);
   if(!fields.length)return failure("Nenhum campo informado",422);
   const sql="UPDATE "+cfg.table+" SET "+fields.map(x=>x+"=?").join(",")+",version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=? AND deleted_at IS NULL";
   const r=await env.DB.prepare(sql).bind(...fields.map(f=>item[f]),id,old.version).run();
   if(r.meta.changes!==1)return failure("Registro alterado por outra sessão",409);
   const row=await env.DB.prepare("SELECT * FROM "+cfg.table+" WHERE id=?").bind(id).first();
   await audit(env.DB,name,id,"UPDATE",old,row);return json({ok:true,row});
  }
  return failure("Método não permitido",405);
 }catch(e){
  const msg=String(e?.message||e);
  if(/campo obrigatório|inválid|incomplet|fora do brasil|limite|competência/i.test(msg))return failure(msg,422);
  return failure("Erro de operação: "+msg,500);
 }
}
