/* BRZ F77 — local-only XLSX decoder for the fixed daily four-sheet workbook.
 * No external JS, no file data sent to a third party. Zip entries verified,
 * XML decoded in browser, SHA-256 of ORIGINAL workbook is retained.
 * This module stages and previews observations; commercial changes require
 * a separate authenticated confirmation through BRZPinAutoSave.
 */
const MAX_FILE=24*1024*1024,MAX_XML=32*1024*1024,MAX_TOTAL=100*1024*1024;
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const str=x=>String(x??'').trim();
const number=x=>{
 if(x===null||x===undefined||str(x)==='')return null;
 const s=str(x).replace(/\s/g,'');
 const v=Number(s.includes(',')&&s.includes('.')?s.replace(/\./g,'').replace(',','.') : s.replace(',','.'));
 return Number.isFinite(v)?v:null;
};
const esc=x=>str(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const prod=x=>{
 const k=norm(x);
 if(['soybean','soy','soja'].includes(k))return 'Soybean';
 if(['corn','milho','maize'].includes(k))return 'Corn';
 if(['sorghum','sorgo'].includes(k))return 'Sorghum';
 if(['soymeal','farelo','farelo de soja','soybean meal'].includes(k))return 'Soymeal';
 if(['soyoil','oleo','oleo de soja','soybean oil'].includes(k))return 'Soyoil';
 return null;
};
const excelDate=v=>{
 if(/^\d{4}-\d\d-\d\d$/.test(str(v)))return str(v);
 const n=number(v);
 if(n&&n>30000&&n<75000)return new Date(Date.UTC(1899,11,30)+Math.floor(n)*86400000).toISOString().slice(0,10);
 return null;
};
function unzipCatalog(buffer){
 const data=new Uint8Array(buffer),v=new DataView(buffer);
 if(data.length>MAX_FILE||data.length<40)throw Error('XLSX vazio ou maior que 24 MB');
 let eocd=-1;
 for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--){
  if(v.getUint32(i,true)===0x06054b50){eocd=i;break;}
 }
 if(eocd<0)throw Error('Não é arquivo XLSX/ZIP válido');
 const count=v.getUint16(eocd+10,true),offset=v.getUint32(eocd+16,true);
 if(count>2000||offset>data.length-46)throw Error('Índice ZIP inválido');
 const out=new Map(),decoder=new TextDecoder(),seen=new Set();
 let i=offset,total=0;
 for(let n=0;n<count;n++){
  if(i+46>data.length||v.getUint32(i,true)!==0x02014b50)throw Error('Diretório ZIP truncado');
  const flags=v.getUint16(i+8,true),method=v.getUint16(i+10,true),
   csize=v.getUint32(i+20,true),usize=v.getUint32(i+24,true),len=v.getUint16(i+28,true),
   extra=v.getUint16(i+30,true),comment=v.getUint16(i+32,true),local=v.getUint32(i+42,true);
  if(flags&1||![0,8].includes(method)||usize>MAX_XML)throw Error('XLSX criptografado ou método ZIP não suportado');
  const path=decoder.decode(data.subarray(i+46,i+46+len));
  if(!path||path.includes('..')||path.startsWith('/')||seen.has(path))throw Error('Caminho ZIP duplicado ou inseguro');
  seen.add(path);total+=usize;if(total>MAX_TOTAL)throw Error('XLSX acima do limite de memória');
  if(local+30>data.length||v.getUint32(local,true)!==0x04034b50)throw Error('Entrada ZIP inválida');
  const first=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);
  if(first+csize>data.length)throw Error('Dados ZIP truncados');
  out.set(path,{method,csize,usize,first});
  i+=46+len+extra+comment;
 }
 return {data,out};
}
async function unzipPart(zip,path){
 const entry=zip.out.get(path);if(!entry)throw Error('Aba XLSX não encontrada: '+path);
 const compressed=zip.data.subarray(entry.first,entry.first+entry.csize);
 let bytes;
 if(entry.method===0)bytes=compressed;
 else {
  if(typeof DecompressionStream!=='function')throw Error('Navegador sem suporte ZIP/deflate-raw');
  const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks=[];let total=0;
  while(true){
   const {done,value}=await reader.read();if(done)break;
   total+=value.byteLength;
   if(total>MAX_XML)throw Error('Planilha excedeu limite de memória após descompactação');
   chunks.push(value);
  }
  bytes=new Uint8Array(total);let cursor=0;
  for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.byteLength;}
 }
 if(bytes.byteLength!==entry.usize)throw Error('Integridade de tamanho ZIP divergente');
 return new TextDecoder().decode(bytes);
}
function parseXML(t){
 if(t.includes('<!DOCTYPE')||t.includes('<!ENTITY'))throw Error('XML da planilha com entidade externa');
 if(typeof DOMParser!=='function')throw Error('Leitor de XML do navegador indisponível');
 const doc=new DOMParser().parseFromString(t,'application/xml');
 if(doc.getElementsByTagName('parsererror').length)throw Error('Planilha XML inválida');
 return doc;
}
const colIndex=ref=>{const x=String(ref||'').match(/^[A-Z]+/);if(!x)return -1;let i=0;for(const c of x[0])i=i*26+c.charCodeAt(0)-64;return i-1;};
function sharedList(doc){
 const rows=[];
 for(const si of doc.getElementsByTagName('si')){
  let s='';for(const t of si.getElementsByTagName('t'))s+=t.textContent||'';rows.push(s);
 }
 return rows;
}
function worksheet(doc,shared){
 const rows=[];
 for(const row of doc.getElementsByTagName('row')){
  const cells=[],items=row.getElementsByTagName('c');
  for(const c of items){
   const pos=colIndex(c.getAttribute('r')),type=c.getAttribute('t'),
    value=c.getElementsByTagName('v')[0]?.textContent??'';
   let val=type==='s'?shared[Number(value)]??'':type==='inlineStr'?
    [...c.getElementsByTagName('t')].map(t=>t.textContent||'').join(''):
    type==='n'||(!type&&value!==''&&Number.isFinite(Number(value)))?Number(value):value;
   if(pos>=0&&pos<80)cells[pos]=val;
  }
  if(cells.some(v=>v!==undefined&&v!==null&&v!==''))rows.push(cells.map(x=>x??''));
  if(rows.length>130000)throw Error('Planilha acima do limite de 130 mil linhas');
 }
 return rows;
}
export async function parseXlsx(file,onProgress=()=>{}){
 if(!file||!/\.(xlsx)$/i.test(file.name||''))throw Error('Selecione um arquivo .xlsx');
 // Real desk exports exceed 24 MB and contain >1 million historical rows.
 // Stream the entire XML, verify counts and retain ONLY each sheet's latest date.
 if(file.size>12*1024*1024){
  const {parseOfficialDailyXlsx}=await import('./f77_official_daily_xlsx.mjs?v=20261117real01');
  return parseOfficialDailyXlsx(file,onProgress);
 }
 if(file.size<50||file.size>MAX_FILE)throw Error('XLSX maior que 24 MB ou vazio');
 const buffer=await file.arrayBuffer();
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))]
  .map(x=>x.toString(16).padStart(2,'0')).join('');
 const zip=unzipCatalog(buffer);
 const workbook=parseXML(await unzipPart(zip,'xl/workbook.xml'));
 const rels=parseXML(await unzipPart(zip,'xl/_rels/workbook.xml.rels'));
 const relMap=new Map([...rels.getElementsByTagName('Relationship')]
  .map(e=>[e.getAttribute('Id'),e.getAttribute('Target')]));
 const shared=zip.out.has('xl/sharedStrings.xml')?
  sharedList(parseXML(await unzipPart(zip,'xl/sharedStrings.xml'))):[];
 const sheets={};
 for(const sheet of workbook.getElementsByTagName('sheet')){
  const name=sheet.getAttribute('name'),rid=sheet.getAttribute('r:id');
  if(!name||!rid)continue;
  let path=String(relMap.get(rid)||'').replace(/^\/+/,'');
  if(!path.startsWith('xl/'))path='xl/'+path;
  if(!zip.out.has(path))continue;
  sheets[name]=worksheet(parseXML(await unzipPart(zip,path)),shared);
 }
 if(!Object.keys(sheets).length)throw Error('Arquivo sem abas de Excel reconhecíveis');
 return {sheets,file_sha256:digest,source_file:file.name};
}
const canonicalNames=Object.freeze({
 prices:['precos','preco','physical','mercado fisico'],
 'Basis FOB':['basis fob','basis','premios fob'],
 'Derivados CMA':['derivados cma','cma','derivados'],
 'frete maritimo':['frete maritimo','fretes maritimos','ocean freight']});
export function suggestedSheets(sheets){
 const names=Object.keys(sheets||{}),out={};
 for(const [target,aliases] of Object.entries(canonicalNames)){
  out[target]=names.find(n=>aliases.includes(norm(n)))||
   names.find(n=>aliases.some(a=>norm(n).includes(a)))||'';
 }
 return out;
}
function normalizedRows(rows,part,day){
 const data=[],errors=[];let ignored=0;
 const first=norm(rows?.[0]?.[0]||'');
 const originalFormat=({
  prices:'date','Basis FOB':'reference_date',
  'Derivados CMA':'dt_date','frete maritimo':'date(a.created_at)'
 })[part]===first;
 for(const [j,original] of (rows||[]).entries()){
  let r=Array.isArray(original)?original:[];
  if(!r.some(x=>str(x)!==''))continue;
  if(originalFormat){
   if(j===0)continue;
   const recordDay=excelDate(r[0]);
   if(recordDay!==day){
    errors.push(part+' linha '+(j+1)+': data '+(recordDay||'inválida')+
     ' diferente da data-base '+day);continue;
   }
   r=r.slice(1);
  }
  try{
   if(part==='prices'){
    const product=prod(r[0]),city=str(r[1]),side=norm(r[2]),value=number(r[3]);
    if(!product||!['Soybean','Corn','Sorghum'].includes(product)||!city){ignored++;continue;}
    if(['bid','offer'].includes(side)&&value!==null){
     data.push([product,city,side==='bid'?'Bid':'Offer',value,str(r[4])||null]);
    }else if(number(r[2])!==null&&value!==null){
     data.push([product,city,'Bid',number(r[2]),str(r[4])||null]);
     data.push([product,city,'Offer',value,str(r[4])||null]);
    }else errors.push('Preços linha '+(j+1)+': não identificado Bid/Offer');
   }else if(part==='Basis FOB'){
    const side=norm(r[6]),value=number(r[7]);
    if(!str(r[0])||!prod(r[1])){ignored++;continue;}
    if(!['bid','offer'].includes(side)||value===null)errors.push('Basis FOB linha '+(j+1)+': lado/valor inválido');
    else data.push([str(r[0]),str(r[1]),str(r[2]),str(r[3]),str(r[4]),str(r[5]),side,value]);
   }else if(part==='Derivados CMA'){
    const product=prod(r[2]),value=number(r[1]);
    if(!str(r[0])||!product){ignored++;continue;}
    if(!['Soymeal','Soyoil'].includes(product)||value===null)errors.push('CMA linha '+(j+1)+': valor ou produto inválido');
    else data.push([str(r[0]),value,product]);
   }else if(part==='frete maritimo'){
    const date=norm(r[1])==='cont'?'CONT':excelDate(r[1]),val=number(r[2]);
    if(!str(r[0])||val===null){ignored++;continue;}
    if(!date)errors.push('Frete marítimo linha '+(j+1)+': mês inválido');
    else data.push([str(r[0]),date,val]);
   }
  }catch(error){errors.push(part+' linha '+(j+1)+': '+error.message);}
  if(errors.length>20)break;
 }
 return {data,ignored,errors};
}
export function buildDailyPack(workbook,day,mapping){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(str(day)))throw Error('Data do relatório inválida');
 const problems=[],records={};let total=0;
 if(workbook?.officialDaily&&workbook.asOf!==day)
  problems.push('A data-base deve ser '+workbook.asOf+' conforme o Excel original. Não misturar dias.');
 if(workbook?.officialDaily)
  for(const name of ['prices','Basis FOB','Derivados CMA','frete maritimo'])
   if(workbook.dateBySheet?.[name]!==day)
    problems.push(name+': data mais recente diferente da data-base');
 for(const part of Object.keys(canonicalNames)){
  const name=mapping?.[part];
  if(!name||!Array.isArray(workbook?.sheets?.[name])){problems.push('Aba não mapeada: '+part);continue;}
  const normalized=normalizedRows(workbook.sheets[name],part,day);
  if(normalized.errors.length)problems.push(...normalized.errors);
  if(!normalized.data.length)problems.push('Sem dados reconhecidos na aba: '+part);
  records[part==='prices'?'prices':part]={[day]:normalized.data};
  total+=normalized.data.length;
 }
 const pack={as_of:day,source_file:workbook.source_file,
  file_sha256:workbook.file_sha256,records};
 return {pack,total,errors:problems,counts:Object.fromEntries(
  Object.entries(records).map(([k,v])=>[k,v[day].length]))};
}
export function installExcelUpload({getReference,getInternalFreightReference,confirmUpload,rollbackUpload}={}){
 if(typeof document==='undefined'||typeof confirmUpload!=='function')return null;
 const screen=document.getElementById('sistema')||document.getElementById('mercado');
 if(!screen||document.getElementById('brz-f77-xlsx'))return null;
 const panel=document.createElement('details');panel.id='brz-f77-xlsx';
 panel.innerHTML='<summary>Fechamento diário · Upload Excel (.xlsx)</summary>'+
 '<p>Arquivo processado neste navegador. Primeiro confira as abas e totais; nenhuma cotação será publicada sem sua confirmação.</p>'+
 '<div class="brz-f77-xlsx-grid"><label>Planilha XLSX <input type="file" id="brz-f77-xlsx-file" accept=".xlsx"></label>'+
 '<label>Data-base <input type="date" id="brz-f77-xlsx-date" required></label></div>'+
 '<div id="brz-f77-xlsx-mapping"></div>'+ 
'<fieldset id="brz-f77-internal-fields"><legend>5 · Frete interno (R$/t) · rodoviário e ferroviário</legend>'+ 
'<p>Selecione a aba do Excel acima ou outro arquivo .xlsx com frete interno. Estrutura: Modal, Origem/UF, Destino, Semana ISO ou Mês/Ano, Valor R$/t.</p>'+ 
'<label>Arquivo separado (opcional) <input type="file" id="brz-f77-internal-file" accept=".xlsx"></label>'+ 
'<label>Aba de frete interno <select id="brz-f77-internal-sheet"><option value="">Selecione a aba</option></select></label>'+ 
'<small>Prévia e comparação somente leitura. Fretes internos NÃO serão gravados nem aplicados ao replacement nesta homologação.</small></fieldset>'+
 '<button type="button" id="brz-f77-xlsx-preview">Validar e pré-visualizar</button>'+
 '<button type="button" id="brz-f77-xlsx-diff-download" disabled>Exportar diferenças completas (JSON)</button>'+
 '<div id="brz-f77-xlsx-report" role="status" aria-live="polite"></div>'+
 '<button type="button" id="brz-f77-xlsx-confirm" disabled>Confirmar somente mercado (não inclui frete interno)</button>'+'<button type="button" id="brz-f77-xlsx-rollback">Desfazer último fechamento Excel</button>';
 screen.appendChild(panel);
 const css=document.createElement('style');css.id='brz-f77-xlsx-css';
 css.textContent='#brz-f77-xlsx{margin:14px 0;padding:13px;border:1px solid var(--g200,#cbd9e2);border-radius:5px;background:var(--card,#fff);color:var(--g900,#173249);font:12px/1.5 Inter,Arial,sans-serif}'+
 '#brz-f77-xlsx summary{cursor:pointer;font-weight:750;font-size:13px}'+
 '.brz-f77-xlsx-grid,#brz-f77-xlsx-mapping{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}'+
 '#brz-f77-xlsx label{display:flex;flex-direction:column;gap:5px;font-weight:600}'+
 '#brz-f77-xlsx select,#brz-f77-xlsx input{padding:8px;min-width:140px;max-width:100%;font:12px Arial;border:1px solid #cbd9e2;background:var(--card,#fff);color:var(--g900,#173249)}'+
 '#brz-f77-xlsx button{padding:9px 12px;border:1px solid #087d76;background:white;color:#087d76;cursor:pointer;margin-right:8px;font-weight:700}'+
 '#brz-f77-xlsx button:disabled{opacity:.4;cursor:not-allowed}'+
'#brz-f77-internal-fields{border:1px solid var(--g200,#cad6df);padding:10px 12px;margin:10px 0}'+
'#brz-f77-internal-fields legend{font-weight:750}'+
'#brz-f77-internal-fields label{display:inline-flex;vertical-align:top;margin:7px 10px 7px 0}'+
 '#brz-f77-xlsx-report{white-space:pre-wrap;margin:10px 0;max-height:350px;overflow:auto}';
 document.head.appendChild(css);
 const $=id=>panel.querySelector('#'+id);
 $('brz-f77-xlsx-date').value=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 let workbook=null,freightWorkbook=null,internalDiff=null,review=null,fullDiff=null;
 const mapping={};
 const internalSheet=$('brz-f77-internal-sheet');
 const showInternalSheets=()=>{
  const wb=freightWorkbook||workbook;
  const names=Object.keys(wb?.sheets||{});
  const previous=internalSheet.value;
  const suggested=names.find(x=>/frete\s*(interno|rodovi|ferrovi)|freight\s*(inland|road|rail)/i.test(x))||'';
  internalSheet.innerHTML='<option value="">Selecione a aba</option>'+
   names.map(x=>'<option value="'+esc(x)+'">'+esc(x)+' ('+wb.sheets[x].length+' linhas)</option>').join('');
  internalSheet.value=names.includes(previous)?previous:suggested;
 };
 $('brz-f77-internal-file').onchange=async()=>{
  freightWorkbook=null;internalDiff=null;review=null;fullDiff=null;
  $('brz-f77-xlsx-confirm').disabled=true;$('brz-f77-xlsx-diff-download').disabled=true;
  const file=$('brz-f77-internal-file').files?.[0];
  if(!file){showInternalSheets();return;}
  $('brz-f77-xlsx-report').textContent='Lendo frete interno…';
  try{freightWorkbook=await parseXlsx(file);showInternalSheets();
   $('brz-f77-xlsx-report').textContent='Frete interno lido: '+Object.keys(freightWorkbook.sheets).join(', ')+
   '\nConfira o mapeamento da aba e valide a prévia.';}
  catch(error){$('brz-f77-xlsx-report').textContent='Falha no frete interno: '+error.message;}
 };
 internalSheet.addEventListener('change',()=>{review=null;internalDiff=null;
  $('brz-f77-xlsx-confirm').disabled=true;$('brz-f77-xlsx-diff-download').disabled=true;});
 const updatePreview=()=>{
  if(!workbook)return;
  const names=Object.keys(workbook.sheets);
  const suggested=suggestedSheets(workbook.sheets);
  $('brz-f77-xlsx-mapping').innerHTML=Object.keys(canonicalNames).map((part,i)=>{
   const id='brz-f77-mapping-'+i;
   return '<label>'+esc(part)+'<select id="'+id+'" data-part="'+esc(part)+'">'+
    '<option value="">Selecione a aba</option>'+
    names.map(x=>'<option value="'+esc(x)+'" '+(suggested[part]===x?'selected':'')+'>'+esc(x)+' ('+workbook.sheets[x].length+' linhas)</option>').join('')+'</select></label>';
  }).join('');
  for(const el of $('brz-f77-xlsx-mapping').querySelectorAll('select'))
   el.addEventListener('change',()=>{$('brz-f77-xlsx-confirm').disabled=true;review=null;});
 };
 $('brz-f77-xlsx-file').onchange=async()=>{
  workbook=null;review=null;fullDiff=null;$('brz-f77-xlsx-diff-download').disabled=true;$('brz-f77-xlsx-confirm').disabled=true;
  const file=$('brz-f77-xlsx-file').files?.[0];if(!file)return;
  $('brz-f77-xlsx-report').textContent='Conferindo estrutura ZIP e lendo abas…';
  try{workbook=await parseXlsx(file,progress=>{
    if(progress?.done)
     $('brz-f77-xlsx-report').textContent='Histórico conferido: '+progress.sheet+
      ' · '+progress.historic+' registros · '+progress.latestCount+
      ' na data '+progress.latest;
    else if(progress?.read)
     $('brz-f77-xlsx-report').textContent='Conferindo histórico do Excel: '+
      progress.read.toLocaleString('pt-BR')+' registros na aba '+progress.sheet;
   });updatePreview();showInternalSheets();
   if(workbook.officialDaily&&workbook.asOf)
    $('brz-f77-xlsx-date').value=workbook.asOf;
   $('brz-f77-xlsx-report').textContent='Planilha lida: '+Object.keys(workbook.sheets).join(', ')+
   '\nSHA-256: '+workbook.file_sha256+
   (workbook.officialDaily?'\nArquivo histórico original auditado: '+
    Object.entries(workbook.historyRows).map(([name,n])=>name+' '+n.toLocaleString('pt-BR')).join(' · ')+
    '\nÚltimo mercado: '+workbook.asOf+' · último frete rodoviário: '+workbook.roadSourceDate+
    '\nOs históricos anteriores não serão reaplicados; serão conferidos antes de atualizar o fechamento.':'')+
   '\nSelecione a data e valide antes de gravar.';
  }catch(error){$('brz-f77-xlsx-report').textContent='Falha no XLSX: '+error.message;}
 };
 $('brz-f77-xlsx-preview').onclick=async()=>{
  review=null;fullDiff=null;internalDiff=null;$('brz-f77-xlsx-diff-download').disabled=true;$('brz-f77-xlsx-confirm').disabled=true;
  if(!workbook){$('brz-f77-xlsx-report').textContent='Escolha um XLSX válido.';return;}
  for(const sel of $('brz-f77-xlsx-mapping').querySelectorAll('select'))mapping[sel.dataset.part]=sel.value;
  try{
   const built=buildDailyPack(workbook,$('brz-f77-xlsx-date').value,mapping);
   if(built.errors.length){$('brz-f77-xlsx-report').textContent='NÃO VALIDADO\n'+built.errors.join('\n');return;}
   let internalSummary='FRETE INTERNO: não informado — nenhum frete será alterado.';
   const freightSheet=internalSheet.value;
   if(freightSheet){
    try{
     const mod=await import('./f77_internal_freight.mjs?v=20261117int01');
     const base=freightWorkbook||workbook;
     const parsed=mod.parseInternalFreight(base?.sheets?.[freightSheet],{sheetName:freightSheet});
     if(parsed.errors.length)throw Error(parsed.errors.slice(0,12).join(' · '));
     const refs=typeof getInternalFreightReference==='function'?
      await getInternalFreightReference():{road:[],rail:[]};
     internalDiff=mod.compareInternalFreight(parsed.records,refs);
     const cs=internalDiff.counts;
     internalSummary='FRETE INTERNO — PRÉVIA SEM GRAVAÇÃO\n'+
      'Rodoviário: '+parsed.counts.rodoviario+' · Ferroviário: '+parsed.counts.ferroviario+
      ' · Comparáveis: '+cs.comparado+' · Alterados: '+cs.alterado+
      ' · Sem referência: '+cs.sem_referencia+'\n'+
      internalDiff.changes.slice(0,16).map(d=>d.modal+' · '+d.origem+' → '+d.destino+
       ' · '+d.periodo+' · '+(d.anterior??'N/D')+' → '+d.novo+' R$/t').join('\n')+
      '\nATENÇÃO: nenhuma cotação de frete interno será publicada pelo Excel F77.';
    }catch(error){
     $('brz-f77-xlsx-report').textContent='FRETE INTERNO NÃO VALIDADO\n'+error.message+
      '\nImportação bloqueada. Corrija o formato ou a seleção da aba.';
     return;
    }
   }
   const reference=typeof getReference==='function'?await getReference(built.pack):null;
   const message='Fonte: '+built.pack.source_file+' · data '+built.pack.as_of+
    '\n'+Object.entries(built.counts).map(([k,v])=>k+': '+v+' registros').join('\n')+
    '\nTotal: '+built.total+' observações. Arquivo intacto; ausência de preço é N/D.'+
    '\nCurva da mesma data: '+(reference?.curveDay===built.pack.as_of&&reference?.fxDay===built.pack.as_of?'CONFIRMADA':'NÃO CONFIRMADA — precisa atualizar CBOT/DOL antes de publicar.');
   if(reference?.diffError){
     $('brz-f77-xlsx-report').textContent=message+'\n\n'+internalSummary+'\nDiferenças não conciliadas: '+reference.diffError+'\nPublicação bloqueada.';
     return;
   }
   if(!reference?.diff||reference.diff.counts?.total!==built.total-(built.counts.prices||0)/2){
     // The true comparison can have fewer derivatives when original CMA=0 => N/D;
     // accept only reports with positive coverage and no comparison exception.
     if(!reference?.diff?.counts?.total){
       $('brz-f77-xlsx-report').textContent=message+'\nSem comparação histórica verificável. Confirmação bloqueada.';
       return;
     }
   }
   fullDiff={...reference.diff,freteInterno:internalDiff};
   $('brz-f77-xlsx-diff-download').disabled=false;
   const diff=fullDiff,format=v=>v===null||v===undefined?'N/D':String(v);
   const stats=Object.entries(diff.byTab).map(([k,v])=>k+': '+v.total+
    ' registros, '+v.alterado+' alterados, '+v.sem_referencia+' sem referência').join('\n');
   const rows=diff.changes.slice(0,45).map(x=>x.tab+' | '+x.key+' | '+
    (x.tab==='Preços'
      ?'Bid '+format(x.oldBid)+' → '+format(x.newBid)+'; Offer '+format(x.oldOffer)+' → '+format(x.newOffer)
      :format(x.oldValue)+' → '+format(x.newValue))+
    (x.status==='sem_referencia'?' [N/D na base]':'')).join('\n');
   $('brz-f77-xlsx-report').textContent=message+
    '\n\nCOMPARAÇÃO COM HISTÓRICO (prévia das primeiras 45; exportação completa disponível):\n'+stats+
    '\n\n'+rows+
    '\n\nNenhum valor N/D foi convertido em zero. Originais permanecem preservados.';
   if(reference?.curveDay!==built.pack.as_of||reference?.fxDay!==built.pack.as_of)return;
   review=built;
   $('brz-f77-xlsx-confirm').disabled=false;
  }catch(error){$('brz-f77-xlsx-report').textContent='Falha de validação: '+error.message;}
 };
 $('brz-f77-xlsx-diff-download').onclick=()=>{
   if(!fullDiff)return;
   const blob=new Blob([JSON.stringify(fullDiff,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='BRZ_F77_Excel_Diferencas_'+fullDiff.date+'.json';
   a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);
 };
 $('brz-f77-xlsx-confirm').onclick=async()=>{
  if(!review)return;
  const expected=review.pack.file_sha256;
  if(!confirm('ATENÇÃO: o frete interno NÃO será gravado. Confirmar SOMENTE as '+review.total+' observações de mercado de '+review.pack.as_of+
    '? O registro será salvo com versionamento, sem sobrescrever snapshots imutáveis.'))return;
  $('brz-f77-xlsx-confirm').disabled=true;
  $('brz-f77-xlsx-report').textContent='Confirmando no banco autenticado…';
  try{
   const ack=await confirmUpload(review.pack);
   $('brz-f77-xlsx-report').textContent='Confirmado: '+review.pack.as_of+
    '\nSHA-256: '+expected+'\nRegistro com revisão '+ack.revision+'. Recarregue para aplicar somente após conciliação integral.';
  }catch(error){$('brz-f77-xlsx-report').textContent='Importação NÃO aplicada: '+error.message;
   $('brz-f77-xlsx-confirm').disabled=false;}
 };
 $('brz-f77-xlsx-rollback').onclick=async()=>{
  if(typeof rollbackUpload!=='function')return;
  if(!confirm('Desfazer somente o último Excel F77 confirmado? Histórico imutável e negócios serão preservados.'))return;
  $('brz-f77-xlsx-rollback').disabled=true;
  try{
   const ack=await rollbackUpload();
   $('brz-f77-xlsx-report').textContent='Rollback confirmado na revisão '+ack.revision+'. Recarregue o site para restaurar a fonte anterior.';
  }catch(error){$('brz-f77-xlsx-report').textContent='Rollback bloqueado: '+error.message;}
  finally{$('brz-f77-xlsx-rollback').disabled=false;}
 };
 return Object.freeze({version:'F77-XLSX-review-v1'});
}
