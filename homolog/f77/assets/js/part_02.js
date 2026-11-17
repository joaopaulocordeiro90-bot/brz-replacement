
/* ══════════════════════════════════════════════════════════════════════════════
   PARIDADE DE EXPORTAÇÃO (PPE) · sub-aba da aba Report · 14/10/2026
   Fonte do basis FOB: fonte histórica autorizada (
   histórico 2016–hoje, regra menor offer / maior bid por dia). Lógica fechada
   com o João em 13 e 14/10/2026 (ver business_rules.paridade_*).
   ══════════════════════════════════════════════════════════════════════════════ */
var _repTab = (function(){ try{ return localStorage.getItem('brz_rep_tab')||'report'; }catch(e){ return 'report'; } })();
var PPE_PROD = (function(){ try{ return localStorage.getItem('brz_ppe_prod')||'Soybean'; }catch(e){ return 'Soybean'; } })();
var PPE_PORT = (function(){ try{ return JSON.parse(localStorage.getItem('brz_ppe_port')||'{}'); }catch(e){ return {}; } })();
var PPE_CFG = (function(){ try{ return JSON.parse(localStorage.getItem('brz_ppe_cfg')||'{}'); }catch(e){ return {}; } })();
var PPE_PLAYER = 'trade';
var _basisFOB = null;

/* ── parâmetros da casa ─────────────────────────────────────────────────────── */
var PPE_PRODUTOS = [
  {k:'Soybean', pt:'Soja',   en:'Soybean', hub:'Paranaguá', unit:'¢/bu',  cbotKey:'cbot',       fator:1000/(100*60*0.45359237), saca:true,  dec:0},
  {k:'Corn',    pt:'Milho',  en:'Corn',    hub:'Santos',    unit:'¢/bu',  cbotKey:'cbotMilho',  fator:1000/(100*56*0.45359237), saca:true,  dec:0},
  {k:'Soymeal', pt:'Farelo', en:'Soymeal', hub:'Paranaguá', unit:'US$/st',cbotKey:'cbotFarelo', fator:1000/(2000*0.45359237), saca:false, dec:1},
  {k:'Soyoil',  pt:'Óleo',   en:'Soyoil',  hub:'Paranaguá', unit:'¢/lb',  cbotKey:'cbotOleo',   fator:1000/(100*0.45359237), saca:false, dec:2}
];
/* spreads fixos contra o hub (decisão do João, 13/10/2026): soja contra Paranaguá, milho contra Santos */
var PPE_SPREADS = {
  Soybean:{'Paranaguá':0,'Santos':5,'Rio Grande':3,'Aratu':3,'São Francisco do Sul':3,'Itaqui':0,'Barcarena':-11,'Santarém':-35,'Itacoatiara':-40},
  Corn:{'Santos':0,'Paranaguá':-3,'Itaqui':-3,'Barcarena':-5,'São Francisco do Sul':-3,'Itacoatiara':-30,'Santarém':-20},
  Soymeal:{'Paranaguá':0},
  Soyoil:{'Paranaguá':0}
};
var PPE_PORTOS = {
  Soybean:['Paranaguá','Santos','Rio Grande','Aratu','Itaqui','Barcarena','São Francisco do Sul','Itacoatiara','Santarém'],
  Corn:['Santos','Paranaguá','Itaqui','Barcarena','São Francisco do Sul','Itacoatiara','Santarém'],
  Soymeal:['Paranaguá'], Soyoil:['Paranaguá']
};
/* grupo do BRAZILIAN CORN MKT (state.premiosMilho) por porto, para a cotação real do milho */
var PPE_CORN_GRUPO = {'Santos':'Santos','Paranaguá':'Paranaguá','Itaqui':'Norte','Barcarena':'Norte','São Francisco do Sul':'São Francisco do Sul','Itacoatiara':'Itacoatiara','Santarém':'Santarém'};
var PPE_MESES_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var PPE_MESES_DOL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
var PPE_CODIGO_MES = ['F','G','H','J','K','M','N','Q','U','V','X','Z'];

function ppeL(pt,en){ return (typeof repL==='function')?repL(pt,en):pt; }
function ppeProd(){ return PPE_PRODUTOS.filter(function(p){ return p.k===PPE_PROD; })[0]||PPE_PRODUTOS[0]; }
function ppePort(){ var p=ppeProd(); var cur=PPE_PORT[p.k]; return (PPE_PORTOS[p.k].indexOf(cur)>=0)?cur:p.hub; }
function ppeData(){
  if(_basisFOB) return _basisFOB;
  try{ var el=document.getElementById('dataBasisFOB'); _basisFOB=el?JSON.parse(el.textContent||'{}'):{meta:{},series:{}}; }catch(e){ _basisFOB={meta:{},series:{}}; }
  return _basisFOB;
}
function ppeYmd(iso){ return parseInt(String(iso).replace(/-/g,''),10); }
function ppeIso(ymd){ var s=String(ymd); return s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8); }
function ppeFmtBR(iso){ return iso?String(iso).split('-').reverse().join('/'):'—'; }
function ppeNum(v,dec){ if(v==null||isNaN(v)) return '—'; var d=(dec==null?2:dec); return Number(v).toLocaleString(ppeL('pt-BR','en-US'),{minimumFractionDigits:d,maximumFractionDigits:d}); }
function ppeSign(v,dec){ if(v==null||isNaN(v)) return '—'; var d=(dec==null?2:dec); var s=Number(v).toLocaleString(ppeL('pt-BR','en-US'),{minimumFractionDigits:d,maximumFractionDigits:d}); return (v>0?'+':'')+s; }
function ppeVarCls(v){ return (v==null||isNaN(v)||Math.abs(v)<1e-9)?'ppe-z':(v>0?'ppe-up':'ppe-dn'); }
function ppeEsc(t){ return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── séries ─────────────────────────────────────────────────────────────────── */
function ppeSerie(comm, porto, typ, ship, player){ return ppeData().series[comm+'|'+porto+'|'+typ+'|'+ship+'|'+player]||null; }
/* valor na data (ou última data ≤ data); devolve {v, ymd} */
function ppeAt(serie, ymd, exato){
  if(!serie||!serie.length) return null;
  var best=null;
  for(var i=serie.length-1;i>=0;i--){ if(serie[i][0]<=ymd){ best=serie[i]; break; } }
  if(!best) return null;
  if(exato&&best[0]!==ymd) return null;
  return {v:best[1], ymd:best[0]};
}
/* valor anterior estrito a uma data */
function ppeBefore(serie, ymd){ if(!serie) return null; for(var i=serie.length-1;i>=0;i--){ if(serie[i][0]<ymd) return {v:serie[i][1], ymd:serie[i][0]}; } return null; }
function ppeUltimaData(comm){ var m=ppeData().meta||{}; return (m.ultimaData&&m.ultimaData[comm])||null; }
function ppeDateMinus(iso, days){ var d=new Date(iso+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()-days); return d.toISOString().slice(0,10); }
function ppeFimMesAnterior(iso){ var d=new Date(iso+'T12:00:00Z'); d.setUTCDate(0); return d.toISOString().slice(0,10); }

/* Basis carry (V2S): retain each port/shipment until the shipment month begins.
   Use the most recent registered observation without a 7d/45d expiration.
   Valuation date tracks the actual CBOT curve snapshot, not merely last FOB upload. */
function ppeValuationDate(comm){
  var raw=String((typeof state!=='undefined'&&state&&state.timestamps&&state.timestamps.cbot)||'');
  var m=raw.match(/(\d{4}-\d{2}-\d{2})/), market=m?m[1]:null, basis=ppeUltimaData(comm);
  return market&&basis?(market>basis?market:basis):(market||basis||'');
}
/* V3V - Recorte vigente fornecido pela mesa: Paranaguá tem uma tabela de
   fonte fechada por produto, janela e lado. O histórico continua gravado,
   mas NAO pode introduzir linhas nem preencher lados vazios na tabela atual. */
function ppeCapturaAtiva(comm){ /* 09/11/2026: captura de print só vale no dia da última leitura da planilha; depois disso a série manda */
  var m=ppeData().meta||{}, cs=(m.capturasFOB||{})[comm]; if(!cs||!cs.asof) return false;
  var ult=(m.ultimaData||{})[comm]||''; return String(cs.asof).slice(0,10)===String(ult).slice(0,10);
}
function ppeCapturaLinha(comm, porto, j){
  var m=ppeData().meta||{};
  if(!ppeCapturaAtiva(comm)) return null;
  if(porto!=='Paranaguá'||!(m.capturasFOB||{})[comm]||!j||j.typ!=='F') return null;
  var linha=((m.tabelaFonteFOB||{})[comm]||{})[j.ship];
  return linha ? {linha:linha,asof:m.capturasFOB[comm].asof} : null;
}
function ppeJanelasDaCaptura(comm,porto){
  var meta=ppeData().meta||{},cs=(meta.capturasFOB||{})[comm],t=((meta.tabelaFonteFOB||{})[comm]);
  if(!ppeCapturaAtiva(comm))return null;
  if(porto!=='Paranaguá'||!cs||!t)return null;
  return Object.keys(t).map(function(ship){
    var ma=/^([0-9]{2}(?:\|[0-9]{2})*)-(\d{4})$/.exec(ship);
    if(!ma)return null;
    var ms=ma[1].split('|').map(Number),y=Number(ma[2]),m=ms[0];
    return {typ:'F',ship:ship,mes:m,ano:y,dupla:ms.length>1,mes2:ms.length>1?ms[1]:null,
            label:ship,ordem:y*10000+m*10,ultimaCotacao:ppeYmd(cs.asof.slice(0,10)),capturaFOB:true};
  }).filter(Boolean);
}
function ppeJanelas(comm){
  /* A lista da captura é a fonte soberana, inclusive janelas compostas. */
  var portoAtual=comm==='Soybean'?ppePort():PPE_PRODUTOS.filter(function(p){return p.k===comm;})[0].hub;
  var tabelaRecortada=ppeJanelasDaCaptura(comm,portoAtual);
  if(tabelaRecortada!==null)return tabelaRecortada;
  var d=ppeData(), iso=ppeValuationDate(comm);if(!iso)return [];
  var today=ppeYmd(iso), curYM=Number(iso.slice(0,4))*100+Number(iso.slice(5,7));
  var hub=PPE_PRODUTOS.filter(function(x){return x.k===comm;})[0].hub;
  var selected=(comm==='Soybean')?((PPE_PORT||{})[comm]||hub):hub;
  // Include hub windows to retain the full shipment calendar, but only the
  // selected port's real quotations can price a soybean PPE.
  var seen={},out=[];
  Object.keys(d.series||{}).forEach(function(k){
    var m=/^([^|]+)\|([^|]+)\|([^|]+)\|(.+)\|(offer|bid)$/.exec(k);
    if(!m||m[1]!==comm||(m[2]!==hub&&m[2]!==selected))return;
    var typ=m[3],ship=m[4],id=typ+'|'+ship;
    if(seen[id])return;seen[id]=1;
    var w=/^([0-9]{2}(?:\|[0-9]{2})*)-(\d{4})$/.exec(ship);
    if(!w)return;
    var months=w[1].split('|').map(Number), ano=Number(w[2]);
    if(months.some(function(x){return x<1||x>12;}))return;
    // When November begins, a November-only reference expires. A Nov/Dec
    // window stays until December begins, its final shipment month.
    var lastMonth=months[months.length-1], finalYear=ano+(lastMonth<months[0]?1:0);
    if(finalYear*100+lastMonth<=curYM)return;
    var last=null;
    [hub,selected].forEach(function(port){ ['offer','bid'].forEach(function(side){
      var r=ppeAt(ppeSerie(comm,port,typ,ship,side),today,false);
      if(r&&(last==null||r.ymd>last))last=r.ymd;
    });});
    if(last==null)return;
    /* 09/11/2026: janela só entra com leitura nos últimos 45 dias (mês corrente só com 7 dias); carry mais velho sai da tabela */
    var _lim45=ppeYmd(ppeDateMinus(iso,45)), _lim7=ppeYmd(ppeDateMinus(iso,7));
    if(last<_lim45)return;
    if(ano*100+months[0]===curYM && last<_lim7)return;
    // For combined shipments, use the first still-active delivery month
    // to choose Chicago while the original quotation remains unchanged.
    var remaining=months.map(function(mm){return {mes:mm,ano:ano+(mm<months[0]?1:0)};})
       .filter(function(x){return x.ano*100+x.mes>curYM;});
    if(!remaining.length)return;
    var mes=remaining[0].mes, anno=remaining[0].ano, mes2=months.length>1?months[1]:null;
    var tOrd={'F':0,'FH':1,'LH':2,'FH|LH':3}[typ];if(tOrd==null)tOrd=4;
    out.push({typ:typ,ship:ship,mes:mes,ano:anno,dupla:months.length>1,
       mes2:mes2,label:((typ==='F')?'':(typ+' '))+ship,
       ordem:anno*10000+mes*10+tOrd,ultimaCotacao:last});
  });
  out.sort(function(a,b){return a.ordem-b.ordem;});
  return out;
}
/* contrato CBOT da janela pela regra da casa */
function ppeContrato(comm, j){
  var m=j.mes, y=j.ano%100, Y2=function(n){ return (n<10?'0':'')+n; };
  if(comm==='Soybean'){ var _pc=brzPapelSojaContrato({mes:m-1,yy:y}); if(_pc) return _pc; var map={1:'F',2:'H',3:'H',4:'K',5:'K',6:'N',7:'N',8:'Q',9:'U',10:'X',11:'X',12:'F'}; return map[m]+Y2(m===12?y+1:y); } /* V4AW: regra basis.papelSoja */
  if(comm==='Corn'){ if(m<=3) return 'H'+Y2(y); return 'Z'+Y2(y); }
  var mp={1:'F',2:'H',3:'H',4:'K',5:'K',6:'N',7:'N',8:'Q',9:'U',10:'V',11:'Z',12:'Z'}; return mp[m]+Y2(y);
}
function ppeContratoLabel(comm, c){ var pre={Soybean:'ZS',Corn:'ZC',Soymeal:'ZM',Soyoil:'ZL'}[comm]||''; return pre+c; }
function ppeCbot(comm, c){
  /* V3W: a PPE inferior usa SEMPRE a curva viva da aba Mercado, inclusive
     apos edicao/salvamento. CBOT do print FOB permanece no card superior
     como referencia historica da captura (nao fixa o replacement futuro). */
  var p=PPE_PRODUTOS.filter(function(x){return x.k===comm;})[0];
  var allowed=(MARKET_SNAPSHOT&&MARKET_SNAPSHOT[p.cbotKey])||{};
  if(!Object.prototype.hasOwnProperty.call(allowed,c))return null;
  var tab=(state&&state[p.cbotKey])||{},v=tab[c];
  return (v==null||v===''||isNaN(v)||!(Number(v)>0))?null:Number(v);
}
function ppeCbotFonteFOB(comm,c){
  if(!ppeCapturaAtiva(comm)) return null;
  var tab=((ppeData().meta||{}).cbotFonteFOB||{})[comm]||{};
  var v=tab[c]; return (v==null||isNaN(v))?null:Number(v);
}
/* CBOT na data (Base de Preços guarda a curva travada por dia) */
function ppeCbotAt(comm, c, iso){
  if(!iso) return null;
  var hoje=(state.timestamps&&state.timestamps.cbot)||''; if(iso>=hoje) return ppeCbot(comm,c);
  if(comm!=='Soybean'&&comm!=='Corn') return null; /* farelo e óleo: sem histórico de CBOT no arquivo, flat DoD/WoW fica em traço */
  try{ var pr=(typeof getPrecosBase==='function')?getPrecosBase():[]; var prod=(comm==='Corn')?'Milho':'Soja';
    for(var i=pr.length-1;i>=0;i--){ var r=pr[i]; if(r.data===iso&&r.produto===prod&&r.vencCBOT===c&&r.cbot>0) return Number(r.cbot); }
  }catch(e){}
  return null;
}
function ppeDolar(j){ var k=PPE_MESES_DOL[j.mes-1]+String(j.ano%100); var v=(state.dolar||{})[k]; return (v==null||isNaN(v)||!(v>0))?null:{v:Number(v),k:k}; }

/* Basis from the last ACTUAL observation for this port/shipment/side.
   Carry-forward is a dated reference, never represented as today's quote. */
function ppeBasis(comm,porto,j,player,iso){
  var snap=ppeCapturaLinha(comm,porto,j);
  if(snap&&iso&&ppeYmd(iso)>=ppeYmd(snap.asof.slice(0,10))){
    var value=snap.linha[player];
    /* Null no print = sem cotacao atual. Proibido ressuscitar cotacao historica. */
    return (value==null)?null:{v:Number(value),ymd:ppeYmd(snap.asof.slice(0,10)),
      fonte:'captura FOB',carry:false,spread:0,porto:porto,capturaFOB:true};
  }
  var p=PPE_PRODUTOS.filter(function(x){return x.k===comm;})[0],hub=p.hub,ymd=ppeYmd(iso);
  /* 09/11/2026: leitura com mais de 45 dias não carrega (regra paridade_janelas_carry) */
  var _lim45=ppeYmd(ppeDateMinus(iso,45)), _fresh=function(r){ return (r&&r.ymd>=_lim45)?r:null; };
  var own=_fresh(ppeAt(ppeSerie(comm,porto,j.typ,j.ship,player),ymd,false));
  if(comm==='Soybean'){
    return own?{v:Number(own.v),ymd:own.ymd,fonte:own.ymd===ymd?'cotação':'carry',
      carry:own.ymd!==ymd,spread:0,porto:porto}:null;
  }
  if(comm==='Corn'){
    /* V4DW: na captura de fechamento 10/11, ausência no paper fica N/D; sem carry de bid antigo. */     if(iso==='2026-11-10' && state.premiosMilho && state.premiosMilho[state.premiosMilho.length-1].tipoCaptura==='FECHAMENTO'){ return ppeCornQuote(porto,j,player,iso); }     var cargo=ppeCornQuote(porto,j,player,iso);
    if(cargo)return cargo;
    // Missing side on the latest Cargo does NOT erase the previous registered basis.
    if(own)return {v:Number(own.v),ymd:own.ymd,fonte:own.ymd===ymd?'cotação':'carry',
      carry:own.ymd!==ymd,spread:0,porto:porto};
    if(ppeCornHasWindow(porto,j,iso))return null;
  }else if(own){
    return {v:Number(own.v),ymd:own.ymd,fonte:own.ymd===ymd?'cotação':'carry',
      carry:own.ymd!==ymd,spread:0,porto:porto};
  }
  var h=_fresh(ppeAt(ppeSerie(comm,hub,j.typ,j.ship,player),ymd,false));
  if(!h)return null;
  var spread=(PPE_SPREADS[comm]||{})[porto];if(spread==null)spread=0;
  return {v:Number(h.v)+spread,ymd:h.ymd,fonte:porto===hub?(h.ymd===ymd?'cotação':'carry'):'spread',
    spread:spread,carry:h.ymd!==ymd,porto:porto};
}
function ppeCornHasWindow(porto,j,iso){
  try{
    var grupo=PPE_CORN_GRUPO[porto]; if(!grupo||!state.premiosMilho) return false;
    var rec=null; for(var i=state.premiosMilho.length-1;i>=0;i--){if(state.premiosMilho[i].data<=iso){rec=state.premiosMilho[i];break;}}
    if(!rec||!Array.isArray(rec.cargoDetails)) return false;
    var emb=PPE_MESES_EN[j.mes-1]+'-'+String(j.ano%100),jan={'F':'Mês','FH':'FH','LH':'LH'}[j.typ]||'Mês';
    return rec.cargoDetails.some(function(c){return c.grupo===grupo&&c.embarque===emb&&c.janela===jan;});
  }catch(e){return false;}
}
function ppeCornQuote(porto, j, player, iso){
  try{
    var grupo=PPE_CORN_GRUPO[porto]; if(!grupo||!state.premiosMilho) return null;
    var rec=null; for(var i=state.premiosMilho.length-1;i>=0;i--){ if(state.premiosMilho[i].data<=iso){ rec=state.premiosMilho[i]; break; } }
    if(!rec||!rec.cargoDetails) return null;
    var emb=PPE_MESES_EN[j.mes-1]+'-'+String(j.ano%100); var jan={'F':'Mês','FH':'FH','LH':'LH'}[j.typ]||'Mês';
    var best=null;
    rec.cargoDetails.forEach(function(c){ if(c.grupo!==grupo||c.embarque!==emb||c.janela!==jan||(player==='bid'&&c.bidPorto&&c.bidPorto!==porto)) return; var v=c[player]; if(v==null) return; if(best==null||(player==='offer'?v<best:v>best)) best=v; });
    if(best==null) return null;
    return {v:best, ymd:ppeYmd(rec.data), fonte:'cotação', carry:rec.data!==iso};
  }catch(e){ return null; }
}
/* DoD / WoW: diferença contra a leitura anterior disponível e contra a última ≤ 7 dias atrás */
function ppeTrend(comm, porto, j, player, iso){
  var now=ppeBasis(comm,porto,j,player,iso); if(!now) return {now:null};
  var hub=ppeProd().hub, s=ppeSerie(comm, (comm==='Soybean'?porto:hub), j.typ, j.ship, player);
  var prev=ppeBefore(s, now.ymd), wk=ppeAt(s, ppeYmd(ppeDateMinus(ppeIso(now.ymd),7)), false), mo=ppeAt(s, ppeYmd(ppeFimMesAnterior(iso)), false);
  var sp=(porto===hub||comm==='Soybean')?0:((PPE_SPREADS[comm]||{})[porto]||0);
  var adj=function(x){ return x?{v:x.v+sp, ymd:x.ymd}:null; };
  if(now.fonte==='cotação'&&porto!==hub&&comm==='Corn'){ /* cotação real: tendência pela própria cotação quando houver, senão pelo hub */
    var pv=ppeCornQuote(porto,j,player,ppeDateMinus(ppeIso(now.ymd),1)); var wv=ppeCornQuote(porto,j,player,ppeDateMinus(ppeIso(now.ymd),7));
    return {now:now, dod:(pv&&pv.ymd<now.ymd)?now.v-pv.v:null, wow:(wv&&wv.ymd<now.ymd)?now.v-wv.v:null, mo:adj(mo)};
  }
  return {now:now, dod:prev?now.v-(prev.v+sp):null, wow:(wk&&wk.ymd<now.ymd)?now.v-(wk.v+sp):null, mo:adj(mo), wk:adj(wk)};
}

/* ── UI ─────────────────────────────────────────────────────────────────────── */
function repSetTab(t){ _repTab=t; try{ localStorage.setItem('brz_rep_tab',t); }catch(e){} if(typeof renderReport==='function') renderReport(); }
function ppeSetProd(k){ PPE_PROD=k; try{ localStorage.setItem('brz_ppe_prod',k); }catch(e){} renderReportParidade(); }
function ppeSetPort(p){ PPE_PORT[PPE_PROD]=p; try{ localStorage.setItem('brz_ppe_port',JSON.stringify(PPE_PORT)); }catch(e){} renderReportParidade(); }
function ppeSetPlayer(p){ PPE_PLAYER=p; renderReportParidade(); }
function ppeCfgKey(){ return PPE_PROD+'|'+ppePort(); }
function ppeCfg(){ return PPE_CFG[ppeCfgKey()]||{}; }
function ppeSetCfg(field, val){
  var c=PPE_CFG[ppeCfgKey()]||{};
  if(field==='origem' && c.origem!==val){ delete c.frete; /* frete manual nunca acompanha mudança de rota */ }
  if(val===''||val==null) delete c[field]; else c[field]=val;
  PPE_CFG[ppeCfgKey()]=c;
  try{ localStorage.setItem('brz_ppe_cfg',JSON.stringify(PPE_CFG)); }catch(e){}
  renderReportParidade();
}
/* Rotas observadas da ÚLTIMA semana rodoviária do arquivo. Nada de todas as praças geográficas.
   Frete direto conhecido é condição para o seletor; corredor intermodal exige conta e fonte próprias. */
var _ppeRodoCache=null;
function ppeRotasPorPorto(){
  var rows=(typeof state!=='undefined'&&Array.isArray(state.fretesRodo))?state.fretesRodo:[];
  if(_ppeRodoCache&&_ppeRodoCache.base===rows) return _ppeRodoCache;
  var semana='';
  rows.forEach(function(x){if(x.semana && /^\d{4}-S\d{2}$/.test(x.semana) && x.semana>semana) semana=x.semana;});
  var portos={};
  rows.forEach(function(x){
    if(x.semana!==semana||x.tipo!=='Rodoviário'||!(Number(x.valor)>0)) return;
    var m=/^(.+)\/([A-Z]{2})$/.exec(String(x.origem||'').trim()); if(!m) return;
    var destino=String(x.destino||'').trim(), nome=m[1].trim()+' - '+m[2];
    var byPort=portos[destino]||(portos[destino]={});
    byPort[nome]={nome:nome, uf:m[2], cidade:m[1].trim(), valor:Number(x.valor), semana:x.semana};
  });
  var out={base:rows,semana:semana,portos:{}};
  Object.keys(portos).forEach(function(k){
    out.portos[k]=Object.keys(portos[k]).map(function(o){return portos[k][o];}).sort(function(a,b){
      return a.uf.localeCompare(b.uf,'pt-BR')||a.cidade.localeCompare(b.cidade,'pt-BR');
    });
  });
  _ppeRodoCache=out;return out;
}
function ppeOrigens(porto){ return ppeRotasPorPorto().portos[porto]||[]; }
var PPE_ORIGENS_PREFERIDAS={
  'Paranaguá':'Campo Mourão - PR','Santos':'Rio Verde - GO','Rio Grande':'Cruz Alta - RS',
  'Aratu':'Luís Eduardo Magalhães - BA','Itaqui':'Balsas - MA','Barcarena':'Paragominas - PA',
  'São Francisco do Sul':'Cascavel - PR'
};
function ppeOrigemDefault(){
  var rotas=ppeOrigens(ppePort()), saved=ppeCfg().origem;
  if(saved&&rotas.some(function(r){return r.nome===saved;})) return saved;
  var pref=PPE_ORIGENS_PREFERIDAS[ppePort()];
  if(pref&&rotas.some(function(r){return r.nome===pref;})) return pref;
  return rotas.length?rotas[0].nome:null;
}
function ppeOrigensSelect(porto, origem){
  var rotas=ppeOrigens(porto);
  if(!rotas.length) return '<select id="ppe-origem-select" class="ppe-in ppe-orig" disabled><option>'+ppeL('Sem rota direta cotada','No quoted direct route')+'</option></select>';
  var groups={},ord=[];
  rotas.forEach(function(r){if(!groups[r.uf]){groups[r.uf]=[];ord.push(r.uf);}groups[r.uf].push(r);});
  var html=ord.map(function(uf){return '<optgroup label="'+ppeEsc(uf)+'">'+groups[uf].map(function(r){
    return '<option value="'+ppeEsc(r.nome)+'"'+(r.nome===origem?' selected':'')+'>'+ppeEsc(r.nome)+' · '+ppeNum(r.valor,0)+' R$/t</option>';
  }).join('')+'</optgroup>';}).join('');
  return '<select id="ppe-origem-select" class="ppe-in ppe-orig" onchange="ppeSetCfg(\'origem\',this.value)">'+html+'</select>';
}
function ppeFobbinsDefault(porto){ var c=ppeCfg(); if(c.fobbins!=null) return Number(c.fobbins); var v=(typeof FOBBINS_POR_PORTO!=='undefined')?FOBBINS_POR_PORTO[porto]:null; if(v==null) v=(typeof FOBBINS_DEFAULT!=='undefined')?FOBBINS_DEFAULT:11; return Number(v); }
function ppeFreteDefault(origem, porto){
  var rotas=ppeOrigens(porto), r=rotas.filter(function(x){return x.nome===origem;})[0];
  if(!r) return {v:null,fonte:ppeL('sem frete direto na base','no direct freight in data'),semana:ppeRotasPorPorto().semana};
  var c=ppeCfg();
  /* Um frete manual salvo para origem já inválida não contamina a nova rota. */
  if(c.frete!=null && (c.origem===origem || !c.origem)){
    var manual=Number(c.frete); if(Number.isFinite(manual)&&manual>=0) return {v:manual, fonte:ppeL('manual','manual'),semana:r.semana};
  }
  return {v:r.valor,fonte:r.semana,semana:r.semana};
}
function ppeParityValues(p,flat,fobbins,frete,fx){
  if(flat==null || !Number.isFinite(Number(flat))) return {flatUsdT:null,fcaT:null,fca:null,exw:null,fcaR:null,exwR:null};
  var flatUsdT=Number(flat)*p.fator, fcaT=flatUsdT-Number(fobbins);
  var div=p.saca?1000/60:1; /* 60 kg/sc; em farelo e óleo, preço em t */
  var fca=fcaT/div, exw=(frete!=null&&fx!=null&&Number(fx)>0)?(fcaT-Number(frete)/Number(fx))/div:null;
  return {flatUsdT:flatUsdT,fcaT:fcaT,fca:fca,exw:exw,
    fcaR:(fx!=null&&Number(fx)>0)?fca*Number(fx):null,
    exwR:(exw!=null&&fx!=null)?exw*Number(fx):null};
}

function renderReportParidadeHook(){
  var main=['rep-toolbar','rep-lotes','rep-physical','rep-analise','rep-estados'].map(function(id){ return document.getElementById(id); });
  var par=document.getElementById('rep-paridade'); var third=document.getElementById('rep-derivados'); var tabs=document.getElementById('rep-subtabs');
  if(tabs){ tabs.innerHTML='<button type="button" class="rep-gbtn'+(_repTab==='report'?' on':'')+'" onclick="repSetTab(\'report\')">Report</button><button type="button" class="rep-gbtn'+(_repTab==='paridade'?' on':'')+'" onclick="repSetTab(\'paridade\')">'+ppeL('Paridade','Parity')+'</button><button type="button" class="rep-gbtn'+(_repTab==='derivados'?' on':'')+'" onclick="repSetTab(\'derivados\')">'+ppeL('Óleo & Farelo','Oil & Meal')+'</button>'; }
  var showPar=(_repTab==='paridade'),showThird=(_repTab==='derivados');
  main.forEach(function(el){ if(el) el.style.display=(showPar||showThird)?'none':''; });
  if(par){ par.style.display=showPar?'':'none'; if(showPar) renderReportParidade(); }
  if(third){third.style.display=showThird?'':'none';if(showThird)renderReportDerivados();}
  var sub=document.getElementById('rep-sub');if(showThird&&sub)sub.textContent=ppeL('Farelo e óleo: replacement FOB a partir do físico · soja: PPE por embarque','Meal and oil: cash-to-FOB replacement · soybeans: parity by shipment')+' · '+r3RefDate(); if(showPar&&sub){ var m=ppeData().meta||{}; sub.textContent=ppeL('Paridade de exportação · basis FOB por porto e janela, CBOT e dólar da curva vigente · ','Export parity · FOB basis by port and window, current CBOT and FX curve · ')+ppeL('data de referência ','valuation date ')+ppeFmtBR(ppeUltimaData(PPE_PROD)||'')+(state._marketSnapshotId?' · '+state._marketSnapshotId:''); }
}

function renderReportParidade(){
  var host=document.getElementById('rep-paridade'); if(!host) return;
  try{ host.setAttribute('data-no-i18n','1'); }catch(e){}
  var p=ppeProd(), comm=p.k, porto=ppePort(), ult=ppeValuationDate(comm);
  var tabs='<div class="rep-granbar" style="flex-wrap:wrap;row-gap:6px"><span class="rep-glabel">'+ppeL('Produto','Product')+'</span>'+PPE_PRODUTOS.map(function(x){ return '<button type="button" class="rep-gbtn'+(x.k===comm?' on':'')+'" onclick="ppeSetProd(\''+x.k+'\')">'+ppeL(x.pt,x.en)+'</button>'; }).join('')
    +'<span class="rep-glabel" style="margin-left:14px">'+ppeL('Porto de referência','Reference port')+'</span>'+PPE_PORTOS[comm].map(function(pt){ return '<button type="button" class="rep-gbtn'+(pt===porto?' on':'')+'" onclick="ppeSetPort(\''+pt.replace(/'/g,"\\'")+'\')">'+pt+'</button>'; }).join('')+'</div>';
  if(!ult){ host.innerHTML='<div class="rep-sec">'+ppeL('Paridade de exportação','Export parity')+'</div>'+tabs+'<div class="a-empty">'+ppeL('Sem histórico de basis FOB para este produto.','No FOB basis history for this product.')+'</div>'; return; }
  var jan=ppeJanelas(comm);
  host.innerHTML='<div class="rep-sec">'+ppeL('Paridade de exportação','Export parity')+'</div>'+tabs+ppeCardBasis(p,comm,porto,ult,jan)+'<div style="height:14px"></div>'+ppeCardPPE(p,comm,porto,ult,jan)
    +'<div class="rep-note">'+ppeL('Paranaguá (soja, farelo e óleo): apenas janelas e bids/offers dos prints recebidos, sem carry em campos vazios e sem meses históricos extras. A tabela superior fixa o CBOT da fonte; a paridade inferior usa CBOT e dólar editáveis da curva de Mercado (26/10 C6). Demais portos continuam com a última leitura histórica identificada. Basis FOB: última leitura efetiva de cada porto, janela e lado (bid/offer), com data original visível. A referência persiste até o início do mês de embarque; janelas compostas até o início do último mês. Sem basis novo, mantém-se o último registrado, nunca uma cotação artificial do dia. Soja: cotação direta prevalece; sem ela, benchmark FOB Paranaguá claramente identificado e sem spread artificial de porto. Trade Level com dias distintos = média histórica indicativa; com apenas um lado, PPE unilateral indicativa (Ind.O/Ind.B), nunca trade executável. Milho: Cargo quando disponível; na ausência, última leitura histórica, com spread contra Santos somente quando identificado. CBOT, dólar e fretes da curva vigente do arquivo; despesas FOB e fretes editáveis; sem frete direto, não inventar rota.',
      'Paranaguá (soybeans, meal and oil): source-exact rows and sides only, without legacy months or carry for blank fields. Top table retains CBOT as quoted; lower parity reads the editable current Market CBOT and FX curve (27 Oct C3). Other ports retain labeled historical quotes. FOB basis: latest recorded observation per port, shipment and bid/offer side, with original observation date displayed. Retain until shipment month begins; combined months expire as the last month begins. No new FOB upload does not erase the last quote. Soybeans: direct port quotation first; otherwise a labeled Paranaguá FOB benchmark without a fabricated port spread. Mixed-date midpoint or one-sided quote is indicative PPE only, never executable Trade Level. Corn: Cargo first when available, then historical FOB quote; hub spreads only where identified. CBOT, FX and freight follow the file\'s current market snapshot; freight and fobbings editable; no unquoted direct freight is fabricated.')+'</div>';
  try{ if(typeof brzAddCamButtons==='function') brzAddCamButtons(host); }catch(e){}
}

function ppeCardBasis(p,comm,porto,ult,jan){
  var hub=p.hub, spread=(PPE_SPREADS[comm]||{})[porto]||0;
  var title=ppeL(p.pt+' · Basis FOB em '+porto, p.en+' · Basis FOB in port '+porto)+(comm==='Soybean'?' <span class="ppe-sub">('+ppeL('última cotação própria · data original preservada','last own-port quote · original date retained')+')</span>':(porto!==hub?' <span class="ppe-sub">('+ppeL('spread de ','spread of ')+ppeSign(spread,0)+' '+ppeL('sobre','vs')+' '+hub+')</span>':''));
  var rows=jan.map(function(j){
    var c=ppeContrato(comm,j), cb=ppeCbot(comm,c);
    var stamp=ppeCapturaLinha(comm,porto,j);
    if(stamp){var quoteCbot=ppeCbotFonteFOB(comm,c); if(quoteCbot!=null)cb=quoteCbot;}
    var to=ppeTrend(comm,porto,j,'offer',ult), tb=ppeTrend(comm,porto,j,'bid',ult);
    var metaPrint=ppeData().meta||{}, fobCapture=ppeCapturaAtiva(comm)?((metaPrint.capturasFOB||{})[comm]||null):null;
    var isPrintPort=(porto==='Paranaguá'&&j.typ==='F'&&fobCapture);
    var recPrint=isPrintPort?((metaPrint.tabelaFonteFOB||{})[comm]||{})[j.ship]:null;
    /* Flat do print: normalmente offer. Se o print so mostra bid (oleo Jan/27), usar bid,
       nao uma offer historica de data anterior que ainda existe como carry na tabela. */
    var flatTrend=recPrint&&recPrint.flatSide==='bid'?tb:to;
    var flatPlayer=recPrint&&recPrint.flatSide==='bid'?'bid':'offer';
    var flat=recPrint?recPrint.flat:((cb!=null&&flatTrend.now)?cb+flatTrend.now.v:null);
    var prevBase=(flatTrend.now&&flatTrend.dod!=null)?ppeBefore(ppeSerie(comm,comm==='Soybean'?porto:hub,j.typ,j.ship,flatPlayer),flatTrend.now.ymd):null;
    var cbPrev=prevBase?ppeCbotAt(comm,c,ppeIso(prevBase.ymd)):null;
    var flatDod=(flat!=null&&flatTrend.dod!=null&&cbPrev!=null)?(flat-(cbPrev+(flatTrend.now.v-flatTrend.dod))):null;
    var cbWk=(flatTrend.now&&flatTrend.wk)?ppeCbotAt(comm,c,ppeIso(flatTrend.wk.ymd)):null;
    var flatWow=(flat!=null&&flatTrend.wow!=null&&cbWk!=null)?(flat-(cbWk+flatTrend.wk.v)):null;
    /* DoD/WoW oficiais do PRINT prevalecem no recorte. Nao extrapolar para outros portos. */
    var showOD=to.dod,showOW=to.wow,showBD=tb.dod,showBW=tb.wow;
    if(recPrint&&recPrint.variation){
      flatDod=recPrint.variation.flat[0]; flatWow=recPrint.variation.flat[1];
      showOD=recPrint.variation.offer[0];showOW=recPrint.variation.offer[1];
      showBD=recPrint.variation.bid[0];showBW=recPrint.variation.bid[1];
    }
    var mark=function(t){ if(!t||!t.now) return ''; var tag=(t.now.fonte==='spread')?' <span class="ppe-tag" title="'+ppeL('hub + spread','hub + spread')+'">S</span>':''; if(t.now.carry) tag+=' <span class="ppe-tag ppe-carry" title="'+ppeL('última leitura em ','last reading on ')+ppeFmtBR(ppeIso(t.now.ymd))+'">'+ppeFmtBR(ppeIso(t.now.ymd)).slice(0,5)+'</span>'; return tag; };
    var decBasis=recPrint?(comm==='Soyoil'?1:0):p.dec;
    var basisOff=recPrint?recPrint.offer:(to.now?to.now.v:null),basisBid=recPrint?recPrint.bid:(tb.now?tb.now.v:null);
    var term=recPrint?((comm==='Soybean'?'S':comm==='Soymeal'?'SM':'BO')+c):ppeContratoLabel(comm,c);
    return '<tr><td class="ppe-win">'+ppeEsc(j.label)+'</td><td class="ppe-cb">'+term+(cb!=null?' · '+ppeNum(cb,2):' · —')+'</td>'
      +'<td class="ppe-b">'+ppeNum(flat,2)+'</td><td class="'+ppeVarCls(flatDod)+'">'+ppeSign(flatDod,2)+'</td><td class="'+ppeVarCls(flatWow)+'">'+ppeSign(flatWow,2)+'</td>'
      +'<td class="ppe-b">'+ppeSign(basisOff,decBasis)+(recPrint?'':mark(to))+'</td><td class="'+ppeVarCls(showOD)+'">'+ppeSign(showOD,decBasis)+'</td><td class="'+ppeVarCls(showOW)+'">'+ppeSign(showOW,decBasis)+'</td>'
      +'<td class="ppe-b">'+ppeSign(basisBid,decBasis)+(recPrint?'':mark(tb))+'</td><td class="'+ppeVarCls(showBD)+'">'+ppeSign(showBD,decBasis)+'</td><td class="'+ppeVarCls(showBW)+'">'+ppeSign(showBW,decBasis)+'</td></tr>';
  }).join('');
  var u=p.unit;
  var tbl='<table class="a-table ppe-table ppe-table-basis"><thead><tr><th rowspan="2">Shipment</th><th rowspan="2">CBOT</th><th colspan="3">Flat Price</th><th colspan="3">Offer</th><th colspan="3">Bid</th></tr>'
    +'<tr><th>Flat ('+u+')</th><th>DoD</th><th>WoW</th><th>Basis ('+u+')</th><th>DoD</th><th>WoW</th><th>Basis ('+u+')</th><th>DoD</th><th>WoW</th></tr></thead><tbody>'+(rows||'<tr><td colspan="11" class="a-empty">'+ppeL('Sem janelas vigentes.','No active windows.')+'</td></tr>')+'</tbody></table>';
  tbl='<div class="ppe-scroll" role="region" tabindex="0" aria-label="'+ppeL('Tabela de basis FOB','FOB basis table')+' · '+ppeEsc(porto)+'">'+tbl+'</div>';
  var chart=ppeChart(p,comm,porto,ult,jan);
  return '<div class="a-card ppe-card"><div class="a-card-t">'+title+'</div>'+tbl+'<div class="ppe-upd">'+ppeL('Data da fonte FOB: ','FOB source date: ')+ppeFmtBR((porto==='Paranaguá'&&ppeCapturaAtiva(comm)&&((ppeData().meta||{}).capturasFOB||{})[comm])?((ppeData().meta||{}).capturasFOB[comm].asof.slice(0,10)):ult)+' · '+(porto==='Paranaguá'&&ppeCapturaAtiva(comm)&&((ppeData().meta||{}).capturasFOB||{})[comm] ? (ppeL('CBOT da captura FOB: ','CBOT from FOB quote: ')+ppeEsc(((ppeData().meta||{}).capturasFOB||{})[comm].asof.replace('T',' '))+' · '+ppeL('CBOT exibida acima: preço do print; paridade abaixo: curva vigente editável. Dólar: curva C3 de 27/10 (horários distintos).','CBOT above: original quote; parity below: editable live curve. FX: 27 Oct C3 curve (different timestamps).')) : (ppeL('CBOT e dólar: ','CBOT and FX: ')+(state._marketSnapshotId||'—')))+'</div>'+chart+'</div>';
}

function ppeChart(p,comm,porto,ult,jan){
  if(!jan.length) return '';
  var wkIso=ppeDateMinus(ult,7), moIso=ppeFimMesAnterior(ult);
  var series=[{k:'last',name:ppeL('Referência','As of')+' ('+ppeFmtBR(ult)+')',color:'#0B1F3A'},{k:'mo',name:ppeL('Mês','Month')+' ('+ppeFmtBR(moIso)+')',color:'#E3B12B'},{k:'wk',name:ppeL('Semana','Week')+' ('+ppeFmtBR(wkIso)+')',color:'#64748B'}];
  var hub=p.hub, sp=(porto===hub||comm==='Soybean')?0:((PPE_SPREADS[comm]||{})[porto]||0);
  var vals=jan.map(function(j){ var s=ppeSerie(comm,comm==='Soybean'?porto:hub,j.typ,j.ship,'offer'); var now=ppeBasis(comm,porto,j,'offer',ult); var wk=ppeAt(s,ppeYmd(wkIso),false), mo=ppeAt(s,ppeYmd(moIso),false);
    return {label:j.label, last:now?now.v:null, wk:(wk&&wk.ymd<=ppeYmd(wkIso))?wk.v+sp:null, mo:(mo&&mo.ymd<=ppeYmd(moIso))?mo.v+sp:null}; });
  var all=[]; vals.forEach(function(v){ ['last','mo','wk'].forEach(function(k){ if(v[k]!=null) all.push(v[k]); }); });
  if(!all.length) return '';
  var mx=Math.max.apply(null,all.concat([0])), mn=Math.min.apply(null,all.concat([0])); var span=(mx-mn)||1;
  var step=Math.pow(10,Math.floor(Math.log(span/5)/Math.LN10)); var f=(span/5)/step; step*=(f<=1?1:(f<=2?2:(f<=5?5:10)));
  mx=Math.ceil((mx+span*0.05)/step)*step; mn=Math.floor((mn-span*0.05)/step)*step; if(mn>0) mn=0; if(mx<0) mx=0;
  var W=980,H=320,pL=48,pR=16,pT=28,pB=78; var n=vals.length, gw=(W-pL-pR)/n, bw=Math.min(22,gw/4);
  var Y=function(v){ return pT+(H-pT-pB)*(1-(v-mn)/(mx-mn)); };
  var g='';
  for(var v=mn;v<=mx+1e-9;v+=step){ var y=Y(v); g+='<line x1="'+pL+'" y1="'+y.toFixed(1)+'" x2="'+(W-pR)+'" y2="'+y.toFixed(1)+'" stroke="#E2E8F0"/><text x="'+(pL-6)+'" y="'+(y+3.5).toFixed(1)+'" text-anchor="end" class="pm2-ax">'+ppeNum(v,0)+'</text>'; }
  g+='<line x1="'+pL+'" y1="'+Y(0).toFixed(1)+'" x2="'+(W-pR)+'" y2="'+Y(0).toFixed(1)+'" stroke="#94A3B8"/>';
  vals.forEach(function(v,i){ var cx=pL+gw*i+gw/2; var ks=['last','mo','wk'];
    ks.forEach(function(k,si){ var val=v[k]; if(val==null) return; var x=cx+(si-1)*(bw+3)-bw/2; var y0=Y(0), y1=Y(val); g+='<rect x="'+x.toFixed(1)+'" y="'+Math.min(y0,y1).toFixed(1)+'" width="'+bw+'" height="'+Math.max(1,Math.abs(y0-y1)).toFixed(1)+'" fill="'+series[si].color+'" rx="2"><title>'+ppeEsc(v.label)+' · '+ppeEsc(series[si].name)+': '+ppeSign(val,p.dec)+'</title></rect>'; });
    var ty=H-pB+12;g+='<text transform="translate('+cx.toFixed(1)+','+ty+') rotate(-38)" text-anchor="end" class="pm2-ax">'+ppeEsc(v.label)+'</text>'; });
  g+='<text x="'+pL+'" y="16" class="pm2-ax" text-anchor="start">Basis ('+p.unit+')</text>';
  var leg='<div class="pm2-leg">'+series.map(function(s){ return '<span class="pm2-chip" style="--c:'+s.color+';cursor:default"><i></i>'+ppeEsc(s.name)+'</span>'; }).join('')+'</div>';
  return '<div class="ppe-chart"><div class="ppe-chart-t">'+ppeEsc(ppeL(p.pt+' · Basis FOB em '+porto,p.en+' · Basis FOB in port '+porto))+'</div><svg viewBox="0 0 '+W+' '+H+'" class="pm2-svg" preserveAspectRatio="xMidYMid meet">'+g+'</svg>'+leg+'</div>';
}

function ppeCardPPE(p,comm,porto,ult,jan){
  var origem=ppeOrigemDefault(), fob=ppeFobbinsDefault(porto), fr=ppeFreteDefault(origem,porto);
  var player=PPE_PLAYER; var pl=function(k,l){ return '<button type="button" class="rep-gbtn'+(player===k?' on':'')+'" onclick="ppeSetPlayer(\''+k+'\')">'+l+'</button>'; };
  var ctr='<div class="ppe-ctrls">'
    +'<div class="ppe-ctl"><div class="ppe-cl">Player</div><div class="rep-granbar" style="border:0;padding:0">'+pl('offer','Offer')+pl('bid','Bid')+pl('trade','Trade Level')+'</div></div>'
    +'<div class="ppe-ctl"><div class="ppe-cl">Fobbings</div><input class="ppe-in" type="number" step="0.5" value="'+fob+'" onchange="ppeSetCfg(\'fobbins\',this.value)"> <span class="ppe-un">USD/t</span></div>'
    +'<div class="ppe-ctl"><div class="ppe-cl">'+ppeL('Frete até o porto','Freight to port')+'</div><input class="ppe-in" type="number" step="1" value="'+(fr.v!=null?Math.round(fr.v):'')+'" placeholder="—" onchange="ppeSetCfg(\'frete\',this.value)"> <span class="ppe-un">R$/t · '+ppeEsc(fr.fonte)+'</span></div>'
    +'<div class="ppe-ctl"><div class="ppe-cl">'+ppeL('Origem · ','Origin · ')+ppeEsc(ppeRotasPorPorto().semana)+'</div>'+ppeOrigensSelect(porto,origem)+'</div>'
    +'<div class="ppe-ctl"><div class="ppe-cl">'+ppeL('Destino','Destination')+'</div><div class="ppe-dest">'+porto+'</div></div>'
    +'<div class="ppe-ctl"><button type="button" class="rep-gbtn" onclick="ppeSetCfg(\'fobbins\',\'\');ppeSetCfg(\'frete\',\'\')">'+ppeL('Padrão','Reset')+'</button></div></div>';
  var uSc=p.saca?'/sc':'/t';
  var plLabel={offer:'Offer',bid:'Bid',trade:'Trade Level'}[player]||player;
  var params='<div class="ppe-params">'+plLabel+' · Fobbings '+ppeNum(fob,0)+' USD/t · '+ppeL('Frete','Freight')+' '+(fr.v!=null?ppeNum(fr.v,0)+' R$/t ('+ppeEsc(fr.fonte)+')':'—')+' · '+ppeEsc(origem||'—')+' → '+porto+'</div>';
  var head='<table class="a-table ppe-table ppe-table-ppe"><thead><tr><th rowspan="2">Shipment</th><th colspan="5">'+ppeL('Parâmetros','Parameters')+'</th><th colspan="2">'+ppeL('Preço em USD','Price in USD')+'</th><th colspan="2">'+ppeL('Preço em BRL','Price in BRL')+'</th></tr>'
    +'<tr><th>Basis ('+p.unit+')</th><th>CBOT ('+p.unit+')</th><th>Flat Price ('+p.unit+')</th><th>FOB (US$/t)</th><th>'+ppeL('Dólar (R$)','Dollar (R$)')+'</th><th>FCA (USD'+uSc+')</th><th>EXW (USD'+uSc+')</th><th>FCA (R$'+uSc+')</th><th>EXW (R$'+uSc+')</th></tr></thead><tbody>';
  var rows=jan.map(function(j){
    var c=ppeContrato(comm,j), cb=ppeCbot(comm,c);
    var bo=ppeBasis(comm,porto,j,'offer',ult), bb=ppeBasis(comm,porto,j,'bid',ult),portBenchmark=null;
    /* Price model (not quotation table): when own-port side is unavailable,
       Paraná FOB is a labeled indicative benchmark, without invented port spread. */
    if(comm==='Soybean'&&porto!=='Paranaguá'){
      var useRef=(player==='offer'&&!bo)||(player==='bid'&&!bb)||(player==='trade'&&!bo&&!bb);
      if(useRef){
        var ro=ppeBasis(comm,'Paranaguá',j,'offer',ult),rb=ppeBasis(comm,'Paranaguá',j,'bid',ult);
        if((player==='offer'&&ro)||(player==='bid'&&rb)||(player==='trade'&&(ro||rb))){
          bo=ro;bb=rb;portBenchmark='Paranaguá';
        }
      }
    }
    var basis=null,mixed=false,unilateral='';
    if(player==='offer') basis=bo?bo.v:null;
    else if(player==='bid') basis=bb?bb.v:null;
    else if(bo&&bb){basis=(bo.v+bb.v)/2;mixed=bo.ymd!==bb.ymd;}
    else if(bo||bb){unilateral=bo?'offer':'bid';basis=(bo||bb).v;}
    /* A single side is a dated indicative PPE, NEVER an executable Trade Level. */
    var flat=(cb!=null&&basis!=null)?cb+basis:null; var dol=ppeDolar(j);
    var calc=ppeParityValues(p,flat,fob,fr.v,dol?dol.v:null);
    var fca=calc.fca,exw=calc.exw,fcaR=calc.fcaR,exwR=calc.exwR;
    var tip=(bo||bb)?(' title="offer '+(bo?ppeSign(bo.v,p.dec)+' ('+ppeFmtBR(ppeIso(bo.ymd))+')':'—')+' · bid '+(bb?ppeSign(bb.v,p.dec)+' ('+ppeFmtBR(ppeIso(bb.ymd))+')':'—')+(mixed?' · '+ppeL('referência histórica indicativa: datas diferentes','historical indication: different dates'):'')+(portBenchmark?' · '+ppeL('benchmark FOB ','FOB benchmark ')+portBenchmark+'; '+ppeL('não é cotação do porto selecionado','not a quoted price for selected port'):'')+((bo&&bo.fonte==='spread')?' · '+ppeL('por spread','by spread'):'')+'"'):'';
    var provenance=(bo||bb)?(bo&&bb&&bo.ymd===bb.ymd?ppeFmtBR(ppeIso(bo.ymd)).slice(0,5):('O '+(bo?ppeFmtBR(ppeIso(bo.ymd)).slice(0,5):'—')+' · B '+(bb?ppeFmtBR(ppeIso(bb.ymd)).slice(0,5):'—'))):'';
    var flag=(portBenchmark?' <span class="ppe-tag ppe-carry" title="'+ppeL('Benchmark FOB Paranaguá — paridade indicativa, sem spread de porto','Paranaguá FOB benchmark — indicative parity, no port spread')+'">Ref. PGUA</span>':'')+(mixed?' <span class="ppe-tag ppe-carry" title="'+ppeL('Bids e offers em datas diferentes; média indicativa','Bid/offer on different dates, indicative midpoint')+'">Ind.</span>':unilateral?' <span class="ppe-tag ppe-ind" title="'+ppeL('Somente '+unilateral+' disponível; paridade indicativa, não Trade Level','Only '+unilateral+' available; indicative parity, not executable Trade Level')+'">'+(unilateral==='offer'?'Ind.O':'Ind.B')+'</span>':'');
    return '<tr><td class="ppe-win">'+ppeEsc(j.label)+'</td><td class="ppe-basis-cell"'+tip+'><span class="ppe-basis-value">'+ppeSign(basis,(player==='trade'&&p.dec<1)?1:p.dec)+'</span>'+flag+(provenance?'<small class="ppe-quote-date">'+provenance+'</small>':'')+'</td><td>'+ppeContratoLabel(comm,c)+' '+ppeNum(cb,2)+'</td><td class="ppe-b">'+ppeNum(flat,2)+'</td><td>'+ppeNum(calc.flatUsdT,2)+'</td><td>'+(dol?ppeNum(dol.v,4):'—')+'</td>'
      +'<td class="ppe-b">'+ppeNum(fca,2)+'</td><td>'+ppeNum(exw,2)+'</td><td class="ppe-b">'+ppeNum(fcaR,2)+'</td><td>'+ppeNum(exwR,2)+'</td></tr>';
  }).join('');
  var note='<div class="ppe-upd">'+ppeL('CBOT da tabela: curva vigente e editável em Mercado, independente do print FOB acima. Dólar: curva vigente de Mercado. Negócios históricos com snapshots travados. · ', 'CBOT: current editable Market curve, independent of the historic FOB quote above. FX: current Market curve. Historical deals use locked snapshots. · ')+ppeL('Fator exato para '+p.pt+': ','Exact '+p.en+' factor: ')+ppeNum(p.fator,8)+' · '+ppeL('Sem basis próprio na janela, PPE da soja pode usar benchmark FOB Paranaguá com aviso Ref. PGUA; esse valor não é um preço FOB cotado no porto selecionado. ','When own-port basis is unavailable, soybean PPE can use a marked Paranaguá FOB benchmark (Ref. PGUA); this is not a FOB quote for the selected port. ')+ppeL('FCA = flat em US$/t menos fobbings; EXW = FCA menos frete até o porto convertido pelo dólar da janela. Janela sem dólar (2028) para no FCA em dólar.','FCA = flat in US$/t minus fobbings; EXW = FCA minus freight to port converted at the window FX. Window without FX (2028) stops at FCA in USD.')+(p.cbotKey==='cbotFarelo'||p.cbotKey==='cbotOleo'?' · '+ppeL('CBOT de farelo e óleo: vencimentos ainda não informados ficam em traço.','Meal and oil CBOT: contracts not yet supplied show a dash.'):'')+'</div>';
  return '<div class="a-card ppe-card"><div class="a-card-t">'+ppeL('Preço de paridade de exportação · '+p.pt, 'Export parity price · '+p.en)+' · '+ppeEsc(origem||'—')+' → '+porto+'</div>'+ctr+params+'<div class="ppe-scroll" role="region" tabindex="0" aria-label="'+ppeL('Tabela de paridade PPE','Export parity PPE table')+' · '+ppeEsc(porto)+'">'+head+(rows||'<tr><td colspan="10" class="a-empty">—</td></tr>')+'</tbody></table></div>'+note+'</div>';
}

