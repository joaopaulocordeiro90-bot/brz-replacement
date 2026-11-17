
/* V4Z · 30/10/2026 · pendências visíveis sem replacement fictício */
(function(){
  function _pendingEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function _pendingNum(v,d){return typeof v==='number'&&isFinite(v)?v.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
  function _pendingRows(day){
    return ((typeof state!=='undefined'&&state&&state.negocios)||[]).filter(function(d){
      return d&&d.data===day&&d.produto==='Milho'&&d.replacementPendente===true&&!d.foraMercado&&!d.naoAbrirMercado;
    });
  }
  function _pendingShow(host,day){
    if(!host)return;
    var before=host.querySelector('[data-brz-v4z-pending]');if(before)before.remove();
    if(!day || typeof getActiveProduto!=='function'||getActiveProduto()!=='Milho')return;
    var rows=_pendingRows(day);if(!rows.length)return;
    var sec=document.createElement('section');sec.setAttribute('data-brz-v4z-pending','1');
    sec.style.cssText='margin:16px 24px 22px;padding:15px;border:1px solid var(--g200);border-left:3px solid var(--amber);border-radius:8px;background:var(--card)';
    var h='<div style="font-size:13px;font-weight:800;color:var(--navy-ink);margin-bottom:6px">Negócios fechados sem replacement validado · '+_pendingEsc(day)+'</div>'+
      '<div style="font-size:11.5px;color:var(--g600);margin-bottom:11px">Estes contratos constam no livro e no volume fechado, mas ficam fora das médias, rankings e margens de exportação até a confirmação dos termos necessários. O DOLZ26 marcado como indicativo não resolve a pendência logística.</div>'+
      '<div class="tableWrap"><table class="table" style="min-width:740px"><thead><tr><th>Negócio</th><th>Origem / destino reportado</th><th>Volume</th><th>Preço final</th><th>CBOT</th><th>Câmbio</th><th>Status</th></tr></thead><tbody>';
    rows.forEach(function(d){h+='<tr><td>'+_pendingEsc(d.id)+'</td><td>'+_pendingEsc(d.origem)+'</td><td class="num">'+_pendingNum(d.volume,0)+' t</td><td class="num">R$ '+_pendingNum(d.preco,2)+'/sc</td><td>'+_pendingEsc(d.vencCBOT)+'</td><td>'+_pendingEsc(d.vencCambio)+(d.cambioIndicativo?' (ind.)':'')+' · '+_pendingNum(d.cambio,4)+'</td><td>Origem/termos pendentes — sem replacement</td></tr>';});
    sec.innerHTML=h+'</tbody></table></div>';host.appendChild(sec);
  }
  var _r=window.renderReplacementPorto;
  if(typeof _r==='function')window.renderReplacementPorto=function(){
    var result=_r.apply(this,arguments);
    try{if(typeof rpcBase!=='undefined'&&rpcBase==='negocios')_pendingShow(document.getElementById('corredores'),typeof rpcDate!=='undefined'?rpcDate:null);}
    catch(e){console.warn('V4Z pendentes por porto',e);}return result;
  };
  var _a=window.renderAnalise;
  if(typeof _a==='function')window.renderAnalise=function(){
    var result=_a.apply(this,arguments);
    try{if(typeof analiseBase!=='undefined'&&analiseBase==='negocios')_pendingShow(document.getElementById('analise'),typeof analiseData!=='undefined'?analiseData:null);}
    catch(e){console.warn('V4Z pendentes análise',e);}return result;
  };
})();
