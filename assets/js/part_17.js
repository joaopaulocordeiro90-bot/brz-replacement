
/* ═══════════════════════════════════════════════════════════════════════════
   REPORT — aba criada em 28/09/2026 a pedido do João. v2 no mesmo dia:
   espelhos VIVOS (controles funcionam), barra de produto/base/data no topo e
   granularidade Semana · Mês · Dia no bloco de originação.
   Blocos: (1) lotes por período separados por safra + variação do replacement;
   (2) espelho das tabelas da Análise; (3) espelho do Replacement por estado.
   Os espelhos clonam a DOM já renderizada MANTENDO os handlers; como todo
   controle da Análise/RPM termina em renderAnalise()/renderReplacementPorto(),
   um gancho nessas duas funções re-espelha o resultado. Nenhuma lógica de
   cálculo foi duplicada nem alterada.
   ═══════════════════════════════════════════════════════════════════════════ */
var _repBasisCache = {};   // id → basisFOB do porto vencedor
var _repCacheKey = null;
var _repGran = 'sem';      // 'sem' | 'mes' | 'dia'
/* Janela do gráfico de originação (pedido do João em 02/10/2026): quantos períodos aparecem no gráfico.
   Só o gráfico obedece; as tabelas seguem completas. Guardado em localStorage, por granularidade. */
var REP_JANELAS={sem:[[8,'8 sem','8 wks'],[12,'12 sem','12 wks'],[16,'16 sem','16 wks'],[26,'26 sem','26 wks'],['all','Tudo','All']],
                 mes:[[3,'3 meses','3 months'],[6,'6 meses','6 months'],[12,'12 meses','12 months'],['all','Tudo','All']],
                 dia:[[10,'10 dias','10 days'],[20,'20 dias','20 days'],[30,'30 dias','30 days'],['all','Tudo','All']]};
var _repJanela=(function(){ try{ var v=JSON.parse(localStorage.getItem('brz_rep_janela')||'null'); if(v&&typeof v==='object') return {sem:v.sem||'all',mes:v.mes||'all',dia:v.dia||'all'}; }catch(e){} return {sem:'all',mes:'all',dia:'all'}; })();
function repJanelaAtual(g){ var v=_repJanela[g||_repGran]; return (v==='all'||v==null||!(+v>0))?'all':+v; }
function repSetJanela(v){ _repJanela[_repGran]=(String(v)==='all')?'all':(+v||'all'); try{ localStorage.setItem('brz_rep_janela',JSON.stringify(_repJanela)); }catch(e){} renderReportLotes(); }
function repJanelaAplicar(ser,g){ var n=repJanelaAtual(g); if(n==='all'||!ser||ser.length<=n) return ser; return ser.slice(ser.length-n); }
function repJanelaLabel(ser,serChart,g){ var n=repJanelaAtual(g); if(n==='all'||!serChart||!ser||serChart.length>=ser.length) return ''; return repL('últimas ','last ')+serChart.length+' '+repL({sem:'semanas',mes:'meses',dia:'dias'}[g],{sem:'weeks',mes:'months',dia:'days'}[g]); }
var _repCssOk = false;

function repAtivo(){ var r=document.getElementById('report'); return !!(r && r.classList.contains('active')); }
function repSafraClasse(d){ return brzSafraClasse(d); } /* V4AV */
function repIsoWeek(iso){
  var p=iso.split('-'), dt=new Date(Date.UTC(+p[0],+p[1]-1,+p[2]));
  var day=dt.getUTCDay()||7, seg=new Date(dt); seg.setUTCDate(dt.getUTCDate()-day+1);
  var th=new Date(seg); th.setUTCDate(seg.getUTCDate()+3);
  var y1=new Date(Date.UTC(th.getUTCFullYear(),0,1)), wk=Math.ceil((((th-y1)/86400000)+1)/7);
  var segIso=seg.toISOString().slice(0,10), dom=new Date(seg); dom.setUTCDate(seg.getUTCDate()+6); var domIso=dom.toISOString().slice(0,10);
  var fx=function(iso){ return iso.slice(8,10)+'/'+iso.slice(5,7); };
  var curto=(segIso.slice(5,7)===domIso.slice(5,7))?(segIso.slice(8,10)+'–'+fx(domIso)):(fx(segIso)+'–'+fx(domIso));
  return {key:th.getUTCFullYear()+'-W'+String(wk).padStart(2,'0'), seg:segIso, fim:domIso, lb:'S'+String(wk).padStart(2,'0')+' · '+fx(segIso)+'–'+fx(domIso), lbEixo:'S'+String(wk).padStart(2,'0')+' · '+curto};
}
var _repDow=['dom','seg','ter','qua','qui','sex','sáb'], _repDowEn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
/* Idioma do Report (02/10/2026): o bloco de originação renderiza já no idioma do seletor (PT/EN) e fica fora do
   tradutor solto (data-no-i18n), que trocava pedaços de palavras. A foto segue o mesmo idioma. */
function repEn(){ try{ return (typeof _currentLang!=='undefined'&&String(_currentLang).toLowerCase().indexOf('en')===0); }catch(e){ return false; } }
function repL(pt,en){ return repEn()?en:pt; }
/* Cores do gráfico de originação por produto (02/10/2026): soja mantém navy/teal; milho usa a paleta dourada do tema produto-milho (--teal-dark #94680A para OC, --teal-light #E3B12B para NC). Safra velha/nova abreviadas OC/NC. */
function repCores(prod){ return (/milho/i.test(prod||''))?{oc:'#94680A',nc:'#E3B12B'}:{oc:'#0B1F3A',nc:'#0F766E'}; }
function repLb(lb){ return repEn()?String(lb||'').replace(/\bS(\d{2})\b/g,'W$1'):lb; }
function repDiaLb(iso){ var d=new Date(iso+'T00:00:00Z'); return (repEn()?_repDowEn:_repDow)[d.getUTCDay()]+' · '+iso.slice(8,10)+'/'+iso.slice(5,7); }
function repBasis(d){
  if(_repBasisCache[d.id]!==undefined) return _repBasisCache[d.id];
  if(d.foraMercado){ _repBasisCache[d.id]=null; return null; }
  var v=null;
  try{ var c=computePortComparison(d); (c&&c.results||[]).forEach(function(p){ var x=p.best; if(!x||x.basisFOB==null||isNaN(x.basisFOB)) return; if(v===null||x.basisFOB<v) v=x.basisFOB; }); }catch(e){}
  _repBasisCache[d.id]=v; return v;
}
function repFmt(n,dec){ if(n==null||isNaN(n)) return '–'; return Number(n).toLocaleString(repEn()?'en-US':'pt-BR',{minimumFractionDigits:dec||0,maximumFractionDigits:dec||0}); }
function repDelta(v,dec){ if(v==null||isNaN(v)) return '<span class="mut">–</span>'; var s=(v>0?'+':'')+repFmt(v,dec); return '<span class="'+(v>0?'pos':v<0?'neg':'mut')+'">'+s+'</span>'; }

function repAgregar(deals, chave, slots){
  var m={};
  (slots||[]).forEach(function(k){ m[k.key]={key:k.key,lb:k.lb,ord:k.ord,n:0,vol:0,velha:0,nova:0,bw:0,bwv:0}; });
  deals.forEach(function(d){
    var k=chave(d); if(!k) return; var g=m[k.key]; if(!g){ g=m[k.key]={key:k.key,lb:k.lb,lbEixo:k.lbEixo,ord:k.ord,n:0,vol:0,velha:0,nova:0,bw:0,bwv:0}; }
    var v=+d.volume||0; g.n++; g.vol+=v; if(repSafraClasse(d)==='nova') g.nova+=v; else g.velha+=v;
    var b=repBasis(d); if(b!=null && d.preco>0){ g.bw+=b*v; g.bwv+=v; }
  });
  var arr=Object.keys(m).map(function(k){return m[k];}).sort(function(a,b){return a.ord<b.ord?-1:1;});
  var prev=null;
  arr.forEach(function(g){ g.lote=g.n?g.vol/g.n:0; g.pctNova=g.vol?100*g.nova/g.vol:0; g.repl=g.bwv?g.bw/g.bwv:null;
    g.dRepl=(prev&&prev.repl!=null&&g.repl!=null)?g.repl-prev.repl:null; if(g.n>0) prev=g; });
  return arr;
}
function repSlotsDia(deals){ // dias úteis das últimas 6 semanas até a última data da base, mais fins de semana com negócio
  var ds=deals.map(function(d){return d.data;}).sort(); if(!ds.length) return [];
  var fim=new Date(ds[ds.length-1]+'T00:00:00Z'), ini=new Date(fim); ini.setUTCDate(fim.getUTCDate()-41);
  var com={}; deals.forEach(function(d){com[d.data]=1;});
  var out=[]; for(var t=new Date(ini); t<=fim; t.setUTCDate(t.getUTCDate()+1)){ var iso=t.toISOString().slice(0,10), dow=t.getUTCDay(); if((dow>=1&&dow<=5)||com[iso]) out.push({key:iso,lb:repDiaLb(iso),ord:iso}); }
  return out;
}
function repSeries(deals, gran){
  if(gran==='dia'){ var slots=repSlotsDia(deals); var lim=slots.length?slots[0].key:null;
    return repAgregar(deals.filter(function(d){return !lim||d.data>=lim;}), function(d){return {key:d.data,lb:repDiaLb(d.data),ord:d.data};}, slots); }
  if(gran==='mes') return repAgregar(deals,function(d){var k=d.data.slice(0,7); return {key:k,lb:k.slice(5,7)+'/'+k.slice(0,4),ord:k};});
  return repAgregar(deals,function(d){var w=repIsoWeek(d.data); return {key:w.key,lb:w.lb,ord:w.seg,lbEixo:w.lbEixo};});
}
function repSvg(ser, gran, prod){
  var cor=repCores(prod);
  if(!ser.length) return '<div class="a-empty">'+repL('Sem negócios.','No deals.')+'</div>';
  var n=ser.length, W=Math.max(640, n*(gran==='dia'?30:(gran==='sem'?62:48))), H=210, pL=44, pR=12, pT=14, pB=40;
  var mx=Math.max.apply(null,ser.map(function(g){return g.vol;}))||1;
  var bw=(W-pL-pR)/n, ih=H-pT-pB, y0=H-pB, out='';
  for(var k=1;k<=3;k++){ var yy=pT+ih*(1-k/4); out+='<line x1="'+pL+'" x2="'+(W-pR)+'" y1="'+yy.toFixed(1)+'" y2="'+yy.toFixed(1)+'" stroke="#EEF2F7"/><text x="'+(pL-6)+'" y="'+(yy+3.5).toFixed(1)+'" font-size="9.5" fill="#94A3B8" text-anchor="end">'+repFmt(mx*k/4/1000,1)+'k</text>'; }
  out+='<line x1="'+pL+'" x2="'+(W-pR)+'" y1="'+y0+'" y2="'+y0+'" stroke="#CBD5E1"/>';
  var ultimoComNeg=-1; ser.forEach(function(g,i){ if(g.n>0) ultimoComNeg=i; });
  ser.forEach(function(g,i){
    var x=pL+i*bw+bw*0.15, w=bw*0.7, hv=ih*(g.velha/mx), hn=ih*(g.nova/mx), last=(i===ultimoComNeg), yV=y0-hv, yN=yV-hn;
    var lbx=repLb(g.lbEixo||g.lb), l1=lbx.split(' · ')[0], l2=lbx.split(' · ')[1]||'', glb=repLb(g.lb);
    if(g.n===0){ out+='<rect x="'+x.toFixed(1)+'" y="'+(y0-3)+'" width="'+w.toFixed(1)+'" height="3" fill="#E2E8F0"><title>'+glb+repL(' · sem negócio',' · no deals')+'</title></rect>'; }
    else {
      out+='<rect x="'+x.toFixed(1)+'" y="'+yV.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+Math.max(0,hv).toFixed(1)+'" fill="'+cor.oc+'" fill-opacity="'+(last?'1':'.8')+'"><title>'+glb+' · OC '+repFmt(g.velha)+' t</title></rect>';
      out+='<rect x="'+x.toFixed(1)+'" y="'+yN.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+Math.max(0,hn).toFixed(1)+'" fill="'+cor.nc+'" fill-opacity="'+(last?'1':'.8')+'"><title>'+glb+' · NC '+repFmt(g.nova)+' t</title></rect>';
      out+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(yN-4).toFixed(1)+'" font-size="'+(gran==='dia'?'8.5':'9.5')+'" font-weight="700" fill="#0F172A" text-anchor="middle">'+repFmt(g.vol/1000,1)+'k</text>';
    }
    var fs=gran==='dia'?'8.5':'9.5', fim=(gran==='dia'&&/^(sáb|dom)/.test(l1));
    out+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(y0+13)+'" font-size="'+fs+'" fill="'+(fim?'#B45309':'#475569')+'" text-anchor="middle">'+l1+'</text>';
    out+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(y0+25)+'" font-size="8.5" fill="#94A3B8" text-anchor="middle">'+l2+'</text>';
  });
  return '<svg class="rep-svg" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">'+out+'</svg>';
}
function repTabela(rows, gran){
  var tit=repL({sem:'Semana',mes:'Mês',dia:'Dia'}[gran],{sem:'Week',mes:'Month',dia:'Day'}[gran]), dl={sem:'Δ WoW',mes:'Δ MoM',dia:'Δ DoD'}[gran];
  var h='<div class="rep-tbl-wrap"><table class="rep-tbl"><thead><tr><th>'+tit+'</th><th>'+repL('Neg.','Deals')+'</th><th>Volume t</th><th>'+repL('Lote médio t','Avg lot t')+'</th><th title="'+repL('safra velha','old crop')+'">OC t</th><th title="'+repL('safra nova','new crop')+'">NC t</th><th>% NC</th><th>Replacement ¢/bu</th><th>'+dl+'</th></tr></thead><tbody>';
  var first=true;
  rows.slice().reverse().forEach(function(g){
    var vazio=(g.n===0);
    h+='<tr class="'+(!vazio&&first?'last':'')+(vazio?' vazio':'')+'"><td>'+repLb(g.lb)+'</td>'+(vazio?'<td colspan="8" class="mut">'+repL('sem negócio','no deals')+'</td>':'<td>'+g.n+'</td><td>'+repFmt(g.vol)+'</td><td>'+repFmt(g.lote)+'</td><td>'+repFmt(g.velha)+'</td><td>'+repFmt(g.nova)+'</td><td>'+repFmt(g.pctNova,0)+'%</td><td>'+(g.repl==null?'<span class="mut">–</span>':repFmt(g.repl,0))+'</td><td>'+repDelta(g.dRepl,0)+'</td>')+'</tr>';
    if(!vazio) first=false;
  });
  return h+'</tbody></table></div>';
}
function repBlocoProduto(prod, deals){
  var g=_repGran, ser=repSeries(deals,g), serChart=repJanelaAplicar(ser,g), jl=repJanelaLabel(ser,serChart,g), cor=repCores(prod);
  var comNeg=ser.filter(function(x){return x.n>0;}), ult=comNeg[comNeg.length-1]||{}, ant=comNeg[comNeg.length-2]||{};
  var dVol=(ult.vol!=null&&ant.vol!=null)?ult.vol-ant.vol:null;
  var per=repL({sem:'na semana',mes:'no mês',dia:'no dia'}[g],{sem:'in the week',mes:'in the month',dia:'in the day'}[g]), dlb={sem:'WoW',mes:'MoM',dia:'DoD'}[g];
  var kp='<div class="rep-kpis">'
    +'<div class="rep-kpi"><b>'+repFmt(ult.vol)+' t</b><span>volume '+per+'</span></div>'
    +'<div class="rep-kpi"><b>'+(ult.n||0)+'</b><span>'+repL('negócios','deals')+'</span></div>'
    +'<div class="rep-kpi"><b>'+repFmt(ult.lote)+' t</b><span>'+repL('lote médio','average lot')+'</span></div>'
    +'<div class="rep-kpi"><b>'+repFmt(ult.pctNova,0)+'%</b><span title="'+repL('safra nova','new crop')+'">NC</span></div>'
    +'<div class="rep-kpi"><b>'+(ult.repl==null?'–':repFmt(ult.repl,0))+'</b><span>'+repL('replacement médio ¢/bu','average replacement ¢/bu')+'</span></div>'
    +'<div class="rep-kpi"><b>'+repDelta(ult.dRepl,0)+'</b><span>Δ replacement '+dlb+'</span></div>'
    +'</div>';
  var lado=(g==='sem')?repTabela(repSeries(deals,'mes'),'mes'):(g==='dia'?repTabela(repSeries(deals,'sem'),'sem'):'');
  return '<div class="rep-card" style="position:relative" data-rep-prod="'+prod+'"><button type="button" class="brz-cam rep-cam" title="'+repL('Exportar PNG: título, legenda e gráfico','Export PNG: title, legend and chart')+'" onclick="repExportDownload(\''+prod+'\')" style="top:10px;right:12px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>'
    +'<div class="rep-card-t" style="padding-right:36px"><span>'+repL(prod,prod==='Soja'?'Soybean':'Corn')+'</span><small>'+repLb(ult.lb||'')+(dVol!=null?' · volume '+(dVol>=0?'+':'')+repFmt(dVol)+repL(' t vs período anterior',' t vs previous period'):'')+(jl?repL(' · gráfico: ',' · chart: ')+jl:'')+'</small></div>'
    +kp
    +'<div class="rep-legend"><span title="'+repL('safra velha','old crop')+'"><i style="background:'+cor.oc+'"></i>OC</span><span title="'+repL('safra nova','new crop')+'"><i style="background:'+cor.nc+'"></i>NC</span>'+(g==='dia'?'<span><i style="background:#E2E8F0"></i>'+repL('dia útil sem negócio','business day without deals')+'</span>':'')+'<span style="margin-left:auto">'+repL('volume originado por '+{sem:'semana',mes:'mês',dia:'dia'}[g]+', em t · rótulo em mil t','volume originated per '+{sem:'week',mes:'month',dia:'day'}[g]+', in t · labels in thousand t')+'</span></div>'
    +repSvg(serChart,g,prod)
    +(lado?'<div class="rep-grid2"><div>'+repTabela(ser,g)+'</div><div>'+lado+'</div></div>':repTabela(ser,g))
    +'</div>';
}
function repGranBar(){
  var b=function(k,l){ return '<button type="button" class="rep-gbtn'+(_repGran===k?' on':'')+'" onclick="repSetGran(\''+k+'\')">'+l+'</button>'; };
  var cur=String(repJanelaAtual(_repGran));
  var jb=(REP_JANELAS[_repGran]||[]).map(function(o){ return '<button type="button" class="rep-gbtn'+(String(o[0])===cur?' on':'')+'" onclick="repSetJanela(\''+o[0]+'\')">'+repL(o[1],o[2])+'</button>'; }).join('');
  return '<div class="rep-granbar" style="flex-wrap:wrap;row-gap:6px"><span class="rep-glabel">'+repL('Período','Period')+'</span>'+b('sem',repL('Semana','Week'))+b('mes',repL('Mês','Month'))+b('dia',repL('Dia','Day'))
    +'<span class="rep-glabel" style="margin-left:14px">'+repL('Janela do gráfico','Chart window')+'</span>'+jb+'</div>';
}
function repSetGran(g){ _repGran=g; renderReportLotes(); }
/* Foto do card de originação (pedido do João em 02/10/2026): só título, legenda e gráfico, na moldura padrão
   da casa (cabeçalho com marca, rodapé com data), pela mesma rota de foreignObject 3x do Replacement por Porto. */
function repExportFrame(prod){
  var g=_repGran, all=(state.negocios||[]).filter(function(d){return (+d.volume||0)>0;});
  var deals=all.filter(function(d){ return (prod==='Soja')?/soja/i.test(d.produto||''):/milho/i.test(d.produto||''); });
  var ser=repSeries(deals,g), serChart=repJanelaAplicar(ser,g); if(!serChart||!serChart.length) return null;
  var comNeg=serChart.filter(function(x){return x.n>0;}), ult=comNeg[comNeg.length-1]||{};
  var per=repL({sem:'semana',mes:'mês',dia:'dia'}[g],{sem:'week',mes:'month',dia:'day'}[g]), jl=repJanelaLabel(ser,serChart,g);
  var title=repL(prod,prod==='Soja'?'Soybean':'Corn')+repL(' — originação por ',' — origination by ')+per;
  var sub=(ult.lb?repLb(ult.lb)+' · ':'')+(jl?jl:repL('toda a série, ','full series, ')+serChart.length+' '+repL({sem:'semanas',mes:'meses',dia:'dias'}[g],{sem:'weeks',mes:'months',dia:'days'}[g]))+repL(' · volume em t, rótulo em mil t · OC safra velha, NC safra nova',' · volume in t, labels in thousand t · OC old crop, NC new crop');
  var today=new Date().toISOString().slice(0,10);
  var frame=document.createElement('div'); frame.className='brz-export-frame'; frame.setAttribute('data-no-i18n','1');
  var fx=document.createElement('style'); fx.textContent='.brz-export-frame,.brz-export-frame *{font-family:Arial,Helvetica,sans-serif !important;box-sizing:border-box} .brz-export-frame ::-webkit-scrollbar{display:none !important}'; frame.appendChild(fx);
  frame.style.cssText='position:fixed;left:-99999px;top:0;width:1200px;background:#ffffff;color:#10283A;padding:24px 28px';
  var head='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2.5px solid #1A3A5C;padding-bottom:10px;margin-bottom:14px"><div style="flex:1 1 auto;min-width:0;padding-right:14px"><div style="font-size:20px;font-weight:800;line-height:1.12;color:#10283A">'+_brzEsc(title)+'</div><div style="font-size:12.5px;color:#6B7280;margin-top:4px">'+_brzEsc(sub)+'</div></div><div style="flex:0 0 auto;min-width:240px;text-align:right;padding-left:18px"><div style="font-size:12px;font-weight:800;color:#1A3A5C;white-space:nowrap">'+BRZ_EXPORT_BRAND.name+'</div><div style="font-size:11px;color:#6B7280;letter-spacing:.3px;white-space:nowrap">'+BRZ_EXPORT_BRAND.sub+'</div></div></div>';
  var chip=function(c){ return '<i style="display:inline-block;width:11px;height:11px;border-radius:2px;background:'+c+';margin-right:6px;vertical-align:-1px"></i>'; };
  var corx=repCores(prod);
  var leg='<div style="display:flex;gap:18px;font-size:12.5px;color:#475569;margin:0 0 6px;align-items:center"><span>'+chip(corx.oc)+'OC</span><span>'+chip(corx.nc)+'NC</span>'+(g==='dia'?'<span>'+chip('#E2E8F0')+repL('dia útil sem negócio','business day without deals')+'</span>':'')+'</div>';
  var svg=repSvg(serChart,g,prod).replace('class="rep-svg"','style="width:100%;height:auto;display:block"');
  var foot='<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid #E5E7EB;font-size:11px;color:#6B7280"><span style="white-space:nowrap">BRZ Replacement Engine</span><span style="font-size:13px;font-weight:700;color:#1A3A5C;white-space:nowrap">'+today+'</span></div>';
  frame.innerHTML=head+leg+svg+foot; frame.setAttribute('data-rep-title',title);
  document.body.appendChild(frame); return frame;
}
function repExportCanvas(prod){
  return new Promise(function(resolve,reject){
    var frame=repExportFrame(prod); if(!frame){ reject(new Error('sem dados')); return; }
    var run=function(){ try{ frame.offsetWidth; }catch(e){} rppFrameToCanvas(frame,3).then(resolve).catch(reject); };
    try{ if(typeof _brzExportWaitStableLayout==='function') _brzExportWaitStableLayout().then(run).catch(run); else run(); }catch(e){ run(); }
  });
}
function repExportDownload(prod){
  var g=_repGran, today=new Date().toISOString().slice(0,10), n=repJanelaAtual(g);
  repExportCanvas(prod).then(function(canvas){ var a=document.createElement('a'); a.download=repL('BRZ_Originacao_','BRZ_Origination_')+_brzSlug(repL(prod,prod==='Soja'?'Soybean':'Corn')+'_'+({sem:'semana',mes:'mes',dia:'dia'}[g])+'_'+(n==='all'?'tudo':n))+'_'+today+'.png'; a.href=canvas.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove(); }).catch(function(e){ alert('Falha ao gerar PNG: '+(e&&e.message||e)); });
}
function renderReportLotes(){
  var host=document.getElementById('rep-lotes'); if(!host) return;
  var all=(state.negocios||[]).filter(function(d){return (+d.volume||0)>0;});
  var ck=all.length+'|'+(all.length?all[all.length-1].id:''); if(_repCacheKey!==ck){ _repBasisCache={}; _repCacheKey=ck; }
  var soja=all.filter(function(d){return /soja/i.test(d.produto||'');}), milho=all.filter(function(d){return /milho/i.test(d.produto||'');});
  try{ host.setAttribute('data-no-i18n','1'); }catch(e){}
  host.innerHTML='<div class="rep-sec-row"><div class="rep-sec">'+repL('1 · Originação por período, separada por safra','1 · Origination by period, split by crop')+'</div>'+repGranBar()+'</div>'
    +repBlocoProduto('Soja',soja)+'<div style="height:14px"></div>'+repBlocoProduto('Milho',milho)
    +'<div class="rep-note">'+repL('Semana ISO, de segunda a domingo, rotulada pelo intervalo (S39 · 21/09–27/09 soma tudo o que fechou entre a segunda 21 e o domingo 27); quando a base termina antes do domingo, a última semana está incompleta. No modo Dia aparecem os dias úteis das últimas seis semanas até a última data da base, e os dias sem negócio ficam marcados. Safra velha (OC): soja 25/26 e milho safrinha 26 (inclui os rótulos "2026", "Safrinha" e "Safra Verão"); safra nova (NC): soja 26/27 e 27/28, milho safrinha 27 e verão 26/27. Replacement médio é o basis FOB do porto vencedor (mesma coluna FOB ¢/b da Análise), ponderado pelo volume dos negócios com preço formado; a variação compara com o período anterior que teve negócio. Negócios a fixar, de preço zero, fora de mercado e de origem Paraguai entram no volume, não no replacement. A janela do gráfico limita só as barras; as tabelas seguem completas. O botão de foto exporta título, legenda e gráfico.','ISO week, Monday to Sunday, labelled by its interval (W39 · 21/09–27/09 adds everything closed between Monday 21 and Sunday 27); when the base ends before Sunday, the last week is incomplete. In Day mode the business days of the last six weeks up to the last date in the base are shown, and days without deals are marked. Old crop (OC): soybean 25/26 and corn safrinha 26 (includes the labels \"2026\", \"Safrinha\" and \"Safra Verão\"); new crop (NC): soybean 26/27 and 27/28, corn safrinha 27 and summer 26/27. Average replacement is the FOB basis of the winning port (same FOB ¢/b column as the Analysis), weighted by the volume of deals with a formed price; the change compares with the previous period that had deals. Deals to be fixed, zero-priced, off-market and of Paraguayan origin count in volume, not in replacement. The chart window limits only the bars; the tables stay complete. The photo button exports title, legend and chart.')+'</div>';
}
function repClonarVivo(el){ return el.cloneNode(true); } // handlers de atributo preservados; não há ids dentro dos blocos espelhados
function repReligar(root){
  /* Botões injetados após o render (⤢ expandir, PNG, DOCX) são ligados por propriedade .onclick, que o clone não leva.
     Remove os clones mortos e chama os mesmos injetores da plataforma sobre o espelho, gerando botões vivos. */
  try{ root.querySelectorAll('.a-exp, .brz-cam, .brz-add').forEach(function(b){ b.remove(); }); }catch(e){}
  try{ if(typeof aFsButtons==='function') aFsButtons(root); }catch(e){}
  try{ if(typeof brzAddCamButtons==='function') brzAddCamButtons(root); }catch(e){}
}
function repEspelharAnalise(){
  var src=document.getElementById('analise'), bar=document.getElementById('rep-toolbar'), host=document.getElementById('rep-analise');
  if(!src||!host) return;
  var ctr=src.querySelector('.a-ctrls'), pair=src.querySelector('.a-tblpair')||src.querySelector('.a-tblsingle'); // clássico ou TAB (desk view)
  if(bar){ bar.innerHTML=''; if(ctr){ var c=repClonarVivo(ctr); c.classList.add('rep-ctrls'); bar.appendChild(c); } }
  host.innerHTML='<div class="rep-sec">2 · Tabelas da Análise</div>';
  if(pair){ var m=document.createElement('div'); m.className='rep-mirror rep-live'; m.appendChild(repClonarVivo(pair)); host.appendChild(m); repReligar(m); }
  else host.innerHTML+='<div class="a-empty">Tabelas da Análise não renderizadas.</div>';
}
function repEspelharEstados(){
  var src=document.getElementById('corredores'), host=document.getElementById('rep-estados'); if(!src||!host) return;
  var sec=src.querySelector('.rpm-state-section');
  host.innerHTML='<div class="rep-sec">3 · Replacement por estado</div>';
  if(sec){ var m=document.createElement('div'); m.className='rep-mirror rep-live'; m.appendChild(repClonarVivo(sec)); host.appendChild(m); repReligar(m); }
  else host.innerHTML+='<div class="a-empty">Replacement por estado não renderizado.</div>';
}
function repEscopoCss(){
  if(_repCssOk) return; _repCssOk=true;
  var extra=[];
  try{ for(var i=0;i<document.styleSheets.length;i++){ var ss=document.styleSheets[i], rules; try{ rules=ss.cssRules; }catch(e){ continue; } if(!rules) continue;
    for(var j=0;j<rules.length;j++){ var r=rules[j]; if(!r.selectorText||!/#corredores|#analise/.test(r.selectorText)) continue;
      extra.push(r.selectorText.split(',').map(function(x){ return x.replace(/#corredores|#analise/g,'#report .rep-live'); }).join(',')+'{'+r.style.cssText+'}'); } } }catch(e){}
  if(extra.length){ var st=document.createElement('style'); st.id='rep-css-escopo'; st.textContent=extra.join('\n'); document.head.appendChild(st); }
}
/* Ganchos: todo controle da Análise e do RPM termina chamando estas funções; re-espelha quando o Report está ativo. */
(function(){
  try{
    if(typeof renderAnalise==='function' && !renderAnalise._repHook){
      var _ra=renderAnalise; var w1=function(){ var r=_ra.apply(this,arguments); if(repAtivo()){ try{ repEspelharAnalise(); }catch(e){} var pt=document.getElementById('pageTitle'); if(pt) pt.textContent='Report'; } return r; }; w1._repHook=true; renderAnalise=w1; window.renderAnalise=w1; }
    if(typeof renderReplacementPorto==='function' && !renderReplacementPorto._repHook){
      var _rp=renderReplacementPorto; var w2=function(){ var r=_rp.apply(this,arguments); if(repAtivo()){ try{ repEspelharEstados(); }catch(e){} var pt=document.getElementById('pageTitle'); if(pt) pt.textContent='Report'; } return r; }; w2._repHook=true; renderReplacementPorto=w2; window.renderReplacementPorto=w2; }
  }catch(e){}
})();
function renderReport(){
  repEscopoCss();
  var sub=document.getElementById('rep-sub'), pt=document.getElementById('pageTitle');
  var all=(state.negocios||[]).filter(function(d){return (+d.volume||0)>0;}), datas=all.map(function(d){return d.data;}).sort();
  if(sub) sub.textContent='Negócios fechados de '+(datas[0]||'').split('-').reverse().join('/')+' a '+(datas[datas.length-1]||'').split('-').reverse().join('/')+' · '+all.length+' registros com volume · replacement = basis FOB do porto vencedor, ponderado por volume';
  renderReportLotes();
  try{ renderAnalise(); }catch(e){ var h=document.getElementById('rep-analise'); if(h) h.innerHTML='<div class="rep-sec">2 · Tabelas da Análise</div><div class="a-empty">Erro: '+String(e).slice(0,80)+'</div>'; }
  try{ renderReplacementPorto(); }catch(e){ var h2=document.getElementById('rep-estados'); if(h2) h2.innerHTML='<div class="rep-sec">3 · Replacement por estado</div><div class="a-empty">Erro: '+String(e).slice(0,80)+'</div>'; }
  if(!document.querySelector('#rep-analise .a-tblpair, #rep-analise .a-tblsingle')) repEspelharAnalise();
  if(!document.querySelector('#rep-estados .rpm-state-section')) repEspelharEstados();
  if(pt) pt.textContent='Report';
  try{ if(typeof renderReportParidadeHook==='function') renderReportParidadeHook(); }catch(e){ console.warn('paridade', e); }
}

