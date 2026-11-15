
/* ═══ V4EG 11/11/2026 · Physical flow — vencimento dominante por volume ═══
   Aba Report, abaixo do bloco 1. Soja e milho lado a lado; seções empilhadas.
   Fonte Calibri e cores dos boletins Agrinvest (soja #3A5A27, milho #8B5E02).
   Janela Day / 7 days / 30 days corridos até a última data de negócio.
   Export = comprador na lista de tradings (regra mercado.tradings).
   Basis: milho FOB porto, soja replacement CFR China; contrato de referência = maior volume.
   Farmer selling = estimativa nacional digitada por dia (state.farmerSelling).
   PNG próprio (pffExportCanvas) pela rota foreignObject 3x da casa (texto fiel), sem cabeçalho duplicado.
   Farmer selling: semana seg–sex da data de referência (5 blocos) + total da semana; total digitado vale no lugar da soma. */
var PFF_PROD={Soja:{nm:'Soybeans',bd:'SOY',acc:'#3A5A27',pre:'S',bl:'CFR China'},Milho:{nm:'Corn',bd:'CORN',acc:'#8B5E02',pre:'C',bl:'FOB'}};
var pffWinP={Soja:'7d',Milho:'7d'};
function pffSetWin(prod,w){ pffWinP[prod]=w; try{ pffRender(); }catch(e){ console.error('pff',e); } }
function _pffIso(d){ return d.toISOString().slice(0,10); }
function _pffShift(iso,n){ var d=new Date(iso+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return _pffIso(d); }
function _pffFmtDate(iso){ var m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return m[Number(iso.slice(5,7))-1]+' '+Number(iso.slice(8,10)); }
function _pffBr(iso){ return iso.split('-').reverse().join('/'); }
function _pffNum(n){ return Math.round(n).toLocaleString('en-US'); }
function _pffSg(n){ return (n>=0?'+':'')+Math.round(n); }
function _pffEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function _pffTradings(){ return (brzRegraParam('mercado.tradings','lista',[])||[]).map(function(x){ return String(x).toUpperCase().trim(); }).filter(Boolean); }
function _pffIsExport(d){ var c=String(d.comprador||'').toUpperCase(); return _pffTradings().some(function(t){ return c.indexOf(t)>=0; }); }
function _pffSemana(ref){
  var wd=new Date(ref+'T12:00:00Z').getUTCDay(), seg=_pffShift(ref,-((wd+6)%7)), out=[];
  for(var i=0;i<5;i++) out.push(_pffShift(seg,i));
  return out;
}
function _pffDiasFS(ref){
  var out=[], d=ref, hol=(typeof brzFeriadosMap==='function')?brzFeriadosMap():{}, g=0;
  while(out.length<3 && g++<15){ var wd=new Date(d+'T12:00:00Z').getUTCDay(); if(wd!==0 && wd!==6 && !hol[d]) out.unshift(d); d=_pffShift(d,-1); }
  return out;
}
function _pffFS(prod){ if(!state.farmerSelling) state.farmerSelling={}; if(!state.farmerSelling[prod]) state.farmerSelling[prod]={}; return state.farmerSelling[prod]; }
function _pffFSv(x){ if(x==null) return null; if(typeof x==='number') return {kt:x,oc:null,nc:null}; var kt=(x.kt==null||isNaN(x.kt))?null:Number(x.kt), oc=(x.oc==null||isNaN(x.oc))?null:Number(x.oc); return {kt:kt, oc:oc, nc:(oc==null?null:Math.round((100-oc)*10)/10)}; }
function _pffOcNc(o){ return (o&&o.oc!=null)?(Math.round(o.oc)+'/'+Math.round(100-o.oc)):'—/—'; }
function _pffFSWeek(prod,sem,fs){ /* kt somado e OC/NC ponderado pelos kt; total digitado (W:) prevalece no que foi digitado */
  var tot=0, tem=false, w=0, wk=0;
  sem.forEach(function(d){ var o=_pffFSv(fs[d]); if(o&&o.kt!=null){ tot+=o.kt; tem=true; if(o.oc!=null){ w+=o.oc*o.kt; wk+=o.kt; } } });
  var oc=wk?w/wk:null, tk='W:'+sem[0], man=_pffFSv(fs[tk]), typed=false, typedOc=false;
  if(man){ if(man.kt!=null){ tot=man.kt; tem=true; typed=true; } if(man.oc!=null){ oc=man.oc; typedOc=true; } }
  return {kt:tem?tot:null, oc:oc, typed:typed, typedOc:typedOc};
}
function _pffFSCell(prod,o){ var kt=(o&&o.kt!=null)?_pffNum(o.kt):'—'; var s='<b>'+kt+'</b>'; if(prod==='Soja') s+='<small class="pff-ocnc">OC/NC<br>'+_pffOcNc(o)+'</small>'; return s; }

function pffEditFS(prod,iso){
  var cur=_pffFSv(_pffFS(prod)[iso]);
  var v=prompt('Brazil farmer selling · '+(prod==='Soja'?'soybeans':'corn')+' · '+_pffBr(iso)+' (kt, national estimate). Empty = clear.', (cur&&cur.kt!=null)?String(cur.kt):'');
  if(v===null) return;
  v=String(v).trim().replace(',','.');
  if(v===''){ delete _pffFS(prod)[iso]; try{ if(typeof persist==='function') persist(); }catch(e){} pffRender(); return; }
  var n=Number(v); if(!isFinite(n)||n<0){ alert('Type a number in kt.'); return; }
  if(prod!=='Soja'){ _pffFS(prod)[iso]=n; }
  else {
    var p=prompt('Soybeans · '+_pffBr(iso)+' · % old crop (OC). New crop = 100 − OC. Empty = no split.', (cur&&cur.oc!=null)?String(cur.oc):'');
    if(p===null) return;
    p=String(p).trim().replace('%','').replace(',','.');
    var oc=(p==='')?null:Number(p); if(oc!=null&&(!isFinite(oc)||oc<0||oc>100)){ alert('OC must be between 0 and 100.'); return; }
    _pffFS(prod)[iso]={kt:n,oc:oc};
  }
  try{ if(typeof persist==='function') persist(); }catch(e){}
  pffRender();
}
function pffEditFSTotal(prod,key){
  var cur=_pffFSv(_pffFS(prod)[key]);
  var v=prompt('Brazil farmer selling · '+(prod==='Soja'?'soybeans':'corn')+' · week total (kt, national estimate). Empty = use the sum of the days.', (cur&&cur.kt!=null)?String(cur.kt):'');
  if(v===null) return;
  v=String(v).trim().replace(',','.');
  var n=(v==='')?null:Number(v); if(n!=null&&(!isFinite(n)||n<0)){ alert('Type a number in kt.'); return; }
  var oc=null;
  if(prod==='Soja'){
    var p=prompt('Soybeans · week · % old crop (OC). Empty = weighted average of the days.', (cur&&cur.oc!=null)?String(cur.oc):'');
    if(p===null) return;
    p=String(p).trim().replace('%','').replace(',','.'); oc=(p==='')?null:Number(p); if(oc!=null&&(!isFinite(oc)||oc<0||oc>100)){ alert('OC must be between 0 and 100.'); return; }
  }
  if(n==null&&oc==null){ delete _pffFS(prod)[key]; }
  else { _pffFS(prod)[key]=(prod==='Soja')?{kt:n,oc:oc}:n; }
  try{ if(typeof persist==='function') persist(); }catch(e){}
  pffRender();
}
var _pffCache={k:'',m:{}};
function _pffBasis(d,isSoja){
  var key=(state.negocios||[]).length+'|'+((state&&state._version)||0)+'|'+((typeof MARKET_SNAPSHOT_ID!=='undefined')?MARKET_SNAPSHOT_ID:'');
  if(_pffCache.k!==key){ _pffCache={k:key,m:{}}; }
  if(_pffCache.m[d.id]!==undefined) return _pffCache.m[d.id];
  var v=null;
  try{ var c=computePortComparison(d), best=null;
    (c&&c.results||[]).forEach(function(p){ var x=p.best; if(!x||x.basisFOB==null||isNaN(x.basisFOB)) return; if(!best||x.basisFOB<best.basisFOB) best=x; });
    if(best){ v=isSoja?best.replacementCFRBasis:best.basisFOB; if(v==null||!isFinite(v)) v=null; }
  }catch(e){}
  _pffCache.m[d.id]=v; return v;
}
/* V4ET: canonicaliza as CHAVES de visualização do embarque sem alterar
   d.embarque, d.embarqueFisicoOrigem nem os meses operacionais do replacement.
   A janela CIP Brasil–Paraguai permanece MULTIMÊS, nunca atribuída a dezembro.
   "Dec-26 (referência operacional)" é agregada ao mês Dec-26 apenas no gráfico. */
function _pffEmbBucket(d, portoRaw, origemOverride){
  /* F56: existing single-case reporting bucket from private authenticated overrides.
     Preserve the original contract window; never infer actual port departure. */
  if(d && window.parent.__BRZF56_PRIVATE_RUNTIME?.specialPortId===d.id
     && window.parent.__BRZF56_PRIVATE_RUNTIME?.specialPortDate===d.data) return 'Dec-26';
  var porto=(portoRaw==null?'':String(portoRaw)).trim();
  if(porto && !/^(?:null|undefined|nan|n\/?d)$/i.test(porto)){
    return porto.replace(/\s*\(\s*refer[eê]ncia operacional\s*\)\s*$/i,'').trim();
  }
  var origem=String(origemOverride==null?(d&&d.embarqueFisicoOrigem||''):origemOverride).trim();
  var w=origem.match(/^([A-Za-z]{3})-(\d{2})\s*\/\s*([A-Za-z]{3})-(\d{2})$/);
  if(w){
    var faixa=(w[2]===w[4])?(w[1]+'–'+w[3]+'/'+w[2]):(w[1]+'-'+w[2]+' a '+w[3]+'-'+w[4]);
    var modal=String(d&&d.modalidadeComercial||'').toUpperCase();
    return faixa+(modal==='CIP'?' (CIP)':' (janela)');
  }
  return 'Sem janela definida';
}
function pffCompute(prod,ref,win){
  var n=win==='dia'?1:(win==='7d'?7:30), ini=_pffShift(ref,-(n-1)), isSoja=prod==='Soja';
  var L=(state.negocios||[]).filter(function(d){
    if(d.foraEscopo || d.status==='PEDIDO NÃO FECHADO') return false;
    /* V4EU: painel Corn contabiliza exclusivamente MILHO. Sorgo fica
       somente em sua commodity de origem, sem contaminar KPIs ou basis. */
    var p=normalizeProduto(d.produto); if(isSoja? p!=='Soja' : p!=='Milho') return false;
    return String(d.data)>=ini && String(d.data)<=ref;
  });
  var r={ini:ini,fim:ref,n:L.length,vol:0,exp:0,uf:{},emb:{},bas:[],semRep:0,semRepTon:0,foraMercadoN:0,foraMercadoTon:0};
  L.forEach(function(d){
    var v=Number(d.volume)||0; r.vol+=v; if(_pffIsExport(d)) r.exp+=v;
    var uf=(typeof rpmStateOf==='function')?rpmStateOf(d):'OUTROS'; if(uf==='OUTROS') uf='Other'; r.uf[uf]=(r.uf[uf]||0)+v;
    if(Array.isArray(d.lotesEmbarque)&&d.lotesEmbarque.length>=2){
      d.lotesEmbarque.forEach(function(l){
        var bucket=_pffEmbBucket(d,l.embarquePorto,l.embarqueOrigem);
        r.emb[bucket]=(r.emb[bucket]||0)+(Number(l.volume)||0);
      });
    } else {
      var _embPortoPFF=d.embarque;
      if(!isSoja && d.regraMilhoSantosDez2026 && d.regraMilhoSantosDez2026.tipo==='por_porto'){
        try{var _cmpPortoPFF=computePortComparison(d);
          if(_cmpPortoPFF && _cmpPortoPFF.bestPort==='Santos') _embPortoPFF='Dec-26';
        }catch(_ePFF){}
      }
      var bucket=_pffEmbBucket(d,_embPortoPFF);
      r.emb[bucket]=(r.emb[bucket]||0)+v;
    }
    // Só excluir quando o próprio reporte exigir, ou faltar dado indispensável.
    var excl=!!(d.foraMercado || d.naoAbrirMercado), ok=!excl && !d.replacementPendente;
    if(excl){ r.foraMercadoN++; r.foraMercadoTon+=v; }
    if(ok&&Array.isArray(d.lotesEmbarque)&&d.lotesEmbarque.length>=2){
      var missed=0;
      d.lotesEmbarque.forEach((l,i)=>{
        var virtual=Object.assign({},d,{id:d.id+'@L'+i,volume:l.volume,
          embarque:l.embarquePorto,embarqueFisicoOrigem:l.embarqueOrigem,
          retirada:l.retirada||d.retirada,vencCBOT:l.vencCBOT,vencFreteCBOT:l.vencCBOT,
          cbot:l.cbot,cbotFechamento:l.cbot,lotesEmbarque:null,replacementPendente:false});
        var basis=_pffBasis(virtual,isSoja),lv=Number(l.volume)||0;
        if(basis==null||!isFinite(basis)){missed+=lv;r.semRepTon+=lv;}
        else r.bas.push({b:Number(basis),v:lv,c:l.vencCBOT,id:d.id+'@L'+i});
      });
      if(missed>0)r.semRep++;
    }else{
      var b=ok?_pffBasis(d,isSoja):null;
      if(b==null || !isFinite(b)){ r.semRep++; r.semRepTon+=v; }
      else {
        var _vencPFF=d.vencCBOT||'SEM VENCIMENTO';
        if(!isSoja && d.regraMilhoSantosDez2026 && d.regraMilhoSantosDez2026.tipo==='por_porto'){
          try{var _cmpVencPFF=computePortComparison(d);
            if(_cmpVencPFF && _cmpVencPFF.bestPort==='Santos') _vencPFF='Z26';
          }catch(_ePffVenc){}
        }
        r.bas.push({b:Number(b),v:v,c:_vencPFF,id:d.id});
      }
    }
  });
  // Não descartar vencimentos minoritários: cada contrato CBOT tem distribuição própria.
  var groups={}, monthOrder={F:1,G:2,H:3,J:4,K:5,M:6,N:7,Q:8,U:9,V:10,X:11,Z:12};
  r.bas.forEach(function(x){ (groups[x.c]=groups[x.c]||[]).push(x); });
  r.basisGroups=Object.keys(groups).sort(function(a,b){
    var ya=Number(a.slice(1)),yb=Number(b.slice(1));
    if(isFinite(ya)&&isFinite(yb)&&ya!==yb)return ya-yb;
    return (monthOrder[a.slice(0,1)]||99)-(monthOrder[b.slice(0,1)]||99);
  }).map(function(code){
    var B=groups[code],tv=B.reduce(function(a,x){return a+x.v;},0),bins={};
    B.forEach(function(x){var k=Math.floor(x.b/20)*20;bins[k]=(bins[k]||0)+x.v;});
    return {ref:code,n:B.length,vol:tv,min:Math.min.apply(null,B.map(function(x){return x.b;})),max:Math.max.apply(null,B.map(function(x){return x.b;})),
      avg:tv?B.reduce(function(a,x){return a+x.b*x.v;},0)/tv:null,
      bins:Object.keys(bins).map(Number).sort(function(a,b){return a-b;}).map(function(k){return [k,bins[k]];})};
  });
  r.basisN=new Set(r.bas.map(x=>String(x.id).split('@L')[0])).size;
  r.basisTon=r.bas.reduce(function(a,x){return a+x.v;},0);
  // V4EG (11/11): modelo original do Physical Flow — apenas o vencimento
  // com MAIOR VOLUME de replacement calculavel. Desempate: negocios,
  // depois ordem de vencimento ja estabelecida em basisGroups.
  // Nunca excluir negocios por marcacao automatica "indicativo".
  var order=r.basisGroups.map(function(g,i){return {g:g,i:i};});
  order.sort(function(a,b){return b.g.vol-a.g.vol || b.g.n-a.g.n || a.i-b.i;});
  r.basis=order.length?order[0].g:null;
  r.basisOutros=r.basisGroups.filter(function(g){return g!==r.basis;});
  return r;
}
function _pffNotaDominante(r){
  var fo=(r.basisOutros||[]).map(function(g){return g.n+' in '+g.ref;}).join(', ');
  var sem=Math.max(0,r.semRep-r.foraMercadoN);
  return (fo?'Excluded from basis: '+fo+'. ':'')
    +(r.foraMercadoN?r.foraMercadoN+' explicitly outside market. ':'')
    +(sem?sem+' without replacement. ':'');
}
function _pffAmostraDominante(r){
  var b=r.basis; if(!b) return '';
  var p=r.vol?(100*b.vol/r.vol).toFixed(1):'0.0';
  return b.n+'/'+r.n+' trades · '+_pffNum(b.vol)+'/'+_pffNum(r.vol)+' t ('+p+'% of Desk volume)';
}
function _pffRow(l,v,t){ var p=t?v/t*100:0; return '<div class="pff-r"><em>'+_pffEsc(l)+'</em><div class="pff-tr"><div style="width:'+p.toFixed(1)+'%"></div></div><span>'+p.toFixed(1)+'%</span></div>'; }
function _pffMeta(prod,ref){
  var m=PFF_PROD[prod], w=pffWinP[prod]||'7d', r=pffCompute(prod,ref,w);
  var wl=w==='dia'?'Day':(w==='7d'?'Last 7 days':'Last 30 days'), wt=w==='dia'?'day':(w==='7d'?'7 days':'30 days');
  var per=(w==='dia'?_pffFmtDate(ref):_pffFmtDate(r.ini)+' to '+_pffFmtDate(ref))+', '+ref.slice(0,4);
  return {m:m,w:w,r:r,wl:wl,wt:wt,per:per,title:m.nm+' physical flow — Number of trades by Agrinvest Desk',sub:wl+' · '+per+' · export = trading buyers · basis gross, no tax incentive'};
}
/* corpo do card (tela e PNG): blocos de volume, farmer selling e seções empilhadas */
function pffBody(prod,ref,forExport){
  var x=_pffMeta(prod,ref), m=x.m, r=x.r, fs=_pffFS(prod), sem=_pffSemana(ref), hol=(typeof brzFeriadosMap==='function')?brzFeriadosMap():{};
  var tk='W:'+sem[0], wk=_pffFSWeek(prod,sem,fs), tem=(wk.kt!=null), tot=wk.kt||0, tman=wk.typed?wk.kt:null;
  var wlab='Week '+_pffFmtDate(sem[0])+'–'+Number(sem[4].slice(8,10));
  var h='<div class="pff-lb">Agrinvest Desk</div><div class="pff-k"><div><span>Desk volume</span><b>'+_pffNum(r.vol)+' t</b></div><div><span>Number of trades</span><b>'+r.n+'</b></div></div>'
    +'<div class="pff-lb">Brazil farmer selling · national estimate (kt)</div><div class="pff-fs">'
    +'<div class="pff-fst'+(forExport?'':' pff-fsd')+'"'+(forExport?'':' onclick="pffEditFSTotal(\''+prod+'\',\''+tk+'\')" title="Click to type the week total (kt). Empty = sum of the days"')+'><span>'+wlab+((wk.typed||wk.typedOc)&&!forExport?' · typed':'')+'</span><b>'+(tem?_pffNum(tot)+' kt':'— kt')+'</b>'+(prod==='Soja'?'<small class="pff-ocnc">OC/NC<br>'+_pffOcNc(wk)+'</small>':'')+'</div>'
    +sem.map(function(d){ var o=_pffFSv(fs[d]), ho=!!hol[d], wd=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(d+'T12:00:00Z').getUTCDay()];
      return '<div'+(forExport?'':' class="pff-fsd" onclick="pffEditFS(\''+prod+'\',\''+d+'\')" title="Click to type the national estimate (kt'+(prod==='Soja'?' and % old crop':'')+')"')+'><span>'+wd+' '+_pffFmtDate(d).split(' ')[1]+(ho?' · hol.':'')+'</span>'+_pffFSCell(prod,o)+'</div>'; }).join('')+'</div>';
  var nota='';
  if(!r.n){ h+='<div class="pff-empty">No Agrinvest Desk deals in this period.</div>'; }
  else{
    var ufs=Object.keys(r.uf).sort(function(a,b){return r.uf[b]-r.uf[a];}), embs=Object.keys(r.emb).sort(function(a,b){ return brzEmbOrdem(a)-brzEmbOrdem(b); });
    h+='<div class="pff-sec">Domestic × export</div>'+_pffRow('Export',r.exp,r.vol)+_pffRow('Domestic',r.vol-r.exp,r.vol)
      +'<div class="pff-sec">By origin (state)</div>'+ufs.map(function(u){ return _pffRow(u,r.uf[u],r.vol); }).join('')
      +'<div class="pff-sec">By shipment</div>'+embs.map(function(e){ return _pffRow(e,r.emb[e],r.vol); }).join('');
    var b=r.basis;
    if(b){
      h+='<div class="pff-sec">Replacement basis '+m.bl+' · '+m.pre+b.ref+' · gross</div>'
        +'<div class="pff-bh">Range <b>'+_pffSg(b.min)+'</b> to <b>'+_pffSg(b.max)+'</b> · weighted avg <b>'+_pffSg(b.avg)+'</b> ¢/bu</div>'
        +b.bins.map(function(q){return _pffRow(_pffSg(q[0])+'/'+(q[0]+19),q[1],b.vol);}).join('')
        +'<div class="pff-bh">Selected maturity: '+_pffAmostraDominante(r)+'</div>';
      nota=_pffNotaDominante(r);
    } else { h+='<div class="pff-sec">Replacement basis '+m.bl+'</div><div class="pff-bh">No deal with calculable replacement in this period.</div>'; nota=_pffNotaDominante(r); }
  }
  h+='<div class="pff-n"><span>'+nota+'Shares over Agrinvest Desk volume; farmer selling is a national estimate.</span><b>'+m.bd+' · '+_pffBr(ref)+'</b></div>';
  return h;
}
function pffCard(prod,ref){
  var x=_pffMeta(prod,ref), m=x.m;
  return '<div class="a-card pff-card" style="--pff-acc:'+m.acc+'" data-pff-prod="'+prod+'" data-pff-ref="'+ref+'" data-export-title="'+_pffEsc(x.title)+'" data-export-sub="'+_pffEsc(x.sub)+'">'
    +'<div class="pff-h"><div><span class="pff-bd">'+m.bd+'</span><span class="pff-t">'+m.nm+' · physical flow</span><div class="pff-s">Number of trades by Agrinvest Desk · '+_pffEsc(x.per)+'</div></div></div>'
    +'<div class="pff-tg a-noexport">'+['dia','7d','30d'].map(function(w){ return '<button class="'+(w===x.w?'on':'')+'" onclick="pffSetWin(\''+prod+'\',\''+w+'\')">'+(w==='dia'?'Day':w==='7d'?'7 days':'30 days')+'</button>'; }).join('')
    +'<button class="pff-story-btn" onclick="pffExportStory(this)" title="Story photo (9:16, 2160 × 3840)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Story 9:16</button></div>'
    +pffBody(prod,ref,false)+'</div>';
}
function pffRender(){
  var host=document.getElementById('rep-physical'); if(!host) return;
  var ref=(state.negocios||[]).reduce(function(a,d){ return (!d.foraEscopo && d.data>a)?d.data:a; },'');
  if(!ref){ host.innerHTML=''; return; }
  host.innerHTML='<div class="rep-sec">Physical flow — Number of trades by Agrinvest Desk</div>'
    +'<div class="pff-ss">Window ending on the last deal date ('+_pffEsc(_pffBr(ref))+') · export = trading buyers (rule mercado.tradings) · soybean basis CFR China, corn basis FOB · gross, no tax incentive</div>'
    +'<div class="pff-pair">'+pffCard('Soja',ref)+pffCard('Milho',ref)+'</div>';
  try{ if(typeof brzAddCamButtons==='function') brzAddCamButtons(host); }catch(e){}
}
/* PNG próprio: moldura com título na cor do produto, fonte Calibri, sem cabeçalho duplicado */
function pffExportCanvas(card){
  var prod=card.getAttribute('data-pff-prod')||'Soja', ref=card.getAttribute('data-pff-ref');
  var x=_pffMeta(prod,ref), m=x.m;
  var wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;left:-10000px;top:0;width:820px;background:#fff';
  wrap.innerHTML='<div class="pff-x" style="--pff-acc:'+m.acc+'"><div class="pff-xh"><div><div class="pff-xt">'+_pffEsc(x.title)+'</div><div class="pff-xs">'+_pffEsc(x.sub)+'</div></div><div class="pff-xl">AGRINVEST COMMODITIES<span>A Division of Marex</span></div></div>'
    +pffBody(prod,ref,true)+'<div class="pff-xf"><span>BRZ Replacement Engine</span><span>'+ref+'</span></div></div>';
  document.body.appendChild(wrap);
  var fp; try{ fp=(document.fonts&&document.fonts.ready)||Promise.resolve(); }catch(e){ fp=Promise.resolve(); }
  return Promise.resolve(fp).then(function(){
    wrap.offsetWidth;
    return pffFrameToCanvas(wrap,5);
    return window.html2canvas(wrap,{scale:3,backgroundColor:'#ffffff',logging:false}).then(function(cv){ try{ wrap.remove(); }catch(e){} return cv; });
  });
}
/* rasteriza pela rota foreignObject (texto nativo do navegador); alturas e larguras dos filhos
   não são fixadas, para o texto refluir se a fonte medir diferente; html2canvas só como reserva */
function pffFrameToCanvas(frame,scale,fixedH,exato){
  return new Promise(function(resolve,reject){
    var done=false, finish=function(c){ if(done) return; done=true; try{ frame.remove(); }catch(e){} resolve(c); };
    var fallback=function(){ if(typeof html2canvas==='undefined'){ try{ frame.remove(); }catch(e){} reject(new Error('html2canvas')); return; }
      html2canvas(frame,{scale:scale,backgroundColor:'#ffffff',logging:false}).then(finish).catch(function(e){ try{ frame.remove(); }catch(_e){} reject(e); }); };
    try{
      var W=frame.offsetWidth, H=fixedH||(frame.offsetHeight+24);
      var skip={position:1,left:1,top:1,right:1,bottom:1,height:1,'block-size':1,'min-block-size':1,'max-block-size':1,width:1,'inline-size':1};
      var css=function(el,root){ try{ var cs=getComputedStyle(el), st='', vazio=!root && !String(el.textContent||'').trim(); for(var i=0;i<cs.length;i++){ var p=cs.item(i); if(p.indexOf('--')===0) continue; if(skip[p] && !(exato && p!=='position' && p!=='left' && p!=='top' && p!=='right' && p!=='bottom') && !(root && (p==='width'||p==='inline-size'||(fixedH&&(p==='height'||p==='block-size')))) && !(vazio && p!=='position' && p!=='left' && p!=='top' && p!=='right' && p!=='bottom')) continue; var v=cs.getPropertyValue(p); if(v!=='') st+=p+':'+v+';'; }
          if(!root && el.style && el.style.width) st+='width:'+el.style.width+';';
          if(!root && el.style && el.style.height) st+='height:'+el.style.height+';';
          if(!root && el.style && el.style.marginBottom) st+='margin-bottom:'+el.style.marginBottom+';';
          return st+(root?'position:static;left:auto;top:auto;':''); }catch(e){ return null; } };
      var all=[frame].concat(Array.prototype.slice.call(frame.querySelectorAll('*'))), sts=all.map(function(el,i){ return css(el,i===0); });
      all.forEach(function(el,i){ if(sts[i]!=null) el.setAttribute('style',sts[i]); });
      var xhtml=new XMLSerializer().serializeToString(frame);
      /* SVG já no tamanho final (viewBox): o navegador desenha o vetor na resolução cheia, sem ampliar bitmap */
      var CW=Math.round(W*scale), CH=Math.round(H*scale);
      var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+CW+'" height="'+CH+'" viewBox="0 0 '+W+' '+H+'"><foreignObject x="0" y="0" width="'+W+'" height="'+H+'"><div xmlns="http://www.w3.org/1999/xhtml">'+xhtml+'</div></foreignObject></svg>';
      var img=new Image(CW,CH);
      img.onload=function(){ try{ var c=document.createElement('canvas'); c.width=CW; c.height=CH; var x=c.getContext('2d'); x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high'; x.fillStyle='#ffffff'; x.fillRect(0,0,CW,CH); x.drawImage(img,0,0,CW,CH); finish(c); }catch(e){ fallback(); } };
      img.onerror=function(){ fallback(); };
      img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    }catch(e){ fallback(); }
  });
}
function pffExportPNG(card){
  var prod=card.getAttribute('data-pff-prod')||'Soja', ref=card.getAttribute('data-pff-ref');
  return pffExportCanvas(card).then(function(cv){
    var a=document.createElement('a'); a.href=cv.toDataURL('image/png');
    a.download='BRZ_'+(prod==='Soja'?'Soybeans':'Corn')+'_physical_flow_'+(pffWinP[prod]||'7d')+'_'+ref+'.png';
    document.body.appendChild(a); a.click(); a.remove();
  }).catch(function(e){ console.error('pff export',e); alert('Export failed: '+e); });
}
(function(){
  var _prevR=window.renderReport;
  if(typeof _prevR==='function') window.renderReport=function(){ var out=_prevR.apply(this,arguments); try{ pffRender(); }catch(e){ console.error('pff',e); } return out; };
  var _pe=window.brzExportCard, _pc=window.brzCardCanvas;
  window.brzCardCanvas=function(card){ if(card&&card.classList&&card.classList.contains('pff-card')) return pffExportCanvas(card); return _pc?_pc.apply(this,arguments):Promise.reject(new Error('no exporter')); };
  window.brzExportCard=function(btn){ var card=btn&&btn.closest?btn.closest('.pff-card'):null; if(card) return pffExportPNG(card); return _pe?_pe.apply(this,arguments):undefined; };
})();

/* ═══ V4BO/V4BQ 05/11/2026 · Foto 2 (story 9:16, 2160 × 3840) do Physical flow ═══
   Mesmo conteúdo e estilo da foto 1, seções empilhadas, formato retrato de celular.
   Se o conteúdo passar da altura (janelas longas), o bloco é reduzido por igual para caber. */
function pffStoryHTML(prod,ref){
  var x=_pffMeta(prod,ref), m=x.m, r=x.r, fs=_pffFS(prod), sem=_pffSemana(ref), hol=(typeof brzFeriadosMap==='function')?brzFeriadosMap():{};
  var wk=_pffFSWeek(prod,sem,fs), tem=(wk.kt!=null), tot=wk.kt||0;
  var R=function(l,v,t){ var p=t?v/t*100:0; return '<div class="pst-r"><em>'+_pffEsc(l)+'</em><div class="pst-tr"><div style="width:'+p.toFixed(1)+'%"></div></div><span>'+p.toFixed(1)+'%</span></div>'; };
  var h='<div class="pst-h"><div class="pst-br">AGRINVEST COMMODITIES<span>A Division of Marex</span></div>'
    +'<div class="pst-t">'+_pffEsc(x.title)+'</div><div class="pst-s">'+_pffEsc(x.sub)+'</div></div>'
    +'<div class="pst-lb">Agrinvest Desk</div><div class="pst-k"><div><span>Desk volume</span><b>'+_pffNum(r.vol)+' t</b></div><div><span>Number of trades</span><b>'+r.n+'</b></div></div>'
    +'<div class="pst-lb">Brazil farmer selling · national estimate (kt)</div><div class="pst-fs"><div><span>Week '+_pffFmtDate(sem[0])+'–'+Number(sem[4].slice(8,10))+'</span><b>'+(tem?_pffNum(tot):'—')+'</b>'+(prod==='Soja'?'<small class="pff-ocnc">OC/NC<br>'+_pffOcNc(wk)+'</small>':'')+'</div>'
    +sem.map(function(d){ var v=fs[d], wd=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(d+'T12:00:00Z').getUTCDay()]; return '<div><span>'+wd+' '+Number(d.slice(8,10))+(hol[d]?' · hol.':'')+'</span>'+_pffFSCell(prod,_pffFSv(v))+'</div>'; }).join('')+'</div>';
  var nota='';
  if(!r.n){ h+='<div class="pst-empty">No Agrinvest Desk deals in this period.</div>'; }
  else{
    var ufs=Object.keys(r.uf).sort(function(a,b){return r.uf[b]-r.uf[a];}), embs=Object.keys(r.emb).sort(function(a,b){ return brzEmbOrdem(a)-brzEmbOrdem(b); });
    h+='<div class="pst-sec">Domestic × export</div>'+R('Export',r.exp,r.vol)+R('Domestic',r.vol-r.exp,r.vol)
      +'<div class="pst-sec">By origin (state)</div>'+ufs.map(function(u){ return R(u,r.uf[u],r.vol); }).join('')
      +'<div class="pst-sec">By shipment</div>'+embs.map(function(e){ return R(e,r.emb[e],r.vol); }).join('');
    var b=r.basis;
    if(b){
      h+='<div class="pst-sec">Replacement basis '+m.bl+' · '+m.pre+b.ref+' · gross</div>'
        +'<div class="pst-bh">Range <b>'+_pffSg(b.min)+'</b> to <b>'+_pffSg(b.max)+'</b> · weighted avg <b>'+_pffSg(b.avg)+'</b> ¢/bu</div>'
        +b.bins.map(function(q){return R(_pffSg(q[0])+'/'+(q[0]+19),q[1],b.vol);}).join('')
        +'<div class="pst-bh">Selected maturity: '+_pffAmostraDominante(r)+'</div>';
      nota=_pffNotaDominante(r);
    } else { h+='<div class="pst-sec">Replacement basis '+m.bl+'</div><div class="pst-bh">No deal with calculable replacement in this period.</div>'; nota=_pffNotaDominante(r); }
  }
  return {m:m,top:h,foot:'<div class="pst-n">'+nota+'Shares over Agrinvest Desk volume; farmer selling is a national estimate.</div><div class="pst-f"><span>BRZ Replacement Engine</span><b>'+m.bd+' · '+_pffBr(ref)+'</b></div>'};
}
function pffStoryCanvas(card){
  var prod=card.getAttribute('data-pff-prod')||'Soja', ref=card.getAttribute('data-pff-ref'), S=pffStoryHTML(prod,ref);
  var W=360, H=640, wrap=document.createElement('div');
  wrap.className='pst'; wrap.style.cssText='position:fixed;left:-10000px;top:0;width:'+W+'px;height:'+H+'px;--pff-acc:'+S.m.acc;
  wrap.innerHTML='<div class="pst-box"><div class="pst-in">'+S.top+'</div></div><div class="pst-ft">'+S.foot+'</div>';
  document.body.appendChild(wrap);
  var box=wrap.querySelector('.pst-box'), inn=wrap.querySelector('.pst-in'), ft=wrap.querySelector('.pst-ft');
  var L=Math.floor(H-21-ft.offsetHeight-5), alt=inn.scrollHeight;
  box.style.height=L+'px';
  if(alt>L-2){ var k=(L-2)/alt; inn.style.transformOrigin='top left'; inn.style.transform='scale('+k.toFixed(4)+')'; inn.style.width=((W-30)/k).toFixed(1)+'px'; }
  var fp; try{ fp=(document.fonts&&document.fonts.ready)||Promise.resolve(); }catch(e){ fp=Promise.resolve(); }
  return Promise.resolve(fp).then(function(){ wrap.offsetWidth; return pffFrameToCanvas(wrap,6,H,true); });
}
function pffExportStory(btn){
  var card=btn&&btn.closest?btn.closest('.pff-card'):null; if(!card) return;
  var prod=card.getAttribute('data-pff-prod')||'Soja', ref=card.getAttribute('data-pff-ref');
  pffStoryCanvas(card).then(function(cv){
    var a=document.createElement('a'); a.href=cv.toDataURL('image/png');
    a.download='BRZ_'+(prod==='Soja'?'Soybeans':'Corn')+'_physical_flow_story_'+(pffWinP[prod]||'7d')+'_'+ref+'.png';
    document.body.appendChild(a); a.click(); a.remove();
  }).catch(function(e){ console.error('pff story',e); alert('Export failed: '+e); });
}
