
(function(){
  var __prevExportDom = window.brzExportCard;
  var __prevCanvasDom = window.brzCardCanvas;

  function __card(btn){ return btn && btn.closest ? btn.closest('.p-card, .a-card, .idc-card, .fd-card') : null; }
  function __isAnalysis(card){ return !!(card && card.querySelector && card.querySelector('.a-tab-table')); }
  function __meta(card){ return (window._brzExportMeta ? window._brzExportMeta(card) : {title:'Prices reported by Agrinvest Desk', sub:''}); }
  function __slug(s){ return window._brzSlug ? window._brzSlug(s) : String(s||'export').replace(/[^a-z0-9]+/gi,'_'); }
  function __wait(){
    var fp; try{ fp=(document.fonts && document.fonts.ready) || Promise.resolve(); }catch(e){ fp=Promise.resolve(); }
    return Promise.resolve(fp).catch(function(){}).then(function(){
      return new Promise(function(resolve){
        var raf=window.requestAnimationFrame || function(cb){ return setTimeout(cb,16); };
        raf(function(){ raf(function(){ setTimeout(resolve,32); }); });
      });
    });
  }
  function __brand(){
    if(window.BRZ_EXPORT_BRAND) return window.BRZ_EXPORT_BRAND;
    return {name:'AGRINVEST COMMODITIES', sub:'A Division of Marex'};
  }
  function __copyStyles(src, dst){
    if(!src || !dst) return;
    var srcNodes=[src].concat(Array.from(src.querySelectorAll('*')));
    var dstNodes=[dst].concat(Array.from(dst.querySelectorAll('*')));
    for(var i=0;i<Math.min(srcNodes.length, dstNodes.length);i++){
      var s=srcNodes[i], d=dstNodes[i];
      if(!d || !s) continue;
      var cs=getComputedStyle(s), txt='';
      for(var j=0;j<cs.length;j++){
        var p=cs[j];
        if(p==='animation' || p==='animation-name' || p==='transition' || p==='transition-property') continue;
        txt += p + ':' + cs.getPropertyValue(p) + ';';
      }
      d.setAttribute('style', txt);
      d.style.animation='none';
      d.style.transition='none';
      d.style.textShadow='none';
      d.style.textRendering='geometricPrecision';
      d.style.fontKerning='normal';
      d.style.webkitFontSmoothing='antialiased';
    }
  }
  function __measureColumns(table){
    var heads=Array.from(table.querySelectorAll('thead tr:first-child th')).filter(function(th){ return getComputedStyle(th).display!=='none'; });
    var widths=heads.map(function(th){ return Math.ceil(Math.max(th.getBoundingClientRect().width, th.scrollWidth, th.offsetWidth)); });
    return widths.filter(function(v){ return !!v; });
  }
  function __applyColgroup(tableClone, widths){
    if(!widths || !widths.length || !tableClone) return;
    var old=tableClone.querySelector('colgroup'); if(old && old.parentNode) old.parentNode.removeChild(old);
    var cg=document.createElement('colgroup');
    widths.forEach(function(w){ var col=document.createElement('col'); col.style.width=w+'px'; cg.appendChild(col); });
    tableClone.insertBefore(cg, tableClone.firstChild);
  }
  function __normalizeTable(tableClone, tableWidth){
    if(!tableClone) return;
    tableClone.style.width=tableWidth+'px';
    tableClone.style.minWidth=tableWidth+'px';
    tableClone.style.maxWidth='none';
    tableClone.style.tableLayout='fixed';
    tableClone.style.borderCollapse='separate';
    tableClone.style.borderSpacing='0';
    tableClone.querySelectorAll('th,td').forEach(function(cell){
      cell.style.letterSpacing='0';
      cell.style.wordSpacing='normal';
      cell.style.textShadow='none';
      cell.style.transform='none';
      cell.style.whiteSpace=getComputedStyle(cell).whiteSpace || cell.style.whiteSpace;
      cell.style.overflowWrap='normal';
      cell.style.wordBreak='normal';
      cell.style.hyphens='none';
      cell.style.textRendering='geometricPrecision';
      cell.style.fontKerning='normal';
      cell.style.webkitFontSmoothing='antialiased';
    });
  }
  function __buildFrame(card){
    var meta=__meta(card), brand=__brand();
    var liveTable=card.querySelector('.a-tab-table');
    if(!liveTable) throw new Error('Tabela não encontrada');
    var liveWrap=liveTable.closest('.a-tab-wrap, .a-tab-wrap-export') || liveTable.parentElement;
    var tableClone=liveTable.cloneNode(true);
    __copyStyles(liveTable, tableClone);
    var widths=__measureColumns(liveTable);
    var tableWidth=Math.ceil(Math.max(liveTable.getBoundingClientRect().width || 0, liveTable.scrollWidth || 0, widths.reduce(function(a,b){return a+b;},0)));
    if(widths.length) __applyColgroup(tableClone, widths);
    __normalizeTable(tableClone, tableWidth);

    var frame=document.createElement('div');
    frame.className='brz-analysis-dom-export-frame';
    frame.style.cssText='position:fixed;left:-100000px;top:0;background:#ffffff;color:#10283A;padding:26px 28px;width:'+(tableWidth+56)+'px;box-sizing:border-box;z-index:2147483000;';

    var style=document.createElement('style');
    style.textContent=''
      + '.brz-analysis-dom-export-frame,.brz-analysis-dom-export-frame *{box-sizing:border-box !important;font-family:Arial,Helvetica,sans-serif !important;letter-spacing:0 !important;word-spacing:normal !important;text-shadow:none !important;transform:none !important;}'
      + '.brz-analysis-dom-export-frame .exp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2.25px solid #1A3A5C;padding-bottom:9px;margin-bottom:16px;}'
      + '.brz-analysis-dom-export-frame .exp-title{font-size:20px;font-weight:800;line-height:1.1;color:#10283A;margin:0;}'
      + '.brz-analysis-dom-export-frame .exp-sub{font-size:12px;line-height:1.2;color:#64748B;margin-top:4px;}'
      + '.brz-analysis-dom-export-frame .exp-brand{margin-left:auto;text-align:right;min-width:220px;}'
      + '.brz-analysis-dom-export-frame .exp-brand .nm{font-size:12px;font-weight:800;line-height:1.05;color:#1A3A5C;white-space:nowrap;}'
      + '.brz-analysis-dom-export-frame .exp-brand .sb{font-size:11px;line-height:1.1;color:#6B7280;white-space:nowrap;}'
      + '.brz-analysis-dom-export-frame .exp-wrap{width:'+tableWidth+'px;min-width:'+tableWidth+'px;max-width:none;overflow:visible;}'
      + '.brz-analysis-dom-export-frame .exp-wrap table{width:'+tableWidth+'px !important;min-width:'+tableWidth+'px !important;max-width:none !important;table-layout:fixed !important;}'
      + '.brz-analysis-dom-export-frame .exp-foot{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E6EBF0;margin-top:16px;padding-top:10px;}'
      + '.brz-analysis-dom-export-frame .exp-foot .l{font-size:10.5px;color:#9CA3AF;white-space:nowrap;}'
      + '.brz-analysis-dom-export-frame .exp-foot .r{font-size:13px;font-weight:700;color:#1A3A5C;white-space:nowrap;}';
    frame.appendChild(style);

    var head=document.createElement('div');
    head.className='exp-head';
    head.innerHTML=''
      + '<div style="flex:1 1 auto;min-width:0;">'
      +   '<div class="exp-title"></div>'
      +   (meta.sub ? '<div class="exp-sub"></div>' : '')
      + '</div>'
      + '<div class="exp-brand"><div class="nm"></div><div class="sb"></div></div>';
    head.querySelector('.exp-title').textContent=meta.title || 'Prices reported by Agrinvest Desk';
    var sub=head.querySelector('.exp-sub'); if(sub) sub.textContent=meta.sub || '';
    head.querySelector('.exp-brand .nm').textContent=brand.name || 'AGRINVEST COMMODITIES';
    head.querySelector('.exp-brand .sb').textContent=brand.sub || 'A Division of Marex';
    frame.appendChild(head);

    var wrap=document.createElement('div'); wrap.className='exp-wrap';
    wrap.appendChild(tableClone);
    frame.appendChild(wrap);

    var foot=document.createElement('div');
    foot.className='exp-foot';
    foot.innerHTML='<div class="l">BRZ Replacement Engine</div><div class="r"></div>';
    foot.querySelector('.r').textContent=(new Date()).toISOString().slice(0,10).replace(/-/g,'');
    frame.appendChild(foot);
    return frame;
  }
  function __capture(frame){
    return __wait().then(function(){
      document.body.appendChild(frame);
      return __wait().then(function(){
        var ww=Math.ceil(frame.scrollWidth + 20), wh=Math.ceil(frame.scrollHeight + 20);
        return html2canvas(frame,{scale:3,backgroundColor:'#ffffff',logging:false,useCORS:true,windowWidth:ww,windowHeight:wh,removeContainer:true});
      }).then(function(canvas){ try{ frame.remove(); }catch(e){} return canvas; }).catch(function(err){ try{ frame.remove(); }catch(e){} throw err; });
    });
  }
  function __download(title, canvas){
    var a=document.createElement('a');
    a.download='BRZ_'+__slug(title)+'_'+(new Date()).toISOString().slice(0,10)+'.png';
    a.href=canvas.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  }

  window.brzExportCard=function(btn){
    var card=__card(btn);
    if(!__isAnalysis(card)) return __prevExportDom ? __prevExportDom(btn) : void 0;
    if(typeof html2canvas==='undefined'){ alert('Motor de imagem ainda carregando.'); return; }
    try{
      var meta=__meta(card), frame=__buildFrame(card);
      __capture(frame).then(function(canvas){ __download(meta.title || 'Prices reported by Agrinvest Desk', canvas); })
        .catch(function(e){ console.error('analysis dom export', e); alert('Falha ao gerar PNG: '+(e&&e.message||e)); });
    }catch(e){ console.error('analysis dom export build', e); alert('Falha ao preparar exportação: '+(e&&e.message||e)); }
  };
  window.brzCardCanvas=function(card){
    if(!__isAnalysis(card)) return __prevCanvasDom ? __prevCanvasDom(card) : Promise.reject(new Error('Card não encontrado'));
    if(typeof html2canvas==='undefined') return Promise.reject(new Error('html2canvas'));
    try{ return __capture(__buildFrame(card)); }
    catch(e){ return Promise.reject(e); }
  };
})();
