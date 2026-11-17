/* BRZ F77 — day close reconciler: read-only operational evidence.
 * Never turns a calculated best port into a physical shipment.
 * A missing CBOT/FX/Excel/TCO verification is a blocker, not a green status.
 */
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const sourceIsoWeek=v=>{const s=String(v||'');const m=s.match(/(?:20\d{2})[-/]?(?:S|W)(\d\d)|(?:20\d{2})-S\d\d/i);
 return m?s.match(/20\d{2}[-/]?[SW]\d\d/i)?.[0]||s:null;};
export function summarizeClose({trades=[],date,cbotDate,fxDate,excelDate,
 excelAudit=null,excelPersisted=false,freights=[],geo=null,tradeAudits=null}={}){
 if(!/^\d{4}-\d\d-\d\d$/.test(String(date||'')))throw Error('F77 fechamento: data inválida');
 const records=trades.filter(d=>d&&String(d.data||'')===date);
 let volume=0,closed=0,pending=0,missingOrigin=0,missingWindow=0,missingCoords=0;
 const products={};
 for(const d of records){
  const prod=String(d.produto||d.grupoProduto||'N/D');
  const v=Number(d.volume)>0?Number(d.volume):0;volume+=v;
  if(/^FECHADO/i.test(String(d.status||'')))closed++;else pending++;
  const entry=products[prod]||(products[prod]={count:0,volume:0});entry.count++;entry.volume+=v;
  if(!String(d.origem||'').trim())missingOrigin++;
  if(!String(d.retirada||d.janelaFisica||'').trim())missingWindow++;
  if(geo&&geo.entries instanceof Map&&!geo.entries.get(String(d.id))?.geo)missingCoords++;
 }
 const warnings=[],checks={
  cbot:String(cbotDate||'')===date,
  dolar:String(fxDate||'')===date,
  excel:String(excelDate||'')===date,
  excelAudit:excelAudit?.ok===true,
  excelPersisted:excelPersisted===true,
  origins:missingOrigin===0,
  windows:missingWindow===0,
  geo:!geo||missingCoords===0
 };
 for(const [k,v] of Object.entries(checks))if(!v)
  warnings.push(k==='excelPersisted'?'Excel ainda sem comprovação de reidratação do fechamento confirmado':
   k==='excelAudit'?'Excel sem auditoria final aprovada':
   k==='cbot'?'Chicago sem captura da data':
   k==='dolar'?'Dólar sem captura da data':
   k==='excel'?'Excel não corresponde à data':
   k==='geo'?'Existem origens sem coordenada validada':k+' pendente');
 if(!records.length)warnings.push('Nenhum negócio cadastrado para a data');
 if(pending)warnings.push(pending+' negócio(s) ainda não fechado(s)');
 if(excelAudit?.errors?.length)warnings.push(...excelAudit.errors.slice(0,8));
 let maxWeek=null;
 for(const row of Array.isArray(freights)?freights:[]){
  const w=sourceIsoWeek(row?.semana||row?.iso_week||row?.week||row?.semanaISO);
  if(w&&(!maxWeek||w>maxWeek))maxWeek=w;
 }
 const financialCheck=tradeAudits?.checked===true&&tradeAudits.failed===0&&
  tradeAudits?.parityChecked===true&&tradeAudits?.parityFailed===0;
 if(!financialCheck)warnings.push('Replacement/TCO sem dupla auditoria: referências F73 e recálculo financeiro F77');
 if(tradeAudits?.parityChecked!==true)
  warnings.push('Auditoria financeira independente da data não executada, incompleta ou desatualizada');
 if(!maxWeek)warnings.push('Frete semanal não identificado na base; fechamento não aprovado');
 return {date,records:records.length,closed,pending,volume,products,missingOrigin,missingWindow,
  missingCoords,cbotDate:cbotDate||null,fxDate:fxDate||null,excelDate:excelDate||null,
  freightWeek:maxWeek,checks,financialCheck,
  warnings,ready:records.length>0&&warnings.length===0};
}
export function installDailyClose({getTrades,getState,getGeo}={}){
 if(typeof document==='undefined'||typeof getTrades!=='function'||typeof getState!=='function')return null;
 const screen=document.getElementById('sistema')||document.getElementById('mercado');
 if(!screen||document.getElementById('brz-f77-close'))return null;
 const box=document.createElement('details');box.id='brz-f77-close';
 box.innerHTML='<summary>Conciliação do dia · negócios, CBOT, dólar, fretes e Excel</summary>'+
 '<div class="brz-f77-close-tools"><label>Data comercial <input type="date" id="brz-f77-close-day"></label>'+
 '<button type="button" id="brz-f77-close-review">Conferir fechamento</button>'+
 '<button type="button" id="brz-f77-close-export">Exportar auditoria</button></div>'+
 '<div id="brz-f77-close-content" aria-live="polite"></div>';
 screen.appendChild(box);
 const css=document.createElement('style');css.id='brz-f77-close-css';
 css.textContent='#brz-f77-close{margin:14px 0;padding:13px;border:1px solid var(--g200,#d0dce4);border-radius:5px;color:var(--g900,#173249);background:var(--card,#fff);font:12px/1.5 Inter,Arial,sans-serif}'+
 '#brz-f77-close summary{cursor:pointer;font-size:13px;font-weight:750}'+
 '.brz-f77-close-tools{display:flex;align-items:end;gap:12px;flex-wrap:wrap;padding:10px 0}'+
 '.brz-f77-close-tools label{display:flex;flex-direction:column;gap:4px}'+
 '.brz-f77-close-tools input{padding:8px;background:var(--card,#fff);color:var(--g900,#173249);border:1px solid var(--g200,#cbd7df)}'+
 '.brz-f77-close-tools button{border:1px solid #087d76;background:white;color:#087d76;padding:8px 10px;cursor:pointer;font-weight:750}'+
 '#brz-f77-close-content table{border-collapse:collapse;width:100%;margin:10px 0}'+
 '#brz-f77-close-content th,#brz-f77-close-content td{border-bottom:1px solid var(--g200,#cbd7df);text-align:left;padding:5px 7px}'+
 '#brz-f77-close-content th{background:var(--g100,#ecf3f6);color:var(--g900,#173249)}'+
 '#brz-f77-close-content p{margin:5px 0}';
 document.head.appendChild(css);
 const $=id=>box.querySelector('#'+id);
 const dates=getTrades().map(d=>String(d?.data||'')).filter(x=>/^20\d\d-\d\d-\d\d$/.test(x)).sort();
 $('brz-f77-close-day').value=dates.at(-1)||new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 let current=null;
 const fmt=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:1});
 function review(){
  if(!box.open)return;
  const state=getState(),day=$('brz-f77-close-day').value;
  // F77: only a finished, current per-ID replacement audit can clear
  // the financial gate. No replacement result is inferred from a valid Excel.
  const audit=window.__BRZ_F73_REPLACEMENT_DIAGNOSTICS;
  const auditCurrent=audit&&Number(audit.total)===getTrades().length&&
    Number(audit.stateVersion)===Number(state?._version||0)&&
    !!audit.completedAt;
  const relevant=Array.isArray(audit?.issues)?audit.issues.filter(x=>x.date===day):[];
  const finance=window.__BRZ_F77_FINANCIAL_PARITY_AUDIT;
  const financialCurrent=!!(finance&&finance.completedAt&&finance.date===day&&
   finance.totalRecords===getTrades().length&&
   Number(finance.stateVersion)===Number(state?._version||0)&&
   finance.marketExcelAsOf===(state?.marketExcelAsOf||null)&&
   finance.cbotDate===(state?.timestamps?.cbot||null)&&
   finance.fxDate===(state?.timestamps?.dolar||null)&&
   Number(finance.freightRows)===(state?.fretesRodo?.length||0)&&
   Number(finance.railRows)===(state?.fretesFerro?.length||0)&&
   finance.passed===true);
  const badFinance=(finance?.counts?.eligible||0)-(finance?.counts?.conforme||0);
  const savedExcel=state?.marketExcelStaged;
  const excelReloadVerified=!!(savedExcel?.status==='confirmado'&&
   savedExcel.as_of===day&&
   /^[a-f0-9]{64}$/.test(String(savedExcel.file_sha256||''))&&
   savedExcel.file_sha256===state?.marketExcelSHA256&&
   savedExcel.file_sha256===state?.marketExcelAudit?.sourceSha256&&
   state?.marketExcelAsOf===day);
  current=summarizeClose({date:day,trades:getTrades(),cbotDate:state?.timestamps?.cbot,
   fxDate:state?.timestamps?.dolar,excelDate:state?.marketExcelAsOf,
   excelAudit:state?.marketExcelAudit,excelPersisted:excelReloadVerified,freights:state?.fretesRodo,
   geo:typeof getGeo==='function'?getGeo():null,
   tradeAudits:{checked:!!auditCurrent,failed:relevant.length,
    parityChecked:financialCurrent,parityFailed:badFinance}});
  const products=Object.entries(current.products);
  const rows=products.map(([p,v])=>'<tr><td>'+esc(p)+'</td><td>'+fmt(v.count)+'</td><td>'+fmt(v.volume)+'</td></tr>').join('');
  $('brz-f77-close-content').innerHTML='<p><b>'+esc(current.date)+'</b> · '+fmt(current.records)+' negócios · '+fmt(current.closed)+' fechados · '+fmt(current.pending)+' pendentes · '+fmt(current.volume)+' t</p>'+
   '<p>CBOT: '+esc(current.cbotDate||'N/D')+' · Dólar: '+esc(current.fxDate||'N/D')+
   ' · Excel: '+esc(current.excelDate||'N/D')+' · Fretes: '+esc(current.freightWeek||'N/D')+'</p>'+
   '<table><thead><tr><th>Produto</th><th>Negócios</th><th>Volume (t)</th></tr></thead><tbody>'+rows+'</tbody></table>'+
   '<p><b>'+ (current.ready?'FECHAMENTO AUDITADO':'PENDENTE DE AUDITORIA')+'</b></p>'+
   '<ul>'+current.warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>'+
   '<small>Somente leitura: o fechamento exige auditoria F73 por ID e auditoria financeira independente F77 para a mesma data, além das referências CBOT, dólar, Excel e frete válidas. Derivados e gravação de tabelas requerem validação complementar.</small>';
 }
 $('brz-f77-close-day').onchange=review;$('brz-f77-close-review').onclick=review;
 $('brz-f77-close-export').onclick=()=>{
  if(!current)return;
  const raw=new Blob([JSON.stringify({schema:'BRZ_F77_DAILY_RECONCILIATION_V1',generatedAt:new Date().toISOString(),...current},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(raw),a=document.createElement('a');a.href=url;
  a.download='BRZ_F77_Fechamento_'+current.date+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2500);
 };
 box.addEventListener('toggle',review);
 const api=Object.freeze({refresh:review,version:'F77-daily-close-v1'});
 window.BRZDailyClose=api;return api;
}
