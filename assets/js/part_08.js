
var BRZ_EXPORT_BRAND={name:'AGRINVEST COMMODITIES',sub:'A Division of Marex'};
function _brzEsc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function _brzSlug(s){return String(s||'card').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40)||'card';}
function _brzCardTitle(card){
  var t=card.querySelector('.p-card-t, .a-card-t, .idc-card-t');
  if(!t){ var p=card.previousElementSibling; while(p){ if(p.classList&&p.classList.contains('idc-sec-t')){t=p;break;} p=p.previousElementSibling; } }
  if(!t) return 'BRZ';
  var c=t.cloneNode(true);
  var rm=c.querySelectorAll('button, select, input, .a-tag, .brz-cam, svg'); for(var i=0;i<rm.length;i++)rm[i].remove();
  return (c.textContent||'').replace(/\s+/g,' ').trim()||'BRZ';
}

function _brzExportMeta(card){
  if(card&&card.classList&&card.classList.contains('pff-card')) return {isRpc:false,title:card.getAttribute('data-export-title')||'',sub:card.getAttribute('data-export-sub')||''}; /* V4BH */
  var isRpc=!!(card && (card.querySelector('.rpc-table') || (card.closest && card.closest('#corredores'))));
  var title=_brzCardTitle(card), sub='';
  var sEl=card?card.querySelector('.p-card-s'):null;
  if(isRpc){
    if(card&&card.classList&&card.classList.contains('rpm-state-card')){
      var uf=card.getAttribute('data-rpm-state')||'';
      title=(uf?uf+' — ':'')+'Port replacement — shipment windows reported by Agrinvest Desk';
    }else{
      title=(card&&card.querySelector&&card.querySelector('.rpm-matrix'))?'Port replacement — shipment windows reported by Agrinvest Desk':'Replacement by Port reported by Agrinvest Desk';
    }
    sub='';
  }else{
    sub=sEl?sEl.textContent.trim():'';
  }
  return {isRpc:isRpc,title:title,sub:sub};
}
function brzAddCamButtons(root){
  try{
    var scope=(root&&root.querySelectorAll)?root:document;
    var cards=scope.querySelectorAll('.p-card, .a-card, .idc-card, .fd-card');
    for(var i=0;i<cards.length;i++){
      var card=cards[i];
      try{ if(getComputedStyle(card).position==='static') card.style.position='relative'; }catch(e){ card.style.position='relative'; }
      if(!card.querySelector(':scope > .brz-cam')){
        var b=document.createElement('button');
        b.className='brz-cam'; b.title=(typeof _currentLang!=='undefined' && _currentLang==='en')?'Export standardized PNG (report)':'Exportar PNG padronizado (relatório)';
        b.onclick=function(ev){ ev.stopPropagation(); brzExportCard(this); };
        b.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
        card.appendChild(b);
      }
      if(!card.querySelector(':scope > .brz-add')){
        var ad=document.createElement('button');
        ad.className='brz-add'; ad.title=(typeof _currentLang!=='undefined' && _currentLang==='en')?'Add to DOCX report':'Marcar para o relatório DOCX';
        ad.setAttribute('data-title', _brzCardTitle(card));
        ad.onclick=function(ev){ ev.stopPropagation(); var c=this.closest('.p-card, .a-card, .idc-card, .fd-card'); brzToggleMark(c, this); };
        card.appendChild(ad);
        _brzPaintAdd(ad, _brzFindMark(_brzCardTitle(card))>=0);
      }
    }
  }catch(e){}
}


function _brzExportPaintDeltaTable(root){
  try{
    if(!root||!root.querySelectorAll) return;
    var tables=root.querySelectorAll('table');
    function _paintCell(td,color,isEmpty){
      if(!td) return;
      td.style.setProperty('color',color,'important');
      td.style.setProperty('-webkit-text-fill-color',color,'important');
      td.style.setProperty('opacity','1','important');
      td.style.setProperty('font-weight',isEmpty?'500':'700','important');
      var nodes=td.querySelectorAll('*');
      for(var ni=0;ni<nodes.length;ni++){
        nodes[ni].style.setProperty('color',color,'important');
        nodes[ni].style.setProperty('-webkit-text-fill-color',color,'important');
        nodes[ni].style.setProperty('opacity','1','important');
        nodes[ni].style.setProperty('font-weight',isEmpty?'500':'700','important');
        nodes[ni].setAttribute('data-export-color',color);
      }
      td.setAttribute('data-export-color',color);
    }
    function _isVarHead(txt){
      txt=(txt||'').replace(/\s+/g,' ').trim().toUpperCase();
      return txt==='DOD'||txt==='WOW'||txt==='MOM'||txt==='Δ FOB'||txt==='DELTA FOB'||txt==='VAR. DOD'||txt==='VAR DOD'||txt==='VAR. WOW'||txt==='VAR WOW'||txt==='VAR. MOM'||txt==='VAR MOM'||txt.indexOf(' DOD')>-1||txt.indexOf(' WOW')>-1||txt.indexOf(' MOM')>-1||txt.indexOf('Δ FOB')>-1||txt.indexOf('DELTA FOB')>-1;
    }
    var forced=root.querySelectorAll('[data-export-color]');
    for(var fi=0;fi<forced.length;fi++){
      var fc=forced[fi].getAttribute('data-export-color')||'#10283A';
      _paintCell(forced[fi],fc,(forced[fi].textContent||'').trim()==='—');
    }
    for(var ti=0;ti<tables.length;ti++){
      var tbl=tables[ti];
      var hs=tbl.querySelectorAll('thead th');
      if(!hs||!hs.length) continue;
      var idxs=[];
      for(var hi=0;hi<hs.length;hi++){
        var h=(hs[hi].textContent||'');
        if(_isVarHead(h)) idxs.push(hi);
      }
      if(!idxs.length) continue;
      var rows=tbl.querySelectorAll('tbody tr');
      for(var ri=0;ri<rows.length;ri++){
        var cells=rows[ri].children||[];
        for(var ii=0;ii<idxs.length;ii++){
          var ci=idxs[ii], td=cells[ci];
          if(!td) continue;
          var tx=(td.textContent||'').replace(/\s+/g,' ').trim();
          var forcedColor=td.getAttribute&&td.getAttribute('data-export-color');
          if(forcedColor){ _paintCell(td,forcedColor,(!tx||tx==='–'||tx==='-'||tx==='—')); continue; }
          if(!tx||tx==='–'||tx==='-'||tx==='—'){
            _paintCell(td,'#6B7280',true);
            continue;
          }
          var raw=tx.replace(/−/g,'-').replace(/[^0-9+\-.,]/g,'');
          var num=NaN;
          if(raw==='0'||raw==='+0'||raw==='0,0'||raw==='0.0'||raw==='0,00'||raw==='0.00'){ num=0; }
          else if(raw.charAt(0)==='+'){ num=1; }
          else if(raw.charAt(0)==='-'){ num=-1; }
          else if(tx.indexOf('▲')>-1 || tx.indexOf('▴')>-1 || tx.indexOf('🔺')>-1){ num=1; }
          else if(tx.indexOf('▼')>-1 || tx.indexOf('▾')>-1 || tx.indexOf('🔻')>-1){ num=-1; }
          else {
            var norm=raw;
            if(norm.indexOf(',')>-1 && norm.indexOf('.')>-1) norm=norm.replace(/\./g,'').replace(',','.');
            else norm=norm.replace(',','.');
            num=parseFloat(norm);
          }
          var color=(num<0?'#16A34A':(num>0?'#DC2626':'#6B7280'));
          if(isNaN(num)) color='#10283A';
          _paintCell(td,color,false);
        }
      }
    }
  }catch(e){}
}


function _brzSyncLiveDeltaColors(srcCard, clone){
  try{
    if(!srcCard||!clone) return;
    var srcTable = srcCard.querySelector('.a-tab-table');
    var dstTable = clone.querySelector('.a-tab-table');
    if(!srcTable || !dstTable) return;
    var srcHeads = srcTable.querySelectorAll('thead th');
    var dstHeads = dstTable.querySelectorAll('thead th');
    if(!srcHeads.length || !dstHeads.length) return;
    function _isVarHead(txt){
      txt=(txt||'').replace(/\s+/g,' ').trim().toUpperCase();
      return txt==='DOD'||txt==='WOW'||txt==='MOM'||txt==='Δ FOB'||txt==='DELTA FOB'||txt==='VAR. DOD'||txt==='VAR DOD'||txt==='VAR. WOW'||txt==='VAR WOW'||txt==='VAR. MOM'||txt==='VAR MOM'||txt.indexOf(' DOD')>-1||txt.indexOf(' WOW')>-1||txt.indexOf(' MOM')>-1||txt.indexOf('Δ FOB')>-1||txt.indexOf('DELTA FOB')>-1;
    }
    var idxs=[];
    for(var i=0;i<Math.min(srcHeads.length,dstHeads.length);i++){
      if(_isVarHead(srcHeads[i].textContent||'')) idxs.push(i);
    }
    if(!idxs.length) return;
    var srcRows=srcTable.querySelectorAll('tbody tr');
    var dstRows=dstTable.querySelectorAll('tbody tr');
    var rlim=Math.min(srcRows.length,dstRows.length);
    for(var r=0;r<rlim;r++){
      for(var j=0;j<idxs.length;j++){
        var ci=idxs[j];
        var sCell=srcRows[r].children[ci];
        var dCell=dstRows[r].children[ci];
        if(!sCell || !dCell) continue;
        var sc=getComputedStyle(sCell).color;
        var sw=getComputedStyle(sCell).fontWeight;
        if(sc){
          dCell.style.setProperty('color', sc, 'important');
          dCell.style.setProperty('-webkit-text-fill-color', sc, 'important');
          dCell.style.setProperty('font-weight', sw||'700', 'important');
          dCell.setAttribute('data-export-color', sc);
          var sn=sCell.querySelectorAll('*'), dn=dCell.querySelectorAll('*');
          for(var k=0;k<Math.min(sn.length,dn.length);k++){
            var nc=getComputedStyle(sn[k]).color || sc;
            var nw=getComputedStyle(sn[k]).fontWeight;
            dn[k].style.setProperty('color', nc, 'important');
            dn[k].style.setProperty('-webkit-text-fill-color', nc, 'important');
            dn[k].style.setProperty('font-weight', nw||sw||'700', 'important');
            dn[k].setAttribute('data-export-color', nc);
          }
        }
      }
    }
  }catch(e){}
}


function _brzExportWaitStableLayout(){
  var waitFonts; try{ waitFonts=(document.fonts&&document.fonts.ready)||Promise.resolve(); }catch(e){ waitFonts=Promise.resolve(); }
  return Promise.resolve(waitFonts).catch(function(){}).then(function(){
    return new Promise(function(resolve){
      var raf=window.requestAnimationFrame||function(cb){ return setTimeout(cb,16); };
      raf(function(){ raf(function(){ setTimeout(resolve,28); }); });
    });
  });
}
function _brzPrettyRegionLabel(v){
  return String(v||'').trim().replace(/^([A-Z]{2})(?! )([^A-Z].*)$/,'$1 $2').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Z])([A-Z][a-z])/g,'$1 $2').replace(/\s+/g,' ').trim();
}
function _brzStabilizeAnalysisExportTable(srcCard, clone, isTradesCard){
  try{
    var table=clone&&clone.querySelector?clone.querySelector('.a-tab-table'):null;
    if(!table) return {table:null,wrap:null,width:0};
    var wrap=clone.querySelector('.a-tab-wrap-export')||clone.querySelector('.a-tab-wrap')||table.parentElement||null;
    var srcTable=srcCard&&srcCard.querySelector?srcCard.querySelector('.a-tab-table'):null;
    var srcHeads=srcTable?srcTable.querySelectorAll('thead tr:first-child th'):[];
    var dstHeads=table.querySelectorAll('thead tr:first-child th');
    var minWidths=[92,92,108,106,96,84,158,102,134,100,112,78,78,78];
    var widths=[]; var total=0;
    for(var i=0;i<dstHeads.length;i++){
      var sw=0;
      if(srcHeads&&srcHeads[i]) sw=Math.max(srcHeads[i].getBoundingClientRect().width||0, srcHeads[i].offsetWidth||0);
      if(!sw && dstHeads[i]) sw=Math.max(dstHeads[i].getBoundingClientRect().width||0, dstHeads[i].offsetWidth||0);
      var w=Math.max(minWidths[i]||84, Math.ceil(sw*1.16)+(i>=11?8:14));
      widths.push(w); total+=w;
    }
    if(widths.length){
      var oldCg=table.querySelector('colgroup'); if(oldCg&&oldCg.parentNode) oldCg.parentNode.removeChild(oldCg);
      var cg=document.createElement('colgroup');
      for(var c=0;c<widths.length;c++){ var col=document.createElement('col'); col.style.width=widths[c]+'px'; cg.appendChild(col); }
      table.insertBefore(cg, table.firstChild);
      table.style.width=total+'px';
      table.style.minWidth=total+'px';
      table.style.maxWidth='none';
      table.style.tableLayout='fixed';
      table.style.borderCollapse='separate';
      table.style.borderSpacing='0';
      if(wrap){
        wrap.style.width=total+'px';
        wrap.style.minWidth=total+'px';
        wrap.style.maxWidth='none';
        wrap.style.height='auto';
        wrap.style.minHeight='0';
        wrap.style.maxHeight='none';
        wrap.style.overflow='visible';
      }
    }
    var ths=table.querySelectorAll('th');
    for(var ti=0;ti<ths.length;ti++){
      ths[ti].style.fontSize='10.6px';
      ths[ti].style.lineHeight='1.18';
      ths[ti].style.padding='9px 11px 6px';
      ths[ti].style.whiteSpace='normal';
      ths[ti].style.wordBreak='normal';
      ths[ti].style.overflowWrap='break-word';
      ths[ti].style.letterSpacing='0';
      ths[ti].style.verticalAlign='bottom';
    }
    var unitHeads=table.querySelectorAll('thead tr.a-tab-units th');
    for(var ui=0;ui<unitHeads.length;ui++){
      unitHeads[ui].style.fontSize='8.9px';
      unitHeads[ui].style.lineHeight='1.12';
      unitHeads[ui].style.padding='2px 11px 8px';
    }
    var tds=table.querySelectorAll('td');
    for(var tj=0;tj<tds.length;tj++){
      tds[tj].style.padding='8px 11px';
      tds[tj].style.lineHeight='1.28';
      tds[tj].style.verticalAlign='middle';
      tds[tj].style.whiteSpace='nowrap';
      tds[tj].style.wordBreak='normal';
      tds[tj].style.overflowWrap='normal';
      tds[tj].style.letterSpacing='0';
    }
    var rows=table.querySelectorAll('tbody tr');
    for(var r=0;r<rows.length;r++){
      var cells=rows[r].children||[];
      if(cells[4]){
        var sh=(cells[4].textContent||'').trim();
        if(/^[A-Za-z]{3}\d{2}$/.test(sh)) cells[4].textContent=sh.slice(0,3)+'-'+sh.slice(3);
      }
      if(cells[6]){ cells[6].textContent=_brzPrettyRegionLabel(cells[6].textContent||''); cells[6].style.whiteSpace='normal'; }
      if(cells[7]){ cells[7].style.whiteSpace='normal'; }
    }
    var retW=total || Math.ceil(table.scrollWidth||0) || 0;
    return {table:table,wrap:wrap,width:retW};
  }catch(e){ return {table:null,wrap:null,width:0}; }
}

function brzExportCard(btn){
  var card=btn&&btn.closest?btn.closest('.p-card, .a-card, .idc-card, .fd-card'):null; if(!card){alert('Card não encontrado');return;}
  if(typeof html2canvas==='undefined'){alert('Motor de imagem ainda carregando, tente de novo.');return;}
  var meta=_brzExportMeta(card), title=meta.title, sub=meta.sub, isRpc=meta.isRpc;
  var _isTradesCard=/(?:Trades|Prices) reported by Agrinvest Desk/i.test(title);
  var today=new Date().toISOString().slice(0,10);
  var frame=document.createElement('div');
  frame.className='brz-export-frame';
  var _fix=document.createElement('style');
  _fix.textContent='.brz-export-frame,.brz-export-frame *{font-family:Arial,Helvetica,sans-serif !important;} .brz-export-frame ::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}';
  frame.appendChild(_fix);
  frame.style.cssText='position:fixed;left:-99999px;top:0;width:'+(isRpc?1540:1060)+'px;background:#ffffff;color:#10283A;font-family:Inter,system-ui,-apple-system,Arial,sans-serif;padding:'+(isRpc?'24px 28px':'30px 34px');
  var head='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2.5px solid #1A3A5C;padding-bottom:10px;margin-bottom:16px">'
    +'<div style="flex:1 1 auto;min-width:0;padding-right:14px"><div style="font-size:20px;font-weight:800;line-height:1.12;color:#10283A;letter-spacing:-.1px;word-break:break-word">'+_brzEsc(title)+'</div>'
    +(sub?'<div style="font-size:12.5px;color:#6B7280;margin-top:4px">'+_brzEsc(sub)+'</div>':'')+'</div>'
    +'<div style="flex:0 0 auto;min-width:240px;text-align:right;padding-left:18px"><div style="font-size:12px;font-weight:800;color:#1A3A5C;white-space:nowrap;letter-spacing:0">'+BRZ_EXPORT_BRAND.name+'</div>'
    +'<div style="font-size:11px;color:#6B7280;letter-spacing:.3px;white-space:nowrap">'+BRZ_EXPORT_BRAND.sub+'</div></div></div>';
  frame.innerHTML=head;
  var body=document.createElement('div'); body.style.cssText='position:relative';
  
  var inner=document.createElement('div'); inner.style.cssText='position:relative;z-index:1';
  var clone=card.cloneNode(true);
  var cams=clone.querySelectorAll('.brz-cam, .brz-add, .a-exp'); for(var k=0;k<cams.length;k++)cams[k].remove();
  var ch=clone.querySelector('.p-card-h'); if(ch)ch.remove();
  var ctt=clone.querySelectorAll('.a-card-t, .idc-card-t'); for(var z=0;z<ctt.length;z++)ctt[z].remove();
  var junkSel='.a-note, .a-legend, .a-mp-note, .evo-sum, .rpc-note, button, select, input, .a-cmp, .a-compare, .idc-cmp, .a-ctrls-tbl, .rpm-controls, .ppe-ctrls'+(isRpc?', .p-card-s, .rpc-badge':'');
  var junk=clone.querySelectorAll(junkSel); for(var jj=0;jj<junk.length;jj++)junk[jj].remove(); (function(){var _pp=clone.querySelector('.a-ports');if(_pp){_pp.style.cssText+=';display:block;font-size:0;';var _pcs=_pp.querySelectorAll('.a-portcard');for(var pi=0;pi<_pcs.length;pi++){var pc=_pcs[pi];pc.style.cssText+=';display:inline-block;width:48%;box-sizing:border-box;vertical-align:top;font-size:13px;margin:0 0 10px 0;'+(pi%2===0?'margin-right:3%;':'');var hh=pc.querySelector('.a-portcard-h');if(hh)hh.style.cssText+=';display:block;position:relative;padding-right:78px;';var vv=pc.querySelector('.a-portcard-v');if(vv)vv.style.cssText+=';position:absolute;right:0;top:0;';}}})(); clone.style.border='none'; clone.style.boxShadow='none'; clone.style.margin='0'; clone.style.background='transparent'; clone.style.borderRadius='0';
  if(isRpc){
    var rw=clone.querySelector('.rpc-table-wrap');
    if(rw) rw.style.cssText += ';overflow:visible;max-width:none;border:1px solid #E8ECF2;border-radius:10px;';
    var rt=clone.querySelector('.rpc-table');
    if(rt){
      rt.style.width='100%';
      rt.style.tableLayout='auto';
      rt.style.fontSize='12px';
      var ths=rt.querySelectorAll('th'); for(var ti=0;ti<ths.length;ti++){ths[ti].style.fontSize='9.5px';ths[ti].style.padding='8px 10px';}
      var tds=rt.querySelectorAll('td'); for(var di=0;di<tds.length;di++){tds[di].style.padding='8px 10px';}
    }
  }
  try{
    var _tabWrap=clone.querySelector('.a-tab-wrap');
    var _tabHead=clone.querySelector('.a-tab-headline');
    var _tabNote=clone.querySelector('.a-tab-note');
    if(_tabHead)_tabHead.remove();
    if(_tabNote)_tabNote.remove();
    if(_tabWrap&&_tabWrap.parentNode){
      var _cleanWrap=document.createElement('div');
      _cleanWrap.className='a-tab-wrap-export';
      _cleanWrap.style.cssText='overflow:visible !important;max-width:none;height:auto;max-height:none;border:1px solid #E8ECF2;border-radius:10px;background:#fff;padding-bottom:4px;';
      while(_tabWrap.firstChild){ _cleanWrap.appendChild(_tabWrap.firstChild); }
      _tabWrap.parentNode.replaceChild(_cleanWrap,_tabWrap);
      _tabWrap=_cleanWrap;
    }
    var _tabTable=clone.querySelector('.a-tab-table');
    if(_tabTable){
      _tabTable.style.width='100%';
      _tabTable.style.minWidth='0';
      _tabTable.style.tableLayout='fixed';
      var _ths=_tabTable.querySelectorAll('th'); for(var _i=0;_i<_ths.length;_i++){_ths[_i].style.fontSize='10.2px';_ths[_i].style.lineHeight='1.08';_ths[_i].style.padding='8px 10px 5px';_ths[_i].style.whiteSpace='normal';_ths[_i].style.overflowWrap='anywhere';_ths[_i].style.textAlign='left';}
      var _tds=_tabTable.querySelectorAll('td'); for(var _j=0;_j<_tds.length;_j++){_tds[_j].style.padding='7px 10px';_tds[_j].style.whiteSpace='nowrap';_tds[_j].style.verticalAlign='middle';_tds[_j].style.textAlign='left';}
      var _nums=_tabTable.querySelectorAll('td.num'); for(var _n=0;_n<_nums.length;_n++){_nums[_n].style.textAlign='right';}
      var _deltas=_tabTable.querySelectorAll('td:nth-child(12),td:nth-child(13),td:nth-child(14)'); for(var _d=0;_d<_deltas.length;_d++){_deltas[_d].style.textAlign='center';}
      var _marg=_tabTable.querySelectorAll('td.a-tab-margin'); for(var _m=0;_m<_marg.length;_m++){_marg[_m].style.textAlign='center';}
      var _rows=_tabTable.querySelectorAll('tbody tr');
      for(var _ri=0;_ri<_rows.length;_ri++){
        var _cells=_rows[_ri].children||[];
        if(_cells[4]){ var _sh=(_cells[4].textContent||'').trim(); if(/^[A-Za-z]{3}\d{2}$/.test(_sh)) _cells[4].textContent=_sh.slice(0,3)+'-'+_sh.slice(3); }
        if(_cells[6]){ var _rg=(_cells[6].textContent||'').trim(); _rg=_rg.replace(/^([A-Z]{2})(?! )([^A-Z].*)$/,'$1 $2').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Z])([A-Z][a-z])/g,'$1 $2').replace(/\s+/g,' ').trim(); _cells[6].textContent=_rg; _cells[6].style.whiteSpace='normal'; }
        if(_cells[7]){ _cells[7].style.whiteSpace='normal'; }
      }
      if(_isTradesCard){
        var _tabOnlyTable=_tabTable.cloneNode(true);
        var _cg=_tabOnlyTable.querySelector('colgroup');
        if(_cg){ _cg.parentNode.removeChild(_cg); }
        _tabOnlyTable.style.width='100%';
        _tabOnlyTable.style.minWidth='0';
        _tabOnlyTable.style.tableLayout='auto';
        _tabOnlyTable.style.fontSize='12.1px';
        var _tabOnlyWrap=document.createElement('div');
        _tabOnlyWrap.className='a-tab-wrap-export';
        _tabOnlyWrap.style.cssText='overflow:visible !important;max-width:none;height:auto !important;max-height:none !important;min-height:0;border:1px solid #E8ECF2;border-radius:10px;background:#fff;padding-bottom:0;';
        _tabOnlyWrap.appendChild(_tabOnlyTable);
        clone.innerHTML='';
        clone.appendChild(_tabOnlyWrap);
      }
    }
  }catch(e){}
  _brzExportPaintDeltaTable(clone);
  _brzSyncLiveDeltaColors(card, clone);
  inner.appendChild(clone); body.appendChild(inner); frame.appendChild(body);
  var foot=document.createElement('div');
  foot.style.cssText='display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E5E7EB;margin-top:18px;padding-top:10px;font-size:10.5px;color:#9CA3AF';
  foot.innerHTML='<div style="letter-spacing:0">BRZ Replacement Engine</div><div style="font-size:13px;font-weight:700;color:#1A3A5C;white-space:nowrap;letter-spacing:0">'+today+'</div>';
  frame.appendChild(foot);
  document.body.appendChild(frame);
  var _brzTabCfg=_brzStabilizeAnalysisExportTable(card, clone, _isTradesCard);
  try{
    var _brzExpWrap=frame.querySelector('.a-tab-wrap-export'), _brzExpTable=frame.querySelector('.a-tab-table');
    if(_brzExpWrap&&_brzExpTable){
      var _brzExpH=Math.ceil(_brzExpTable.getBoundingClientRect().height+8);
      _brzExpWrap.style.height=_brzExpH+'px';
      _brzExpWrap.style.minHeight=_brzExpH+'px';
      _brzExpWrap.style.maxHeight='none';
      _brzExpWrap.style.overflow='visible';
    }
  }catch(_brzExpErr){}
  if(isRpc){
    try{
      var tbl=frame.querySelector('.rpc-table');
      var needed=tbl?Math.ceil(tbl.scrollWidth+56):1540;
      needed=Math.max(1280,Math.min(1850,needed));
      frame.style.width=needed+'px';
    }catch(e){}
  }
  if(_isTradesCard){
    try{
      var _tt=frame.querySelector('.a-tab-table');
      var _baseW=_brzTabCfg&&_brzTabCfg.width?(_brzTabCfg.width+120):(_tt?Math.ceil(_tt.scrollWidth+180):2100);
      var _need=Math.max(2100,Math.min(3800,_baseW));
      frame.style.width=_need+'px';
      if(_brzTabCfg&&_brzTabCfg.wrap&&_brzTabCfg.width){
        _brzTabCfg.wrap.style.width=_brzTabCfg.width+'px';
        _brzTabCfg.wrap.style.minWidth=_brzTabCfg.width+'px';
      }
    }catch(e){}
  }
  var _runCapture=function(){
    var _dl=function(canvas){ var a=document.createElement('a'); a.download='BRZ_'+_brzSlug(title)+'_'+today+'.png';
      a.href=canvas.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove(); frame.remove(); };
    var _fallback=function(){ if(typeof html2canvas==='undefined'){ frame.remove(); alert('Motor de imagem indisponível.'); return; }
      var _ww=isRpc?1900:(_isTradesCard?Math.max(2400,Math.ceil(frame.scrollWidth+80)):1100);
      var _wh=Math.max(1400,Math.ceil(frame.scrollHeight+60));
      html2canvas(frame,{scale:(_isTradesCard?3:2),backgroundColor:'#ffffff',logging:false,useCORS:true,windowWidth:_ww,windowHeight:_wh}).then(_dl)
        .catch(function(e){ console.error('brzExport',e); frame.remove(); alert('Falha ao gerar PNG: '+(e&&e.message||e)); }); };
    if(_isTradesCard){ _fallback(); return; }
    try{
      var W=frame.offsetWidth, H=frame.offsetHeight;
      var _inl=function(el,extra){ try{ var cs=getComputedStyle(el); if(!cs) return; var s='';
          for(var pi=0;pi<cs.length;pi++){ var pr=cs.item(pi);
            if(pr==='position'||pr==='left'||pr==='top'||pr==='right'||pr==='bottom'||pr==='height') continue;
            var pv=cs.getPropertyValue(pr); if(pv!=='') s+=pr+':'+pv+';'; }
          el.setAttribute('style', s+(extra||'')); }catch(e){} };
      var all=frame.querySelectorAll('*');
      for(var q=0;q<all.length;q++){ _inl(all[q]); }
      _inl(frame,'position:static;left:auto;top:auto;');
      var xhtml=new XMLSerializer().serializeToString(frame);
      var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">'+xhtml+'</div></foreignObject></svg>';
      var img=new Image();
      img.onload=function(){ try{
          var canvas=document.createElement('canvas'); canvas.width=W*2; canvas.height=H*2;
          var ctx=canvas.getContext('2d'); ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.scale(2,2); ctx.drawImage(img,0,0);
          _dl(canvas);
        }catch(e){ console.warn('brzExport FO draw',e); _fallback(); } };
      img.onerror=function(e){ console.warn('brzExport FO load',e); _fallback(); };
      img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    }catch(e){ console.warn('brzExport FO',e); _fallback(); }
  };
  _brzExportWaitStableLayout().then(function(){ try{ frame.offsetWidth; frame.offsetHeight; }catch(e){} _runCapture(); }).catch(function(){ _runCapture(); });
}


/* ===== Relatório DOCX: marcação de cards (+) e geração client-side ===== */
window.brzMarked = window.brzMarked || []; /* [{title,b64,w,h}] em ordem de marcação */
function _brzCrc32(buf){ var c,crc=0xFFFFFFFF; if(!_brzCrc32.t){ var t=[]; for(var n=0;n<256;n++){ c=n; for(var k=0;k<8;k++){ c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);} t[n]=c>>>0;} _brzCrc32.t=t;} var t=_brzCrc32.t; for(var i=0;i<buf.length;i++){ crc=(crc>>>8)^t[(crc^buf[i])&0xFF];} return (crc^0xFFFFFFFF)>>>0; }
function _brzZip(files){ var enc=new TextEncoder(),parts=[],central=[],offset=0; function u16(n){return [n&0xFF,(n>>>8)&0xFF];} function u32(n){return [n&0xFF,(n>>>8)&0xFF,(n>>>16)&0xFF,(n>>>24)&0xFF];}
  for(var i=0;i<files.length;i++){ var f=files[i],nameB=enc.encode(f.name),data=(f.data instanceof Uint8Array)?f.data:enc.encode(f.data),crc=_brzCrc32(data);
    var lh=[].concat(u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nameB.length),u16(0));
    parts.push(new Uint8Array(lh),nameB,data);
    var ch=[].concat(u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nameB.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset));
    central.push(new Uint8Array(ch),nameB); offset+=lh.length+nameB.length+data.length; }
  var cdSize=0; for(var j=0;j<central.length;j++) cdSize+=central[j].length;
  var eocd=[].concat(u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cdSize),u32(offset),u16(0));
  var all=parts.concat(central).concat([new Uint8Array(eocd)]); var total=all.reduce(function(a,b){return a+b.length;},0);
  var out=new Uint8Array(total),p=0; for(var x=0;x<all.length;x++){ out.set(all[x],p); p+=all[x].length;} return out; }
function _brzB64ToU8(b64){ var bin=atob(b64),u=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u; }
function brzBuildDocx(images, title, subtitle){
  var EMU=914400,pageW=12240,pageH=15840,mL=1080,mR=1080,mT=1440,mB=1440;
  var usableW=(pageW-mL-mR)/1440*EMU, usableH=(pageH-mT-mB)/1440*EMU, headerEMU=Math.round(1.5*EMU);
  var rels=[], media=[], bodyParts=[];
  bodyParts.push('<w:p><w:pPr><w:spacing w:before="0" w:after="40"/><w:pBdr><w:bottom w:val="single" w:sz="20" w:space="6" w:color="2E6E8E"/></w:pBdr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="10283A"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr><w:t xml:space="preserve">'+_brzEsc(title)+'</w:t></w:r></w:p>');
  if(subtitle){ bodyParts.push('<w:p><w:pPr><w:spacing w:before="100" w:after="200"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="10283A"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">'+_brzEsc(subtitle)+'</w:t></w:r></w:p>'); }
  for(var i=0;i<images.length;i++){ var im=images[i],idx=i+1,ar=im.w/im.h;
    var maxH=(i===0)?(usableH-headerEMU):usableH, cx=usableW, cy=Math.round(usableW/ar);
    if(cy>maxH){ cy=maxH; cx=Math.round(maxH*ar); } cx=Math.round(cx); cy=Math.round(cy);
    rels.push('<Relationship Id="rImg'+idx+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image'+idx+'.png"/>');
    media.push({name:'word/media/image'+idx+'.png', data:_brzB64ToU8(im.b64)});
    var dr='<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="'+idx+'" name="Image'+idx+'"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="'+idx+'" name="Image'+idx+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rImg'+idx+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    bodyParts.push('<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="60"/></w:pPr>'+dr+'</w:p>');
    if(i<images.length-1) bodyParts.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>'); }
  var sectPr='<w:sectPr><w:pgSz w:w="'+pageW+'" w:h="'+pageH+'"/><w:pgMar w:top="'+mT+'" w:right="'+mR+'" w:bottom="'+mB+'" w:left="'+mL+'" w:header="600" w:footer="600" w:gutter="0"/></w:sectPr>';
  var documentXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>'+bodyParts.join('')+sectPr+'</w:body></w:document>';
  var ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  var relsRoot='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  var docRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rels.join('')+'</Relationships>';
  var files=[{name:'[Content_Types].xml',data:ct},{name:'_rels/.rels',data:relsRoot},{name:'word/document.xml',data:documentXml},{name:'word/_rels/document.xml.rels',data:docRels}].concat(media);
  return _brzZip(files);
}
function _brzMM_DD(){ var d=new Date(); return ('0'+(d.getMonth()+1)).slice(-2)+'/'+('0'+d.getDate()).slice(-2); }
function brzCardCanvas(card){ return new Promise(function(resolve,reject){
  if(typeof html2canvas==='undefined'){ reject(new Error('html2canvas')); return; }
  var meta=_brzExportMeta(card), title=meta.title, sub=meta.sub, isRpc=meta.isRpc, _isTradesCard=/(?:Trades|Prices) reported by Agrinvest Desk/i.test(title), today=new Date().toISOString().slice(0,10);
  var frame=document.createElement('div'); frame.className='brz-export-frame';
  var _fx=document.createElement('style'); _fx.textContent='.brz-export-frame,.brz-export-frame *{font-family:Arial,Helvetica,sans-serif !important;} .brz-export-frame ::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}'; frame.appendChild(_fx);
  frame.style.cssText='position:fixed;left:-99999px;top:0;width:'+(isRpc?1540:1060)+'px;background:#ffffff;color:#10283A;font-family:Inter,system-ui,-apple-system,Arial,sans-serif;padding:'+(isRpc?'24px 28px':'30px 34px');
  frame.innerHTML='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2.5px solid #1A3A5C;padding-bottom:10px;margin-bottom:16px"><div style="flex:1 1 auto;min-width:0"><div style="font-size:23px;font-weight:800;letter-spacing:-.3px;line-height:1.15;color:#10283A">'+_brzEsc(title)+'</div>'+(sub?'<div style="font-size:12.5px;color:#6B7280;margin-top:4px">'+_brzEsc(sub)+'</div>':'')+'</div><div style="flex:0 0 auto;min-width:250px;text-align:right;padding-left:12px"><div style="font-size:14px;font-weight:800;letter-spacing:.4px;color:#1A3A5C;white-space:nowrap">'+BRZ_EXPORT_BRAND.name+'</div><div style="font-size:11px;color:#6B7280;letter-spacing:.3px;white-space:nowrap">'+BRZ_EXPORT_BRAND.sub+'</div></div></div>';
  var body=document.createElement('div'); body.style.cssText='position:relative';
  var inner=document.createElement('div'); inner.style.cssText='position:relative;z-index:1';
  var clone=card.cloneNode(true);
  var cams=clone.querySelectorAll('.brz-cam, .brz-add, .a-exp'); for(var k=0;k<cams.length;k++)cams[k].remove();
  var ch=clone.querySelector('.p-card-h'); if(ch)ch.remove();
  var ctt=clone.querySelectorAll('.a-card-t, .idc-card-t'); for(var z=0;z<ctt.length;z++)ctt[z].remove();
  var junkSel='.a-note, .a-legend, .a-mp-note, .evo-sum, .rpc-note, button, select, input, .a-cmp, .a-compare, .idc-cmp, .a-ctrls-tbl, .rpm-controls, .ppe-ctrls'+(isRpc?', .p-card-s, .rpc-badge':'');
  var junk=clone.querySelectorAll(junkSel); for(var jj=0;jj<junk.length;jj++)junk[jj].remove(); (function(){var _pp=clone.querySelector('.a-ports');if(_pp){_pp.style.cssText+=';display:block;font-size:0;';var _pcs=_pp.querySelectorAll('.a-portcard');for(var pi=0;pi<_pcs.length;pi++){var pc=_pcs[pi];pc.style.cssText+=';display:inline-block;width:48%;box-sizing:border-box;vertical-align:top;font-size:13px;margin:0 0 10px 0;'+(pi%2===0?'margin-right:3%;':'');var hh=pc.querySelector('.a-portcard-h');if(hh)hh.style.cssText+=';display:block;position:relative;padding-right:78px;';var vv=pc.querySelector('.a-portcard-v');if(vv)vv.style.cssText+=';position:absolute;right:0;top:0;';}}})();
  clone.style.border='none'; clone.style.boxShadow='none'; clone.style.margin='0'; clone.style.background='transparent'; clone.style.borderRadius='0';
  if(isRpc){
    var rw=clone.querySelector('.rpc-table-wrap');
    if(rw) rw.style.cssText += ';overflow:visible;max-width:none;border:1px solid #E8ECF2;border-radius:10px;';
    var rt=clone.querySelector('.rpc-table');
    if(rt){
      rt.style.width='100%';
      rt.style.tableLayout='auto';
      rt.style.fontSize='12px';
      var ths=rt.querySelectorAll('th'); for(var ti=0;ti<ths.length;ti++){ths[ti].style.fontSize='9.5px';ths[ti].style.padding='8px 10px';}
      var tds=rt.querySelectorAll('td'); for(var di=0;di<tds.length;di++){tds[di].style.padding='8px 10px';}
    }
  }
  try{
    var _tabWrap=clone.querySelector('.a-tab-wrap');
    var _tabHead=clone.querySelector('.a-tab-headline');
    var _tabNote=clone.querySelector('.a-tab-note');
    if(_tabHead)_tabHead.remove();
    if(_tabNote)_tabNote.remove();
    if(_tabWrap&&_tabWrap.parentNode){
      var _cleanWrap=document.createElement('div');
      _cleanWrap.className='a-tab-wrap-export';
      _cleanWrap.style.cssText='overflow:visible !important;max-width:none;height:auto;max-height:none;border:1px solid #E8ECF2;border-radius:10px;background:#fff;padding-bottom:4px;';
      while(_tabWrap.firstChild){ _cleanWrap.appendChild(_tabWrap.firstChild); }
      _tabWrap.parentNode.replaceChild(_cleanWrap,_tabWrap);
      _tabWrap=_cleanWrap;
    }
    var _tabTable=clone.querySelector('.a-tab-table');
    if(_tabTable){
      _tabTable.style.width='100%';
      _tabTable.style.minWidth='0';
      _tabTable.style.tableLayout='fixed';
      var _ths=_tabTable.querySelectorAll('th'); for(var _i=0;_i<_ths.length;_i++){_ths[_i].style.fontSize='10.2px';_ths[_i].style.lineHeight='1.08';_ths[_i].style.padding='8px 10px 5px';_ths[_i].style.whiteSpace='normal';_ths[_i].style.overflowWrap='anywhere';_ths[_i].style.textAlign='left';}
      var _tds=_tabTable.querySelectorAll('td'); for(var _j=0;_j<_tds.length;_j++){_tds[_j].style.padding='7px 10px';_tds[_j].style.whiteSpace='nowrap';_tds[_j].style.verticalAlign='middle';_tds[_j].style.textAlign='left';}
      var _nums=_tabTable.querySelectorAll('td.num'); for(var _n=0;_n<_nums.length;_n++){_nums[_n].style.textAlign='right';}
      var _deltas=_tabTable.querySelectorAll('td:nth-child(12),td:nth-child(13),td:nth-child(14)'); for(var _d=0;_d<_deltas.length;_d++){_deltas[_d].style.textAlign='center';}
      var _marg=_tabTable.querySelectorAll('td.a-tab-margin'); for(var _m=0;_m<_marg.length;_m++){_marg[_m].style.textAlign='center';}
      var _rows=_tabTable.querySelectorAll('tbody tr');
      for(var _ri=0;_ri<_rows.length;_ri++){
        var _cells=_rows[_ri].children||[];
        if(_cells[4]){ var _sh=(_cells[4].textContent||'').trim(); if(/^[A-Za-z]{3}\d{2}$/.test(_sh)) _cells[4].textContent=_sh.slice(0,3)+'-'+_sh.slice(3); }
        if(_cells[6]){ var _rg=(_cells[6].textContent||'').trim(); _rg=_rg.replace(/^([A-Z]{2})(?! )([^A-Z].*)$/,'$1 $2').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Z])([A-Z][a-z])/g,'$1 $2').replace(/\s+/g,' ').trim(); _cells[6].textContent=_rg; _cells[6].style.whiteSpace='normal'; }
        if(_cells[7]){ _cells[7].style.whiteSpace='normal'; }
      }
      if(_isTradesCard){
        var _tabOnlyTable=_tabTable.cloneNode(true);
        var _cg=_tabOnlyTable.querySelector('colgroup');
        if(_cg){ _cg.parentNode.removeChild(_cg); }
        _tabOnlyTable.style.width='100%';
        _tabOnlyTable.style.minWidth='0';
        _tabOnlyTable.style.tableLayout='auto';
        _tabOnlyTable.style.fontSize='12.1px';
        var _tabOnlyWrap=document.createElement('div');
        _tabOnlyWrap.className='a-tab-wrap-export';
        _tabOnlyWrap.style.cssText='overflow:visible !important;max-width:none;height:auto !important;max-height:none !important;min-height:0;border:1px solid #E8ECF2;border-radius:10px;background:#fff;padding-bottom:0;';
        _tabOnlyWrap.appendChild(_tabOnlyTable);
        clone.innerHTML='';
        clone.appendChild(_tabOnlyWrap);
      }
    }
  }catch(e){}
  _brzExportPaintDeltaTable(clone);
  _brzSyncLiveDeltaColors(card, clone);
  inner.appendChild(clone); body.appendChild(inner); frame.appendChild(body);
  var foot=document.createElement('div'); foot.style.cssText='display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E5E7EB;margin-top:18px;padding-top:10px;font-size:10.5px;color:#9CA3AF';
  foot.innerHTML='<div style="letter-spacing:0">BRZ Replacement Engine</div><div style="font-size:13px;font-weight:700;color:#1A3A5C;white-space:nowrap;letter-spacing:0">'+today+'</div>'; frame.appendChild(foot);
  document.body.appendChild(frame);
  var _brzTabCfg=_brzStabilizeAnalysisExportTable(card, clone, _isTradesCard);
  try{
    var _brzExpWrap=frame.querySelector('.a-tab-wrap-export'), _brzExpTable=frame.querySelector('.a-tab-table');
    if(_brzExpWrap&&_brzExpTable){
      var _brzExpH=Math.ceil(_brzExpTable.getBoundingClientRect().height+8);
      _brzExpWrap.style.height=_brzExpH+'px';
      _brzExpWrap.style.minHeight=_brzExpH+'px';
      _brzExpWrap.style.maxHeight='none';
      _brzExpWrap.style.overflow='visible';
    }
  }catch(_brzExpErr){}
  if(isRpc){
    try{
      var tbl=frame.querySelector('.rpc-table');
      var needed=tbl?Math.ceil(tbl.scrollWidth+56):1540;
      needed=Math.max(1280,Math.min(1850,needed));
      frame.style.width=needed+'px';
    }catch(e){}
  }
  if(_isTradesCard){
    try{
      var _tt=frame.querySelector('.a-tab-table');
      var _baseW=_brzTabCfg&&_brzTabCfg.width?(_brzTabCfg.width+120):(_tt?Math.ceil(_tt.scrollWidth+180):2100);
      var _need=Math.max(2100,Math.min(3800,_baseW));
      frame.style.width=_need+'px';
      if(_brzTabCfg&&_brzTabCfg.wrap&&_brzTabCfg.width){
        _brzTabCfg.wrap.style.width=_brzTabCfg.width+'px';
        _brzTabCfg.wrap.style.minWidth=_brzTabCfg.width+'px';
      }
    }catch(e){}
  }
  var _capture=function(){
    var _ww=isRpc?1900:(_isTradesCard?Math.max(2400,Math.ceil(frame.scrollWidth+80)):1100);
    var _wh=Math.max(1400,Math.ceil(frame.scrollHeight+60));
    html2canvas(frame,{scale:(_isTradesCard?3:2),backgroundColor:'#ffffff',logging:false,useCORS:true,windowWidth:_ww,windowHeight:_wh}).then(function(canvas){ frame.remove(); resolve(canvas); }).catch(function(e){ frame.remove(); reject(e); });
  };
  _brzExportWaitStableLayout().then(function(){ try{ frame.offsetWidth; frame.offsetHeight; }catch(e){} _capture(); }).catch(function(){ _capture(); });
}); }
function _brzFindMark(title){ for(var i=0;i<window.brzMarked.length;i++){ if(window.brzMarked[i].title===title) return i; } return -1; }
function _brzPaintAdd(btn, marked){ if(!btn) return; btn.classList.toggle('on', !!marked);
  if(marked){ var n=_brzFindMark(btn.getAttribute('data-title'))+1; btn.innerHTML='<span class="brz-add-n">'+(n>0?n:'')+'</span>'; }
  else { btn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'; } }
function brzRepaintAdds(){ try{ var adds=document.querySelectorAll('.brz-add'); for(var i=0;i<adds.length;i++){ var b=adds[i]; _brzPaintAdd(b, _brzFindMark(b.getAttribute('data-title'))>=0); } }catch(e){} }
function brzToggleMark(card, btn){ if(!card) return; var title=_brzCardTitle(card), idx=_brzFindMark(title);
  if(idx>=0){ window.brzMarked.splice(idx,1); brzRepaintAdds(); brzUpdateFloat(); return; }
  if(btn) btn.classList.add('busy');
  brzCardCanvas(card).then(function(canvas){ var dataURL=canvas.toDataURL('image/png');
    window.brzMarked.push({title:title,b64:dataURL.split(',')[1],w:canvas.width,h:canvas.height});
    if(btn) btn.classList.remove('busy'); brzRepaintAdds(); brzUpdateFloat();
  }).catch(function(e){ if(btn) btn.classList.remove('busy'); alert('Falha ao capturar card: '+(e&&e.message||e)); }); }
function brzUpdateFloat(){ var fb=document.getElementById('brzDocxFloat');
  if(!fb){ fb=document.createElement('button'); fb.id='brzDocxFloat'; fb.className='brz-docx-float'; fb.title=(typeof _currentLang!=='undefined'&&_currentLang==='en')?'Generate DOCX report':'Gerar relatório DOCX';
    fb.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg><span class="brz-docx-badge">0</span>';
    fb.onclick=brzGenDocx; document.body.appendChild(fb); }
  var n=window.brzMarked.length, badge=fb.querySelector('.brz-docx-badge'); if(badge) badge.textContent=n; fb.style.display=n>0?'inline-flex':'none'; }
function brzGenDocx(){ if(!window.brzMarked.length) return;
  try{ var bytes=brzBuildDocx(window.brzMarked.map(function(m){return {b64:m.b64,w:m.w,h:m.h};}), 'Daily report of replacement cost', 'Soybean Replacement by Traders');
    var blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    var url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download='Replacement_Cost_Daily_Report_'+_brzMM_DD().replace('/','-')+'.docx';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); },4000);
  }catch(e){ console.error('brzGenDocx',e); alert('Falha ao gerar DOCX: '+(e&&e.message||e)); } }

setTimeout(function(){ try{brzAddCamButtons(document);}catch(e){} },1200);
/* Rede de segurança: re-anexa câmera quando um filtro re-renderiza cards */
(function(){
  var _camT=null;
  function _schedCam(){
    if(_camT) return;
    _camT=setTimeout(function(){
      _camT=null;
      try{
        var act=document.querySelector('.screen.active')||document;
        if(typeof brzAddCamButtons==='function') brzAddCamButtons(act);
      }catch(e){}
    },140);
  }
  try{
    var root=document.querySelector('.main')||document.body;
    if(root && window.MutationObserver){
      var mo=new MutationObserver(function(muts){
        for(var i=0;i<muts.length;i++){
          var m=muts[i];
          if(m.type==='childList' && m.addedNodes && m.addedNodes.length){
            for(var j=0;j<m.addedNodes.length;j++){
              var nd=m.addedNodes[j];
              if(nd.nodeType===1 && nd.className && (''+nd.className).indexOf('brz-cam')>=0) continue;
              _schedCam(); return;
            }
          }
        }
      });
      mo.observe(root,{childList:true,subtree:true});
    }
  }catch(e){}
})();
