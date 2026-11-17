
/* PRÊMIOS v2 */
/* ═══════════════════════════════════════════════════════════════════════
   PRÊMIOS v2 — remodelação de 01/10/2026 (pedido do João)
   Milho: FOB por porto/janela (state.premiosMilho, 70 leituras desde 21/05)
   Soja:  CFR China por janela (CFR_CHINA_OFFER_REPORT, 47 leituras desde 22/07)
   Sem alteração de dado: só leitura e apresentação.
   ═══════════════════════════════════════════════════════════════════════ */
var pm2State = { grupo:'Santos', hidden:{}, nDias:60, soHistMeses:true, modo:'tempo', mesSafra:'Feb' };
function pm2SetModo(m){ pm2State.modo=m; pm2State.hidden={}; renderPremiosV2(); }
function pm2SetMesSafra(m){ pm2State.mesSafra=m; pm2State.hidden={}; renderPremiosV2(); }
var PM2_PAL = ['#1A3A5C','#0D9488','#B5963E','#DC2626','#2563EB','#7C3AED','#0891B2','#65A30D','#EA580C','#6B7280','#DB2777','#0F766E'];
var PM2_MES = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};

function pm2Key(j){ // 'Nov-26' | 'Nov/Dec-26' | 'Mar/Apr-27'
  try{ var m=/^([A-Z][a-z]{2})(?:\/([A-Z][a-z]{2}))?-(\d{2})$/.exec(String(j||'')); if(!m) return 9999;
    var y=parseInt(m[3],10), mo=PM2_MES[m[1]]||0; return y*100+mo+(m[2]?0.5:0); }catch(e){ return 9999; }
}
function pm2Fmt(v,dec){ if(v==null||isNaN(v)) return '—'; return (dec?Number(v).toFixed(dec):String(Math.round(v))).replace('.',','); }
function pm2Dlt(c,p){ if(c==null||p==null) return '<span class="pm2-m">—</span>'; var d=Math.round((c-p)*100)/100; if(d===0) return '<span class="pm2-z">=</span>'; return '<span class="'+(d>0?'pm2-up':'pm2-dn')+'">'+(d>0?'▲ +':'▼ ')+pm2Fmt(Math.abs(d),(Math.abs(d)%1)?1:0).replace('-','')+'</span>'; }
function pm2Data(iso){ return String(iso||'').split('-').reverse().join('/'); }
function pm2DataC(iso){ var p=String(iso||'').split('-'); return p.length===3?(p[2]+'/'+p[1]):iso; }
function pm2MesAno(iso){ var p=String(iso||'').split('-'); var M=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']; return p.length===3?(M[parseInt(p[1],10)-1]+'/'+p[0].slice(2)):iso; }
function pm2Esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

/* ───────── gráfico de linhas (SVG) ───────── */
function pm2LineChart(series, xLabels, opts){
  opts=opts||{}; var n=xLabels.length; if(!n||!series.length) return '<div class="pm2-empty">Sem pontos suficientes.</div>';
  var W=Math.max(640, opts.width||820), H=opts.height||250, pL=48, pR=46, pT=14, pB=36;
  var vals=[]; series.forEach(function(s){ s.values.forEach(function(v){ if(v!=null&&!isNaN(v)) vals.push(v); }); });
  if(!vals.length) return '<div class="pm2-empty">Sem pontos suficientes.</div>';
  var mn=Math.min.apply(null,vals), mx=Math.max.apply(null,vals); if(mx===mn){ mx+=5; mn-=5; }
  var pad=(mx-mn)*0.10; mn-=pad; mx+=pad;
  // ticks "redondos"
  var span=mx-mn, step=Math.pow(10,Math.floor(Math.log10(span/4))); var m=span/4/step; step*= (m>5?10:(m>2?5:(m>1?2:1)));
  var y0=Math.ceil(mn/step)*step;
  var X=function(i){ return pL+(n===1?0:(i*(W-pL-pR)/(n-1))); }, Y=function(v){ return pT+(H-pT-pB)*(1-(v-mn)/(mx-mn)); };
  var g='';
  for(var v=y0; v<=mx; v+=step){ g+='<line x1="'+pL+'" y1="'+Y(v).toFixed(1)+'" x2="'+(W-pR)+'" y2="'+Y(v).toFixed(1)+'" class="pm2-grid"/><text x="'+(pL-6)+'" y="'+(Y(v)+3.5).toFixed(1)+'" class="pm2-ax" text-anchor="end">'+pm2Fmt(v)+'</text>'; }
  // eixo X: até 10 rótulos; para séries longas, marca a troca de mês/ano
  var step2=Math.max(1,Math.ceil(n/10)), lastLbl='', bounds=[];
  if(n>140&&opts.xKeys){ opts.xKeys.forEach(function(mk,i){ if(mk!==lastLbl){ bounds.push(i); lastLbl=mk; } }); }
  var bstep=Math.max(1,Math.ceil(bounds.length/12)); var showIdx={}; bounds.forEach(function(bi,q){ if(q%bstep===0) showIdx[bi]=1; });
  for(var i=0;i<n;i++){
    var lb=xLabels[i], show=false;
    if(n>140){ if(showIdx[i]){ show=true; lb=opts.xKeys[i]; } }
    else if(i===n-1) show=true;
    else if(i%step2===0 && (n-1-i)>=Math.max(2,Math.ceil(step2*0.6))) show=true; // evita colidir com o último rótulo
    if(show) g+='<text x="'+X(i).toFixed(1)+'" y="'+(H-pB+16)+'" class="pm2-ax" text-anchor="middle">'+pm2Esc(lb)+'</text>';
  }
  // rótulos finais sem sobreposição: calcula posições e afasta os que ficariam a menos de 10px
  var ends=[]; series.forEach(function(s,si){ var li=-1; s.values.forEach(function(v,i){ if(v!=null&&!isNaN(v)) li=i; }); if(li>=0) ends.push({si:si,y:Y(s.values[li]),yl:Y(s.values[li])}); });
  ends.sort(function(a,b){return a.y-b.y;}); for(var k=1;k<ends.length;k++){ if(ends[k].yl-ends[k-1].yl<10) ends[k].yl=ends[k-1].yl+10; }
  var endY={}; ends.forEach(function(e){ endY[e.si]=e.yl; });
  series.forEach(function(s,si){
    var d='', first=true, pts='', li=-1;
    var gapMax=(opts.gapMax!=null?opts.gapMax:15), lastI=-1;
    s.values.forEach(function(v,i){ if(v==null||isNaN(v)) return; var x=X(i), y=Y(v); var brk=(lastI>=0&&(i-lastI)>gapMax); d+=((first||brk)?'M':'L')+x.toFixed(1)+' '+y.toFixed(1)+' '; first=false; li=i; lastI=i;
      if(n<=40) pts+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="2.2" fill="'+s.color+'"><title>'+pm2Esc(s.name)+' · '+pm2Esc(xLabels[i])+' · '+pm2Fmt(v,1)+'</title></circle>'; });
    if(li<0) return;
    // linha contínua: pontos sem cotação são ligados ao próximo cotado (pedido do João, 01/10/2026)
    g+='<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="'+(s.dash?1.4:2)+'" '+(s.dash?'stroke-dasharray="5 4" ':'')+'stroke-linejoin="round" stroke-linecap="round"><title>'+pm2Esc(s.name)+'</title></path>'+pts;
    g+='<circle cx="'+X(li).toFixed(1)+'" cy="'+Y(s.values[li]).toFixed(1)+'" r="3.4" fill="'+s.color+'" stroke="#fff" stroke-width="1.2"/>';
    var yl=(endY[si]!=null?endY[si]:Y(s.values[li]));
    g+='<text x="'+(X(li)+7).toFixed(1)+'" y="'+(yl+3.5).toFixed(1)+'" class="pm2-lbl" fill="'+s.color+'">'+pm2Fmt(s.values[li])+'</text>';
  });
  // hover: linha vertical + leitura do dia
  var hov='<g class="pm2-hov" style="display:none"><line class="pm2-hovline" y1="'+pT+'" y2="'+(H-pB)+'" x1="0" x2="0"/><text class="pm2-hovtxt" y="'+(pT+10)+'" x="0"></text></g>';
  var uid='pm2c'+Math.random().toString(36).slice(2,8);
  var data=JSON.stringify({n:n,pL:pL,pR:pR,W:W,labels:xLabels,series:series.map(function(s){return {name:s.name,values:s.values,color:s.color};})}).replace(/</g,'\\u003c');
  return '<div class="pm2-chartwrap" id="'+uid+'" data-chart=\''+data.replace(/'/g,'&#39;')+'\' onmousemove="pm2Hover(event,this)" onmouseleave="pm2HoverOff(this)"><svg viewBox="0 0 '+W+' '+H+'" class="pm2-svg" preserveAspectRatio="xMidYMid meet">'+g+hov+'</svg><div class="pm2-tip" style="display:none"></div></div>';
}
function pm2Hover(ev,wrap){
  try{ var d=JSON.parse(wrap.getAttribute('data-chart')); var svg=wrap.querySelector('svg'); var r=svg.getBoundingClientRect(); var sx=d.W/r.width; var x=(ev.clientX-r.left)*sx;
    var i=Math.round((x-d.pL)/((d.W-d.pL-d.pR)/(d.n-1))); i=Math.max(0,Math.min(d.n-1,i)); var X=d.pL+i*((d.W-d.pL-d.pR)/(d.n-1));
    var hg=svg.querySelector('.pm2-hov'); hg.style.display=''; hg.querySelector('line').setAttribute('x1',X); hg.querySelector('line').setAttribute('x2',X);
    var tip=wrap.querySelector('.pm2-tip'); var rows=d.series.map(function(s){ var v=s.values[i]; return v==null?'':'<div><i style="background:'+s.color+'"></i>'+pm2Esc(s.name)+' <b>'+pm2Fmt(v)+'</b></div>'; }).join('');
    tip.innerHTML='<div class="pm2-tipd">'+pm2Esc(d.labels[i])+'</div>'+(rows||'<div class="pm2-m">sem cotação</div>'); tip.style.display='';
    var left=(X/sx); tip.style.left=Math.min(r.width-170, Math.max(0,left+10))+'px';
  }catch(e){}
}
function pm2HoverOff(wrap){ try{ wrap.querySelector('.pm2-hov').style.display='none'; wrap.querySelector('.pm2-tip').style.display='none'; }catch(e){} }

/* ───────── comparação entre safras: mesma janela (ex.: Feb) em cada ano, x = meses até o embarque ───────── */
function pm2SeasonChart(linhas, opts){
  // linhas: [{name,color,pts:[{t:mesesAteEmbarque(neg.→0), v}]}]
  opts=opts||{}; var W=Math.max(640,opts.width||860), H=opts.height||260, pL=48, pR=96, pT=14, pB=36;
  var all=[]; linhas.forEach(function(l){ l.pts.forEach(function(p){ all.push(p.v); }); }); if(!all.length) return '<div class="pm2-empty">Sem pontos para comparar.</div>';
  var mn=Math.min.apply(null,all), mx=Math.max.apply(null,all); if(mx===mn){mx+=5;mn-=5;} var pad=(mx-mn)*0.1; mn-=pad; mx+=pad;
  var tmin=-13, tmax=0.3; var X=function(t){ return pL+(t-tmin)/(tmax-tmin)*(W-pL-pR); }, Y=function(v){ return pT+(H-pT-pB)*(1-(v-mn)/(mx-mn)); };
  var g=''; var span=mx-mn, step=Math.pow(10,Math.floor(Math.log10(span/4))); var m=span/4/step; step*=(m>5?10:(m>2?5:(m>1?2:1)));
  for(var v=Math.ceil(mn/step)*step; v<=mx; v+=step){ g+='<line x1="'+pL+'" y1="'+Y(v).toFixed(1)+'" x2="'+(W-pR)+'" y2="'+Y(v).toFixed(1)+'" class="pm2-grid"/><text x="'+(pL-6)+'" y="'+(Y(v)+3.5).toFixed(1)+'" class="pm2-ax" text-anchor="end">'+pm2Fmt(v)+'</text>'; }
  for(var t=-12;t<=0;t+=1){ g+='<line x1="'+X(t).toFixed(1)+'" y1="'+pT+'" x2="'+X(t).toFixed(1)+'" y2="'+(H-pB)+'" class="pm2-grid"/><text x="'+X(t).toFixed(1)+'" y="'+(H-pB+16)+'" class="pm2-ax" text-anchor="middle">'+(t===0?'embarque':(-t)+'m')+'</text>'; }
  var ends=[]; linhas.forEach(function(l,li){ l.pts.sort(function(a,b){return a.t-b.t;}); var lp=l.pts[l.pts.length-1]; if(lp) ends.push({li:li,y:Y(lp.v),yl:Y(lp.v)}); });
  ends.sort(function(a,b){return a.y-b.y;}); for(var q=1;q<ends.length;q++){ if(ends[q].yl-ends[q-1].yl<11) ends[q].yl=ends[q-1].yl+11; } var endY={}; ends.forEach(function(e){ endY[e.li]=e.yl; });
  linhas.forEach(function(l,li){ var d='', first=true; l.pts.forEach(function(p){ if(p.t<tmin) return; d+=(first?'M':'L')+X(p.t).toFixed(1)+' '+Y(p.v).toFixed(1)+' '; first=false; });
    if(d) g+='<path d="'+d+'" fill="none" stroke="'+l.color+'" stroke-width="'+(l.atual?2.6:1.7)+'" stroke-linejoin="round" stroke-linecap="round" opacity="'+(l.atual?1:.85)+'"><title>'+pm2Esc(l.name)+'</title></path>';
    var lp=l.pts[l.pts.length-1]; if(lp){ var yl=(endY[li]!=null?endY[li]:Y(lp.v)); g+='<circle cx="'+X(lp.t).toFixed(1)+'" cy="'+Y(lp.v).toFixed(1)+'" r="3" fill="'+l.color+'"/><text x="'+(W-pR+8)+'" y="'+(yl+3.5).toFixed(1)+'" class="pm2-lbl" fill="'+l.color+'">'+pm2Esc(l.name)+' '+pm2Fmt(lp.v)+'</text>'; } });
  return '<svg viewBox="0 0 '+W+' '+H+'" class="pm2-svg" preserveAspectRatio="xMidYMid meet">'+g+'</svg>';
}
function pm2SeasonData(base, mesSafra, val){
  // uma linha por ano da janela mesSafra-YY, x em meses (fração) até o 1º dia do mês de embarque
  var MON=PM2_MES; var anos={};
  base.forEach(function(e){ Object.keys(e.jan).forEach(function(j){ if(j.indexOf('/')>=0||j.slice(0,3)!==mesSafra) return; var y=2000+parseInt(j.slice(4),10); var ship=new Date(Date.UTC(y,MON[mesSafra]-1,1)); var dt=new Date(e.data+'T00:00:00Z'); var t=-(ship-dt)/(1000*3600*24)/30.4375; if(t>0.3||t<-13.5) return; (anos[j]=anos[j]||[]).push({t:t,v:val(e,j)}); }); });
  return Object.keys(anos).sort(function(a,b){return pm2Key(a)-pm2Key(b);}).filter(function(j){return anos[j].length>=15;}).map(function(j,i,arr){ return {name:j,color:PM2_PAL[i%PM2_PAL.length],pts:anos[j],atual:i===arr.length-1,key:'s:'+j}; });
}
/* ───────── curva do dia: barras por categoria, com fantasma da leitura anterior ───────── */
function pm2TermChart(cats, cur, prev, opts){
  opts=opts||{}; var n=cats.length; if(!n) return '<div class="pm2-empty">Sem janela cotada na última leitura.</div>';
  var W=Math.max(520, opts.width||760), H=opts.height||240, pL=46, pR=14, pT=22, pB=44;
  var vals=cur.concat(prev).filter(function(v){return v!=null&&!isNaN(v);}); if(!vals.length) return '<div class="pm2-empty">Sem pontos.</div>';
  var mn=Math.min.apply(null,vals), mx=Math.max.apply(null,vals); if(mx===mn){ mx+=5; mn-=5; } var pad=(mx-mn)*0.18; mn=Math.max(0,mn-pad); mx+=pad;
  var slot=(W-pL-pR)/n, bw=Math.min(38, slot*0.52), Y=function(v){ return pT+(H-pT-pB)*(1-(v-mn)/(mx-mn)); };
  var g=''; for(var t=0;t<=4;t++){ var v=mn+(mx-mn)*t/4; g+='<line x1="'+pL+'" y1="'+Y(v).toFixed(1)+'" x2="'+(W-pR)+'" y2="'+Y(v).toFixed(1)+'" class="pm2-grid"/><text x="'+(pL-6)+'" y="'+(Y(v)+3.5).toFixed(1)+'" class="pm2-ax" text-anchor="end">'+pm2Fmt(v)+'</text>'; }
  var base=Y(mn);
  cats.forEach(function(c,i){ var cx=pL+slot*i+slot/2; var v=cur[i], p=prev[i];
    if(p!=null&&!isNaN(p)) g+='<rect x="'+(cx-bw/2+6).toFixed(1)+'" y="'+Y(p).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+(base-Y(p)).toFixed(1)+'" class="pm2-ghost"><title>leitura anterior · '+pm2Fmt(p,1)+'</title></rect>';
    if(v!=null&&!isNaN(v)){ g+='<rect x="'+(cx-bw/2).toFixed(1)+'" y="'+Y(v).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+(base-Y(v)).toFixed(1)+'" rx="3" class="pm2-bar"><title>'+pm2Esc(c)+' · '+pm2Fmt(v,1)+'</title></rect>';
      g+='<text x="'+cx.toFixed(1)+'" y="'+(Y(v)-6).toFixed(1)+'" class="pm2-val" text-anchor="middle">'+pm2Fmt(v)+'</text>';
      if(p!=null&&!isNaN(p)&&Math.round(v-p)!==0){ var d=v-p; g+='<text x="'+cx.toFixed(1)+'" y="'+(H-pB+(n>8?40:30))+'" class="'+(d>0?'pm2-tup':'pm2-tdn')+'" text-anchor="middle">'+(d>0?'+':'')+pm2Fmt(d)+'</text>'; } }
    var yl=(H-pB+16)+((n>8&&i%2)?12:0); // intercala quando há muitas categorias
    g+='<text x="'+cx.toFixed(1)+'" y="'+yl+'" class="pm2-ax" text-anchor="middle">'+pm2Esc(c)+'</text>';
  });
  return '<svg viewBox="0 0 '+W+' '+H+'" class="pm2-svg" preserveAspectRatio="xMidYMid meet">'+g+'</svg>';
}
function pm2Legend(items){ return '<div class="pm2-leg">'+items.map(function(it){ return '<button class="pm2-chip'+(it.hidden?' off':'')+'" style="--c:'+it.color+'" onclick="pm2Toggle(\''+pm2Esc(it.key).replace(/'/g,"\\'")+'\')"><i></i>'+pm2Esc(it.name)+'</button>'; }).join('')+'</div>'; }
function pm2Toggle(k){ pm2State.hidden[k]=!pm2State.hidden[k]; renderPremiosV2(); }
function pm2SetGrupo(g){ pm2State.grupo=g; pm2State.hidden={}; renderPremiosV2(); }
function pm2SetN(n){ pm2State.nDias=parseInt(n,10)||60; renderPremiosV2(); }
function pm2ToggleHist(){ pm2State.soHistMeses=!pm2State.soHistMeses; renderPremiosV2(); }
function pm2Kpi(lbl,val,sub,delta){ return '<div class="pm2-kpi"><div class="pm2-kv">'+val+'</div><div class="pm2-kl">'+lbl+'</div>'+(sub?'<div class="pm2-ks">'+sub+'</div>':'')+(delta!==undefined?'<div class="pm2-kd">'+delta+'</div>':'')+'</div>'; }

/* ═════════════════════ MILHO · FOB ═════════════════════ */
function renderPremiosMilhoV2(wrap){
  var base=((typeof state!=='undefined'&&state&&state.premiosMilho)||[]).slice().sort(function(a,b){return String(a.data)<String(b.data)?-1:1;});
  if(!base.length){ wrap.innerHTML='<div class="pm2-empty">Sem leituras de FOB milho.</div>'; return; }
  var cur=base[base.length-1], prev=base.length>1?base[base.length-2]:null;
  var grupos=[]; base.slice(-40).forEach(function(e){ Object.keys(e.cargo||{}).forEach(function(g){ if(grupos.indexOf(g)<0) grupos.push(g); }); });
  var ORDG=['Santos','Norte','Itacoatiara','Paranaguá','São Francisco do Sul','Santarém']; grupos.sort(function(a,b){ var ia=ORDG.indexOf(a), ib=ORDG.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); });
  if(grupos.indexOf(pm2State.grupo)<0) pm2State.grupo=grupos[0];
  var G=pm2State.grupo;
  var offer=function(e,g,m){ var x=e&&e.cargo&&e.cargo[g]&&e.cargo[g][m]; return x&&x.offer!=null?x.offer:null; };
  var bid=function(e,g,m){ var x=e&&e.cargo&&e.cargo[g]&&e.cargo[g][m]; return x&&x.bid!=null?x.bid:null; };
  // última leitura anterior em que o par (g,m) tinha offer
  var prevOffer=function(g,m){ for(var i=base.length-2;i>=0;i--){ var v=offer(base[i],g,m); if(v!=null) return {v:v,d:base[i].data}; } return null; };
  var nLinhas=(cur.cargoDetails||[]).length, nGrupos=Object.keys(cur.cargo||{}).length, nBid=(cur.cargoDetails||[]).filter(function(x){return x.bid!=null;}).length;
  // KPIs: Santos Nov/Dec, Norte Nov, Paranaguá Nov
  var kp=[['Santos','Nov-26'],['Santos','Dec-26'],['Norte','Nov-26'],['Norte','Dec-26'],['Paranaguá','Nov-26']];
  var kpis=''; kp.forEach(function(p){ var v=offer(cur,p[0],p[1]); var pv=prevOffer(p[0],p[1]); kpis+=pm2Kpi(p[0]+' · '+p[1], v==null?'—':pm2Fmt(v), v==null?'não cotado hoje':(bid(cur,p[0],p[1])!=null?'bid '+pm2Fmt(bid(cur,p[0],p[1])):'só offer'), v!=null&&pv?pm2Dlt(v,pv.v)+' <span class="pm2-m">vs '+pm2DataC(pv.d)+'</span>':''); });
  kpis+=pm2Kpi('Leitura de '+pm2Data(cur.data), nLinhas+' linhas', nGrupos+' grupos · '+nBid+' com bid', '');
  // Série histórica do grupo selecionado
  var win=base.slice(-pm2State.nDias);
  var meses=[]; win.forEach(function(e){ Object.keys((e.cargo||{})[G]||{}).forEach(function(m){ if(meses.indexOf(m)<0) meses.push(m); }); });
  meses.sort(function(a,b){return pm2Key(a)-pm2Key(b);});
  var minPts=win.length>140?20:2; meses=meses.filter(function(m){ var c=0; win.forEach(function(e){ if(offer(e,G,m)!=null) c++; }); return c>=minPts; }); if(meses.length>12) meses=meses.slice(-12);
  var xl=win.map(function(e){return pm2DataC(e.data);}); var xk=win.map(function(e){return pm2MesAno(e.data);});
  var series=[], leg=[];
  meses.forEach(function(m,i){ var col=PM2_PAL[i%PM2_PAL.length]; leg.push({key:'m:'+m,name:m,color:col,hidden:!!pm2State.hidden['m:'+m]}); if(pm2State.hidden['m:'+m]) return; series.push({name:G+' '+m,color:col,values:win.map(function(e){return offer(e,G,m);})}); });
  var gsel='<select class="pm2-sel" onchange="pm2SetGrupo(this.value)">'+grupos.map(function(g){return '<option'+(g===G?' selected':'')+'>'+g+'</option>';}).join('')+'</select>';
  var nsel='<select class="pm2-sel" onchange="pm2SetN(this.value)">'+[20,40,60,120,250,9999].map(function(n){return '<option value="'+n+'"'+(n===pm2State.nDias?' selected':'')+'>'+(n===9999?'tudo':n+' leituras')+'</option>';}).join('')+'</select>';
  // Curva do dia (todas as janelas do grupo, hoje x anterior)
  var catsAll=[]; grupos.forEach(function(g){ Object.keys((cur.cargo||{})[g]||{}).forEach(function(m){ var k=g+'|'+m; if(catsAll.indexOf(k)<0) catsAll.push(k); }); });
  var catsG=Object.keys((cur.cargo||{})[G]||{}).sort(function(a,b){return pm2Key(a)-pm2Key(b);});
  var curV=catsG.map(function(m){return offer(cur,G,m);}), prevV=catsG.map(function(m){ var p=prevOffer(G,m); return p?p.v:null; });
  // Matriz: colunas = pares (grupo, mês) com >=3 pontos nas últimas 20 leituras
  var last=base.slice(-15), cols=[];
  grupos.forEach(function(g){ var ms={}; base.slice(-20).forEach(function(e){ Object.keys((e.cargo||{})[g]||{}).forEach(function(m){ if(offer(e,g,m)!=null) ms[m]=(ms[m]||0)+1; }); }); Object.keys(ms).filter(function(m){return ms[m]>=3;}).sort(function(a,b){return pm2Key(a)-pm2Key(b);}).forEach(function(m){ cols.push([g,m]); }); });
  var th='<tr><th class="pm2-tl">Leitura</th>'+cols.map(function(c){return '<th><span class="pm2-thg">'+pm2Esc(c[0])+'</span>'+c[1]+'</th>';}).join('')+'</tr>';
  var rows=''; for(var r=last.length-1;r>=0;r--){ var e=last[r], pe=null; for(var q=base.indexOf(e)-1;q>=0;q--){ pe=base[q]; break; }
    rows+='<tr'+(r===last.length-1?' class="pm2-cur"':'')+'><td class="pm2-tl">'+pm2Data(e.data)+'</td>'+cols.map(function(c){ var v=offer(e,c[0],c[1]); if(v==null) return '<td class="pm2-m">—</td>'; var pv=null; for(var q2=base.indexOf(e)-1;q2>=0;q2--){ var t=offer(base[q2],c[0],c[1]); if(t!=null){pv=t;break;} } var b=bid(e,c[0],c[1]); return '<td><b>'+pm2Fmt(v)+'</b>'+(b!=null?'<small>/'+pm2Fmt(b)+'</small>':'')+'<em>'+(pv!=null?pm2Dlt(v,pv):'')+'</em></td>'; }).join('')+'</tr>'; }
  // Detalhe da última leitura
  var det=(cur.cargoDetails||[]).slice().sort(function(a,b){ var ia=ORDG.indexOf(a.grupo), ib=ORDG.indexOf(b.grupo); if(ia!==ib) return (ia<0?99:ia)-(ib<0?99:ib); return pm2Key(a.embarque)-pm2Key(b.embarque); });
  var dr=det.map(function(x){ return '<tr'+(x.parcial?' class="pm2-parcial"':'')+'><td>'+pm2Esc(x.grupo)+'</td><td>'+pm2Esc(x.janela||'')+'</td><td>'+pm2Esc(x.embarque)+'</td><td class="pm2-num">'+(x.offer!=null?pm2Fmt(x.offer):'—')+'</td><td class="pm2-num">'+(x.bid!=null?pm2Fmt(x.bid):'—')+'</td><td class="pm2-obs">'+pm2Esc(x.obs||'')+(x.parcial?' · <b>parcela, fora do agregado</b>':'')+'</td></tr>'; }).join('');
  var h='<div class="pm2">';
  h+='<div class="pm2-top"><div><div class="pm2-eyebrow">Milho · prêmio FOB · ¢/bu sobre CBOT</div><div class="pm2-title">Última leitura <b>'+pm2Data(cur.data)+'</b>'+(prev?' <span class="pm2-m">· anterior '+pm2Data(prev.data)+'</span>':'')+'</div></div></div>';
  h+='<div class="pm2-kpis">'+kpis+'</div>';
  h+='<div class="pm2-row">';
  h+='<div class="a-card pm2-card pm2-w2"><div class="a-card-t">Série histórica · '+pm2Esc(G)+' <span class="pm2-tag">offer</span></div><div class="pm2-tools"><label>Porto '+gsel+'</label><label>Janela '+nsel+'</label></div>'+pm2Legend(leg)+pm2LineChart(series,xl,{width:860,height:250,xKeys:xk})+'<div class="pm2-foot">Offer do agregado do porto por embarque, uma leitura por dia útil reportado. Fins de semana e dias sem reporte não entram. Clique na legenda para esconder uma janela.</div></div>';
  h+='<div class="a-card pm2-card pm2-w1"><div class="a-card-t">Curva do dia · '+pm2Esc(G)+'</div>'+pm2TermChart(catsG,curV,prevV,{width:520,height:250})+'<div class="pm2-foot">Barra cheia é a leitura de '+pm2Data(cur.data)+'; barra clara, a última leitura anterior em que a janela foi cotada. Número abaixo do eixo é a variação.</div></div>';
  h+='</div>';
  h+='<div class="a-card pm2-card"><div class="a-card-t">Matriz das últimas 15 leituras <span class="pm2-tag">offer / bid · Δ vs leitura anterior da mesma janela</span></div><div class="pm2-tw"><table class="pm2-tbl"><thead>'+th+'</thead><tbody>'+rows+'</tbody></table></div></div>';
  h+='<div class="a-card pm2-card"><div class="a-card-t">Detalhe da leitura de '+pm2Data(cur.data)+' <span class="pm2-tag">'+det.length+' linhas como reportadas</span></div><div class="pm2-tw"><table class="pm2-tbl pm2-det"><thead><tr><th>Grupo</th><th>Janela</th><th>Embarque</th><th class="pm2-num">Offer</th><th class="pm2-num">Bid</th><th>Observação</th></tr></thead><tbody>'+dr+'</tbody></table></div>'+(cur.nota?'<div class="pm2-foot">'+pm2Esc(cur.nota)+'</div>':'')+'</div>';
  h+='</div>'; wrap.innerHTML=h;
}

/* ═════════════════════ SOJA · CFR CHINA ═════════════════════ */
function pm2CfrBase(){
  var R=(typeof CFR_CHINA_OFFER_REPORT!=='undefined')?CFR_CHINA_OFFER_REPORT:{}; var byDate={};
  Object.keys(R).forEach(function(j){ (R[j]||[]).forEach(function(x){ if(!x||x.value==null) return; (byDate[x.data]=byDate[x.data]||{})[j]={v:x.value,ref:x.ref,obs:x.obs,player:x.player}; }); });
  return Object.keys(byDate).sort().map(function(d){ return {data:d, jan:byDate[d]}; });
}
function renderPremiosSojaV2(wrap){
  var base=pm2CfrBase();
  if(!base.length){ wrap.innerHTML='<div class="pm2-empty">Sem leituras de CFR China.</div>'; return; }
  var cur=base[base.length-1], prev=base.length>1?base[base.length-2]:null;
  var val=function(e,j){ var x=e&&e.jan&&e.jan[j]; return x?x.v:null; };
  var ref=function(e,j){ var x=e&&e.jan&&e.jan[j]; return x&&x.ref?x.ref:''; };
  var prevVal=function(j){ for(var i=base.length-2;i>=0;i--){ var v=val(base[i],j); if(v!=null) return {v:v,d:base[i].data}; } return null; };
  var isMes=function(j){ return j.indexOf('/')<0; };
  var janelasAll=[]; base.slice(-40).forEach(function(e){ Object.keys(e.jan).forEach(function(j){ if(janelasAll.indexOf(j)<0) janelasAll.push(j); }); }); janelasAll.sort(function(a,b){return pm2Key(a)-pm2Key(b);});
  var kp=Object.keys(cur.jan).filter(isMes).sort(function(a,b){return pm2Key(a)-pm2Key(b);}).slice(0,6); /* V4AW: janelas do dia */
  var kpis=''; kp.forEach(function(j){ var v=val(cur,j), pv=prevVal(j); kpis+=pm2Kpi(j+(ref(cur,j)?' · ref '+ref(cur,j):''), v==null?'—':pm2Fmt(v), v==null?'não cotado hoje':'offer ¢/bu', v!=null&&pv?pm2Dlt(v,pv.v)+' <span class="pm2-m">vs '+pm2DataC(pv.d)+'</span>':''); });
  var nJ=Object.keys(cur.jan).length; kpis+=pm2Kpi('Leitura de '+pm2Data(cur.data), nJ+' janelas', base.length+' leituras desde '+pm2Data(base[0].data), '');
  var win=base.slice(-pm2State.nDias), xl=win.map(function(e){return pm2DataC(e.data);}), xk=win.map(function(e){return pm2MesAno(e.data);});
  var longo=win.length>140;
  var janelasWin=[]; if(longo){ var cnt={}; win.forEach(function(e){ Object.keys(e.jan).forEach(function(j){ cnt[j]=(cnt[j]||0)+1; }); }); janelasWin=Object.keys(cnt).filter(function(j){return cnt[j]>=20;}).sort(function(a,b){return pm2Key(a)-pm2Key(b);}); if(janelasWin.length>12) janelasWin=janelasWin.slice(-12); }
  var jan=(longo?janelasWin:janelasAll).filter(function(j){ if(pm2State.soHistMeses&&!isMes(j)) return false; var c=0; win.forEach(function(e){ if(val(e,j)!=null) c++; }); return c>=2; });
  var series=[], leg=[];
  jan.forEach(function(j,i){ var col=PM2_PAL[i%PM2_PAL.length]; leg.push({key:'j:'+j,name:j,color:col,hidden:!!pm2State.hidden['j:'+j]}); if(pm2State.hidden['j:'+j]) return; series.push({name:'CFR '+j,color:col,values:win.map(function(e){return val(e,j);})}); });
  var nsel='<select class="pm2-sel" onchange="pm2SetN(this.value)">'+[20,40,60,120,250,9999].map(function(n){return '<option value="'+n+'"'+(n===pm2State.nDias?' selected':'')+'>'+(n===9999?'tudo':n+' leituras')+'</option>';}).join('')+'</select>';
  var hsel='<button class="pm2-sel pm2-btn'+(pm2State.soHistMeses?' on':'')+'" onclick="pm2ToggleHist()">'+(pm2State.soHistMeses?'só meses cheios':'meses + intervalos')+'</button>';
  var modoSel='<span class="pm2-seg"><button class="'+(pm2State.modo==='tempo'?'on':'')+'" onclick="pm2SetModo(\'tempo\')">Linha do tempo</button><button class="'+(pm2State.modo==='safra'?'on':'')+'" onclick="pm2SetModo(\'safra\')">Comparar safras</button></span>';
  var mesesDisp=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var msel='<select class="pm2-sel" onchange="pm2SetMesSafra(this.value)">'+mesesDisp.map(function(mm){return '<option'+(mm===pm2State.mesSafra?' selected':'')+'>'+mm+'</option>';}).join('')+'</select>';
  var cats=Object.keys(cur.jan).sort(function(a,b){return pm2Key(a)-pm2Key(b);});
  var curV=cats.map(function(j){return val(cur,j);}), prevV=cats.map(function(j){ var p=prevVal(j); return p?p.v:null; });
  var catsL=cats.map(function(j){ return j+(ref(cur,j)?' '+ref(cur,j):''); });
  var last=base.slice(-15), cols=janelasAll.filter(function(j){ var c=0; base.slice(-20).forEach(function(e){ if(val(e,j)!=null) c++; }); return c>=3; });
  var th='<tr><th class="pm2-tl">Leitura</th>'+cols.map(function(j){return '<th>'+j+'</th>';}).join('')+'</tr>';
  var rows=''; for(var r=last.length-1;r>=0;r--){ var e=last[r]; var idx=base.indexOf(e);
    rows+='<tr'+(r===last.length-1?' class="pm2-cur"':'')+'><td class="pm2-tl">'+pm2Data(e.data)+'</td>'+cols.map(function(j){ var v=val(e,j); if(v==null) return '<td class="pm2-m">—</td>'; var pv=null; for(var q=idx-1;q>=0;q--){ var t=val(base[q],j); if(t!=null){pv=t;break;} } return '<td><b>'+pm2Fmt(v)+'</b><small> '+pm2Esc(ref(e,j))+'</small><em>'+(pv!=null?pm2Dlt(v,pv):'')+'</em></td>'; }).join('')+'</tr>'; }
  var dr=cats.map(function(j){ var x=cur.jan[j]; return '<tr><td>'+j+'</td><td>'+pm2Esc(x.ref||'')+'</td><td class="pm2-num">'+pm2Fmt(x.v)+'</td><td class="pm2-obs">'+pm2Esc(x.obs||'')+'</td></tr>'; }).join('');
  var h='<div class="pm2">';
  h+='<div class="pm2-top"><div><div class="pm2-eyebrow">Soja · basis CFR China · ¢/bu sobre CBOT · menor offer da janela</div><div class="pm2-title">Última leitura <b>'+pm2Data(cur.data)+'</b>'+(prev?' <span class="pm2-m">· anterior '+pm2Data(prev.data)+'</span>':'')+'</div></div></div>';
  h+='<div class="pm2-kpis">'+kpis+'</div>';
  h+='<div class="pm2-row">';
  if(pm2State.modo==='safra'){
    var linhas=pm2SeasonData(base, pm2State.mesSafra, val); var legS=linhas.map(function(l){return {key:l.key,name:l.name,color:l.color,hidden:!!pm2State.hidden[l.key]};}); var vis=linhas.filter(function(l){return !pm2State.hidden[l.key];});
    h+='<div class="a-card pm2-card pm2-w2"><div class="a-card-t">Comparar safras · janela '+pm2Esc(pm2State.mesSafra)+' <span class="pm2-tag">offer · alinhado pelo embarque</span></div><div class="pm2-tools"><label>Modo '+modoSel+'</label><label>Mês de embarque '+msel+'</label></div>'+pm2Legend(legS)+pm2SeasonChart(vis,{width:860,height:260})+'<div class="pm2-foot">Cada linha é a janela '+pm2Esc(pm2State.mesSafra)+' de um ano, do 13º mês antes do embarque até o mês de embarque. Linha mais grossa é a safra corrente. Histórico desde 2022 (arquivo Basis Paranaguá CFR China) emendado à série diária.</div></div>';
  } else {
  h+='<div class="a-card pm2-card pm2-w2"><div class="a-card-t">Série histórica por janela <span class="pm2-tag">offer</span></div><div class="pm2-tools"><label>Modo '+modoSel+'</label><label>Janelas '+hsel+'</label><label>Período '+nsel+'</label></div>'+pm2Legend(leg)+pm2LineChart(series,xl,{width:860,height:250,xKeys:xk})+'<div class="pm2-foot">Menor oferta reportada por janela de embarque, com a referência CBOT de cada uma (X, F, H, K, N). Dezembro segue a regra do menor F. Clique na legenda para esconder uma janela.'+(longo?' Período longo: só janelas com 20+ leituras no intervalo, até 12; a linha quebra quando a janela fica mais de 15 leituras sem cotação.':'')+'</div></div>';
  }
  var wide=cats.length>8; if(wide){ h+='</div>'; }
  h+='<div class="a-card pm2-card '+(wide?'pm2-full':'pm2-w1')+'"><div class="a-card-t">Curva do dia'+(wide?' <span class="pm2-tag">'+cats.length+' janelas</span>':'')+'</div>'+pm2TermChart(catsL,curV,prevV,{width:wide?1100:560,height:wide?280:250})+'<div class="pm2-foot">Estrutura a termo da leitura de '+pm2Data(cur.data)+' contra a última leitura anterior de cada janela (barra clara). Letra ao lado da janela é a referência CBOT.</div></div>';
  if(!wide) h+='</div>';
  h+='<div class="a-card pm2-card"><div class="a-card-t">Matriz das últimas 15 leituras <span class="pm2-tag">offer e referência · Δ vs leitura anterior da mesma janela</span></div><div class="pm2-tw"><table class="pm2-tbl"><thead>'+th+'</thead><tbody>'+rows+'</tbody></table></div></div>';
  h+='<div class="a-card pm2-card"><div class="a-card-t">Detalhe da leitura de '+pm2Data(cur.data)+' <span class="pm2-tag">'+cats.length+' janelas</span></div><div class="pm2-tw"><table class="pm2-tbl pm2-det"><thead><tr><th>Janela</th><th>Ref</th><th class="pm2-num">Offer</th><th>Observação</th></tr></thead><tbody>'+dr+'</tbody></table></div></div>';
  h+='</div>'; wrap.innerHTML=h;
}

function renderPremiosV2(){
  var wrap=document.getElementById('premiosWrap'); if(!wrap) return;
  var isMilho=(typeof getActiveProduto==='function'&&getActiveProduto()==='Milho');
  if(isMilho) renderPremiosMilhoV2(wrap); else renderPremiosSojaV2(wrap);
  try{ if(typeof aFsButtons==='function') aFsButtons(wrap); }catch(e){}
  try{ if(typeof brzAddCamButtons==='function') brzAddCamButtons(wrap); }catch(e){}
}
/* substitui o renderizador antigo; as funções antigas ficam no arquivo, sem uso */
window.renderPremios = function(){ try{ renderPremiosV2(); }catch(e){ console.warn('premios v2',e); var w=document.getElementById('premiosWrap'); if(w) w.innerHTML='<div class="pm2-empty">Erro ao montar Prêmios: '+pm2Esc(e&&e.message)+'</div>'; } };

