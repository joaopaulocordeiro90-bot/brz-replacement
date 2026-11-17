
/* REPLACEMENT POR PORTO (rpp) · v4 "cards por porto" (01/10/2026, orientação do João)
   Mesmo visual dos cards de estado, invertido: um card por porto, colunas = embarques, linhas CFR / FOB / NEG.
   Valor = MÉDIA SIMPLES dos negócios do embarque fechados pelo porto efetivo no período (D-1, D-7, D-30);
   variação contra a janela anterior equivalente; sem volume, sem ponderação, sem misturar embarques.
   Detalhe: Porto (todas as origens) | Por estado. */
var rppState = { periodo:'acum', detalhe:'porto', cache:{}, cacheKey:'' };
var RPP_UF = {GO:'Goiás',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PR:'Paraná',RS:'Rio Grande do Sul',SC:'Santa Catarina',SP:'São Paulo',TO:'Tocantins',BA:'Bahia',MA:'Maranhão',PI:'Piauí',PA:'Pará',RO:'Rondônia',DF:'Distrito Federal',AL:'Alagoas',SE:'Sergipe',CE:'Ceará',PE:'Pernambuco',RN:'Rio Grande do Norte',PB:'Paraíba',AM:'Amazonas',AC:'Acre',RR:'Roraima',AP:'Amapá',ES:'Espírito Santo',RJ:'Rio de Janeiro'};
var RPP_CODE = {'Santos':'STS','Paranaguá':'PGUA','Itaqui':'ITQ','Barcarena':'BCR','Rio Grande':'RIG','São Francisco do Sul':'SFS','Santarém':'STM','Itacoatiara':'ITC','Tubarão':'TUB'};
function rppUF(origem){ var m=/\s-\s([A-Z]{2})(?:\s|$|\s\+)/.exec(String(origem||'')); return m?m[1]:'??'; }
function rppEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function rppData(iso){ return String(iso||'').split('-').reverse().join('/'); }
function rppDataC(iso){ var p=String(iso||'').split('-'); return p.length===3?(p[2]+'/'+p[1]):iso; }
function rppSetPeriodo(p){ rppState.periodo=String(p); rppInject(); }
function rppSetDetalhe(d){ rppState.detalhe=d; rppInject(); }
function rppObs(){
  var prod=getActiveProduto(); var key=prod+'|'+(typeof MARKET_SNAPSHOT_ID!=='undefined'?MARKET_SNAPSHOT_ID:'')+'|'+(((state||{}).negocios||[]).length);
  if(rppState.cacheKey===key && rppState.cache[prod]) return rppState.cache[prod];
  var src=((state&&state.negocios)||[]).filter(function(d){ return normalizeProduto(d.produto)===prod && !d.foraMercado && d.cbot!=null && d.cambio!=null && (d.volume||0)>0 && d.data; });
  var obs=[];
  src.forEach(function(d){
    var emb=d.embarque; if(!emb){ try{ emb=embarqueInferido(d); }catch(e){} } if(!emb) return;
    var r=null; try{ r=rpcEffectiveRoute(d); }catch(e){} if(!r||!r.porto||r.basisFOB==null||isNaN(r.basisFOB)) return;
    var hk=''; try{ hk=analiseRowKey(Object.assign({},d,{embarque:emb})); }catch(e){ hk=String(d.origem||'')+'|'+emb+'|'+prod; }
    obs.push({id:d.id, data:d.data, emb:emb, porto:r.porto, uf:rppUF(d.origem), origem:d.origem, hk:hk, fob:Number(r.basisFOB), cfr:(r.replacementCFRBasis!=null&&!isNaN(r.replacementCFRBasis)?Number(r.replacementCFRBasis):null), frete:(r.freteTotal!=null&&!isNaN(r.freteTotal)?Number(r.freteTotal):null)});
  });
  rppState.cacheKey=key; rppState.cache={}; rppState.cache[prod]=obs; return obs;
}
function rppMean(list,field){ var v=list.map(function(o){return o[field];}).filter(function(x){return x!=null&&!isNaN(x);}); if(!v.length) return null; return {v:v.reduce(function(s,x){return s+x;},0)/v.length, n:v.length, min:Math.min.apply(null,v), max:Math.max.apply(null,v)}; }
function rppWindow(all, latest, per){
  // Acumulado = todos os negócios de cada embarque desde o primeiro até a última data; variação contra o acumulado até o dia anterior com negócio.
  // D-1 = negócios da última data; D-7 / D-30 = dias corridos até a última data. Retorna {cur, ref, label, start, refLabel}
  var dates=Array.from(new Set(all.map(function(o){return o.data;}))).sort();
  if(per==='acum'){ var s7=rpcShift(latest,-6); return {cur:all.slice(), ref:all.filter(function(o){return o.data>=s7;}), acum:true, label:'Acumulado · desde o 1º negócio de cada embarque até '+rppData(latest), start:dates[0], refLabel:'a média dos últimos 7 dias ('+rppData(s7)+' a '+rppData(latest)+'); seta = recente menos acumulado'}; }
  if(per==='1'){ var prevD=dates.filter(function(d){return d<latest;}).pop()||null; return {cur:all.filter(function(o){return o.data===latest;}), ref:prevD?all.filter(function(o){return o.data===prevD;}):[], label:'D-1 · '+rppData(latest), start:latest, refLabel:prevD?('dia anterior com negócio, '+rppData(prevD)):'sem referência'}; }
  var n=per==='30'?30:7, start=rpcShift(latest,-(n-1)), refEnd=rpcShift(start,-1), refStart=rpcShift(refEnd,-(n-1));
  return {cur:all.filter(function(o){return o.data>=start&&o.data<=latest;}), ref:all.filter(function(o){return o.data>=refStart&&o.data<=refEnd;}), label:'D-'+n+' · '+rppData(start)+' a '+rppData(latest), start:start, refLabel:n+' dias anteriores, '+rppData(refStart)+' a '+rppData(refEnd)};
}
function rppCompute(){
  var prod=getActiveProduto(), isM=prod==='Milho'; var all=rppObs(); if(!all.length) return null;
  var HID=(typeof analiseHiddenRows!=='undefined'&&analiseHiddenRows)||{}; all=all.filter(function(o){ return !HID[o.hk]; }); if(!all.length) return null;
  var latest=all.reduce(function(m,o){return o.data>m?o.data:m;},''); var W=rppWindow(all,latest,rppState.periodo); var cur=W.cur, ref=W.ref;
  if(!cur.length) return null;
  var sep='|', groups={}, groupsR={}, refG={}, refGR={};
  cur.forEach(function(o){ (groups[o.porto+sep+o.emb]=groups[o.porto+sep+o.emb]||[]).push(o); (groupsR[o.porto+sep+o.uf+sep+o.emb]=groupsR[o.porto+sep+o.uf+sep+o.emb]||[]).push(o); });
  ref.forEach(function(o){ (refG[o.porto+sep+o.emb]=refG[o.porto+sep+o.emb]||[]).push(o); (refGR[o.porto+sep+o.uf+sep+o.emb]=refGR[o.porto+sep+o.uf+sep+o.emb]||[]).push(o); });
  var metric=isM?'FOB':'CFR', vals=[], vals1=[]; Object.keys(groups).forEach(function(k){ var m=rppMean(groups[k],isM?'fob':'cfr'); if(!m) return; (groups[k].length>=2?vals:vals1).push(m.v); }); if(!vals.length) vals=vals1;
  var lo=vals.length?Math.min.apply(null,vals):null, hi=vals.length?Math.max.apply(null,vals):null;
  var ports=rpcPorts(); var portList=Array.from(new Set(cur.map(function(o){return o.porto;}))).sort(function(a,b){ var ia=ports.indexOf(a), ib=ports.indexOf(b); if(ia<0)ia=99; if(ib<0)ib=99; return ia-ib; });
  function cellPack(port,emb,uf){
    var g=uf?groupsR[port+sep+uf+sep+emb]:groups[port+sep+emb]; if(!g||!g.length) return null;
    var rg=(uf?refGR[port+sep+uf+sep+emb]:refG[port+sep+emb])||[];
    var curF=rppMean(g,'fob'), curC=isM?null:rppMean(g,'cfr'), refF=rppMean(rg,'fob'), refC=isM?null:rppMean(rg,'cfr'), curT=rppMean(g,'frete'), refT=rppMean(rg,'frete');
    var ds=g.map(function(o){return o.data;}).sort(); var d0=ds[0], d1=ds[ds.length-1];
    var tt=[(uf?RPP_UF[uf]||uf:port)+' · '+emb, g.length+' negócio'+(g.length>1?'s':'')+' · '+rppData(d0)+(d1!==d0?' a '+rppData(d1):''), 'FOB médio '+rpcFmt(curF.v)+' (mín '+rpcFmt(curF.min)+' · máx '+rpcFmt(curF.max)+')'+(curC?' · CFR médio '+rpcFmt(curC.v)+' (mín '+rpcFmt(curC.min)+' · máx '+rpcFmt(curC.max)+')':''), (W.acum?'Últimos 7 dias menos acumulado: FOB ':'Variação vs '+W.refLabel+': FOB ')+(refF?rpcFmtSigned(curF.v-refF.v):'—')+(curC&&refC?' · CFR '+rpcFmtSigned(curC.v-refC.v):'')].join('\n');
    var heatV=isM?curF.v:(curC&&curC.v), styles=rpmHeatStyles(heatV,lo,hi);
    var dl=function(c,r){ if(!c||!r) return [c,null]; return W.acum?[{v:r.v},{v:c.v}]:[c,r]; }; // pares (cur,ref) para a seta
    var pF=dl(curF,refF), pC=dl(curC,refC), pT=dl(curT,refT);
    var keys=Array.from(new Set(g.map(function(o){return o.hk;}))), cidades=Array.from(new Set(g.map(function(o){return String(o.origem||'').split(' + ')[0];})));
    return {curF:curF,curC:curC,refF:refF,refC:refC,curT:curT,refT:refT,dF:pF,dC:pC,dT:pT,n:g.length,d0:d0,d1:d1,tt:tt,styles:styles,keys:keys,cidades:cidades};
  }
  function portData(port){
    var L=cur.filter(function(o){return o.porto===port;});
    var embs=Array.from(new Set(L.map(function(o){return o.emb;}))).sort(function(a,b){return aVencKey(a)-aVencKey(b);}).slice(0,14);
    var origins=[{label:'Todas',uf:null,color:rpmPortColor(port)}];
    if(rppState.detalhe==='estado'){
      var ufs=Array.from(new Set(L.map(function(o){return o.uf;}))); var order={}; ufs.forEach(function(uf){ var m=rppMean(L.filter(function(o){return o.uf===uf;}),isM?'fob':'cfr'); order[uf]=m?m.v:1e9; });
      ufs.sort(function(a,b){return order[a]-order[b];}).forEach(function(uf){ origins.push({label:RPP_UF[uf]||uf,uf:uf,color:rpmStateAccent(uf)}); });
    }
    var rows=[]; origins.forEach(function(og){ var cells={}, has=false; embs.forEach(function(emb){ cells[emb]=cellPack(port,emb,og.uf); if(cells[emb]) has=true; }); if(has) rows.push({origin:og,cells:cells}); });
    return {port:port, n:L.length, embs:embs, rows:rows};
  }
  return {prod:prod,isM:isM,latest:latest,W:W,lo:lo,hi:hi,metric:metric,portList:portList,cellPack:cellPack,portData:portData,totalN:cur.length};
}
function rppXBtn(keys,cidades,escopo){
  if(!keys||!keys.length) return '';
  var lbl='Remover '+(cidades.length===1?cidades[0]:cidades.length+' origens: '+cidades.slice(0,6).join(', ')+(cidades.length>6?'…':''))+' da média'+(escopo?' ('+escopo+')':'')+' · mesma exclusão das tabelas Análise/TAB';
  var arg=keys.join('\u001e').replace(/'/g,"\\'").replace(/"/g,'&quot;');
  return '<button class="a-noexport rpm-xbtn rpp-x" title="'+rppEsc(lbl)+'" onclick="event.stopPropagation();rpmToggleHiddenMany(\''+arg+'\')">×</button>';
}
function rppMM(m){ return (m&&m.n>1)?('<div class="rpp-mm">'+rpcFmt(m.min)+' – '+rpcFmt(m.max)+'</div>'):''; }
function rppBuildHtml(){
  var C=rppCompute(); if(!C) return ''; var prod=C.prod, isM=C.isM, W=C.W, latest=C.latest;
  var perCtl='<label>Período<select onchange="rppSetPeriodo(this.value)">'+[['acum','Acumulado'],['1','Último dia vs anterior'],['7','7d vs 7d anteriores'],['30','30d vs 30d anteriores']].map(function(p){return '<option value="'+p[0]+'"'+(rppState.periodo===p[0]?' selected':'')+'>'+p[1]+'</option>';}).join('')+'</select></label>';
  var detCtl='<label>Detalhe<select onchange="rppSetDetalhe(this.value)"><option value="porto"'+(rppState.detalhe==='porto'?' selected':'')+'>Porto</option><option value="estado"'+(rppState.detalhe==='estado'?' selected':'')+'>Por estado</option></select></label>';
  var h='<div class="rpm-state-section rpp-section" id="rppBlock"><div class="rpm-state-toolbar"><div><div class="rpm-state-section-title">Replacement por porto — janelas de embarque</div><div class="rpm-state-section-sub">Cada card consolida os negócios fechados pelo porto (porto efetivo de cada negócio) · média simples por embarque, sem ponderar por volume · '+(isM?'FOB porto':'FOB porto + CFR China')+' · '+W.label+' · '+(W.acum?'seta compara ':'variação contra ')+W.refLabel+' · escala de cor global '+C.metric+' '+rpcFmt(C.lo)+' → '+rpcFmt(C.hi)+' · mín – máx sob cada média</div></div><div class="rpm-controls">'+detCtl+perCtl+(rpmHiddenCount()?'<button class="a-noexport rpm-restore" title="Restaurar as origens removidas (restaura também nas tabelas Análise/TAB)" onclick="rpmClearHidden()">'+rpmHiddenCount()+' fora da média · restaurar</button>':'')+'</div></div><div class="rpm-state-grid">';
  var cardsHtml=[];
  C.portList.forEach(function(port){
    var P=C.portData(port); var embs=P.embs;
    var tableW=Math.max(530,119+embs.length*114), embW=Math.max(100,Math.floor((tableW-119)/Math.max(1,embs.length)));
    var accent=rpmPortColor(port);
    var card='<div class="a-card rpm-card rpm-state-card rpp-port-card" data-rpp-port="'+rppEsc(port)+'" style="--rpm-accent:'+accent+';--rpm-table-w:'+tableW+'px;--rpm-emb-w:'+embW+'px"><div class="rpm-card-head"><div><div class="a-card-t"><span class="rpm-state-code">'+(RPP_CODE[port]||port.slice(0,3).toUpperCase())+'</span><span class="rpm-state-name">'+rppEsc(port)+'</span></div><div class="rpm-sub">Replacement por embarque — média simples dos negócios ('+(isM?'FOB porto':'FOB porto & CFR China')+', ¢/bu) · '+P.n+' negócio'+(P.n>1?'s':'')+' no período</div></div></div>';
    card+='<div class="rpm-wrap"><table class="rpm-matrix"><colgroup><col class="rpm-col-port"><col class="rpm-col-metric">';
    embs.forEach(function(){card+='<col class="rpm-col-emb">';});
    card+='</colgroup><thead><tr><th class="rpm-port-head">Origem</th><th class="rpm-metric-head"></th>';
    embs.forEach(function(e,i){var sc=rpmSplitClass(e,prod,i?embs[i-1]:null);card+='<th class="'+sc.cl.trim()+'">'+rppEsc(e)+'</th>';});
    card+='</tr></thead><tbody>';
    P.rows.forEach(function(R){
      var og=R.origin, cache=R.cells; var label=og.uf?((og.label.length<=11)?og.label:og.uf):og.label;
      var rowKeys=[], rowCid=[]; embs.forEach(function(emb){ var p=cache[emb]; if(!p) return; p.keys.forEach(function(k){ if(rowKeys.indexOf(k)<0) rowKeys.push(k); }); p.cidades.forEach(function(c){ if(rowCid.indexOf(c)<0) rowCid.push(c); }); });
      var pc='<div class="rpm-port" title="'+rppEsc(og.label)+'"><span class="rpm-dot" style="background:'+og.color+'"></span>'+rppEsc(label)+(og.uf?rppXBtn(rowKeys,rowCid,'todos os embarques'):'')+'</div>';
      var rows=isM?2:3;
      if(!isM){
        card+='<tr class="rpm-port-group-start"><td class="rpm-port-cell" rowspan="'+rows+'">'+pc+'</td><td class="rpm-metric">CFR</td>';
        embs.forEach(function(emb,i){var p=cache[emb],sc=rpmSplitClass(emb,prod,i?embs[i-1]:null);if(!p){card+='<td class="rpm-blank '+sc.cl.trim()+'"></td>';return;}card+='<td class="rpm-value-cell rpp-cell '+sc.cl.trim()+'" title="'+rppEsc(p.tt)+'"><div class="rpm-value-inner rpm-cell-top rpp-vi" style="'+p.styles.top+'"><span class="rpm-num">'+rpcFmt(p.curC&&p.curC.v)+'</span>'+rpmDeltaSpan(p.dC[0],p.dC[1])+rppMM(p.curC)+'</div>'+rppXBtn(p.keys,p.cidades,emb)+'</td>';});
        card+='</tr><tr><td class="rpm-metric">FOB</td>';
      } else {
        card+='<tr class="rpm-port-group-start"><td class="rpm-port-cell" rowspan="'+rows+'">'+pc+'</td><td class="rpm-metric">FOB</td>';
      }
      embs.forEach(function(emb,i){var p=cache[emb],sc=rpmSplitClass(emb,prod,i?embs[i-1]:null);if(!p){card+='<td class="rpm-blank '+sc.cl.trim()+'"></td>';return;}card+='<td class="rpm-value-cell rpp-cell '+sc.cl.trim()+'" title="'+rppEsc(p.tt)+'"><div class="rpm-value-inner '+(isM?'rpm-cell-top':'rpm-cell-mid')+' rpp-vi" style="'+(isM?p.styles.top:p.styles.mid)+'"><span class="rpm-num">'+rpcFmt(p.curF.v)+'</span>'+rpmDeltaSpan(p.dF[0],p.dF[1])+rppMM(p.curF)+'</div>'+(isM?rppXBtn(p.keys,p.cidades,emb):'')+'</td>';});
      card+='</tr><tr class="rpm-port-group-end"><td class="rpm-metric">NEG</td>';
      embs.forEach(function(emb,i){var p=cache[emb],sc=rpmSplitClass(emb,prod,i?embs[i-1]:null);if(!p){card+='<td class="rpm-blank '+sc.cl.trim()+'"></td>';return;}card+='<td class="rpm-avg-cell '+sc.cl.trim()+'" title="'+rppEsc(p.tt)+'"><div class="rpm-value-inner rpm-cell-avg" style="'+p.styles.avg+'"><span class="rpm-avg-text">'+p.n+' neg'+(p.n<3?' · amostra':'')+'</span></div></td>';});
      card+='</tr>';
    });
    card+='</tbody></table></div>';
    card+='<div class="rpm-foot"><span>Média simples dos negócios do embarque fechados por '+rppEsc(port)+' no período; '+(W.acum?'seta = últimos 7 dias menos acumulado':'variação vs '+rppEsc(W.refLabel))+'; mín – máx sob cada média. Amostra = menos de 3 negócios.</span><span class="rpm-foot-right">'+rppEsc(RPP_CODE[port]||port)+' · '+rppData(latest)+'</span></div></div>';
    cardsHtml.push(card);
  });
  for(var ci=0; ci<cardsHtml.length; ci+=2){ h+='<div class="rpm-state-row"><div class="rpm-state-slot">'+cardsHtml[ci]+'</div><div class="rpm-state-slot'+(cardsHtml[ci+1]?'':' is-empty')+'">'+(cardsHtml[ci+1]||'')+'</div></div>'; }
  h+='</div></div>'; return h;
}
/* ───────── exportação própria (PNG e DOCX): tabela limpa na moldura Agrinvest ───────── */
function rppExportFrame(port){
  var C=rppCompute(); if(!C) return null; var P=C.portData(port); var isM=C.isM, W=C.W, embs=P.embs;
  var today=new Date().toISOString().slice(0,10);
  var frame=document.createElement('div'); frame.className='brz-export-frame';
  var fx=document.createElement('style'); fx.textContent='.brz-export-frame,.brz-export-frame *{font-family:Arial,Helvetica,sans-serif !important;box-sizing:border-box} .brz-export-frame ::-webkit-scrollbar{display:none !important}'; frame.appendChild(fx);
  var colW=Math.max(150, Math.min(215, Math.floor((1540-56-180-70)/Math.max(1,embs.length))));
  var width=180+70+colW*embs.length+56; frame.style.cssText='position:fixed;left:-99999px;top:0;width:'+width+'px;background:#ffffff;color:#10283A;padding:24px 28px';
  var title='Replacement '+port+' — '+C.prod, sub='Média simples dos negócios por embarque fechados pelo porto · '+(isM?'FOB porto':'FOB porto e CFR China')+' em ¢/bu · '+W.label+' · '+(W.acum?'seta compara ':'variação contra ')+W.refLabel+' · '+P.n+' negócio'+(P.n>1?'s':'');
  var head='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2.5px solid #1A3A5C;padding-bottom:10px;margin-bottom:16px"><div style="flex:1 1 auto;min-width:0;padding-right:14px"><div style="font-size:20px;font-weight:800;line-height:1.12;color:#10283A">'+_brzEsc(title)+'</div><div style="font-size:12.5px;color:#6B7280;margin-top:4px">'+_brzEsc(sub)+'</div></div><div style="flex:0 0 auto;min-width:240px;text-align:right;padding-left:18px"><div style="font-size:12px;font-weight:800;color:#1A3A5C;white-space:nowrap">'+BRZ_EXPORT_BRAND.name+'</div><div style="font-size:11px;color:#6B7280;letter-spacing:.3px;white-space:nowrap">'+BRZ_EXPORT_BRAND.sub+'</div></div></div>';
  var t='<table style="width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:12px;color:#10283A;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden"><colgroup><col style="width:180px"><col style="width:70px">'+embs.map(function(){return '<col style="width:'+colW+'px">';}).join('')+'</colgroup>';
  t+='<thead><tr><th style="text-align:left;padding:10px 12px;background:#F3F6FA;font-size:10.5px;letter-spacing:.4px;text-transform:uppercase;color:#4B5563;border-bottom:2px solid #1A3A5C">Origem</th><th style="background:#F3F6FA;border-bottom:2px solid #1A3A5C"></th>';
  embs.forEach(function(e,i){ var sc=rpmSplitClass(e,C.prod,i?embs[i-1]:null); t+='<th style="text-align:center;padding:10px 8px;background:#F3F6FA;font-size:12.5px;font-weight:800;color:#10283A;border-bottom:2px solid #1A3A5C;'+(sc.cl?'border-left:2px dashed #94A3B8;':'')+'">'+_brzEsc(e)+(sc.tag?'<div style="font-size:9px;font-weight:700;color:#6B7280;letter-spacing:.3px">'+_brzEsc(sc.tag)+'</div>':'')+'</th>'; });
  t+='</tr></thead><tbody>';
  function cell(m,ref,style,sc,isNeg,p,pair){
    if(pair&&pair[0]&&pair[1]){ ref={v:pair[1].v, v2:pair[0].v}; }
    var bl='border-left:'+(sc.cl?'2px dashed #94A3B8':'1px solid #EEF1F5')+';';
    if(isNeg){ return '<td style="padding:5px 8px;'+bl+'border-top:1px solid #EEF1F5;text-align:center;font-size:10.5px;color:#4B5563;'+(p?p.styles.avg:'')+'">'+(p?(p.n+' neg · '+rppDataC(p.d0)+(p.d1!==p.d0?' – '+rppDataC(p.d1):'')+(p.n<3?' · <span style="color:#92400E;font-weight:700">amostra</span>':'')):'')+'</td>'; }
    if(!m) return '<td style="'+bl+'border-top:1px solid #EEF1F5"></td>';
    var d=(ref&&ref.v!=null)?((ref.v2!=null?ref.v2:m.v)-ref.v):null; var dh=d==null?'<span style="color:#9CA3AF">—</span>':('<span style="color:'+(d>0?'#DC2626':(d<0?'#16A34A':'#6B7280'))+';font-weight:800">'+(d>0?'▲':(d<0?'▼':'▬'))+Math.abs(Math.round(d))+'</span>');
    return '<td style="padding:6px 8px 5px;'+bl+'border-top:1px solid #EEF1F5;text-align:center;'+style+'"><div style="font-size:18px;font-weight:800;line-height:1;letter-spacing:-.2px">'+rpcFmt(m.v)+' <span style="font-size:11px;vertical-align:middle">'+dh+'</span></div>'+(m.n>1?'<div style="font-size:10px;color:#4B5563;margin-top:3px">mín '+rpcFmt(m.min)+' · máx '+rpcFmt(m.max)+'</div>':'<div style="font-size:10px;color:#9CA3AF;margin-top:3px">negócio único</div>')+'</td>';
  }
  P.rows.forEach(function(R,ri){
    var og=R.origin, nRows=isM?2:3; var tot=0; embs.forEach(function(e){ if(R.cells[e]) tot+=R.cells[e].n; });
    var oc='<td rowspan="'+nRows+'" style="padding:8px 12px;vertical-align:middle;'+(ri?'border-top:2px solid #E2E8F0;':'border-top:1px solid #EEF1F5;')+'background:#FAFBFD"><div style="display:flex;align-items:center;gap:7px;font-weight:800;font-size:13px"><span style="width:9px;height:9px;border-radius:999px;background:'+og.color+';display:inline-block"></span>'+_brzEsc(og.label)+'</div><div style="font-size:10px;color:#6B7280;margin-top:3px;padding-left:16px">'+tot+' negócio'+(tot>1?'s':'')+'</div></td>';
    var metricTd=function(lbl,first){ return '<td style="padding:4px 6px;font-size:10px;font-weight:800;color:#6B7280;text-align:right;'+(first&&ri?'border-top:2px solid #E2E8F0;':'border-top:1px solid #EEF1F5;')+'background:#FAFBFD">'+lbl+'</td>'; };
    var topBorder=ri?'border-top:2px solid #E2E8F0;':'';
    if(!isM){ t+='<tr>'+oc+metricTd('CFR',true); embs.forEach(function(e,i){ var p=R.cells[e], sc=rpmSplitClass(e,C.prod,i?embs[i-1]:null); t+=cell(p&&p.curC,p&&p.refC,(p?p.styles.top:'')+';'+topBorder,sc,false,p,p&&p.dC); }); t+='</tr>'; }
    t+='<tr>'+(isM?oc:'')+metricTd('FOB',isM); embs.forEach(function(e,i){ var p=R.cells[e], sc=rpmSplitClass(e,C.prod,i?embs[i-1]:null); t+=cell(p&&p.curF,p&&p.refF,(p?(isM?p.styles.top:p.styles.mid):'')+(isM?';'+topBorder:''),sc,false,p,p&&p.dF); }); t+='</tr>';
    t+='<tr>'+metricTd('NEG',false); embs.forEach(function(e,i){ var p=R.cells[e], sc=rpmSplitClass(e,C.prod,i?embs[i-1]:null); t+=cell(null,null,'',sc,true,p); }); t+='</tr>';
  });
  t+='</tbody></table>';
  var note='<div style="display:flex;justify-content:space-between;gap:16px;margin-top:10px;font-size:10.5px;color:#6B7280;line-height:1.4"><div style="max-width:78%">Replacement = basis '+(isM?'FOB porto':'FOB porto e CFR China')+' em ¢/bu sobre CBOT; média simples dos negócios de cada embarque fechados por '+_brzEsc(port)+' (porto efetivo de cada negócio) no período; ▲▼ = '+(W.acum?'diferença entre a média dos últimos 7 dias e a média acumulada (recente menos acumulado)':'variação da média contra '+_brzEsc(W.refLabel))+'; mín · máx = extremos dos negócios do embarque. Amostra = menos de 3 negócios. Escala de cor global '+C.metric+' '+rpcFmt(C.lo)+' → '+rpcFmt(C.hi)+'.</div><div style="font-weight:800;color:#1A3A5C;white-space:nowrap">'+_brzEsc(RPP_CODE[port]||port)+' · '+rppData(C.latest)+'</div></div>';
  var foot='<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E5E7EB;margin-top:18px;padding-top:10px;font-size:10.5px;color:#9CA3AF"><div style="white-space:nowrap">BRZ Replacement Engine</div><div style="font-size:13px;font-weight:700;color:#1A3A5C;white-space:nowrap">'+today+'</div></div>';
  frame.innerHTML=head+t+note+foot; frame.setAttribute('data-rpp-title',title);
  document.body.appendChild(frame); return frame;
}
function rppFrameToCanvas(frame, scale){
  // mesma técnica do export genérico: estilos computados inline + SVG foreignObject (texto fiel); html2canvas como reserva
  return new Promise(function(resolve,reject){
    var done=false; var finish=function(c){ if(done) return; done=true; try{ frame.remove(); }catch(e){} resolve(c); };
    var fallback=function(){ if(typeof html2canvas==='undefined'){ try{ frame.remove(); }catch(e){} reject(new Error('html2canvas')); return; }
      html2canvas(frame,{scale:scale,backgroundColor:'#ffffff',logging:false,useCORS:true,windowWidth:Math.ceil(frame.scrollWidth+80),windowHeight:Math.ceil(frame.scrollHeight+60)}).then(finish).catch(function(e){ try{ frame.remove(); }catch(_e){} reject(e); }); };
    try{
      var W=frame.offsetWidth, H=frame.offsetHeight;
      var inl=function(el,extra){ try{ var cs=getComputedStyle(el); if(!cs) return; var st=''; for(var pi=0;pi<cs.length;pi++){ var pr=cs.item(pi); if(pr==='position'||pr==='left'||pr==='top'||pr==='right'||pr==='bottom'||pr==='height') continue; var pv=cs.getPropertyValue(pr); if(pv!=='') st+=pr+':'+pv+';'; } el.setAttribute('style', st+(extra||'')); }catch(e){} };
      var all=frame.querySelectorAll('*'); for(var q=0;q<all.length;q++){ inl(all[q]); }
      inl(frame,'position:static;left:auto;top:auto;');
      var xhtml=new XMLSerializer().serializeToString(frame);
      var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">'+xhtml+'</div></foreignObject></svg>';
      var img=new Image();
      img.onload=function(){ try{ var canvas=document.createElement('canvas'); canvas.width=W*scale; canvas.height=H*scale; var ctx=canvas.getContext('2d'); ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.scale(scale,scale); ctx.drawImage(img,0,0); finish(canvas); }catch(e){ console.warn('rpp FO draw',e); fallback(); } };
      img.onerror=function(e){ console.warn('rpp FO load',e); fallback(); };
      img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    }catch(e){ console.warn('rpp FO',e); fallback(); }
  });
}
function rppExportCanvas(port){
  return new Promise(function(resolve,reject){
    var frame=rppExportFrame(port); if(!frame){ reject(new Error('sem dados')); return; }
    var run=function(){ try{ frame.offsetWidth; }catch(e){} rppFrameToCanvas(frame,3).then(resolve).catch(reject); };
    try{ if(typeof _brzExportWaitStableLayout==='function') _brzExportWaitStableLayout().then(run).catch(run); else run(); }catch(e){ run(); }
  });
}
function rppExportDownload(port){
  var C=rppCompute(); if(!C) return; var today=new Date().toISOString().slice(0,10);
  rppExportCanvas(port).then(function(canvas){ var a=document.createElement('a'); a.download='BRZ_Replacement_'+_brzSlug(port+'_'+C.prod+'_'+(rppState.periodo==='acum'?'Acumulado':'D'+rppState.periodo))+'_'+today+'.png'; a.href=canvas.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove(); }).catch(function(e){ alert('Falha ao gerar PNG: '+(e&&e.message||e)); });
}
(function(){
  var oE=window.brzExportCard, oC=window.brzCardCanvas;
  if(typeof oE==='function') window.brzExportCard=function(btn){ var c=btn&&btn.closest?btn.closest('.rpp-port-card'):null; if(c){ rppExportDownload(c.getAttribute('data-rpp-port')); return; } return oE.apply(this,arguments); };
  if(typeof oC==='function') window.brzCardCanvas=function(card){ if(card&&card.classList&&card.classList.contains('rpp-port-card')) return rppExportCanvas(card.getAttribute('data-rpp-port')); return oC.apply(this,arguments); };
})();
function rppInject(){
  var host=document.getElementById('corredores'); if(!host) return;
  var old=document.getElementById('rppBlock'); var html=''; try{ html=rppBuildHtml(); }catch(e){ console.warn('rpp',e); html=''; }
  if(!html){ if(old) old.remove(); return; }
  var tmp=document.createElement('div'); tmp.innerHTML=html; var block=tmp.firstElementChild;
  if(old){ old.replaceWith(block); }
  else { var anchor=host.querySelector('.rpm-state-section:not(.rpp-section)'); if(anchor) anchor.parentNode.insertBefore(block,anchor); else host.appendChild(block); }
  try{ if(typeof brzAddCamButtons==='function') brzAddCamButtons(block); }catch(e){}
}
(function(){
  var orig=window.renderReplacementPorto;
  if(typeof orig!=='function') return;
  window.renderReplacementPorto=function(){ var r=orig.apply(this,arguments); try{ rppInject(); }catch(e){ console.warn('rpp inject',e); } return r; };
})();

