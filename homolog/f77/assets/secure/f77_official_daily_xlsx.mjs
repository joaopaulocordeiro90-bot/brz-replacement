/* F77 | Leitor incremental do arquivo historico diario da mesa (5 abas).
 * Processa todas as linhas para conferir integridade; mantem em memoria
 * somente a data mais recente de cada aba. Nao altera historicos comerciais.
 * Modelo real auditado: prices / frete rodoviario / frete maritimo /
 * Basis FOB / Derivados CMA. A data do rodoviario e independente do mercado.
 */
const MAX_FILE=48*1024*1024, MAX_XML=210*1024*1024, MAX_TOTAL=460*1024*1024;
const REQUIRED=['prices','frete rodoviario','frete maritimo','Basis FOB','Derivados CMA'];
const safeIso=v=>{
 if(/^\d{4}-\d\d-\d\d$/.test(String(v||'')))return String(v);
 const n=Number(v);
 if(!Number.isFinite(n)||n<42000||n>80000)return null;
 return new Date(Date.UTC(1899,11,30)+Math.floor(n)*86400000).toISOString().slice(0,10);
};
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function central(buffer){
 const d=new Uint8Array(buffer),v=new DataView(buffer);
 if(d.length<50||d.length>MAX_FILE)throw Error('Arquivo excede o limite de 48 MB');
 let tail=-1;
 for(let i=d.length-22;i>=Math.max(0,d.length-65557);i--)
  if(v.getUint32(i,true)===0x06054b50){tail=i;break;}
 if(tail<0)throw Error('Central ZIP do Excel inválida');
 const entries=v.getUint16(tail+10,true),cursor=v.getUint32(tail+16,true);
 if(entries>300||cursor>d.length-46)throw Error('Índice XLSX incompatível');
 const decoder=new TextDecoder(),lookup=new Map();
 let at=cursor,total=0;
 for(let j=0;j<entries;j++){
  if(at+46>d.length||v.getUint32(at,true)!==0x02014b50)
   throw Error('Arquivo Excel truncado');
  const flags=v.getUint16(at+8,true),method=v.getUint16(at+10,true),
   compressed=v.getUint32(at+20,true),expanded=v.getUint32(at+24,true),
   len=v.getUint16(at+28,true),extra=v.getUint16(at+30,true),
   comment=v.getUint16(at+32,true),off=v.getUint32(at+42,true);
  const name=decoder.decode(d.subarray(at+46,at+46+len));
  if(!name||name.includes('..')||name.startsWith('/')||lookup.has(name)||
     flags&1||![0,8].includes(method)||expanded>MAX_XML)
   throw Error('Entrada ZIP insegura ou incompatível');
  if(off+30>d.length||v.getUint32(off,true)!==0x04034b50)
   throw Error('Cabeçalho de entrada ZIP inválido');
  const first=off+30+v.getUint16(off+26,true)+v.getUint16(off+28,true);
  if(first+compressed>d.length)throw Error('Carga XLSX truncada');
  total+=expanded;if(total>MAX_TOTAL)throw Error('Arquivo descompactado acima do limite de 460 MB');
  lookup.set(name,{method,compressed,expanded,first});
  at+=46+len+extra+comment;
 }
 return {d,lookup};
}
function part(zip,name){
 const e=zip.lookup.get(name);if(!e)throw Error('Falta componente XLSX: '+name);
 const bytes=zip.d.subarray(e.first,e.first+e.compressed);
 return {stream:()=>e.method===0?new Blob([bytes]).stream():
   new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')),entry:e};
}
async function smallXml(zip,name){
 const {stream,entry}=part(zip,name);
 if(entry.expanded>8*1024*1024)throw Error('Metadados XLSX excessivos');
 const reader=stream().getReader(),parts=[];let total=0;
 try{
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   total+=value.byteLength;if(total>8*1024*1024)throw Error('Metadados XLSX excessivos');
   parts.push(value);
  }
 }finally{reader.releaseLock()}
 if(total!==entry.expanded)throw Error('Tamanho XLSX divergente: '+name);
 const buf=new Uint8Array(total);let offset=0;
 for(const p of parts){buf.set(p,offset);offset+=p.byteLength}
 const xml=new TextDecoder().decode(buf);
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('XML inseguro no XLSX');
 const parsed=new DOMParser().parseFromString(xml,'application/xml');
 if(parsed.getElementsByTagName('parsererror').length)throw Error('XML corrompido: '+name);
 return parsed;
}
function rowCells(xml,shared){
 const result=[];
 const re=/<c\b([^>]*)>([\s\S]*?)<\/c>/g;let c;
 while((c=re.exec(xml))!==null){
  const ref=c[1].match(/\br="([A-Z]+)\d+"/),kind=c[1].match(/\bt="([^"]+)"/);
  if(!ref)continue;
  let idx=0;for(const letter of ref[1])idx=idx*26+letter.charCodeAt(0)-64;
  idx--;if(idx<0||idx>40)throw Error('Coluna fora do padrão diário');
  const raw=c[2].match(/<v>([\s\S]*?)<\/v>/)?.[1]??'';
  let value=kind?.[1]==='s'?shared[Number(raw)]:
   kind?.[1]==='inlineStr'?c[2].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1]??'':raw;
  if(value===undefined)throw Error('Índice de texto compartilhado inválido');
  result[idx]=value;
 }
 return Array.from({length:result.length},(_,i)=>result[i]??'');
}
async function dailySheet(zip,filename,shared,onProgress){
 const {stream,entry}=part(zip,filename);
 const reader=stream().getReader(),decoder=new TextDecoder();
 let buffer='',rows=[],prevRows=[],header=null,maxDay=null,prevDate=null,read=0,total=0,dimension=null,invalidDate=0,priorDay=null,outOfOrder=0;
 async function consume(raw){
  const cells=rowCells(raw,shared);
  total++;
  if(total===1){header=cells;return}
  const day=safeIso(cells[0]);
  if(!day){invalidDate++;return}
  if(priorDay&&day>priorDay)outOfOrder++;
  priorDay=day;
  if(maxDay===null||day>maxDay){maxDay=day;rows=[cells]}
  else if(day===maxDay){rows.push(cells)}
  else if(prevDate===null||day>prevDate){prevDate=day;prevRows=[cells]}
  else if(day===prevDate){prevRows.push(cells)}
  if(rows.length>50000||prevRows.length>50000)throw Error('Fechamento com mais de 50 mil linhas: fracionamento obrigatório');
  if(total%20000===0){
   onProgress?.({sheet:filename,read:total,latest:maxDay,latestCount:rows.length});
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 try{
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   read+=value.byteLength;
   if(read>entry.expanded)throw Error('Tamanho da aba maior que o índice ZIP');
   buffer+=decoder.decode(value,{stream:true});
   if(!dimension){
    const m=buffer.match(/<dimension\b[^>]*\bref="[^"]*?([A-Z]+)(\d+)"/);
    if(m)dimension=Number(m[2]);
   }
   for(;;){
    const start=buffer.indexOf('<row ');
    if(start<0){buffer=buffer.slice(-64);break}
    const end=buffer.indexOf('</row>',start);
    if(end<0){if(start>0)buffer=buffer.slice(start);break}
    const raw=buffer.slice(start,end+6);
    buffer=buffer.slice(end+6);
    await consume(raw);
    if(total>1500000)throw Error('Mais de 1,5 milhão de linhas em uma aba');
   }
  }
  buffer+=decoder.decode();
 }finally{try{reader.releaseLock()}catch{}}
 if(read!==entry.expanded)throw Error('Aba XLSX incompleta: '+filename);
 if(!header||!maxDay||!rows.length||invalidDate||outOfOrder||
    (dimension!==null&&dimension!==total))
  throw Error('Histórico Excel incompleto ou fora da ordem por data: '+filename+
    ' (linhas='+total+', datas inválidas='+invalidDate+', inversões='+outOfOrder+')');
 return {rows:[header,...rows],date:maxDay,latest:rows.length,historic:total-1,
  previousRows:[header,...prevRows],previousDate:prevDate};
}
export async function parseOfficialDailyXlsx(file,onProgress=()=>{}){
 if(!file||!/\.xlsx$/i.test(file.name||'')||file.size>MAX_FILE||file.size<100)
  throw Error('Selecione o XLSX diário original (até 48 MB)');
 if(typeof DecompressionStream!=='function'||typeof DOMParser!=='function')
  throw Error('Este navegador não suporta o leitor de Excel histórico incremental');
 const buffer=await file.arrayBuffer(),zip=central(buffer);
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))]
   .map(x=>x.toString(16).padStart(2,'0')).join('');
 const wb=await smallXml(zip,'xl/workbook.xml'),rels=await smallXml(zip,'xl/_rels/workbook.xml.rels');
 const sharedDoc=await smallXml(zip,'xl/sharedStrings.xml');
 const shared=[...sharedDoc.getElementsByTagName('si')].map(si=>
  [...si.getElementsByTagName('t')].map(t=>t.textContent||'').join(''));
 const relsMap=new Map([...rels.getElementsByTagName('Relationship')].map(x=>[
  x.getAttribute('Id'),x.getAttribute('Target')]));
 const targets=new Map();
 for(const el of wb.getElementsByTagName('sheet')){
  const name=el.getAttribute('name'),rid=el.getAttribute('r:id');
  let target=String(relsMap.get(rid)||'').replace(/^\/+/,'');
  if(!target.startsWith('xl/'))target='xl/'+target;
  targets.set(name,target);
 }
 for(const name of REQUIRED)if(!targets.has(name))
  throw Error('Aba obrigatória ausente no Excel diário: '+name);
 const sheets={},dates={},history={},latestCount={},previousSheets={},previousDateBySheet={};
 for(const name of REQUIRED){
  const result=await dailySheet(zip,targets.get(name),shared,onProgress);
  sheets[name]=result.rows;dates[name]=result.date;
  previousSheets[name]=result.previousRows;previousDateBySheet[name]=result.previousDate;
  history[name]=result.historic;latestCount[name]=result.latest;
  onProgress({sheet:name,done:true,latest:result.date,latestCount:result.latest,historic:result.historic});
 }
 const marketDate=dates.prices;
 for(const name of ['frete maritimo','Basis FOB','Derivados CMA'])
  if(dates[name]!==marketDate)throw Error('Datas de mercado divergentes: '+name);
 return {sheets,file_sha256:digest,source_file:file.name,
  officialDaily:true,dateBySheet:dates,historyRows:history,latestCount,
  previousSheets,previousDateBySheet,
  asOf:marketDate,roadSourceDate:dates['frete rodoviario']};
}
