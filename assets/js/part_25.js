
/* BRZ F34 | V4FQ market source bridge | read-only | mesa/admin JWT via F33. */
(function(){
'use strict';
const expected={physical:59758,curves:16418,basis_points:107184,
 basis_series:1405,derivatives:14235,ocean:68959};
const domains=Object.keys(expected);
let current='curves',nextCursor=0,loaded=0,working=false,countsCache=null;
const $=id=>document.getElementById(id);
const bridge=()=>{
 const f=window.BRZF33;
 if(!f?.status?.().connected)throw Error('Conecte primeiro em Banco F33 com perfil mesa/admin');
 return f;
};
function status(text,kind=''){
 const el=$('brzf34-status');if(el){el.textContent=text;el.dataset.state=kind;}
}
async function counts(){
 const rows=await bridge().marketCounts();
 if(!Array.isArray(rows)||rows.length!==6)throw Error('Inventário F34 incompleto');
 const seen=new Set();let sum=0;
 for(const r of rows){
  if(!r||!domains.includes(r.domain)||seen.has(r.domain)||
   Number(r.expected_rows)!==expected[r.domain]||Number(r.loaded_rows)!==expected[r.domain]||r.ready!==true)
    throw Error('F34: fonte de mercado parcial ou divergente');
  seen.add(r.domain);sum+=Number(r.loaded_rows);
 }
 if(sum!==267959)throw Error('F34: total divergente');
 countsCache=rows;
 const out=$('brzf34-counts');if(out){out.textContent='';
   for(const r of rows){const line=document.createElement('div');line.textContent=String(r.domain)+' · '+
     Number(r.loaded_rows).toLocaleString('pt-BR')+' / '+Number(r.expected_rows).toLocaleString('pt-BR');
     out.appendChild(line);}
 }
 status('6 bases conciliadas · 267.959 registros · PostgreSQL','ok');
 return rows;
}
async function page({domain=current,afterRowNo=0,limit=100,fromDate=null}={}){
 const rows=await bridge().marketPage({domain,afterRowNo,limit,fromDate});
 if(!Array.isArray(rows)||rows.length>limit)throw Error('Resposta F34 inválida');
 let cursor=afterRowNo;
 for(const r of rows){
   if(r.domain!==domain||!Number.isSafeInteger(Number(r.row_no))||Number(r.row_no)<=cursor||
     !r.record_json||typeof r.record_json!=='object'||
     !/^[a-f0-9]{64}$/.test(r.record_fingerprint||''))throw Error('Registro F34 inválido');
   cursor=Number(r.row_no);
 }
 return rows;
}
async function lookup({domain,sourceKey}={}){
 const rows=await bridge().marketLookup({domain,sourceKey});
 if(!Array.isArray(rows)||rows.length>1)throw Error('Busca F34 inválida');
 return rows[0]||null;
}
function reset(){current=$('brzf34-domain').value;nextCursor=0;loaded=0;
 const list=$('brzf34-rows');if(list)list.textContent='';
 status('Selecione Consultar próxima página · somente leitura');}
async function inspect(){
 if(working)return;working=true;
 try{
   const fromDate=$('brzf34-from-date').value||null;
   if(fromDate&&['basis_points','basis_series','derivatives'].includes(current))
     throw Error('Filtro de data indisponível para este conjunto: consulte sem data');
   if(nextCursor===0&&loaded===0)await counts();
   const rows=await page({domain:current,afterRowNo:nextCursor,limit:100,fromDate});
   const list=$('brzf34-rows');
   for(const r of rows){
     const item=document.createElement('div');
     item.className='brzf34-row';
     item.textContent='ID '+r.row_no+' · '+r.source_key.slice(0,55)+
       (r.market_date?' · '+r.market_date:'')+' · '+r.source_kind;
     list.appendChild(item);
   }
   if(rows.length)nextCursor=Number(rows.at(-1).row_no);
   loaded+=rows.length;
   status(rows.length?'Consulta autenticada · '+loaded+' registros desta seleção':'Fim dos resultados','ok');
 }catch(error){status(error.message||'Falha ao consultar F34','warn');}
 finally{working=false;}
}
const css=document.createElement('style');css.textContent=`
#brzf34-launch{position:fixed;left:14px;bottom:14px;z-index:2147483001;
 background:#143d54;color:#fff;border:1px solid #527080;border-radius:10px;padding:10px 14px;
 font:600 12px Arial,sans-serif;box-shadow:0 6px 18px #0004;cursor:pointer}
#brzf34-panel{position:fixed;left:14px;bottom:58px;z-index:2147483001;
 width:min(380px,calc(100vw - 28px));max-height:75vh;overflow:auto;box-sizing:border-box;
 background:#fff;color:#172638;border:1px solid #bcc8d3;border-radius:12px;padding:15px;
 box-shadow:0 12px 32px #0003;font:13px Arial,sans-serif}
#brzf34-panel[hidden]{display:none!important}#brzf34-panel h3{font-size:15px;margin:0 0 7px}
#brzf34-panel p{font-size:12px;line-height:1.4;margin:6px 0}
#brzf34-panel label{font-size:12px;font-weight:bold;display:block;margin-top:8px}
#brzf34-panel select,#brzf34-panel input{width:100%;box-sizing:border-box;padding:7px;border:1px solid #b8c7d4;border-radius:6px}
#brzf34-panel button{cursor:pointer;border:1px solid #8b9eaf;background:#eef4f8;border-radius:7px;padding:8px;margin:7px 6px 0 0}
#brzf34-status{font-size:12px;background:#eef4f8;padding:7px;border-radius:6px;margin:7px 0;line-height:1.4}
#brzf34-status[data-state='ok']{color:#17663e}#brzf34-status[data-state='warn']{color:#a32921}
#brzf34-rows{max-height:150px;overflow:auto}.brzf34-row{border-top:1px solid #edf1f4;padding:5px 0;font:11px Arial,sans-serif}
#brzf34-counts{font:11px Arial,sans-serif;display:grid;grid-template-columns:1fr 1fr;gap:3px}
`;document.head.appendChild(css);
const launch=document.createElement('button');launch.id='brzf34-launch';launch.type='button';
launch.textContent='Mercado F34 · PG';document.body.appendChild(launch);
const panel=document.createElement('section');panel.id='brzf34-panel';panel.hidden=true;
panel.innerHTML='<h3>BRZ Replacement · Mercado F34</h3>'+
 '<p>Fontes V4FQ no PostgreSQL, sob a mesma sessão mesa/admin do Banco F33.</p>'+
 '<p>Leitura autenticada, sem modificar o motor financeiro HTML. Integração aos cálculos: F35.</p>'+
 '<div id="brzf34-status">Desconectado. Acesse Banco F33 primeiro.</div>'+
 '<div id="brzf34-counts"></div>'+
 '<label for="brzf34-domain">Base de mercado</label><select id="brzf34-domain">'+
 domains.map(d=>'<option value="'+d+'">'+d+'</option>').join('')+'</select>'+
 '<label for="brzf34-from-date">Data inicial (opcional, curvas/físico/marítimo)</label>'+
 '<input id="brzf34-from-date" type="date" />'+
 '<button id="brzf34-reconcile" type="button">Conferir 6 bases</button>'+
 '<button id="brzf34-page" type="button">Consultar +100</button>'+
 '<div id="brzf34-rows"></div>';
document.body.appendChild(panel);
$('brzf34-domain').value=current;
$('brzf34-domain').addEventListener('change',reset);
$('brzf34-from-date').addEventListener('change',reset);
$('brzf34-reconcile').addEventListener('click',async()=>{try{await counts()}catch(e){status(e.message,'warn')}});
$('brzf34-page').addEventListener('click',inspect);
launch.addEventListener('click',()=>{panel.hidden=!panel.hidden;});
window.BRZF34=Object.freeze({status:()=>({connected:!!window.BRZF33?.status?.().connected,
   domain:current,loadedInInspector:loaded,snapshotReady:!!countsCache}),
  counts:()=>counts(),page:(opts)=>page(opts),lookup:(opts)=>lookup(opts)});
})();
