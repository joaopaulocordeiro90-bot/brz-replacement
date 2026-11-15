
(function(){
  var _origBrzExportCard = window.brzExportCard;
  var _origBrzCardCanvas = window.brzCardCanvas;
  function _esc(s){
    s = String(s==null ? '' : s);
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _waitStable(){
    var fp; try{ fp=(document.fonts&&document.fonts.ready)||Promise.resolve(); }catch(e){ fp=Promise.resolve(); }
    return Promise.resolve(fp).catch(function(){}).then(function(){
      return new Promise(function(resolve){
        var raf = window.requestAnimationFrame || function(cb){ return setTimeout(cb,16); };
        raf(function(){ raf(function(){ setTimeout(resolve,30); }); });
      });
    });
  }
  function _cardFromBtn(btn){ return btn&&btn.closest?btn.closest('.p-card, .a-card, .idc-card, .fd-card'):null; }
  function _isAnalysisTableCard(card){ return !!(card && card.querySelector && card.querySelector('.a-tab-table')); }
  function _txt(el){
    var t='';
    try{ t=(el.innerText||el.textContent||''); }catch(e){ t=(el&&el.textContent)||''; }
    return String(t||'').replace(/ /g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function _oneLine(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
  function _prettyRegion(s){ return String(s||'').trim().replace(/^([A-Z]{2})(?! )([^A-Z].*)$/,'$1 $2').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Z])([A-Z][a-z])/g,'$1 $2').replace(/\s+/g,' ').trim(); }
  function _cellColor(cell){
    try{
      var target = cell.querySelector('[data-export-color]') || cell.querySelector('.a-tab-delta, .a-tab-margin, span') || cell;
      var c = (target.getAttribute && target.getAttribute('data-export-color')) || getComputedStyle(target).color || getComputedStyle(cell).color;
      return c || '#162235';
    }catch(e){ return '#162235'; }
  }
  function _cellBg(cell){
    try{
      if(cell.classList.contains('a-tab-margin')) return getComputedStyle(cell).backgroundColor || '#8B8D90';
      return '';
    }catch(e){ return ''; }
  }
  function _logicalColCount(table){
    var max=0, rows=table.querySelectorAll('thead tr, tbody tr');
    for(var i=0;i<rows.length;i++){
      var n=0, cells=rows[i].children;
      for(var j=0;j<cells.length;j++) n += (parseInt(cells[j].getAttribute('colspan')||'1',10)||1);
      if(n>max) max=n;
    }
    return max || ((table.rows[0] && table.rows[0].cells.length) || 1);
  }
  function _headerWidth(text, idx){
    text = String(text||'').toUpperCase();
    if(/REGI/.test(text)) return 160;
    if(/PORTO/.test(text)) return 110;
    if(/EMBARQUE/.test(text)) return 95;
    if(/REF\s*VENC|REFVENC|CBOT/.test(text)) return 92;
    if(/C[ÂA]MBIO/.test(text)) return 92;
    if(/CASH/.test(text)) return 96;
    if(/FRETE/.test(text)) return 88;
    if(/MODAL/.test(text)) return 74;
    if(/REPLACEMENT|COST|BASIS|FOB|CFR|GROSS|MARGIN/.test(text)) return 118;
    if(/DOD|WOW|MOM|VAR/.test(text)) return 78;
    if(/N\. CN|N CN|NORTE DA CHINA/.test(text)) return 140;
    var w = Math.max(74, Math.min(138, Math.ceil(text.length*7.6)+28));
    return w;
  }
  function _buildAnalysisFrame(card, meta){
    var title = meta.title || 'Table';
    var sub = meta.sub || '';
    var today = new Date().toISOString().slice(0,10);
    var srcTable = card.querySelector('.a-tab-table');
    var rows = srcTable.querySelectorAll('thead tr, tbody tr');
    var colCount = _logicalColCount(srcTable);
    var headerCells = srcTable.querySelectorAll('thead tr:first-child th');
    var widths = [];
    for(var i=0;i<colCount;i++){
      var ht = headerCells[i] ? _oneLine(_txt(headerCells[i])) : ('COL '+(i+1));
      widths.push(_headerWidth(ht, i));
    }
    var total = widths.reduce(function(a,b){ return a+b; }, 0);
    total = Math.max(total, 1180);

    var frame = document.createElement('div');
    frame.className = 'brz-export-frame brz-analysis-clean-frame';
    frame.style.cssText = 'position:fixed;left:-99999px;top:0;background:#ffffff;color:#10283A;padding:28px 32px;font-family:Arial,Helvetica,sans-serif;width:'+(total+2)+'px;';

    var sty = document.createElement('style');
    sty.textContent = ''+
      '.brz-analysis-clean-frame,.brz-analysis-clean-frame *{font-family:Arial,Helvetica,sans-serif !important;box-sizing:border-box !important;letter-spacing:0 !important;text-shadow:none !important;transform:none !important;}' +
      '.brz-analysis-clean-frame .brz-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2.5px solid #1A3A5C;padding-bottom:10px;margin-bottom:16px;}' +
      '.brz-analysis-clean-frame .brz-title{font-size:21px;font-weight:800;line-height:1.12;color:#10283A;}' +
      '.brz-analysis-clean-frame .brz-sub{font-size:12.5px;color:#6B7280;margin-top:4px;}' +
      '.brz-analysis-clean-frame .brz-brand{text-align:right;min-width:240px;}' +
      '.brz-analysis-clean-frame .brz-brand .nm{font-size:12px;font-weight:800;color:#1A3A5C;white-space:nowrap;}' +
      '.brz-analysis-clean-frame .brz-brand .sb{font-size:11px;color:#6B7280;white-space:nowrap;}' +
      '.brz-analysis-clean-frame .brz-wrap{border:1px solid #E8ECF2;border-radius:10px;background:#fff;overflow:hidden;}' +
      '.brz-analysis-clean-frame table{border-collapse:separate;border-spacing:0;width:'+total+'px;table-layout:fixed;font-size:12px;color:#162235;font-variant-numeric:tabular-nums;text-rendering:geometricPrecision;-webkit-font-smoothing:antialiased;}' +
      '.brz-analysis-clean-frame th,.brz-analysis-clean-frame td{border:0;border-bottom:1px solid #E9EDF2;padding:8px 10px;vertical-align:middle;overflow:hidden;}' +
      '.brz-analysis-clean-frame thead th{font-size:10.6px;line-height:1.16;font-weight:800;color:#111827;background:#fff;text-align:left;white-space:normal;overflow-wrap:break-word;word-break:normal;padding:9px 10px 6px;}' +
      '.brz-analysis-clean-frame thead tr.units th{font-size:8.9px;line-height:1.1;font-weight:700;color:#596579;padding:2px 10px 8px;border-bottom:2px solid #17212B;}' +
      '.brz-analysis-clean-frame tbody td{line-height:1.24;white-space:nowrap;}' +
      '.brz-analysis-clean-frame tbody td.wrap{white-space:normal;overflow-wrap:break-word;word-break:normal;}' +
      '.brz-analysis-clean-frame tbody td.center,.brz-analysis-clean-frame thead th.center{text-align:center;}' +
      '.brz-analysis-clean-frame tbody td.right{text-align:right;}' +
      '.brz-analysis-clean-frame tbody td.margin{font-weight:800;text-align:center;color:#fff;border-bottom-color:#9A9C9F;}' +
      '.brz-analysis-clean-frame tbody tr:last-child td{border-bottom:0;}' +
      '.brz-analysis-clean-frame tbody tr.section td{background:#FCFCFD;font-weight:700;color:#10283A;border-top:2px solid #C9AE5D;border-bottom:1px solid #E9EDF2;}' +
      '.brz-analysis-clean-frame .brz-foot{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E5E7EB;margin-top:18px;padding-top:10px;font-size:10.5px;color:#9CA3AF;}'+
      '.brz-analysis-clean-frame .brz-foot .dt{font-size:13px;font-weight:700;color:#1A3A5C;white-space:nowrap;}';
    frame.appendChild(sty);

    var brand = (window.BRZ_EXPORT_BRAND || {name:'AGRINVEST COMMODITIES', sub:''});
    var head = document.createElement('div');
    head.className='brz-head';
    head.innerHTML = '<div style="flex:1 1 auto;min-width:0;padding-right:14px"><div class="brz-title">'+_esc(title)+'</div>' +
      (sub ? '<div class="brz-sub">'+_esc(sub)+'</div>' : '') +
      '</div><div class="brz-brand"><div class="nm">'+_esc(brand.name||'')+'</div><div class="sb">'+_esc(brand.sub||'')+'</div></div>';
    frame.appendChild(head);

    var wrap = document.createElement('div'); wrap.className='brz-wrap';
    var table = document.createElement('table');
    var colgroup = document.createElement('colgroup');
    for(var c=0;c<widths.length;c++){
      var col=document.createElement('col'); col.style.width=widths[c]+'px'; colgroup.appendChild(col);
    }
    table.appendChild(colgroup);

    var thead=document.createElement('thead'), tbody=document.createElement('tbody');
    for(var r=0;r<rows.length;r++){
      var srcRow=rows[r], trgRow=document.createElement('tr');
      var parentTag = srcRow.parentElement && srcRow.parentElement.tagName ? srcRow.parentElement.tagName.toLowerCase() : '';
      if(parentTag==='thead') thead.appendChild(trgRow); else tbody.appendChild(trgRow);
      if(srcRow.classList.contains('a-tab-units')) trgRow.className='units';
      var cells=srcRow.children;
      var logical=0;
      var isSection = false;
      for(var j=0;j<cells.length;j++) if((parseInt(cells[j].getAttribute('colspan')||'1',10)||1) > 1) { isSection = true; break; }
      if(isSection && parentTag!=='thead') trgRow.classList.add('section');
      for(var j=0;j<cells.length;j++){
        var sCell=cells[j], tag=(parentTag==='thead'?'th':'td'), dCell=document.createElement(tag);
        var cs = parseInt(sCell.getAttribute('colspan')||'1',10)||1, rs = parseInt(sCell.getAttribute('rowspan')||'1',10)||1;
        if(cs>1) dCell.colSpan=cs; if(rs>1) dCell.rowSpan=rs;
        var rawText = _txt(sCell);
        if(logical===6) rawText = _prettyRegion(rawText);
        if(logical===4 && /^[A-Za-z]{3}\d{2}$/.test(_oneLine(rawText))) rawText = _oneLine(rawText).slice(0,3)+'-'+_oneLine(rawText).slice(3);
        dCell.innerHTML = _esc(rawText).split('\n').join('<br>');
        var align='left';
        if(parentTag==='thead'){
          var ht=_oneLine(rawText).toUpperCase();
          if(/DOD|WOW|MOM|VAR|GROSS|FOB|CFR|BASIS|REPLACEMENT/.test(ht)) align='center';
        }else if(isSection){
          align='left';
        }else if(sCell.classList.contains('a-tab-margin')){
          align='center';
          dCell.classList.add('margin');
          dCell.style.background = _cellBg(sCell) || '#8B8D90';
          dCell.style.color = '#ffffff';
        }else if(sCell.classList.contains('num') || /^(?:[+\-]?\d|\d{1,3}(?:[.,]\d{3})*[.,]\d+)/.test(_oneLine(rawText))){
          align='right';
        }
        if(logical===6 || logical===7) dCell.classList.add('wrap');
        if(logical>=Math.max(0,colCount-3) && !dCell.classList.contains('margin') && parentTag!=='thead') align='center';
        dCell.classList.add(align==='right'?'right':(align==='center'?'center':''));
        if(!dCell.classList.contains('margin')) dCell.style.color = _cellColor(sCell);
        logical += cs;
        trgRow.appendChild(dCell);
      }
    }
    table.appendChild(thead); table.appendChild(tbody); wrap.appendChild(table); frame.appendChild(wrap);

    var foot=document.createElement('div');
    foot.className='brz-foot';
    foot.innerHTML='<div>BRZ Replacement Engine</div><div class="dt">'+today+'</div>';
    frame.appendChild(foot);
    return frame;
  }
  function _captureFrame(frame, scale){
    return _waitStable().then(function(){
      document.body.appendChild(frame);
      return _waitStable().then(function(){
        try{ frame.offsetWidth; frame.offsetHeight; }catch(e){}
        var ww = Math.ceil(frame.scrollWidth + 20), wh = Math.ceil(frame.scrollHeight + 20);
        return html2canvas(frame, {scale:scale||2.5, backgroundColor:'#ffffff', logging:false, useCORS:true, windowWidth:ww, windowHeight:wh});
      }).then(function(canvas){ try{ frame.remove(); }catch(e){} return canvas; }).catch(function(err){ try{ frame.remove(); }catch(e){} throw err; });
    });
  }
  function _downloadCanvas(title, canvas){
    var today = new Date().toISOString().slice(0,10);
    var a=document.createElement('a');
    a.download='BRZ_'+((window._brzSlug?window._brzSlug(title):String(title||'export').replace(/[^a-z0-9]+/gi,'_')))+'_'+today+'.png';
    a.href=canvas.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  }

  window.brzExportCard = function(btn){
    var card = _cardFromBtn(btn);
    if(!_isAnalysisTableCard(card)) return _origBrzExportCard ? _origBrzExportCard(btn) : void 0;
    if(typeof html2canvas==='undefined'){ alert('Motor de imagem ainda carregando, tente de novo.'); return; }
    try{
      var meta = (window._brzExportMeta ? window._brzExportMeta(card) : {title:'Table',sub:''});
      var frame = _buildAnalysisFrame(card, meta);
      _captureFrame(frame, 3).then(function(canvas){ _downloadCanvas(meta.title||'table', canvas); })
        .catch(function(e){ console.error('analysis export', e); alert('Falha ao gerar PNG: '+(e&&e.message||e)); });
    }catch(e){ console.error('analysis export build', e); alert('Falha ao preparar exportação: '+(e&&e.message||e)); }
  };

  window.brzCardCanvas = function(card){
    if(!_isAnalysisTableCard(card)) return _origBrzCardCanvas ? _origBrzCardCanvas(card) : Promise.reject(new Error('Card não encontrado'));
    if(typeof html2canvas==='undefined') return Promise.reject(new Error('html2canvas'));
    try{
      var meta = (window._brzExportMeta ? window._brzExportMeta(card) : {title:'Table',sub:''});
      var frame = _buildAnalysisFrame(card, meta);
      return _captureFrame(frame, 3);
    }catch(e){ return Promise.reject(e); }
  };
})();
