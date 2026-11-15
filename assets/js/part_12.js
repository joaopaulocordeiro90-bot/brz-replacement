
(function(){
  var _prevExportCard = window.brzExportCard;
  var _prevCardCanvas = window.brzCardCanvas;

  function _cvCardFromBtn(btn){ return btn&&btn.closest ? btn.closest('.p-card, .a-card, .idc-card, .fd-card') : null; }
  function _cvIsAnalysis(card){ return !!(card && card.querySelector && card.querySelector('.a-tab-table')); }
  function _cvText(el){
    var t='';
    try{ t=(el.innerText || el.textContent || ''); }catch(e){ t=(el&&el.textContent)||''; }
    return String(t||'').replace(/\u00A0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function _cvOne(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
  function _cvPrettyRegion(s){ return String(s||'').trim().replace(/^([A-Z]{2})(?! )([^A-Z].*)$/,'$1 $2').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Z])([A-Z][a-z])/g,'$1 $2').replace(/\s+/g,' ').trim(); }
  function _cvMeta(card){ return (window._brzExportMeta ? window._brzExportMeta(card) : {title:'Prices reported by Agrinvest Desk', sub:'', isRpc:false}); }
  function _cvSlug(s){ return window._brzSlug ? window._brzSlug(s) : String(s||'export').replace(/[^a-z0-9]+/gi,'_'); }
  function _cvColor(el, fallback){
    try{
      var c=(el&&getComputedStyle(el).color)||'';
      return c && c!=='rgba(0, 0, 0, 0)' ? c : (fallback||'#243648');
    }catch(e){ return fallback||'#243648'; }
  }
  function _cvBg(el, fallback){
    try{
      var c=(el&&getComputedStyle(el).backgroundColor)||'';
      if(!c || c==='rgba(0, 0, 0, 0)' || c==='transparent') return fallback||'';
      return c;
    }catch(e){ return fallback||''; }
  }
  function _cvWeight(el, fallback){
    try{ var w=(el&&getComputedStyle(el).fontWeight)||''; return w||fallback||'400'; }catch(e){ return fallback||'400'; }
  }
  function _cvColCount(table){
    var max=0, rows=table.querySelectorAll('thead tr, tbody tr');
    for(var i=0;i<rows.length;i++){
      var n=0, cells=rows[i].children;
      for(var j=0;j<cells.length;j++) n += (parseInt(cells[j].getAttribute('colspan')||'1',10)||1);
      if(n>max) max=n;
    }
    return max || 1;
  }
  function _cvHeaderWidth(txt){
    txt = String(txt||'').toUpperCase();
    if(/REGI/.test(txt)) return 150;
    if(/EMBARQUE|SHIPMENT/.test(txt)) return 96;
    if(/REF/.test(txt)) return 92;
    if(/CASH/.test(txt)) return 106;
    if(/FRETE|FREIGHT/.test(txt)) return 92;
    if(/MODAL/.test(txt)) return 74;
    if(/PORTO|PORT/.test(txt)) return 94;
    if(/CBOT/.test(txt)) return 82;
    if(/C[ÂA]MBIO|FX/.test(txt)) return 92;
    if(/REPLACEMENT/.test(txt)) return 122;
    if(/BASIS/.test(txt)) return 110;
    if(/GROSS/.test(txt)) return 98;
    if(/DOD|WOW|MOM|VAR/.test(txt)) return 76;
    if(/CFR/.test(txt) || /CHINA/.test(txt) || /NORTE DA CHINA/.test(txt) || /NORTH CHINA/.test(txt)) return 150;
    return 96;
  }
  function _cvMeasure(ctx, txt, font){ ctx.font=font; return Math.ceil(ctx.measureText(String(txt||'')).width); }
  function _cvWrap(ctx, txt, maxWidth, font){
    ctx.font=font;
    var parts=String(txt||'').split(/\n/), out=[];
    for(var p=0;p<parts.length;p++){
      var words=parts[p].split(/\s+/), line='';
      for(var i=0;i<words.length;i++){
        var test=line?line+' '+words[i]:words[i];
        if(line && ctx.measureText(test).width>maxWidth){ out.push(line); line=words[i]; }
        else line=test;
      }
      if(line) out.push(line);
      if(!parts[p] && p<parts.length-1) out.push('');
    }
    return out.length?out:[''];
  }
  function _cvParseTable(card){
    var table=card.querySelector('.a-tab-table');
    var colCount=_cvColCount(table);
    var rows=table.querySelectorAll('thead tr, tbody tr');
    var parsed=[];
    for(var r=0;r<rows.length;r++){
      var row=rows[r], parent=(row.parentElement&&row.parentElement.tagName||'').toLowerCase();
      var logical=0, isSection=false;
      var cells=[];
      for(var j=0;j<row.children.length;j++){
        var cell=row.children[j], cs=parseInt(cell.getAttribute('colspan')||'1',10)||1;
        if(cs>1 && parent!=='thead') isSection=true;
      }
      for(var j=0;j<row.children.length;j++){
        var cell=row.children[j], cs=parseInt(cell.getAttribute('colspan')||'1',10)||1, rs=parseInt(cell.getAttribute('rowspan')||'1',10)||1;
        var raw=_cvText(cell);
        if(parent!=='thead'){
          if(logical===6 || (/REGI/.test(_cvOne(parsed[0]&&parsed[0].cells[logical]?parsed[0].cells[logical].text:'')))) raw=_cvPrettyRegion(raw);
          if(/^[A-Za-z]{3}\d{2}$/.test(_cvOne(raw))) raw=_cvOne(raw).slice(0,3)+'-'+_cvOne(raw).slice(3);
        }
        var align='left';
        if(parent==='thead'){
          var hdr=_cvOne(raw).toUpperCase();
          if(/DOD|WOW|MOM|VAR|BASIS|GROSS|REPLACEMENT|CFR|FOB/.test(hdr)) align='center';
        }else if(cell.classList.contains('a-tab-margin')) align='center';
        else if(cell.classList.contains('num') || /^(?:[+\-]?\d|\d{1,3}(?:[.,]\d{3})*[.,]\d+)/.test(_cvOne(raw))) align='right';
        if(parent!=='thead' && logical>=Math.max(0,colCount-3) && !cell.classList.contains('a-tab-margin')) align='center';
        var target=cell.querySelector('[data-export-color]') || cell.querySelector('.a-tab-delta, span') || cell;
        cells.push({
          text: raw,
          colspan: cs,
          rowspan: rs,
          logical: logical,
          align: align,
          color: _cvColor(target, _cvColor(cell,'#243648')),
          bg: cell.classList.contains('a-tab-margin') ? (_cvBg(cell,'#8B8D90')||'#8B8D90') : (_cvBg(cell,'')),
          weight: _cvWeight(target, _cvWeight(cell, isSection?'700':(parent==='thead'?'800':'400'))),
          wrap: (logical===6 || logical===7 || parent==='thead' || isSection)
        });
        logical += cs;
      }
      parsed.push({section:parent, isUnits: row.classList.contains('a-tab-units'), isSection:isSection, cells:cells});
    }
    return {table:table, rows:parsed, colCount:colCount};
  }
  function _cvColumnWidths(parsed){
    var firstHeader=parsed.rows.find(function(r){ return r.section==='thead' && !r.isUnits; });
    var widths=[];
    for(var i=0;i<parsed.colCount;i++){
      var htxt=firstHeader && firstHeader.cells[i] ? firstHeader.cells[i].text : '';
      widths[i]=_cvHeaderWidth(htxt);
    }
    return widths;
  }
  function _cvBuildCanvas(card){
    var meta=_cvMeta(card), brand=(window.BRZ_EXPORT_BRAND||{name:'AGRINVEST COMMODITIES',sub:'A Division of Marex'});
    var parsed=_cvParseTable(card), widths=_cvColumnWidths(parsed);
    var padX=26, topPad=26, headerGap=18, tablePad=0, bottomPad=16;
    var titleH=28, subH=0, topLine=12;
    var totalW=widths.reduce(function(a,b){return a+b;},0);
    var W=padX*2 + totalW;
    if(W<1400) W=1400;
    var scale=2;
    var measure=document.createElement('canvas').getContext('2d');
    function rowHeight(row){
      if(row.section==='thead' && !row.isUnits){
        var maxH=0; for(var i=0;i<row.cells.length;i++){
          var c=row.cells[i], cw=widths[c.logical]||90, ww=(cw*c.colspan)-20;
          var lines=_cvWrap(measure,c.text,ww,'700 10px Arial');
          maxH=Math.max(maxH, lines.length*12 + 14);
        } return Math.max(30,maxH);
      }
      if(row.section==='thead' && row.isUnits) return 24;
      if(row.isSection) return 28;
      var maxH=0;
      for(var i=0;i<row.cells.length;i++){
        var c=row.cells[i], cw=widths[c.logical]||90, ww=(cw*c.colspan)-20;
        var font=(parseInt(c.weight,10)>=700?'700':'400')+' 12px Arial';
        var lines=c.wrap ? _cvWrap(measure,c.text,ww,font) : [c.text];
        maxH=Math.max(maxH, lines.length*14 + 12);
      }
      return Math.max(30,maxH);
    }
    var tableRowsH=0; for(var r=0;r<parsed.rows.length;r++) tableRowsH += rowHeight(parsed.rows[r]);
    var footerH=36;
    var H=topPad + titleH + subH + topLine + headerGap + tableRowsH + footerH + bottomPad;
    var canvas=document.createElement('canvas'); canvas.width=W*scale; canvas.height=H*scale;
    var ctx=canvas.getContext('2d'); ctx.scale(scale,scale);
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
    // Header
    ctx.fillStyle='#10283A'; ctx.font='800 20px Arial'; ctx.textBaseline='top';
    ctx.fillText(meta.title || 'Prices reported by Agrinvest Desk', padX, topPad);
    ctx.fillStyle='#1A3A5C'; ctx.font='800 12px Arial';
    var brandName=brand.name||'AGRINVEST COMMODITIES', brandSub=brand.sub||'';
    var brandNameW=ctx.measureText(brandName).width;
    ctx.fillText(brandName, W-padX-brandNameW, topPad+2);
    ctx.fillStyle='#6B7280'; ctx.font='400 11px Arial';
    var brandSubW=ctx.measureText(brandSub).width;
    ctx.fillText(brandSub, W-padX-brandSubW, topPad+15);
    ctx.strokeStyle='#1A3A5C'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(padX, topPad+30); ctx.lineTo(W-padX, topPad+30); ctx.stroke();

    // Table origin
    var x0=padX, y=topPad+42;
    var colX=[x0];
    for(var i=0;i<widths.length;i++) colX.push(colX[colX.length-1]+widths[i]);

    function drawText(lines,x,y,w,h,align,color,font){
      ctx.fillStyle=color||'#243648'; ctx.font=font||'400 12px Arial'; ctx.textBaseline='middle';
      var lh = font&&font.indexOf('10px')>-1 ? 11.5 : 14;
      var total = lines.length*lh;
      var yy = y + (h-total)/2 + lh/2 - 1;
      for(var i=0;i<lines.length;i++){
        var tx = x + 10;
        if(align==='center') tx = x + w/2;
        else if(align==='right') tx = x + w - 10;
        ctx.textAlign = align||'left';
        ctx.fillText(lines[i], tx, yy + i*lh);
      }
      ctx.textAlign='left';
    }

    for(var r=0;r<parsed.rows.length;r++){
      var row=parsed.rows[r], rh=rowHeight(row);
      var rowBg='';
      if(row.section==='thead') rowBg='#F1F5F9';
      // infer row background from first non-empty bg / bold selection row preserved if source has bg
      if(!rowBg){
        for(var c=0;c<row.cells.length;c++){ if(row.cells[c].bg){ rowBg=row.cells[c].bg; break; } }
      }
      if(rowBg){ ctx.fillStyle=rowBg; ctx.fillRect(x0,y,totalW,rh); }
      if(row.isSection){
        ctx.strokeStyle='#C9AE5D'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x0,y+0.5); ctx.lineTo(x0+totalW,y+0.5); ctx.stroke();
      }
      var logical=0;
      for(var c=0;c<row.cells.length;c++){
        var cell=row.cells[c], x=colX[logical], w=colX[logical+cell.colspan]-colX[logical];
        if(cell.bg && !row.section==='thead'){ ctx.fillStyle=cell.bg; ctx.fillRect(x,y,w,rh); }
        if(cell.bg && cell.bg!==rowBg){ ctx.fillStyle=cell.bg; ctx.fillRect(x,y,w,rh); }
        var font = (row.section==='thead' ? (row.isUnits?'700 8.8px Arial':'800 10px Arial') : ((parseInt(cell.weight,10)>=700||row.isSection)?'700 12px Arial':'400 12px Arial'));
        var wrapW = w - 20;
        var lines = (cell.wrap || row.isSection || row.section==='thead') ? _cvWrap(measure,cell.text,wrapW,font) : [cell.text];
        var color = row.section==='thead' ? (row.isUnits ? '#596579' : '#4B5563') : (cell.color||'#243648');
        drawText(lines,x,y,w,rh,cell.align,color,font);
        logical += cell.colspan;
      }
      // row divider
      ctx.strokeStyle='#E9EDF2'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x0,y+rh); ctx.lineTo(x0+totalW,y+rh); ctx.stroke();
      y += rh;
    }

    // outer rounded-ish border impression
    ctx.strokeStyle='#E5E7EB'; ctx.lineWidth=1; ctx.strokeRect(x0,y - tableRowsH,totalW,tableRowsH);
    // Footer
    var fy = y + 12;
    ctx.strokeStyle='#E5E7EB'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(padX, fy); ctx.lineTo(W-padX, fy); ctx.stroke();
    ctx.fillStyle='#9CA3AF'; ctx.font='400 10.5px Arial'; ctx.textBaseline='top'; ctx.fillText('BRZ Replacement Engine', padX, fy+10);
    ctx.fillStyle='#1A3A5C'; ctx.font='700 13px Arial';
    var today=(new Date()).toISOString().slice(0,10).replace(/-/g,'');
    var tw=ctx.measureText(today).width; ctx.fillText(today, W-padX-tw, fy+8);
    return canvas;
  }
  function _cvDownload(title, canvas){
    var today=(new Date()).toISOString().slice(0,10);
    var a=document.createElement('a');
    a.download='BRZ_'+_cvSlug(title)+'_'+today+'.png';
    a.href=canvas.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  }

  window.brzExportCard = function(btn){
    var card=_cvCardFromBtn(btn);
    if(!_cvIsAnalysis(card)) return _prevExportCard ? _prevExportCard(btn) : void 0;
    try{
      var meta=_cvMeta(card);
      var canvas=_cvBuildCanvas(card);
      _cvDownload(meta.title||'Prices reported by Agrinvest Desk', canvas);
    }catch(e){ console.error('canvas export analysis',e); alert('Falha ao gerar PNG: '+(e&&e.message||e)); }
  };

  window.brzCardCanvas = function(card){
    if(!_cvIsAnalysis(card)) return _prevCardCanvas ? _prevCardCanvas(card) : Promise.reject(new Error('Card não encontrado'));
    try{ return Promise.resolve(_cvBuildCanvas(card)); }
    catch(e){ return Promise.reject(e); }
  };
})();
