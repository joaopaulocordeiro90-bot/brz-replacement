
/* REPORT · OIL & MEAL V2 · replacement físico → FOB e curva regional da soja.
   Regra canônica: preço de derivados do Excel sempre SPOT; mínimo/data/praça/produto = DIFERIDO.
   Sem basis FOB para derivados: (físico+frete)/DOL + fobbings, US$/t.
   Frete S42 herda rotas de grãos da soja; proxy Cambé→Londrina identificada.
   A curva da soja é PPE, não uma cotação física futura fabricada.
*/
var R3_CITY=[
 {city:'Rondonópolis - MT',region:'Mato Grosso',port:'Santos'},
 {city:'Rio Verde - GO',region:'Goiás',port:'Santos'},
 {city:'Cambé - PR',region:'Norte do Paraná',port:'Paranaguá'},
 {city:'Londrina - PR',region:'Norte do Paraná',port:'Paranaguá'},
 {city:'Passo Fundo - RS',region:'Norte/Noroeste RS',port:'Rio Grande'},
 {city:'Ijuí - RS',region:'Norte/Noroeste RS',port:'Rio Grande'},
 {city:'Santa Rosa - RS',region:'Norte/Noroeste RS',port:'Rio Grande'},
 {city:'Erechim - RS',region:'Norte/Noroeste RS',port:'Rio Grande'}
];
var R3_CFG=(function(){try{return JSON.parse(localStorage.getItem('brz_r3_cfg')||'{}')||{};}catch(e){return {};}})();
/* 06/11/2026 V4CJ: origens ocultas de forma permanente vivem no ARQUIVO (state.r3Hidden, lista 'prod|cidade');
   o × da tela grava no navegador (brz_r3_cfg) e vale até o João pedir para gravar no arquivo. Restaurar na tela
   grava hidden:false, que prevalece sobre o padrão do arquivo neste navegador. */
function r3ApplyFileHidden(){ try{ var lst=(typeof state!=='undefined'&&state&&Array.isArray(state.r3Hidden))?state.r3Hidden:[]; lst.forEach(function(k){ var c=R3_CFG[k]||{}; if(c.hidden===false) return; c.hidden=true; R3_CFG[k]=c; }); }catch(e){} }
var R3_SIDE=(function(){try{return localStorage.getItem('brz_r3_side')||'trade';}catch(e){return 'trade';}})();
var _r3DerivCache=null,_r3SpotCache=null,_r3PhysicalCache=null,_r3PhysicalCacheDate=null;
function r3Data(){if(_r3DerivCache)return _r3DerivCache;try{var el=document.getElementById('dataDerivadosSpot');_r3DerivCache=JSON.parse(el.textContent||'{}');}catch(e){_r3DerivCache={meta:{},rows:[]};}return _r3DerivCache;}
function r3RefDate(){
  /* V4FQ C35: relatório usa a referência mais nova entre estado e CMA.
     Evita que timestamps salvos de um build antigo ocultem cotações já publicadas. */
  var values=[];
  try{
    var d=String((typeof state!=='undefined'&&state&&state.timestamps&&state.timestamps.cbot)||'').trim();
    var iso=d.match(/^(\d{4}-\d{2}-\d{2})(?:$|\s)/);
    if(iso)values.push(iso[1]);
    var br=d.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:$|\s)/);
    if(br)values.push(br[3]+'-'+br[2]+'-'+br[1]);
  }catch(_e){}
  var spot=String((r3Data().meta||{}).ultimaData||'');
  if(/^\d{4}-\d{2}-\d{2}$/.test(spot))values.push(spot);
  if(values.length)return values.sort().slice(-1)[0];
  return ppeData().meta.gerado||'2026-10-15';
}
function r3GroupKey(prod,city){return prod+'|'+city;}
function r3Options(prod,city){return R3_CFG[r3GroupKey(prod,city)]||{};}
function r3Save(prod,city,field,val){var key=r3GroupKey(prod,city),c=R3_CFG[key]||{};if(val===''||val==null){delete c[field];}else{c[field]=val;}if(field==='port'){delete c.frete;delete c.fobbins;}R3_CFG[key]=c;try{localStorage.setItem('brz_r3_cfg',JSON.stringify(R3_CFG));}catch(e){}renderReportDerivados();}
function r3SetSide(s){R3_SIDE=s;try{localStorage.setItem('brz_r3_side',s);}catch(e){}renderReportDerivados();}

function r3AllCities(prod){
  if(prod==='Soybean') return R3_CITY.slice();
  var out=R3_CITY.slice(),seen={};out.forEach(function(e){seen[e.city]=1;});
  var ref=r3RefDate();
  (r3Data().rows||[]).forEach(function(x){
    if(x.p!==prod||!x.o||x.d>ref)return;
    var age=(Date.parse(ref+'T12:00:00Z')-Date.parse(x.d+'T12:00:00Z'))/86400000;
    if(age>10||age<0||seen[x.o])return;
    var uf=(String(x.o).match(/ - ([A-Z]{2})$/)||[])[1]||'—';
    var port=uf==='RS'?'Rio Grande':uf==='PR'||uf==='SC'?'Paranaguá':'Santos';
    out.push({city:x.o,region:uf+' · cotação SPOT',port:port});seen[x.o]=1;
  });
  return out;
}
function r3VisibleCities(prod){return r3AllCities(prod).filter(function(e){return r3Options(prod,e.city).hidden!==true;});}
function r3HiddenCount(prod){return r3AllCities(prod).length-r3VisibleCities(prod).length;}
function r3HideOrigin(prod,city){if(!r3AllCities(prod).some(function(e){return e.city===city;})||['Soymeal','Soyoil','Soybean'].indexOf(prod)<0)return;var k=r3GroupKey(prod,city),c=R3_CFG[k]||{};c.hidden=true;R3_CFG[k]=c;try{localStorage.setItem('brz_r3_cfg',JSON.stringify(R3_CFG));}catch(e){}
  try{ if(!Array.isArray(state.r3Hidden)) state.r3Hidden=[]; if(state.r3Hidden.indexOf(k)<0) state.r3Hidden.push(k); if(typeof persist==='function') persist(); }catch(e){}
  renderReportDerivados();}
function r3HiddenList(prod){ var out=[]; r3AllCities(prod).forEach(function(e){ var c=r3Options(prod,e.city); if(c.hidden===true) out.push(r3GroupKey(prod,e.city)); }); return out; }
function r3CopyHidden(prod){ var lst=r3HiddenList(prod); var txt=JSON.stringify(lst); try{ navigator.clipboard.writeText(txt); alert(ppeL('Lista de origens ocultas copiada ('+lst.length+'). Cole no chat para gravar no arquivo.','Hidden origins list copied ('+lst.length+'). Paste it in the chat to store it in the file.')); }catch(e){ prompt(ppeL('Copie a lista:','Copy the list:'), txt); } }
function r3RestoreOrigins(prod){if(['Soymeal','Soyoil','Soybean'].indexOf(prod)<0)return;r3AllCities(prod).forEach(function(e){var k=r3GroupKey(prod,e.city),c=R3_CFG[k];if(c&&c.hidden===true){c.hidden=false;R3_CFG[k]=c;} try{ if(Array.isArray(state.r3Hidden)){ var ix=state.r3Hidden.indexOf(k); if(ix>=0) state.r3Hidden.splice(ix,1); } }catch(e){} }); try{ if(typeof persist==='function') persist(); }catch(e){}try{localStorage.setItem('brz_r3_cfg',JSON.stringify(R3_CFG));}catch(e){}renderReportDerivados();}
function r3RemoveCell(prod,e){var msg=ppeL('Remover origem da tabela: ','Remove origin from table: ')+e.city;return '<td class="r3-ctrl r3-noexport"><button type="button" class="r3-del-origin" title="'+r3E(msg)+'" aria-label="'+r3E(msg)+'" onclick="r3HideOrigin('+r3E(JSON.stringify(prod))+','+r3E(JSON.stringify(e.city))+')">&times;</button></td>';}
function r3RestoreButton(prod){var n=r3HiddenCount(prod);return n?'<button type="button" class="r3-restore r3-noexport" onclick="r3RestoreOrigins('+r3E(JSON.stringify(prod))+')">'+r3E(ppeL('Restaurar origens','Restore origins'))+' ('+n+')</button> <button type="button" class="r3-restore r3-noexport" onclick="r3CopyHidden('+r3E(JSON.stringify(prod))+')" title="'+r3E(ppeL('Copia a lista de origens ocultas para gravar no arquivo','Copies the hidden origins list to store it in the file'))+'">'+r3E(ppeL('Copiar lista oculta','Copy hidden list'))+'</button>':'';}
function r3EmptyRow(n){return '<tr><td colspan="'+n+'" class="r3-empty">'+r3E(ppeL('Nenhuma origem visível. Use Restaurar origens para recuperar as linhas.','No origins displayed. Use Restore origins to bring the rows back.'))+'</td></tr>';}

function r3E(v){return ppeEsc(v);}
function r3F(v,n){return ppeNum(v,n==null?2:n);}
function r3Kpi(name,value,unit){return '<div class="r3-kpi"><span>'+r3E(name)+'</span><strong>'+r3E(value)+'</strong><small>'+r3E(unit||'')+'</small></div>';}
function r3Ppe(prod,fn){var old=PPE_PROD;PPE_PROD=prod;try{return fn();}finally{PPE_PROD=old;}}
var _r3SpotCacheDate=null;
function r3Sources(){
  var ref=r3RefDate();
  if(_r3SpotCache&&_r3SpotCacheDate===ref)return _r3SpotCache;
  var m={};
  (r3Data().rows||[]).forEach(function(r){
    if(!r||!r.d||r.d>ref)return;
    var k=r.p+'|'+r.o;
    if(!m[k]||m[k].d<r.d)m[k]=r;
  });
  _r3SpotCache=m;_r3SpotCacheDate=ref;
  return m;
}
function r3PhysicalDeriv(prod,city){var q=r3Sources()[prod+'|'+city];if(!q||q.d>r3RefDate())return null;var age=Math.round((new Date(r3RefDate()+'T12:00:00Z')-new Date(q.d+'T12:00:00Z'))/86400000);if(age>10||age<0)return null;var vals=(q.v||[]).map(Number).filter(function(x){return Number.isFinite(x)&&x>0;});return vals.length?{v:Math.min.apply(null,vals),d:q.d,n:vals.length,age:age,kind:'Diferido',source:'Derivados CMA · Excel'}:null;}
function r3SoyObserved(city,ship){
  var ref=r3RefDate();
  if(!_r3PhysicalCache||_r3PhysicalCacheDate!==ref){
    var index={};
    try{
      var base=(typeof getPrecosBase==='function')?getPrecosBase():[];
      base.forEach(function(q){
        if(!q||q.produto!=='Soja'||!q.embarque||!q.origem||!q.data||q.data>ref)return;
        if(!(Number(q.preco)>0)||!Number.isFinite(Number(q.preco)))return;
        var k=q.origem+'|'+q.embarque;
        if(!index[k]||q.data>index[k].data||(q.data===index[k].data&&String(q.id||'')>String(index[k].id||'')))index[k]=q;
      });
    }catch(err){console.warn('r3SoyObserved: cash data unavailable',err);}
    _r3PhysicalCache=index;
    _r3PhysicalCacheDate=ref;
  }
  var r=_r3PhysicalCache[city+'|'+ship];
  // A desk price is a quote only for its own publication date. Prior days cannot silently become today's cash.
  if(!r||r.data!==ref)return null;
  return {v:Number(r.preco),d:r.data,source:r.precoOrig||'',id:r.id||'',kind:'cash-mid'};
}
function r3Route(city,port){return ppeOrigens(port).filter(function(x){return x.nome===city;})[0]||null;}
function r3FreightRoute(city,port){var direct=r3Route(city,port);if(direct)return {valor:direct.valor,semana:direct.semana,nome:city,proxy:false};if(city==='Cambé - PR'&&port==='Paranaguá'){var x=r3Route('Londrina - PR',port);if(x)return {valor:x.valor,semana:x.semana,nome:'Londrina - PR',proxy:true};}if(city==='Erechim - RS'&&port==='Rio Grande'){var y=r3Route('Passo Fundo - RS',port);if(y)return {valor:y.valor,semana:y.semana,nome:'Passo Fundo - RS',proxy:true};}
  /* 09/11/2026 (João): sem rota de grãos cadastrada para a praça, usa o motor rodoviário (coleta da semana ou vizinho por t·km com coleta recente, regra frete.rodoSemana) */
  try{ if(typeof findRodoFreight==='function'){ var cid=String(city||'').split(' - ')[0].trim(); var corr=(typeof PRACA_TO_CORREDOR!=='undefined'&&PRACA_TO_CORREDOR[cid])||null; var hoje=(typeof r3RefDate==='function'?r3RefDate():null)||new Date().toISOString().slice(0,10); var f=findRodoFreight(city,port,hoje,corr); if(f&&Number.isFinite(Number(f.valor))&&Number(f.valor)>0){ var nm=f.estimado?((f.refOrigem?String(f.refOrigem).replace('/',' - '):'TKU')+(f.semanaRef?' '+f.semanaRef:'')):(city+(f.semana?' '+f.semana:'')); return {valor:Number(f.valor),semana:f.semana||f.semanaRef||'',nome:nm,proxy:!!f.estimado,motor:true,semanaAnterior:f.fonteFrete==='semana_anterior',etiquetaFonte:f.etiquetaFonte||''}; } } }catch(e){}
  return null;}
function r3Port(prod,entry){return r3Options(prod,entry.city).port||entry.port;}
function r3AvailablePorts(prod,entry){var supported=(typeof PPE_PORTOS!=='undefined'&&PPE_PORTOS.Soybean)||['Santos','Paranaguá','Rio Grande'];var sel=r3Port(prod,entry),a=[];supported.forEach(function(p){if(r3FreightRoute(entry.city,p)||p===sel||p===entry.port)a.push(p);});return a;}
function r3Cost(prod,entry){var c=r3Options(prod,entry.city),port=r3Port(prod,entry),route=r3FreightRoute(entry.city,port);
  /* Óleo a granel líquido nunca herda automaticamente tarifa de grãos. */
  var isOil=prod==='Soyoil',hasManual=c.frete!=null&&c.frete!=='';
  var frete=hasManual?Number(c.frete):(isOil?null:(route?Number(route.valor):null));
  var fbDefault=(typeof FOBBINS_POR_PORTO!=='undefined'&&FOBBINS_POR_PORTO[port]!=null)?Number(FOBBINS_POR_PORTO[port]):((typeof FOBBINS_DEFAULT!=='undefined')?Number(FOBBINS_DEFAULT):11),fobbins=c.fobbins==null?fbDefault:Number(c.fobbins);
  var valid=Number.isFinite(frete)&&(isOil?frete>0:frete>=0);
  return {port:port,frete:valid?frete:null,fobbins:Number.isFinite(fobbins)&&fobbins>=0?fobbins:null,route:route,freightSource:isOil?(hasManual&&valid?'Manual · óleo líquido (confirmar tarifa)':'ÓLEO: frete líquido não cotado · requer input'):hasManual?'Manual':route?(route.proxy?'Proxy '+route.nome+' · '+route.semana:(route.semanaAnterior?'Frete soja/grãos '+route.semana+' (sem S46)':'Frete soja/grãos · '+route.semana)):'Frete não cotado'};
}
function r3CallSave(prod,entry,fld){return 'r3Save('+JSON.stringify(prod)+','+JSON.stringify(entry.city)+','+JSON.stringify(fld)+',this.value)';}
function r3Input(prod,e,field,val,ph){return '<input class="r3-input r3-noexport" type="number" min="0" step="0.01" aria-label="'+r3E(field+' '+e.city)+'" value="'+(val!=null?r3E(String(val)):'')+'" placeholder="'+r3E(ph||'—')+'" onchange="'+r3E(r3CallSave(prod,e,field))+'"><span class="r3-exportval">'+(val!=null?r3F(val,2):'—')+'</span>';}
function r3PortInput(prod,e){var p=r3Port(prod,e);return '<select class="r3-select r3-noexport" aria-label="'+r3E(ppeL('Porto ','Port ')+e.city)+'" onchange="'+r3E(r3CallSave(prod,e,'port'))+'">'+r3AvailablePorts(prod,e).map(function(x){return '<option value="'+r3E(x)+'"'+(x===p?' selected':'')+'>'+r3E(x)+'</option>';}).join('')+'</select><span class="r3-exportval">'+r3E(p)+'</span>';}
function r3FxKey(prod){var c=R3_CFG['fx|'+prod]||{},k=c.key;var m=+r3RefDate().slice(5,7),y=+r3RefDate().slice(0,4);var dt=new Date(Date.UTC(y,m,1));var def=PPE_MESES_DOL[dt.getUTCMonth()]+String(dt.getUTCFullYear()%100);if(k&&state.dolar&&Number(state.dolar[k])>0)return k;if(Number((state.dolar||{})[def])>0)return def;var keys=Object.keys(state.dolar||{}).filter(function(x){return Number(state.dolar[x])>0;});return keys.length?keys[0]:'';}
function r3SetFx(prod,key){R3_CFG['fx|'+prod]={key:key};try{localStorage.setItem('brz_r3_cfg',JSON.stringify(R3_CFG));}catch(e){}renderReportDerivados();}
function r3Fx(prod){var k=r3FxKey(prod),v=Number((state.dolar||{})[k]);return {key:k,value:Number.isFinite(v)&&v>0?v:null,proxySpot:!!(state.dolarProxies&&state.dolarProxies[k])};}
function r3FxSelector(prod){var cur=r3FxKey(prod),ref=r3RefDate(),start=+ref.slice(0,4)*12+(+ref.slice(5,7));var yearOf=function(k){var mm=PPE_MESES_DOL.indexOf(k.slice(0,3));return mm<0?0:(2000+Number(k.slice(3)))*12+(mm+1);};var keys=Object.keys(state.dolar||{}).filter(function(k){return Number(state.dolar[k])>0&&/^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\d{2}$/.test(k)&&yearOf(k)>=start;}).sort(function(a,b){return yearOf(a)-yearOf(b);});if(keys.indexOf(cur)<0&&cur)keys.unshift(cur);return '<label class="r3-fxlabel r3-noexport">'+ppeL('Dólar (B3 / proxy)','FX (B3 / proxy)')+' <select class="r3-select" onchange="r3SetFx('+JSON.stringify(prod)+',this.value)">'+keys.map(function(k){return '<option value="'+r3E(k)+'"'+(k===cur?' selected':'')+'>'+r3E(k)+' · '+r3F(state.dolar[k],4)+(state.dolarProxies&&state.dolarProxies[k]?' · PROXY SPOT':'')+'</option>';}).join('')+'</select></label><span class="r3-exportval">DOL '+r3E(cur)+' · '+r3F(r3Fx(prod).value,4)+(r3Fx(prod).proxySpot?' · PROXY SPOT (NÃO B3)':'')+'</span>';}
function r3PhysicalInput(prod,e,p,c){var override=c.fisico!=null&&c.fisico!=='';var original=p?p.v:null,selected=override?Number(c.fisico):original;var observed=override?ppeL('Mesa · manual','Desk · manual'):p?(ppeL('Diferido · ','Deferred · ')+ppeFmtBR(p.d)):ppeL('Sem preço físico','No cash quote');return '<div class="r3-physical">'+(selected!=null&&Number.isFinite(selected)?'<b>'+r3F(selected,2)+'</b>':'<span class="r3-blank">'+r3E(ppeL('A consultar','To be checked'))+'</span>')+'<small>'+r3E(observed)+'</small></div><div class="r3-fisicoedit r3-noexport"><input class="r3-input" type="number" min="0" step="0.01" value="'+(override?r3E(c.fisico):'')+'" placeholder="'+r3E(p?ppeL('Ajustar mesa','Adjust desk quote'):ppeL('Inserir preço','Insert price'))+'" aria-label="'+r3E(ppeL('Preço SPOT ','SPOT price ')+e.city)+'" onchange="'+r3E(r3CallSave(prod,e,'fisico'))+'"></div>';}
function r3DerivReplacement(phys,frete,fb,fx){if(phys==null||!(+phys>0)||frete==null||fb==null||!(fx>0))return null;var cost=+phys+ +frete,usd=cost/fx+ +fb,fobPortR=cost+(+fb*+fx);return {originR:+phys,freteR:+frete,portR:cost,portUSD:cost/fx,fobbinsUSD:+fb,fobPortR:fobPortR,fobUSD:usd};}
function r3CardStart(id,title,sub,unit,extra){return '<section class="a-card r3-card" id="'+r3E(id)+'" data-r3-export="'+r3E(id)+'"><div class="r3-head"><div class="r3-header-titles"><div class="a-card-t">'+r3E(title)+'</div><div class="p-card-s">'+r3E(sub)+'</div></div><div class="r3-header-tools"><span class="r3-unit">'+r3E(unit)+'</span>'+(extra||'')+'</div></div>';}
/* V2V — negócios FECHADOS da mesa, somente no dia do relatório; produtos de derivados separados.
   CIF representa preço entregue; sem origem/frete identificáveis, FOB é PENDENTE, nunca 0.
   Outros traders NÃO são gravados em state.negocios. */
function r3DayDeals(prod){var wanted=(prod==='Soymeal'?'farelo':prod==='Soyoil'?'óleo':'');if(!wanted)return [];
  var ref=r3RefDate();var ids={};return (state.negocios||[]).filter(function(d){
    var p=String(d.produto||'').toLocaleLowerCase('pt-BR');var matches=wanted==='farelo'?(p==='farelo'||p==='farelo de soja'):(p==='óleo'||p==='oleo'||p==='óleo de soja'||p==='oleo de soja');
    if(!matches||d.data!==ref||!d.id||ids[d.id])return false;ids[d.id]=true;return true;
  });
}
function r3TradeConfig(d){return R3_CFG['trade|'+d.id]||{};}
function r3TradeSave(id,field,value){var all=(state.negocios||[]),d=all.find(function(x){return x.id===id;});if(!d)return;
  var key='trade|'+id,cf=R3_CFG[key]||{};
  if(value===''||value==null)delete cf[field];else cf[field]=value;
  if(field==='port'){delete cf.frete;delete cf.fobbins;}
  R3_CFG[key]=cf;try{localStorage.setItem('brz_r3_cfg',JSON.stringify(R3_CFG));}catch(e){}
  renderReportDerivados();
}
function r3TradeInput(d,field,v,ph){return '<input class="r3-input r3-noexport" type="number" min="0" step="0.01" aria-label="'+r3E(field+' '+d.id)+'" value="'+(v!=null?r3E(String(v)):'')+'" placeholder="'+r3E(ph||'—')+'" onchange="r3TradeSave('+r3E(JSON.stringify(d.id))+','+r3E(JSON.stringify(field))+',this.value)"><span class="r3-exportval">'+(v!=null?r3F(v,2):'—')+'</span>';}
function r3TradePortInput(d,port){var ports=['Santos','Paranaguá','Rio Grande','São Francisco do Sul','Itaqui'];if(ports.indexOf(port)<0)ports.push(port);
  return '<select class="r3-select r3-noexport" aria-label="'+r3E('Porto simulado '+d.id)+'" onchange="r3TradeSave('+r3E(JSON.stringify(d.id))+',\'port\',this.value)">'+ports.map(function(p){return '<option value="'+r3E(p)+'"'+(p===port?' selected':'')+'>'+r3E(p)+'</option>';}).join('')+'</select><span class="r3-exportval">'+r3E(port)+'</span>';
}
function r3TradeModel(prod,d){var c=r3TradeConfig(d),ref=d.id,loc=String(d.origem||''),port=c.port||(loc.indexOf('RS')>=0?'Rio Grande':loc.indexOf('PR')>=0?'Paranaguá':'Santos');
  /* 09/11/2026 (João): CIF entregue em cidade usa a praça de entrega como origem do cálculo; frete de grãos como proxy, igual à tabela de praças */
  var direct=r3FreightRoute(loc,port),f=c.frete!=null&&c.frete!==''?Number(c.frete):direct?Number(direct.valor):null;
  if(!Number.isFinite(f)||f<0)f=null;
  var fbDef=(typeof FOBBINS_POR_PORTO!=='undefined'&&FOBBINS_POR_PORTO[port]!=null)?Number(FOBBINS_POR_PORTO[port]):Number(typeof FOBBINS_DEFAULT!=='undefined'?FOBBINS_DEFAULT:11);
  var fb=c.fobbins!=null&&c.fobbins!==''?Number(c.fobbins):fbDef;if(!Number.isFinite(fb)||fb<0)fb=null;
  var price=Number(d.precoRsTon!=null?d.precoRsTon:d.preco),fx=Number(d.cambioFechamento||d.cambio),px=Number(d.cbotFechamento||d.cbot);
  var cb=(px>0&&d.vencCBOT&&d.vencCBOT!=='-')?{contract:d.vencCBOT,price:px}:null;
  /* 09/11/2026 (João): negócio informativo de farelo/óleo não carrega câmbio nem CBOT; usa a curva vigente da aba (mesma das praças) */
  var _fxCurva=null,_cbCurva=null; try{ _fxCurva=r3Fx(prod); _cbCurva=r3DerivativeCBOT(prod); }catch(e){}
  var _fxViva=!(fx>0); if(_fxViva && _fxCurva && _fxCurva.value>0) fx=Number(_fxCurva.value);
  if(!cb && _cbCurva && _cbCurva.price>0) cb={contract:_cbCurva.contract,price:_cbCurva.price};
  var v=r3DerivReplacement(price,f,fb,fx),basis=r3DerivativeBasis(prod,v?v.fobUSD:null,cb);
  var isCIF=/\bCIF\b/i.test(String(d.condicaoEntrega||'')),freightSource=c.frete!=null&&c.frete!==''?'Frete manual':direct?(direct.proxy?'Proxy '+direct.nome:((direct.semana||'Semana N/D')+' · '+direct.nome)):'Frete não informado';
  var warn=isCIF?ppeL('CIF entregue: praça de entrega como origem do cálculo, frete de grãos como proxy','Delivered CIF: delivery city as calculation origin, grain freight as proxy'):ppeL('FOB origem informada','FOB origin specified');
  if(!v)warn+=' · '+ppeL('sem frete: replacement em aberto','freight missing: replacement pending');
  return {deal:d,city:loc,region:ppeL('FECHADO MESA AGRINVEST','AGRINVEST DESK TRADE'),port:port,phys:price,physNote:(isCIF?'CIF':'FOB')+' · '+r3E(d.teorProteina||'')+' · '+ppeFmtBR(d.data),
    frete:f,freightSource:freightSource,fobbins:fb,fx:fx>0?fx:null,fxKey:(d.vencCambio&&!_fxViva)?((d.vencCambio||'-')+(d.vencCambioProvisorio?' · provisório':'')):((_fxCurva&&_fxCurva.key)?_fxCurva.key+' · curva vigente':'-'),
    fobPortR:v?v.fobPortR:null,replacement:v?v.fobUSD:null,basis:basis,cbContract:cb?cb.contract:null,cbPrice:cb?cb.price:null,warn:warn,
    isTrade:true,seller:d.vendedor||'',buyer:d.comprador||'',volume:d.volume,delivery:d.retirada||'',id:ref,marketBatch:d.marketSnapshotBatch||''};
}
function r3TradeSection(prod){var deals=r3DayDeals(prod);if(!deals.length)return '';
  var label=ppeL('NEGÓCIOS FECHADOS · MESA AGRINVEST','CLOSED TRADES · AGRINVEST DESK');
  return '<tr class="a-sorgo-sep r3-trade-break"><td colspan="'+(prod==='Soymeal'?'14':'11')+'"><div class="a-sorgo-sep-inner"><span class="a-sorgo-sep-title">'+r3E(label)+'</span><span class="a-sorgo-sep-note">'+r3E(ppeFmtBR(r3RefDate()))+' · '+deals.length+' '+r3E(ppeL('negócio(s)','trade(s)'))+' · '+r3E(ppeL('replacement FOB em US$/t · físico convertido + frete até o porto','FOB replacement in US$/t · cash converted + inland freight'))+'</span></div></td></tr>'+deals.map(function(d){
    var r=r3TradeModel(prod,d),co=r3TradeConfig(d),valid=r.replacement!=null;
    return '<tr class="r3-trade-row" data-trade-id="'+r3E(d.id)+'">'+
      '<td class="r3-l"><b>'+r3E(r.city)+'</b><small>'+r3E(d.vendedor)+' → '+r3E(d.comprador)+'</small><small>'+r3E(r3F(d.volume,0)+' t · '+(d.teorProteina||d.tipoProduto||d.produto))+'</small><small>'+r3E(d.retirada||'')+'</small></td>'+
      '<td class="r3-l">'+r3TradePortInput(d,r.port)+'</td>'+
      '<td class="r3-n"><b>'+r3F(r.phys,2)+'</b><small>'+r3E(r.physNote)+'</small></td>'+
      '<td class="r3-n">'+r3TradeInput(d,'frete',co.frete!=null&&co.frete!==''?co.frete:r.frete,ppeL('Inserir frete','Enter freight'))+'<small>'+r3E(r.freightSource)+'</small></td>'+
      '<td class="r3-n">'+r3TradeInput(d,'fobbins',r.fobbins,'Fobbings')+'</td>'+
      '<td class="r3-n">'+(valid?r3F(r.fobPortR,2):'—')+'</td>'+
      '<td class="r3-n">'+(r.fx?r3F(r.fx,4):'—')+'<small>'+r3E(r.fxKey)+'</small></td>'+
      '<td class="r3-n r3-strong">'+(valid?'<b>'+r3F(r.replacement,2)+'</b>':'<span class="r3-blank">—</span>')+'<small>'+r3E(valid?ppeL('Paridade FOB · frete de grãos como referência','FOB parity · grain freight as reference'):ppeL('Aguardando frete','Freight required'))+'</small></td>'+
      '<td class="r3-l r3-colnote"><small>'+r3E(r.warn)+'</small></td>'+
      '<td class="r3-n r3-strong"><b>'+r3DerivativeBasisFormatted(r.basis,prod)+'</b><small>'+r3E((r.cbContract||'—')+' · '+(r.cbPrice||'—'))+'</small></td>'+
      (prod==='Soymeal'?'<td class="r3-n">N/D</td><td class="r3-n">N/D</td><td class="r3-n">N/D</td>':'')+
      '<td class="r3-ctrl"></td></tr>';
  }).join('');
}
function r3MealDeltaLabel(ago){return ppeFmtBR(r3MealTargetDate(r3RefDate(),ago)).slice(0,5);}
function r3DerivTable(prod,title){
  var fx=r3Fx(prod),cbotRef=r3DerivativeCBOT(prod);
  var body=r3VisibleCities(prod).map(function(e){
    var co=r3Cost(prod,e),m=r3Options(prod,e.city),p=r3PhysicalDeriv(prod,e.city),over=m.fisico!=null&&m.fisico!=='';
    var phys=over?Number(m.fisico):p?p.v:null;
    var v=r3DerivReplacement(phys,co.frete,co.fobbins,fx.value);
    var basis=r3DerivativeBasis(prod,v?v.fobUSD:null,cbotRef);
    var deltas=prod==='Soymeal'?r3MealDeltas(e,co,m,cbotRef,fx,basis):null;
    var warn=prod==='Soyoil'?(co.frete==null?ppeL('Sem frete líquido: replacement em aberto','Liquid freight missing: replacement unavailable'):ppeL('Frete líquido manual: confirmar execução','Manual liquid freight: confirm execution')):co.route&&co.route.proxy&&m.frete==null?ppeL('Proxy de frete · confirmar com a mesa','Freight proxy · confirm with desk'):!co.route&&m.frete==null?ppeL('Sem frete direto; preencher manualmente','No direct freight; fill manually'):!p&&!over?ppeL('Aguardando preço SPOT','Waiting for SPOT price'):ppeL('Frete grãos como proxy indicativa','Grain freight used as indicative proxy');
    return '<tr>'+
      '<td class="r3-l"><b>'+r3E(e.city)+'</b><small>'+r3E(e.region)+'</small></td>'+
      '<td class="r3-l">'+r3PortInput(prod,e)+'</td>'+
      '<td class="r3-n">'+r3PhysicalInput(prod,e,p,m)+'</td>'+
      '<td class="r3-n">'+r3Input(prod,e,'frete',co.frete,ppeL('Frete','Freight'))+'<small>'+r3E(co.freightSource)+'</small></td>'+
      '<td class="r3-n">'+r3Input(prod,e,'fobbins',co.fobbins,'Fobbings')+'</td>'+
      '<td class="r3-n">'+(v?r3F(v.fobPortR,2):'—')+'<small>'+(v&&co.fobbins!=null?'incl. '+r3F(co.fobbins,2)+' US$/t':'')+'</small></td>'+
      '<td class="r3-n">'+(fx.value!=null?r3F(fx.value,4):'—')+'<small>'+r3E(fx.key)+'</small></td>'+
      '<td class="r3-n r3-strong">'+(v?'<b>'+r3F(v.fobUSD,2)+'</b><small>'+r3E(over?ppeL('Indicação manual','Manual input'):p?(ppeL('Físico · ','Cash · ')+ppeFmtBR(p.d)):'')+'</small>':'<span class="r3-blank">—</span><small>'+r3E(ppeL('Preencher pendência','Fill pending item'))+'</small>')+'</td>'+
      '<td class="r3-l r3-colnote"><small>'+r3E(warn)+'</small></td>'+
      '<td class="r3-n r3-strong"><b>'+r3DerivativeBasisFormatted(basis,prod)+'</b><small>'+(cbotRef?'CBOT '+r3E(cbotRef.contract)+' · '+r3F(cbotRef.price,prod==='Soymeal'?1:2):r3E(ppeL('Sem CBOT válida','No valid CBOT')))+'</small></td>'+
      (deltas?r3MealDeltaCell(deltas.d1)+r3MealDeltaCell(deltas.d7)+r3MealDeltaCell(deltas.d30):'')+
      r3RemoveCell(prod,e)+'</tr>';
  }).join('');
  var closedTrades=r3TradeSection(prod);
  if(!body&&!closedTrades)body=r3EmptyRow(prod==='Soymeal'?14:11);
  body=closedTrades+body; /* V4EF: negócios fechados do dia em primeiro plano */
  var subtitle=prod==='Soyoil'?ppeL('SPOT CMA por praça; replacement apenas com frete específico de óleo líquido informado pela mesa; sem tarifa, FOB/basis em aberto','CMA SPOT by city; replacement requires manually sourced liquid oil freight; blank otherwise'):ppeL('Físico SPOT diferido; frete de grãos é proxy indicativa, não cotação garantida de farelo; basis contra CBOT compatível','Deferred SPOT cash; grain freight is an indicative proxy, not quoted meal freight; CBOT-equivalent basis');
  var table='<div class="r3-scroll a-tab-wrap"><table class="r3-table a-tab-table"><thead><tr>'+
    '<th>'+ppeL('Praça','Origin')+'</th><th>'+ppeL('Porto','Port')+'</th><th>'+ppeL('Físico R$/t','Cash BRL/t')+'</th><th>'+ppeL('Frete R$/t','Freight BRL/t')+'</th><th>Fobbings US$/t</th><th>'+ppeL('FOB porto R$/t','FOB port BRL/t')+'</th><th>FX R$/US$</th><th>Replacement FOB US$/t</th><th>'+ppeL('Origem / situação','Source / status')+'</th><th>Basis ('+r3DerivativeBasisUnit(prod)+')</th>'+(prod==='Soymeal'?'<th title="Δ basis US$/st vs '+r3MealDeltaLabel(1)+'">D-1</th><th title="Δ basis US$/st vs '+r3MealDeltaLabel(7)+'">D-7</th><th title="Δ basis US$/st vs '+r3MealDeltaLabel(30)+'">D-30</th>':'')+'<th class="r3-ctrl r3-noexport" aria-label="'+r3E(ppeL('Remover','Remove'))+'"></th></tr></thead><tbody>'+body+'</tbody></table></div>';
  return r3CardStart('r3-card-'+prod,title,subtitle,'US$/t',r3FxSelector(prod)+r3RestoreButton(prod))+table+'<div class="r3-foot">'+ppeL('Basis = FOB replacement convertido à unidade da CBOT − cotação CBOT. Farelo em US$/short ton; óleo em ¢/lb. Referência CBOT identificada por contrato.','Basis = FOB replacement converted into CBOT units − CBOT futures. Soymeal in US$/short ton; soyoil in ¢/lb. CBOT contract identified.')+(prod==='Soymeal'?'<div style="font-size:11px;color:#64748B;margin-top:5px">D-1: '+r3MealDeltaLabel(1)+' · D-7: '+r3MealDeltaLabel(7)+' · D-30: '+r3MealDeltaLabel(30)+' · variação do basis (US$/short ton); N/D = falta de spot, frete, dólar ou CBOT históricos comparáveis. Fobbings mantidos constantes; frete de grãos como proxy.</div>':'')+'</div></section>';
}
function r3MonthDistance(a,b){return Math.abs((a.ano*12+a.mes)-(b.ano*12+b.mes));}
function r3Windows(prod){return r3Ppe(prod,function(){return ppeJanelas(prod);});}
/* PPE V2U: direct FOB basis first; otherwise Paranaguá FOB benchmark.
   Never silently convert a Paranaguá quote into a Santos/Rio Grande quotation.
   A one-sided quote is indicative, never an executable two-way market. */
function r3SoyQuote(port,j,iso){return r3Ppe('Soybean',function(){
  function select(bench){
    var o=ppeBasis('Soybean',bench,j,'offer',iso),b=ppeBasis('Soybean',bench,j,'bid',iso);
    var val=null,single=false,mixed=false,side='';
    if(R3_SIDE==='offer' && o){val=Number(o.v);side='offer';}
    else if(R3_SIDE==='bid' && b){val=Number(b.v);side='bid';}
    else if(R3_SIDE==='trade'){
      if(o&&b){val=(Number(o.v)+Number(b.v))/2;mixed=o.ymd!==b.ymd;side='mid';}
      else if(o||b){var r=o||b;val=Number(r.v);single=true;side=o?'offer':'bid';}
    }
    if(val==null||!Number.isFinite(val)) return null;
    var valDate=Math.max(o?o.ymd:0,b?b.ymd:0),valuation=ppeYmd(iso),proxy=bench!==port;
    return {v:val,o:o,b:b,mixed:mixed,single:single,proxy:proxy,
      benchmarkPort:bench,porto:port,side:side,
      indicative:proxy||mixed||single,
      carried:!!((o&&o.ymd!==valuation)||(b&&b.ymd!==valuation)),
      quoteDates:(o?ppeFmtBR(ppeIso(o.ymd)):'—')+' / '+(b?ppeFmtBR(ppeIso(b.ymd)):'—'),
      ymd:valDate,
      fonte:proxy?'benchmark FOB '+bench+(single?' · unilateral':mixed?' · datas distintas':''):
        (single?'basis unilateral indicativo':mixed?'referência histórica indicativa':'última cotação própria')};
  }
  return select(port) || (port!=='Paranaguá'?select('Paranaguá'):null);
});}
function r3SoyBasisTrend(port,j,iso){
  // DoD, WoW, MoM = apenas mudança do basis FOB da MESMA janela/porto.
  // Não apresentar variações para físico transformado em replacement, nem para PPE proxy.
  function at(d){var ss=function(pl){var s=ppeSerie('Soybean',port,j.typ,j.ship,pl);return ppeAt(s,ppeYmd(d),true);};
    var a=ss('offer'),b=ss('bid');
    if(R3_SIDE==='offer')return a?Number(a.v):null;
    if(R3_SIDE==='bid')return b?Number(b.v):null;
    return a&&b?(Number(a.v)+Number(b.v))/2:null;}
  var today=at(iso);if(today===null)return {dod:null,wow:null,mom:null};
  function prior(start,maxBack){var d=new Date(start+'T12:00:00Z');for(var i=0;i<=maxBack;i++){
    var x=d.toISOString().slice(0,10),v=at(x);if(v!==null&&x!==iso)return v;d.setUTCDate(d.getUTCDate()-1);
  }return null;}
  var dt=new Date(iso+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()-1);
  var d1=prior(dt.toISOString().slice(0,10),5);
  var weekly=new Date(iso+'T12:00:00Z');weekly.setUTCDate(weekly.getUTCDate()-7);
  var wk=prior(weekly.toISOString().slice(0,10),3);
  var monthly=new Date(iso+'T12:00:00Z');monthly.setUTCMonth(monthly.getUTCMonth()-1);
  var mo=prior(monthly.toISOString().slice(0,10),3);
  return {dod:d1===null?null:today-d1,wow:wk===null?null:today-wk,mom:mo===null?null:today-mo};
}
function r3SoyCalc(e,j,opt){
  opt=opt||{};
  var co=r3Cost('Soybean',e),iso=r3RefDate(),chosen=j,q=r3SoyQuote(co.port,j,iso);
  function usable(x){return !!(x&&x.v!=null&&Number.isFinite(Number(x.v)));}
  var nearest=false;
  // Only a nearby shipment may act as a marked fallback; never as an actual quote.
  if(!usable(q)&&opt.allowNearest){
    var list=r3Windows('Soybean').filter(function(x){
      return x.typ==='F'&&!x.dupla&&r3MonthDistance(x,j)<=2;
    }).sort(function(a,b){
      return r3MonthDistance(a,j)-r3MonthDistance(b,j)||a.ordem-b.ordem;
    });
    for(var n=0;n<list.length;n++){
      var other=r3SoyQuote(co.port,list[n],iso);
      if(usable(other)){q=other;chosen=list[n];nearest=true;break;}
    }
  }
  var c=ppeContrato('Soybean',j),cb=ppeCbot('Soybean',c),fx=ppeDolar(j);
  var pp=PPE_PRODUTOS.filter(function(x){return x.k==='Soybean';})[0];
  var flat=usable(q)&&cb!=null?cb+Number(q.v):null;
  var calc=(flat!=null&&co.fobbins!=null)?ppeParityValues(pp,flat,co.fobbins,co.frete,fx?fx.v:null):null;
  var price=(co.frete!=null&&fx&&calc&&calc.exwR!=null)?calc.exwR:null;
  var freightProxy=!!(co.route&&co.route.proxy),indicative=!!(nearest||(q&&q.indicative)||freightProxy);
  var via=q?(q.proxy?'benchmark FOB '+q.benchmarkPort+' (não cotação FOB '+co.port+')':'FOB '+co.port):'';
  var note=usable(q)?((indicative?'PPE indicativa; ':'PPE cotação direta; ')+via+
      ' · janela '+chosen.label+(nearest?' (proxy para '+j.label+')':'')+' · '+q.quoteDates+
      (freightProxy?' · frete proxy '+co.freightSource:'')):'Sem basis FOB histórico utilizável na janela/benchmark';
  return {j:j,cost:co,quote:q,used:chosen,indicative:indicative,nearest:nearest,freightProxy:freightProxy,
    cbot:cb,contract:c,fx:fx?fx.v:null,fxKey:fx?fx.k:'',flat:flat,calc:calc,price:price,source:note};
}
function r3SoySpot(e){
  var opts=r3Windows('Soybean').filter(function(x){return x.typ==='F'&&!x.dupla;}).sort(function(a,b){return a.ordem-b.ordem;});
  // Primeiro, a janela física mais próxima do dia; não ocultar um cash por falta de FOB.
  var futures=r3MonthKeys();
  for(var i=0;i<futures.length;i++){
    var fj=futures[i],ship=PPE_MESES_EN[fj.mes-1]+'-'+String(fj.ano).slice(-2);
    if(r3SoyObserved(e.city,ship))return r3SoyCalc(e,fj,{allowNearest:false});
  }
  for(var n=0;n<opts.length;n++){var r=r3SoyCalc(e,opts[n],{allowNearest:false});if(r.price!=null)return r;}
  return opts.length?r3SoyCalc(e,opts[0],{allowNearest:false}):(futures.length?r3SoyCalc(e,futures[0],{allowNearest:false}):null);
}
function r3MonthKeys(){var d=r3RefDate(),y=+d.slice(0,4),m=+d.slice(5,7),out=[];for(var k=1;k<=11;k++){var dt=new Date(Date.UTC(y,m-1+k,1)),mm=dt.getUTCMonth()+1,yy=dt.getUTCFullYear();out.push({mes:mm,ano:yy,typ:'F',ship:String(mm).padStart(2,'0')+'-'+yy,label:PPE_MESES_DOL[mm-1]+'/'+String(yy).slice(2),ordem:yy*10000+mm*10});}return out;}
function r3SoyWindows(e){var spot=r3SoySpot(e);var keys=r3MonthKeys();return [{label:'SPOT',isSpot:true,j:spot?spot.j:null,r:spot}].concat(keys.filter(function(x){return !spot||x.mes!==spot.j.mes||x.ano!==spot.j.ano;}).map(function(x){return {label:x.label,isSpot:false,j:x,r:r3SoyCalc(e,x,{allowNearest:true})};}));}
function r3SoyCell(e,w){
  var r=w.r;
  if(!r||!r.j)return '<td class="r3-price-cell"><span class="r3-blank">—</span></td>';
  var ship=PPE_MESES_EN[r.j.mes-1]+'-'+String(r.j.ano).slice(2);
  var physical=r3SoyObserved(e.city,ship), isCash=!!physical;
  var displayed=isCash?physical.v:r.price;
  var tooltip='Window '+w.label+'; '+(isCash?'Cash '+physical.d+' · '+physical.source:r.source)+'; '+r.contract+' '+(r.cbot==null?'n/a':r.cbot)+'; FX '+(r.fx==null?'n/a':r.fx)+'; '+r.cost.freightSource;
  var label=isCash?ppeL('Físico · trade level','Cash · trade level'):(displayed!=null?(r.indicative?ppeL('PPE indicativa','Indicative PPE'):'PPE'):ppeL('Sem preço válido','No valid price'));
  return '<td class="r3-price-cell" title="'+r3E(tooltip)+'"><div class="r3-priceval">'+(displayed!=null?r3F(displayed,2):'—')+'</div><div class="r3-cellmeta">'+r3E(label)+'</div>'+(isCash?'<div class="r3-cellmeta">'+r3E(ppeFmtBR(physical.d))+'</div>':'')+(!isCash&&displayed!=null?'<div class="r3-cellmeta'+(r.indicative?' r3-amber':'')+'">'+r3E('FOB '+(r.quote&&r.quote.proxy?'ref. '+r.quote.benchmarkPort+' · ':'')+(r.nearest?'jan. '+r.used.label+' · ':'')+(r.quote&&r.quote.single?'unilateral · ':'')+(r.quote&&r.quote.o?ppeFmtBR(ppeIso(r.quote.o.ymd)).slice(0,5):'—')+(r.quote&&r.quote.b&&(r.quote.o==null||r.quote.b.ymd!==r.quote.o.ymd)?' / '+ppeFmtBR(ppeIso(r.quote.b.ymd)).slice(0,5):'')+(r.indicative?' · Ind.':''))+'</div>':'')+'</td>';
}
function r3SoyTable(){var ref=r3VisibleCities('Soybean')[0]||R3_CITY[0],example=r3SoyWindows(ref),labels=example.map(function(w){return w.label==='SPOT'?'SPOT'+(w.r&&w.r.j?' ('+PPE_MESES_DOL[w.r.j.mes-1]+'/'+String(w.r.j.ano).slice(2)+')':''):w.label;});var rows=r3VisibleCities('Soybean').map(function(e){var co=r3Cost('Soybean',e),w=r3SoyWindows(e),cells=w.map(function(x){return r3SoyCell(e,x);}).join('');return '<tr><td class="r3-l r3-sticky"><b>'+r3E(e.city)+'</b><small>'+r3E(e.region)+'</small></td><td class="r3-l">'+r3PortInput('Soybean',e)+'</td><td class="r3-n">'+r3Input('Soybean',e,'frete',co.frete,ppeL('Frete','Freight'))+'<small>'+r3E(co.freightSource)+'</small></td><td class="r3-n">'+r3Input('Soybean',e,'fobbins',co.fobbins,'Fobbings')+'</td>'+cells+r3RemoveCell('Soybean',e)+'</tr>';}).join('');if(!rows)rows=r3EmptyRow(5+labels.length);var subtitle=ppeL('Físico do dia primeiro; basis direto ou benchmark FOB Paranaguá identificado · referências históricas até o vencimento','Same-day cash first; direct basis or labeled Paranaguá FOB benchmark · historical quotes retained until shipment expiry');return r3CardStart('r3-card-soy',ppeL('03 · Replacement Soja — curva regional','03 · Soybean Replacement — regional curve'),subtitle,'R$/sc',r3RestoreButton('Soybean'))+'<div class="r3-scroll r3-soyscroll a-tab-wrap"><table class="r3-table r3-soymatrix a-tab-table"><thead><tr><th>'+ppeL('Origem','Origin')+'</th><th>'+ppeL('Porto','Port')+'</th><th>'+ppeL('Frete R$/t','Freight BRL/t')+'</th><th>Fobbings US$/t</th>'+labels.map(function(x){return '<th>'+r3E(x)+'</th>';}).join('')+'<th class="r3-ctrl r3-noexport" aria-label="'+r3E(ppeL('Remover','Remove'))+'"></th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="r3-foot">'+ppeL('Físico do dia prevalece. Sem físico, PPE usa a última referência FOB disponível do mesmo porto e embarque, com data histórica identificada; bid e offer de datas diferentes resultam em PPE indicativa. Referências vencidas desaparecem da tabela, não do histórico. Sem cotação direta: referência FOB de Paranaguá é usada como benchmark indicativo, com o frete da origem até o porto selecionado; fretes por proxy são identificados. Sem qualquer referência ou rota utilizável, o cálculo permanece em aberto.','Current-day cash takes precedence. Without cash, PPE uses own-port basis or a labeled Paranaguá FOB benchmark with selected-route freight and quote date; mixed-date bid and offer generate indicative PPE. Expired shipments disappear from the table, never from historical data. Without a direct quote, Paranaguá FOB is a flagged indicative benchmark using inland freight to the selected port; freight proxies are labeled. Missing all valid basis or usable freight keeps the price blank.')+'</div></section>';}
function r3CSV(){
  // Export only origins currently visible in each product table. Preserve the original data in the HTML.
  var blocks=[['Soymeal',ppeL('Replacement Farelo','Soymeal Replacement')],['Soyoil',ppeL('Replacement Óleo','Soyoil Replacement')],['soy',ppeL('Replacement Soja','Soybean Replacement')]];
  var csv=[],q=function(v){var s=String(v==null?'':v).replace(/\s+/g,' ').trim();return '"'+s.replace(/"/g,'""')+'"';};
  blocks.forEach(function(g){var table=document.querySelector('#r3-card-'+g[0]+' table');if(!table)return;csv.push(q(g[1]));
    Array.prototype.forEach.call(table.querySelectorAll('tr'),function(row){
      var cells=Array.prototype.filter.call(row.children,function(c){return c.matches('th,td')&&!c.classList.contains('r3-ctrl');});
      // Empty-state message is interface text, not a market observation.
      if(row.querySelector('.r3-empty'))return;
      csv.push(cells.map(function(cell){var copy=cell.cloneNode(true);
        copy.querySelectorAll('.r3-noexport,.r3-fisicoedit,.r3-del-origin').forEach(function(x){x.remove();});
        copy.querySelectorAll('small,.r3-cellmeta,.r3-exportval,.r3-priceval,b').forEach(function(x){x.insertAdjacentText('beforebegin',' ');});
        return q(copy.textContent);
      }).join(';'));
    });
    csv.push('');
  });
  var blob=new Blob(['\ufeff'+csv.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='BRZ_Oil_Meal_Replacement_'+r3RefDate()+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
}
function r3DerivativeCBOT(prod){
  var curve=prod==='Soymeal'?(state.cbotFarelo||{}):(state.cbotOleo||{});
  var months={F:1,G:2,H:3,J:4,K:5,M:6,N:7,Q:8,U:9,V:10,X:11,Z:12};
  var ref=r3RefDate(),year=Number(ref.slice(0,4)),month=Number(ref.slice(5,7));
  var threshold=year*12+month+1;
  var available=Object.keys(curve).map(function(k){
    var t=/^([FGHJKMNQUVXZ])(\d{2})$/.exec(k.toUpperCase());
    if(!t||!Number.isFinite(Number(curve[k]))||Number(curve[k])<=0)return null;
    return {contract:k,price:Number(curve[k]),sort:(2000+Number(t[2]))*12+months[t[1]]};
  }).filter(Boolean).sort(function(a,b){return a.sort-b.sort;});
  return available.find(function(x){return x.sort>=threshold;})||null;
}
function r3DerivativeBasis(prod,fobUsdT,quote){
  if(fobUsdT==null||!Number.isFinite(Number(fobUsdT))||!quote)return null;
  var physical=prod==='Soymeal'?(Number(fobUsdT)*0.90718474):(Number(fobUsdT)/22.046226218487758);
  var value=physical-quote.price;
  return Number.isFinite(value)?value:null;
}
function r3DerivativeBasisUnit(prod){return prod==='Soymeal'?'US$/st':'¢/lb';}
function r3DerivativeBasisFormatted(value,prod){
  if(value==null||!Number.isFinite(value))return '—';
  var dec=(prod==='Soymeal'?0:(prod==='Soyoil'?2:2));
  return (value>0?'+':'')+r3F(value,dec);
}
/* V4ES (12/11) — D-1/D-7/D-30 de farelo: variacao do BASIS US$/short ton.
   Estritamente MESMA praça/porto, mesmo contrato CBOT e mesmo vencimento DOL;
   data-alvo com observação física CMA, CBOT, DOL e frete histórico efetivamente cotado.
   Fobbings são mantidos constantes para não criar histórico não fornecido; manual atual N/D.
   Não interpolar, não projetar e não usar preços/curvas atuais para D-7/D-30. */
var _r3MealHistoricSpotIndex=null, _r3MealCurveCache=null;
function r3MealHistoricalSpot(city,date){
 if(!_r3MealHistoricSpotIndex){
   var idx={};(r3Data().rows||[]).forEach(function(q){
     if(q.p!=='Soymeal'||!q.d||!q.o)return;
     var vals=(q.v||[]).map(Number).filter(function(v){return Number.isFinite(v)&&v>0;});
     if(!vals.length)return;
     var key=q.o+'|'+q.d,val=Math.min.apply(null,vals);
     if(idx[key]===undefined||val<idx[key])idx[key]=val;
   });_r3MealHistoricSpotIndex=idx;
 }
 var v=_r3MealHistoricSpotIndex[city+'|'+date];return v===undefined?null:v;
}
function r3MealTargetDate(ref,ago){
 var t=new Date(ref+'T12:00:00Z');t.setUTCDate(t.getUTCDate()-ago);
 while(t.getUTCDay()===0||t.getUTCDay()===6)t.setUTCDate(t.getUTCDate()-1);
 return t.toISOString().slice(0,10);
}
function r3MealHistoricalFxContract(key){
 var m=/^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)(\d{2})$/.exec(key||'');
 if(!m)return null;
 var codes={Jan:'F',Fev:'G',Mar:'H',Abr:'J',Mai:'K',Jun:'M',Jul:'N',Ago:'Q',Set:'U',Out:'V',Nov:'X',Dez:'Z'};
 return 'DOL'+codes[m[1]]+m[2];
}
function r3MealHistoricalFreight(city,port,date){
 if(typeof findRodoFreight!=='function')return null;
 var target=city;
 // Exact-route freight only; nearby-city rates are not interchangeable for historical deltas.
 try{
   var x=findRodoFreight(target,port,date,null);
   if(!x||x.estimado||!Number.isFinite(Number(x.valor))||Number(x.valor)<0||!x.semana)return null;
   return {v:Number(x.valor),semana:x.semana,ref:x.fonteFrete};
 }catch(e){return null;}
}
function r3MealDeltas(e,co,m,cbotRef,fx,currentBasis){
 var nd={d1:null,d7:null,d30:null,labels:{},method:'basis · mesma CBOT/DOL e frete histórico cotado; FOBBINS constantes'};
 if(!e||!co||!cbotRef||!fx||currentBasis==null||!Number.isFinite(Number(currentBasis)))return nd;
 // Manual inputs have no dated audit trail; never compare them with historical cash/freight.
 if((m.fisico!=null&&m.fisico!=='')||(m.frete!=null&&m.frete!=='')||(m.fobbins!=null&&m.fobbins!==''))return nd;
 if(!co.port||co.fobbins==null||!Number.isFinite(Number(co.fobbins)))return nd;
 if(co.route&&co.route.proxy)return nd;
 var currentFreight=r3MealHistoricalFreight(e.city,co.port,r3RefDate());
 if(!currentFreight||Math.abs(currentFreight.v-Number(co.frete))>0.01)return nd;
 var historical=_r3MealCurveCache;
 if(!historical){try{historical=JSON.parse(document.getElementById('dataCurvas').textContent);_r3MealCurveCache=historical;}catch(err){return nd;}}
 var cbName='ZM'+cbotRef.contract.toUpperCase(), fxName=r3MealHistoricalFxContract(fx.key);
 if(!fxName||!historical.cbot||!historical.cbot[cbName]||!historical.dol||!historical.dol[fxName])return nd;
 var seriesCB=historical.cbot[cbName],seriesFX=historical.dol[fxName];
 var targetList=[['d1',1],['d7',7],['d30',30]];
 targetList.forEach(function(item){
   var label=item[0],iso=r3MealTargetDate(r3RefDate(),item[1]);nd.labels[label]=iso;
   var spot=r3MealHistoricalSpot(e.city,iso),cb=Number(seriesCB[iso]),dol=Number(seriesFX[iso]);
   var f=r3MealHistoricalFreight(e.city,co.port,iso);
   if(!(spot>0)||!(cb>0)||!(dol>0)||!f)return;
   var historic=r3DerivReplacement(spot,f.v,co.fobbins,dol);
   if(!historic)return;
   var hb=r3DerivativeBasis('Soymeal',historic.fobUSD,{price:cb});
   if(hb==null||!Number.isFinite(hb))return;
   nd[label]=Number(currentBasis)-hb;
 });
 return nd;
}
function r3MealDeltaFormat(v){return v===null||v===undefined||!Number.isFinite(Number(v))?'N/D':((v>0?'+':'')+r3F(Number(v),1));}
function r3MealDeltaCell(v){var color=v==null?'#8291A6':v>0?'#137B53':v<0?'#C14438':'#35465A';return '<td class="r3-n r3-meal-delta" style="color:'+color+';font-weight:700" title="Δ basis histórico US$/short ton · N/D sem CBOT/CMA/FX/frete comparável">'+r3MealDeltaFormat(v)+'</td>';}

function r3ExportDerivRows(prod){
  var fx=r3Fx(prod),cbotRef=r3DerivativeCBOT(prod);
  return r3VisibleCities(prod).map(function(e){
    var co=r3Cost(prod,e),m=r3Options(prod,e.city),p=r3PhysicalDeriv(prod,e.city),over=m.fisico!=null&&m.fisico!=='';
    var phys=over?Number(m.fisico):p?p.v:null;
    var v=r3DerivReplacement(phys,co.frete,co.fobbins,fx.value);
    var warn=prod==='Soyoil'?(co.frete==null?ppeL('Sem frete líquido: replacement em aberto','Liquid freight missing: replacement unavailable'):ppeL('Frete líquido manual: confirmar execução','Manual liquid freight: confirm execution')):co.route&&co.route.proxy&&m.frete==null?ppeL('Proxy de frete · confirmar com a mesa','Freight proxy · confirm with desk'):!co.route&&m.frete==null?ppeL('Sem frete direto; preencher manualmente','No direct freight; fill manually'):!p&&!over?ppeL('Aguardando preço SPOT','Waiting for SPOT price'):ppeL('Frete grãos como proxy indicativa','Grain freight used as indicative proxy');
    return {
      city:e.city, region:e.region, port:r3Port(prod,e), phys:phys, physNote:over?ppeL('Indicação manual','Manual input'):p?(ppeL('Diferido · ','Deferred · ')+ppeFmtBR(p.d)):ppeL('Sem preço físico','No cash quote'),
      frete:co.frete, freightSource:co.freightSource, fobbins:co.fobbins, fx:fx.value, fxKey:fx.key,
      fobPortR:v?v.fobPortR:null, replacement:v?v.fobUSD:null,
      basis:r3DerivativeBasis(prod,v?v.fobUSD:null,cbotRef), cbContract:cbotRef?cbotRef.contract:null,cbPrice:cbotRef?cbotRef.price:null,
      grossMargin:null,warn:warn,mealDeltas:prod==='Soymeal'?r3MealDeltas(e,co,m,cbotRef,fx,r3DerivativeBasis(prod,v?v.fobUSD:null,cbotRef)):null
    };
  }).concat(r3DayDeals(prod).map(function(d){return r3TradeModel(prod,d);}));
}
function r3ExportSoyRows(){
  var reportDate=r3RefDate(),all=[];
  // CBOT soybean contracts are in US cents/bushel. 1 US$/t = approximately 2.721554 cents/bu.
  var cbotUsdT=0.36743717455,soyProduct=PPE_PRODUTOS.filter(function(x){return x.k==='Soybean';})[0];
  function valid(x){return x!==null&&x!==undefined&&Number.isFinite(Number(x));}
  r3VisibleCities('Soybean').forEach(function(e){
    var wins=r3SoyWindows(e);
    wins.forEach(function(w){
      if(!w.j||!w.r)return;
      var r=w.r,j=w.j,cost=r3Cost('Soybean',e),ship=PPE_MESES_EN[j.mes-1]+'-'+String(j.ano).slice(-2);
      var observed=r3SoyObserved(e.city,ship),cashObserved=!!observed;
      var cbot=valid(r.cbot)&&Number(r.cbot)>0?Number(r.cbot):null;
      var fx=valid(r.fx)&&Number(r.fx)>0?Number(r.fx):null;
      var quote=(r.quote&&valid(r.quote.v))?Number(r.quote.v):null;
      var physicalLabel=cashObserved?('Trade level · '+ppeFmtBR(observed.d)):(r&&r.indicative?r.source:'');
      var sea=null,chinaBasis=null;
      if(typeof getSoyOceanFreightInfo==='function'){
        var si=getSoyOceanFreightInfo('China',cost.port,ship,reportDate,r.contract);
        if(si&&si.source==='monthly-shipment'&&si.fallback===false&&valid(si.value))sea=Number(si.value);
      }
      var offer=null,bid=null;
      if(typeof cfrChinaOfferRecord==='function'){
        var of=cfrChinaOfferRecord(reportDate,ship);
        if(of&&of.data&&(Date.parse(reportDate+'T12:00:00Z')-Date.parse(of.data+'T12:00:00Z'))/86400000<=14){
          if(String(of.ref||'').toUpperCase()===String(r.contract||'').charAt(0).toUpperCase()&&valid(of.value))offer=Number(of.value);
        }
      }
      if(typeof cfrChinaBidRecord==='function'){
        var br=cfrChinaBidRecord(reportDate,ship);
        if(br&&br.data&&(Date.parse(reportDate+'T12:00:00Z')-Date.parse(br.data+'T12:00:00Z'))/86400000<=14){
          if((!br.ref||String(br.ref).toUpperCase()===String(r.contract||'').charAt(0).toUpperCase())&&valid(br.value))bid=Number(br.value);
        }
      }
      chinaBasis=bid!=null?bid:offer;
      var chinaSide=bid!=null?'Bid':(offer!=null?'Offer':'');
      function assemble(mode,freight){
        var canCompute=fx!=null&&cbot!=null&&cost.fobbins!=null&&valid(freight)&&Number(freight)>=0;
        var cash=null,basis=null,cashType='',basisIsIndicative=false;
        if(cashObserved){
          cash=observed.v;cashType='Cash';
          // Physical quote determines actual FOB replacement separately for truck and truck+rail.
          if(canCompute){
            var fobUsdT=(cash*1000/60+Number(freight))/fx+Number(cost.fobbins);
            basis=fobUsdT/cbotUsdT-cbot;
          }
        }else{
          cashType='PPE';basisIsIndicative=!!r.indicative;
          if(canCompute&&quote!=null){
            basis=quote;
            var flatUsdT=(cbot+quote)*cbotUsdT;
            cash=(flatUsdT-Number(cost.fobbins)-Number(freight)/fx)*fx*60/1000;
          }
        }
        var cfr=(basis!=null&&sea!=null)?basis+sea/cbotUsdT:null;
        var margin=(cfr!=null&&bid!=null)?bid-cfr:null;
        all.push({
          region:e.city,uf:e.region,ship:w.isSpot?'SPOT · '+ship:ship,contract:r.contract,cbot:cbot,source:r.source,benchmarkPort:(r.quote&&r.quote.benchmarkPort)||cost.port,freightProxy:r.freightProxy,
          cash:cash,cashType:cashType,physicalNote:physicalLabel,modal:mode,port:cost.port,
          fob:basis,indicative:basisIsIndicative,cfr:cfr,chinaBasis:chinaBasis,margin:margin,
          freight:Number.isFinite(Number(freight))?Number(freight):null,fobbins:cost.fobbins,quoteDate:cashObserved?observed.d:null,chinaSide:chinaSide,
          dod:(!cashObserved&&!basisIsIndicative)?r3SoyBasisTrend(cost.port,j,reportDate).dod:null,
          wow:(!cashObserved&&!basisIsIndicative)?r3SoyBasisTrend(cost.port,j,reportDate).wow:null,
          mom:(!cashObserved&&!basisIsIndicative)?r3SoyBasisTrend(cost.port,j,reportDate).mom:null
        });
      }
      assemble(cost.route||r3Options('Soybean',e.city).frete!=null?'T':'—',cost.frete);
      var railCity=null,railCorredor=null;
      if(cost.port==='Santos'&&e.city==='Rondonópolis - MT'){railCity='Rondonópolis';railCorredor='MT Sul';}
      if(cost.port==='Santos'&&e.city==='Rio Verde - GO'){railCity='Rio Verde';railCorredor='GO Sudoeste';}
      if(railCity&&typeof railLegByCity==='function'&&fx!=null&&cost.fobbins!=null){
        var mm=PPE_MESES_DOL[j.mes-1],rail=railLegByCity(railCity,mm,cost.port,railCorredor);
        if(valid(rail)&&Number(rail)>0)assemble('T+R',50+Number(rail));
      }
    });
  });
  return all;
}
function r3OpenPrintWindow(title, body, opt){
  opt=opt||{};
  var w=window.open('', '_blank', 'noopener,noreferrer');
  if(!w){ alert(ppeL('O navegador bloqueou a janela de impressão/PDF. Libere pop-ups e tente novamente.','The browser blocked the print/PDF window. Please allow pop-ups and try again.')); return; }
  var orientation=opt.orientation||'landscape';
  var css='@page{size:A4 '+orientation+';margin:10mm;}body{font-family:Arial,Helvetica,sans-serif;color:#243648;margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}'+
    '.wrap{padding:0 2px 8px 2px}.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1A3A5C;padding-bottom:8px;margin-bottom:14px}.ttl{font-size:24px;font-weight:800;color:#10283A;letter-spacing:-0.2px}.sub{font-size:12px;color:#6B7280;margin-top:4px}.dt{font-size:13px;font-weight:700;color:#1A3A5C;white-space:nowrap}'+
    '.blk{break-inside:avoid;page-break-inside:avoid;border:1px solid #D7DEE7;border-radius:12px;padding:12px 14px 14px 14px;margin:0 0 12px 0}.blk-title{display:flex;justify-content:space-between;gap:8px;align-items:flex-end;margin-bottom:8px}.blk-title h3{margin:0;font-size:19px;color:#10283A}.blk-title .meta{font-size:11px;color:#6B7280}.meta-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 10px 0}.meta-kpi{background:#F6F8FB;border:1px solid #E4EAF1;border-radius:10px;padding:7px 8px}.meta-kpi .k{font-size:10px;font-weight:700;color:#647084;text-transform:uppercase;letter-spacing:.02em}.meta-kpi .v{font-size:14px;font-weight:700;color:#10283A;margin-top:2px}.meta-kpi .n{font-size:10px;color:#7B8794;margin-top:2px}'+
    'table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border-bottom:1px solid #E5E7EB;padding:7px 8px;vertical-align:top}th{background:#F2F5F9;color:#647084;border-bottom:2px solid #203D5C;font-size:10.2px;line-height:1.15;text-transform:none;text-align:right}td{font-size:11px;line-height:1.18;text-align:right;color:#35465A}th.l,td.l{text-align:left}.note{display:block;font-size:9.2px;line-height:1.18;color:#7B8794;margin-top:2px}.z{color:#98A2B3}.pos{color:#009E55;font-weight:700}.neg{color:#D71920;font-weight:700}.strong{font-weight:800;color:#10283A}.foot{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E5E7EB;margin-top:14px;padding-top:8px;font-size:10.5px;color:#9CA3AF}.newpage{page-break-before:always}.nowrap{white-space:nowrap}';
  if(opt.extraCss) css+=opt.extraCss;
  var html='<!doctype html><html><head><meta charset="utf-8"><title>'+title+'</title><style>'+css+'</style></head><body><div class="wrap">'+body+'</div></body></html>';
  w.document.open();
  w.document.write(html);
  w.document.close();
  var once=false;
  var kick=function(){ if(once) return; once=true; setTimeout(function(){ try{ w.focus(); w.print(); }catch(e){} }, 250); };
  w.onload=kick;
  setTimeout(kick, 800);
}
function r3ExportCard(card){
  if(!card) return;
  var exportId=card.getAttribute('data-r3-export')||card.id||'';
  function makeFrame(width){
    var frame=document.createElement('div');
    frame.style.cssText='position:fixed;left:-99999px;top:0;width:'+width+'px;background:#ffffff;padding:24px 26px 18px;border-radius:18px;box-shadow:none;color:#243648;font-family:Arial,Helvetica,sans-serif;z-index:-1;';
    var brand=document.createElement('div');
    brand.style.cssText='display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #1A3A5C;';
    brand.innerHTML='<div><div style="font-size:17px;font-weight:800;color:#10283A;letter-spacing:-0.2px">'+r3E((card.querySelector('.a-card-t')||{}).textContent||'Report')+'</div><div style="font-size:11px;color:#6B7280;margin-top:3px">'+r3E((card.querySelector('.p-card-s')||{}).textContent||'')+'</div></div><div style="text-align:right"><div style="font-size:11px;font-weight:700;color:#1A3A5C">AGRINVEST</div><div style="font-size:10px;color:#647084">'+r3E(r3RefDate())+'</div></div>';
    frame.appendChild(brand);
    document.body.appendChild(frame);
    return frame;
  }
  function finishExport(node){
    var cleanup=function(){ try{node.remove();}catch(e){} };
    var startScale=Math.min(3, window.devicePixelRatio>1?2.2:2);
    function attempt(scale){
      html2canvas(node,{backgroundColor:'#ffffff',scale:scale,useCORS:true,logging:false,windowWidth:node.scrollWidth,windowHeight:node.scrollHeight}).then(function(canvas){
        var url=canvas.toDataURL('image/png');
        var a=document.createElement('a');a.href=url;a.download=(exportId||'report')+'_'+r3RefDate()+'.png';document.body.appendChild(a);a.click();a.remove();cleanup();
      }).catch(function(err){
        if(scale>1.2) attempt(Math.max(1.1,scale-0.4)); else { cleanup(); alert(ppeL('Não foi possível exportar a imagem.','Unable to export image.')); console.error(err); }
      });
    }
    attempt(startScale);
  }
  function num(n,d){ return n===null||n===undefined||!Number.isFinite(Number(n))?'—':r3F(Number(n),d); }
  function diff(n){ return n===null||n===undefined||!Number.isFinite(Number(n))?'—':((Number(n)>0?'+':'')+r3F(Number(n),0)); }
  function cls(n){ return n===null||n===undefined||!Number.isFinite(Number(n))?'z':(Number(n)>0?'pos':(Number(n)<0?'neg':'')); }

  if(exportId==='r3-card-soy'){
    var rows=r3ExportSoyRows();
    var byCity={};
    rows.forEach(function(r){ (byCity[r.region]=byCity[r.region]||[]).push(r); });
    var cityOrder=r3VisibleCities('Soybean').map(function(e){return e.city;}).filter(function(c){return byCity[c]&&byCity[c].length;});
    var blocks='';
    cityOrder.forEach(function(city,idx){
      var arr=byCity[city].slice();
      if(!arr.length) return;
      var base=arr[0], lastShip=null, shipToggle=false;
      blocks+=(idx?'<div class="newpage"></div>':'')+'<div class="head"><div><div class="ttl">Prices reported by Agrinvest Desk</div></div><div style="text-align:right"><div class="dt">AGRINVEST COMMODITIES</div><div class="sub">A Division of Marex</div></div></div>';
      blocks+='<section class="blk"><div class="blk-title"><div><h3>'+r3E(city.replace(' - ',' · '))+'</h3><div class="meta">'+r3E(base.uf||'')+' | Port: '+r3E(base.port||'—')+' | '+r3E(ppeFmtBR(r3RefDate()))+'</div></div></div>';
      blocks+='<table><thead><tr><th class="l" style="width:14%">Origin</th><th class="l" style="width:12%">Shipment</th><th style="width:8%">CBOT</th><th style="width:11%">Cash R$/sc</th><th style="width:10%">Freight R$/t</th><th class="l" style="width:7%">Mode</th><th class="l" style="width:10%">Port</th><th style="width:9%">FOB c/b</th><th style="width:10%">CFR China c/b</th><th style="width:9%">Basis CFR China</th><th style="width:10%">Gross Margin</th></tr></thead><tbody>';
      arr.forEach(function(r){
        if(lastShip!==r.ship){shipToggle=!shipToggle;lastShip=r.ship;}
        var bg=shipToggle?'#FFFFFF':'#F6F8FB';
        blocks+='<tr style="background:'+bg+'">'+
          '<td class="l strong">'+r3E(r.region.replace(' - ',' · '))+'<span class="note">'+r3E(r.uf||'')+'</span></td>'+
          '<td class="l strong">'+r3E(r.ship)+'<span class="note">'+r3E(r.contract||'')+'</span></td>'+
          '<td>'+r3E(num(r.cbot,1))+'</td>'+
          '<td>'+r3E(num(r.cash,2))+'<span class="note">'+r3E(r.cashType||'')+(r.indicative?(' · '+ppeL('PPE indicativa','Indicative PPE')):'')+(r.physicalNote?(' · '+r.physicalNote):'')+'</span></td>'+
          '<td>'+r3E(num(r.freight,0))+'</td>'+
          '<td class="l">'+r3E(r.modal||'—')+'</td>'+
          '<td class="l">'+r3E(r.port||'—')+'</td>'+
          '<td>'+r3E(num(r.fob,0))+'</td>'+
          '<td>'+r3E(num(r.cfr,0))+'</td>'+
          '<td>'+r3E(num(r.chinaBasis,0))+'</td>'+
          '<td class="'+cls(r.margin)+'">'+r3E(diff(r.margin))+'</td>'+
        '</tr>';
      });
      blocks+='</tbody></table><div class="foot"><div>BRZ Replacement Engine</div><div>'+r3E(ppeFmtBR(r3RefDate()))+'</div></div></section>';
    });
    r3OpenPrintWindow('Replacement Soja · '+r3RefDate(), blocks, {orientation:'portrait', extraCss:'.blk{border:none;border-radius:0;padding:0;margin:0 0 10px 0}.head{margin-bottom:10px}.blk-title h3{font-size:16px}.blk-title .meta{font-size:10.2px}.wrap{padding:0 2px 8px 2px}table{font-size:10.2px}th,td{padding:5px 5px}th{font-size:9.2px}td{font-size:9.8px}.note{font-size:8.4px}.foot{font-size:9.4px}.ttl{font-size:20px}'});
    return;
  }

  if(exportId==='r3-card-Soymeal' || exportId==='r3-card-Soyoil'){
    var prod=(exportId==='r3-card-Soymeal'?'Soymeal':'Soyoil');
    var frame=makeFrame(1640);
    var rowsD=r3ExportDerivRows(prod);
    var title=(prod==='Soymeal'?ppeL('Soymeal Replacement','Soymeal Replacement'):ppeL('Soyoil Replacement','Soyoil Replacement'));
    var basisUnit=(prod==='Soymeal'?'US$/st':'¢/lb');
    var mealCol=prod==='Soymeal';
    var table='<div style="font-size:24px;font-weight:800;color:#10283A;letter-spacing:-0.2px;margin-bottom:10px">'+r3E(title)+'</div>';
    table+='<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:11.1px;color:#35465A"><thead><tr>'+
      '<th style="width:'+(mealCol?'16':'19')+'%;background:#F2F5F9;padding:9px 8px;border-bottom:2px solid #203D5C;color:#647084;text-align:left">'+r3E(ppeL('Origin','Origin'))+'</th>'+
      '<th style="width:'+(mealCol?'10':'12')+'%;background:#F2F5F9;padding:9px 8px;border-bottom:2px solid #203D5C;color:#647084;text-align:left">'+r3E(ppeL('Port','Port'))+'</th>'+
      '<th style="width:'+(mealCol?'10':'12')+'%;background:#F2F5F9;padding:9px 8px;border-bottom:2px solid #203D5C;color:#647084;text-align:right">'+r3E(ppeL('Price R$/t','Price BRL/t'))+'</th>'+
      '<th style="width:'+(mealCol?'10':'12')+'%;background:#F2F5F9;padding:9px 8px;border-bottom:2px solid #203D5C;color:#647084;text-align:right">'+r3E(ppeL('Freight R$/t','Freight BRL/t'))+'</th>'+
      '<th style="width:'+(mealCol?'11':'14')+'%;background:#F2F5F9;padding:9px 8px;border-bottom:2px solid #203D5C;color:#647084;text-align:right">'+r3E(ppeL('FOB port R$/t','FOB port BRL/t'))+'</th>'+
      '<th style="width:'+(mealCol?'8':'10')+'%;background:#F2F5F9;padding:9px 8px;border-bottom:2px solid #203D5C;color:#647084;text-align:right">FX R$/US$</th>'+
      '<th style="width:'+(mealCol?'12':'12')+'%;background:#F2F5F9;padding:9px 8px;border-bottom:2px solid #203D5C;color:#647084;text-align:right">Replacement FOB US$/t</th>'+
      '<th style="width:'+(mealCol?'7':'9')+'%;background:#F2F5F9;padding:9px 8px;border-bottom:2px solid #203D5C;color:#647084;text-align:right">Basis '+basisUnit+'</th>'+
      (mealCol?'<th style="width:5%;text-align:right">D-1</th><th style="width:5%;text-align:right">D-7</th><th style="width:5%;text-align:right">D-30</th>':'')+
    '</tr></thead><tbody>';
    rowsD.forEach(function(r,i){
      if(r.isTrade && (i===0 || !rowsD[i-1].isTrade))table+='<tr><td colspan="'+(mealCol?'11':'8')+'" style="background:#DBEAFE;color:#173B5D;text-align:left;padding:11px;font-weight:800;letter-spacing:.4px">'+r3E(ppeL('NEGÓCIOS FECHADOS · MESA AGRINVEST','CLOSED TRADES · AGRINVEST DESK'))+' · '+r3E(ppeFmtBR(r3RefDate()))+'</td></tr>';
      var bg=(i%2===0?'#FFFFFF':'#FAFBFD');
      table+='<tr style="background:'+bg+'">'+
        '<td style="padding:8px 8px;border-bottom:1px solid #E5E7EB;text-align:left;vertical-align:top"><b>'+r3E(r.city.replace(' - ',' · '))+'</b><div style="font-size:9.2px;color:#7B8794;margin-top:2px">'+r3E(r.region||'')+(r.isTrade?'<div style="font-size:9px;line-height:1.3">'+r3E(r.seller+' → '+r.buyer)+' · '+r3E(r.volume)+' t</div>':'')+'</div></td>'+
        '<td style="padding:8px 8px;border-bottom:1px solid #E5E7EB;text-align:left;vertical-align:top">'+r3E(r.port||'—')+'</td>'+
        '<td style="padding:8px 8px;border-bottom:1px solid #E5E7EB;text-align:right;vertical-align:top">'+r3E(num(r.phys,2))+'<div style="font-size:9.2px;color:#7B8794;margin-top:2px">'+r3E(r.physNote||'')+'</div></td>'+
        '<td style="padding:8px 8px;border-bottom:1px solid #E5E7EB;text-align:right;vertical-align:top">'+r3E(num(r.frete,2))+'<div style="font-size:9.2px;color:#7B8794;margin-top:2px">'+r3E(r.freightSource||'')+'</div></td>'+
        '<td style="padding:8px 8px;border-bottom:1px solid #E5E7EB;text-align:right;vertical-align:top"><b>'+r3E(num(r.fobPortR,2))+'</b></td>'+
        '<td style="padding:8px 8px;border-bottom:1px solid #E5E7EB;text-align:right;vertical-align:top">'+r3E(num(r.fx,4))+'<div style="font-size:9.2px;color:#7B8794;margin-top:2px">'+r3E(r.fxKey||'')+'</div></td>'+
        '<td style="padding:8px 8px;border-bottom:1px solid #E5E7EB;text-align:right;vertical-align:top;background:#EEF4FB;font-weight:800;color:#10283A">'+r3E(num(r.replacement,2))+'</td>'+
        '<td style="padding:8px 8px;border-bottom:1px solid #E5E7EB;text-align:right;vertical-align:top;font-weight:800;color:#10283A">'+r3E(r3DerivativeBasisFormatted(r.basis,prod))+'<div style="font-size:9.2px;color:#7B8794;margin-top:2px">'+(r.cbContract?r3E(r.cbContract+' · '+num(r.cbPrice,prod==='Soymeal'?1:2)):'')+'</div></td>'+
        (mealCol?['d1','d7','d30'].map(function(k){return '<td style="text-align:right;border-bottom:1px solid #E5E7EB;padding:8px 4px">'+r3E(r3MealDeltaFormat(r.mealDeltas&&r.mealDeltas[k]))+'</td>';}).join(''):'')+
      '</tr>';
    });
    if(!rowsD.length) table+='<tr><td colspan="'+(mealCol?'11':'8')+'" style="padding:16px;color:#98A2B3;text-align:center">'+r3E(ppeL('Sem dados','No data'))+'</td></tr>';
    table+='</tbody></table>';
    frame.innerHTML+=table;
    var foot=document.createElement('div');
    foot.style.cssText='display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E5E7EB;margin-top:12px;padding-top:8px;font-size:10.5px;color:#9CA3AF';
    foot.innerHTML='<span>BRZ Replacement Engine</span><span style="font-size:13px;font-weight:700;color:#1A3A5C">'+r3E(ppeFmtBR(r3RefDate()))+'</span>';
    frame.appendChild(foot);
    finishExport(frame);
    return;
  }

  var wide=card.classList.contains('r3-card') || card.querySelector('.a-tab-table');
  var frame=makeFrame(wide?2240:1460);
  var clone=card.cloneNode(true);
  clone.querySelectorAll('.brz-cam,.brz-add,.a-exp,.r3-fxlabel,.r3-fisicoedit,.r3-noexport').forEach(function(x){x.remove();});
  clone.querySelectorAll('.r3-exportval').forEach(function(x){x.style.display='inline-block';});
  clone.style.border='none'; clone.style.boxShadow='none'; clone.style.margin='0'; clone.style.background='transparent'; clone.style.borderRadius='0';
  var hd=clone.querySelector('.r3-head'); if(hd) hd.remove();
  var cfoot=clone.querySelector('.r3-foot'); if(cfoot) cfoot.remove();
  var wrap=clone.querySelector('.r3-scroll');
  if(wrap){wrap.style.cssText='overflow:visible!important;max-width:none;height:auto;max-height:none;border:none;padding:0;';}
  var table=clone.querySelector('table');
  if(table){
    table.style.width='100%'; table.style.minWidth='0'; table.style.maxWidth='none'; table.style.tableLayout=wide?'fixed':'auto'; table.style.borderCollapse='collapse'; table.style.fontSize=wide?'11px':'12px';
    table.querySelectorAll('th').forEach(function(th){th.style.background='#FFFFFF'; th.style.color='#6B7280'; th.style.borderBottom='2px solid #1A3A5C'; th.style.padding='9px 8px'; th.style.fontSize=wide?'9.8px':'10.2px'; th.style.fontWeight='700'; th.style.textTransform='none'; th.style.whiteSpace='normal'; th.style.lineHeight='1.15'; th.style.textAlign=th.cellIndex<2?'left':'right';});
    table.querySelectorAll('td').forEach(function(td){td.style.padding='9px 8px'; td.style.borderBottom='1px solid #E5E7EB'; td.style.whiteSpace='normal'; td.style.lineHeight='1.22'; td.style.textAlign=(td.classList.contains('r3-l')||td.classList.contains('r3-sticky'))?'left':'right'; td.style.verticalAlign='middle';});
    clone.querySelectorAll('tbody tr:nth-child(even) td').forEach(function(td){td.style.background='#FAFBFC';});
    clone.querySelectorAll('.r3-strong').forEach(function(td){td.style.background='#EEF4FB'; td.style.color='#10283A'; td.style.fontWeight='800';});
    clone.querySelectorAll('small').forEach(function(sm){sm.style.display='block'; sm.style.fontSize='9.5px'; sm.style.color='#6B7280'; sm.style.lineHeight='1.25'; sm.style.marginTop='3px';});
    clone.querySelectorAll('.r3-sticky').forEach(function(td){td.style.position='static'; td.style.left='auto';});
    clone.querySelectorAll('.r3-blank').forEach(function(el){el.style.color='#9CA3AF'; el.style.fontWeight='600';});
  }
  frame.appendChild(clone);
  var foot=document.createElement('div');
  foot.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid #E5E7EB;font-size:11px;color:#6B7280';
  foot.innerHTML='<span style="white-space:nowrap">BRZ Replacement Engine</span><span style="font-size:13px;font-weight:700;color:#1A3A5C;white-space:nowrap">'+r3E(r3RefDate())+'</span>';
  frame.appendChild(foot);
  finishExport(frame);
}
function r3InitCameras(host){if(!host||host.dataset.r3CameraReady)return;host.dataset.r3CameraReady='1';host.addEventListener('click',function(ev){var b=ev.target.closest&&ev.target.closest('.brz-cam'),c=b&&b.closest('.r3-card');if(!c)return;ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();r3ExportCard(c);},true);}
function renderReportDerivados(){ try{ r3ApplyFileHidden(); }catch(_rh){}var host=document.getElementById('rep-derivados');if(!host)return;host.removeAttribute('data-no-i18n');var ref=r3RefDate(),meta=r3Data().meta||{};var side=['bid','trade','offer'].map(function(k){return '<button type="button" class="rep-gbtn'+(R3_SIDE===k?' on':'')+'" onclick="r3SetSide(\''+k+'\')">'+({bid:ppeL('Bid','Bid'),trade:ppeL('Trade Level','Trade Level'),offer:ppeL('Offer','Offer')}[k])+'</button>';}).join('');var top='<div class="r3-intro"><div><div class="r3-eyebrow">'+ppeL('REPORT / ÓLEO & FARELO','REPORT / OIL & MEAL')+'</div><h2>'+ppeL('Replacement · Complexo soja','Replacement · Soy complex')+'</h2><p>'+ppeL('Físico SPOT → FOB equivalente para derivados · PPE por embarque para soja','SPOT cash → equivalent FOB for derivatives · export parity by shipment for soybeans')+'</p></div><div class="r3-actions"><span class="r3-muted">'+ppeL('PPE soja:','Soybean parity:')+'</span><div class="rep-granbar">'+side+'</div><button class="rep-gbtn" type="button" onclick="r3CSV()">CSV</button></div></div>';var kpis='<div class="r3-kpis">'+r3Kpi(ppeL('Curva CBOT / B3','CBOT / B3 curve'),state._marketSnapshotId||'C2','')+r3Kpi(ppeL('Físico derivados','Derivatives cash market'),ppeFmtBR(meta.ultimaData||'2026-10-14'),ppeL('SPOT · CMA / Excel','SPOT · CMA / Excel'))+r3Kpi(ppeL('Fretes rodoviários','Truck freight'),ppeRotasPorPorto().semana,ppeL('parâmetro herdado da soja','soybean-derived parameter'))+'</div>';var notes='<div class="r3-notes"><b>'+ppeL('Metodologia:','Methodology:')+'</b> '+ppeL('Farelo/óleo: tabela de praças SPOT + seção automática de negócios FECHADOS do dia, quando existirem. Casca de soja não é farelo. Negócios CIF sem origem/frete até o porto mantêm replacement em aberto; o frete pode ser preenchido manualmente para simulação indicativa. Outros traders nunca entram na base HTML. Fórmula: (físico diferido + frete R$/t) ÷ DOL + fobbings US$/t; não exige basis FOB. Frete S43 editável; Cambé utiliza proxy Londrina identificado. Sem físico ou frete, replacement em aberto. Soja: físico do dia prevalece; PPE usa o basis direto ou benchmark FOB Paranaguá explicitamente identificado, sempre com frete da rota escolhida e data original. Datas diferentes ou janela aproximada são identificadas como indicativas; nenhum prêmio arbitrário em janeiro.','Meal/oil = (deferred SPOT + truck freight BRL/t) ÷ FX + fobbings US$/t; no FOB basis needed. S43 freight editable; Cambé uses labeled Londrina proxy. Without valid cash/freight, replacement remains blank. Soybean: same-day cash takes precedence; PPE carries the latest registered own-port shipment basis until the shipment expires. Mixed-date sides and nearest-window proxies are flagged indicative. No arbitrary January basis.')+'</div>';host.innerHTML=top+kpis+r3DerivTable('Soymeal',ppeL('01 · Replacement Farelo','01 · Soymeal Replacement'))+r3DerivTable('Soyoil',ppeL('02 · Replacement Óleo','02 · Soyoil Replacement'))+r3SoyTable()+notes;r3InitCameras(host);try{if(typeof brzAddCamButtons==='function')brzAddCamButtons(host);}catch(e){} }

