
(function(){
  var _prevExportCardFinal = window.brzExportCard;
  var _prevCardCanvasFinal = window.brzCardCanvas;

  function _exCard(btn){ return btn&&btn.closest ? btn.closest('.p-card, .a-card, .idc-card, .fd-card') : null; }
  function _exIsAnalysis(card){ return !!(card && card.querySelector && card.querySelector('.a-tab-table')); }
  function _exMeta(card){ return (window._brzExportMeta ? window._brzExportMeta(card) : {title:'Prices reported by Agrinvest Desk', sub:''}); }
  function _exText(el){
    var t='';
    try{ t=(el.innerText || el.textContent || ''); }catch(e){ t=(el&&el.textContent)||''; }
    return String(t||'').replace(/\u00A0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function _exOne(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
  function _exSlug(s){ return window._brzSlug ? window._brzSlug(s) : String(s||'export').replace(/[^a-z0-9]+/gi,'_'); }
  function _exPrettyRegion(s){ return String(s||'').trim().replace(/^([A-Z]{2})(?! )([^A-Z].*)$/,'$1 $2').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Z])([A-Z][a-z])/g,'$1 $2').replace(/\s+/g,' ').trim(); }
  function _exColorFrom(el, fb){ try{ var c=getComputedStyle(el).color; return (c&&c!=='rgba(0, 0, 0, 0)')?c:(fb||'#2c3d50'); }catch(e){ return fb||'#2c3d50'; } }
  function _exBgFrom(el, fb){ try{ var c=getComputedStyle(el).backgroundColor; return (!c||c==='transparent'||c==='rgba(0, 0, 0, 0)')?(fb||''):c; }catch(e){ return fb||''; } }
  function _exWeightFrom(el, fb){ try{ return getComputedStyle(el).fontWeight || fb || '400'; }catch(e){ return fb || '400'; } }
  function _exTableData(card){
    var table=card.querySelector('.a-tab-table');
    var rows=Array.from(table.querySelectorAll('thead tr, tbody tr'));
    var rowData=[]; var colCount=0;
    rows.forEach(function(row){
      var parent=(row.parentElement&&row.parentElement.tagName||'').toLowerCase();
      var cells=Array.from(row.children); var logical=0; var isSection=false;
      cells.forEach(function(c){ var cs=parseInt(c.getAttribute('colspan')||'1',10)||1; logical += cs; if(cs>1 && parent!=='thead') isSection=true; });
      colCount=Math.max(colCount, logical);
      logical=0;
      var rd={section:parent,isUnits:row.classList.contains('a-tab-units'),isSection:isSection,rowBg:_exBgFrom(row,''),cells:[]};
      cells.forEach(function(c){
        var cs=parseInt(c.getAttribute('colspan')||'1',10)||1, rs=parseInt(c.getAttribute('rowspan')||'1',10)||1;
        var txt=_exText(c), niceTxt=txt;
        if(parent!=='thead'){
          if(/^[A-Za-z]{3}\d{2}$/.test(_exOne(niceTxt))) niceTxt=_exOne(niceTxt).slice(0,3)+'-'+_exOne(niceTxt).slice(3);
          if(logical===6 || logical===7 || /campo|north|south|norte|sul|centro|sudeste|nordeste|oeste|northwest|northeast/i.test(niceTxt)) niceTxt=_exPrettyRegion(niceTxt);
        }
        var target=c.querySelector('[data-export-color]') || c.querySelector('.a-tab-delta, .a-tab-margin, span') || c;
        var align='left';
        if(parent==='thead'){
          var ht=_exOne(niceTxt).toUpperCase();
          if(/DOD|WOW|MOM|VAR|BASIS|GROSS|REPLACEMENT|CFR|FOB|MARGIN/.test(ht)) align='center';
        }else if(c.classList.contains('a-tab-margin')){
          align='center';
        }else if(c.classList.contains('num') || /^(?:[+\-]?\d|\d{1,3}(?:[.,]\d{3})*[.,]\d+)/.test(_exOne(niceTxt))){
          align='right';
        }
        rd.cells.push({
          text:niceTxt,
          rawText:txt,
          logical:logical,
          colspan:cs,
          rowspan:rs,
          align:align,
          color:_exColorFrom(target, _exColorFrom(c,'#2c3d50')),
          bg:c.classList.contains('a-tab-margin')?(_exBgFrom(c,'#8c8f93')||'#8c8f93'):_exBgFrom(c,''),
          weight:_exWeightFrom(target, _exWeightFrom(c,parent==='thead'?'800':'400')),
          wrap:(parent==='thead' || logical===6 || logical===7 || isSection)
        });
        logical += cs;
      });
      rowData.push(rd);
    });
    return {rows:rowData,colCount:colCount};
  }
  function _exBaseHeaderWidth(txt){
    txt=String(txt||'').toUpperCase();
    if(/REGI[ÃA]O|REGION/.test(txt)) return 170;
    if(/EMBARQUE|SHIPMENT/.test(txt)) return 96;
    if(/REF\s*VENC|REFVENC/.test(txt)) return 94;
    if(/CBOT/.test(txt)) return 82;
    if(/FX|C[ÂA]MBIO/.test(txt)) return 92;
    if(/CASH/.test(txt)) return 108;
    if(/FRETE|FREIGHT/.test(txt)) return 98;
    if(/MODAL/.test(txt)) return 72;
    if(/PORTO|PORT/.test(txt)) return 96;
    if(/REPLACEMENT/.test(txt)) return 126;
    if(/BASIS/.test(txt)) return 118;
    if(/GROSS/.test(txt)) return 104;
    if(/DOD|WOW|MOM|VAR/.test(txt)) return 78;
    if(/CFR/.test(txt)) return 154;
    return 96;
  }
  function _exComputeWidths(data){
    var canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
    var widths=[]; for(var i=0;i<data.colCount;i++) widths[i]=74;
    var headerRow=data.rows.find(function(r){ return r.section==='thead' && !r.isUnits; });
    if(headerRow) headerRow.cells.forEach(function(c){ widths[c.logical]=Math.max(widths[c.logical], _exBaseHeaderWidth(c.text)); });
    data.rows.forEach(function(r){
      r.cells.forEach(function(c){
        if(c.colspan!==1) return;
        var font=(r.section==='thead'?(r.isUnits?'700 9px Arial':'800 10px Arial'):((parseInt(c.weight,10)>=700 || r.isSection)?'700 12px Arial':'400 12px Arial'));
        ctx.font=font;
        var txt=_exOne(c.text);
        var w=Math.ceil(ctx.measureText(txt).width)+24;
        if(c.logical===6) w=Math.max(w, 132);
        if(c.logical===7) w=Math.max(w, 86);
        if(c.logical>=data.colCount-3) w=Math.max(w, 78);
        widths[c.logical]=Math.max(widths[c.logical], Math.min(w, c.logical===6?170:(c.logical===7?110:160)));
      });
    });
    return widths;
  }
  function _exWrap(ctx, txt, maxWidth, font){
    ctx.font=font; txt=String(txt||'');
    var paragraphs=txt.split(/\n/), out=[];
    paragraphs.forEach(function(p){
      var words=p.split(/\s+/).filter(Boolean), line='';
      if(!words.length){ out.push(''); return; }
      words.forEach(function(w){
        var test=line?line+' '+w:w;
        if(line && ctx.measureText(test).width>maxWidth){ out.push(line); line=w; }
        else line=test;
      });
      if(line) out.push(line);
    });
    return out.length?out:[''];
  }
  function _exBuildCanvas(card){
    var meta=_exMeta(card), brand=(window.BRZ_EXPORT_BRAND||{name:'AGRINVEST COMMODITIES',sub:'A Division of Marex'});
    var data=_exTableData(card), widths=_exComputeWidths(data);
    var totalW=widths.reduce(function(a,b){return a+b;},0);
    var pageW=Math.max(1180, totalW+52), left=26, top=24, afterHeader=16, bottom=18;
    var headH=46, footGap=14, footH=28;
    var mCanvas=document.createElement('canvas'), mctx=mCanvas.getContext('2d');

    function rowHeight(row){
      if(row.section==='thead' && !row.isUnits){
        var mh=0;
        row.cells.forEach(function(c){ var font='800 10px Arial'; var lines=_exWrap(mctx,c.text,(widths[c.logical]||90)*c.colspan-18,font); mh=Math.max(mh, lines.length*11.5+14); });
        return Math.max(28,mh);
      }
      if(row.section==='thead' && row.isUnits) return 22;
      if(row.isSection) return 28;
      var mh=0;
      row.cells.forEach(function(c){ var font=(parseInt(c.weight,10)>=700?'700':'400')+' 12px Arial'; var lines=c.wrap?_exWrap(mctx,c.text,(widths[c.logical]||90)*c.colspan-18,font):[c.text]; mh=Math.max(mh, lines.length*14+12); });
      return Math.max(29,mh);
    }
    var tableH=0; data.rows.forEach(function(r){ tableH += rowHeight(r); });
    var H=top+headH+afterHeader+tableH+footGap+footH+bottom;
    var scale=3;
    var canvas=document.createElement('canvas'); canvas.width=pageW*scale; canvas.height=H*scale;
    var ctx=canvas.getContext('2d'); ctx.scale(scale,scale); ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,pageW,H);

    // header
    ctx.fillStyle='#10283A'; ctx.font='800 20px Arial'; ctx.textBaseline='top'; ctx.fillText(meta.title||'Prices reported by Agrinvest Desk', left, top);
    ctx.fillStyle='#1A3A5C'; ctx.font='800 12px Arial'; var nm=brand.name||'AGRINVEST COMMODITIES'; var nW=ctx.measureText(nm).width; ctx.fillText(nm, pageW-left-nW, top+1);
    ctx.fillStyle='#6B7280'; ctx.font='400 11px Arial'; var sb=brand.sub||''; var sW=ctx.measureText(sb).width; ctx.fillText(sb, pageW-left-sW, top+14);
    ctx.strokeStyle='#1A3A5C'; ctx.lineWidth=2.25; ctx.beginPath(); ctx.moveTo(left, top+30); ctx.lineTo(pageW-left, top+30); ctx.stroke();

    var x0=left, y=top+44, xPos=[x0]; widths.forEach(function(w){ xPos.push(xPos[xPos.length-1]+w); });

    function drawLines(lines, x, y, w, h, align, color, font){
      ctx.font=font; ctx.fillStyle=color; ctx.textBaseline='middle';
      var lh=font.indexOf('10px')>-1?11.2:(font.indexOf('9px')>-1?10.4:13.6);
      var block=lines.length*lh; var yy=y+(h-block)/2+lh/2-0.5;
      lines.forEach(function(line, i){
        var tx=x+10; ctx.textAlign='left';
        if(align==='center'){ ctx.textAlign='center'; tx=x+w/2; }
        else if(align==='right'){ ctx.textAlign='right'; tx=x+w-10; }
        ctx.fillText(line, tx, yy+i*lh);
      });
      ctx.textAlign='left';
    }

    var yStart=y;
    data.rows.forEach(function(row){
      var rh=rowHeight(row);
      var rowBg='';
      if(row.section==='thead') rowBg='#F1F5F9';
      else rowBg=row.rowBg||'';
      if(rowBg){ ctx.fillStyle=rowBg; ctx.fillRect(x0,y,totalW,rh); }
      if(row.isSection){ ctx.strokeStyle='#C7A44E'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(x0,y+0.5); ctx.lineTo(x0+totalW,y+0.5); ctx.stroke(); }
      row.cells.forEach(function(c){
        var x=xPos[c.logical], w=xPos[c.logical+c.colspan]-xPos[c.logical];
        if(c.bg && c.bg!==rowBg){ ctx.fillStyle=c.bg; ctx.fillRect(x,y,w,rh); }
        var font=row.section==='thead' ? (row.isUnits?'700 8.8px Arial':'800 10px Arial') : ((parseInt(c.weight,10)>=700||row.isSection)?'700 12px Arial':'400 12px Arial');
        var lines=(row.section==='thead'||c.wrap||row.isSection)?_exWrap(mctx,c.text,w-18,font):[_exOne(c.text)];
        var color=row.section==='thead' ? (row.isUnits?'#596579':'#4B5563') : (c.bg?'#ffffff':(c.color||'#2c3d50'));
        drawLines(lines,x,y,w,rh,c.align,color,font);
      });
      ctx.strokeStyle='#E8EDF3'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x0,y+rh); ctx.lineTo(x0+totalW,y+rh); ctx.stroke();
      y+=rh;
    });
    ctx.strokeStyle='#E6EBF0'; ctx.lineWidth=1; ctx.strokeRect(x0,yStart,totalW,tableH);
    var fy=y+footGap;
    ctx.strokeStyle='#E6EBF0'; ctx.beginPath(); ctx.moveTo(left, fy); ctx.lineTo(pageW-left, fy); ctx.stroke();
    ctx.fillStyle='#9CA3AF'; ctx.font='400 10.5px Arial'; ctx.textBaseline='top'; ctx.fillText('BRZ Replacement Engine', left, fy+9);
    ctx.fillStyle='#1A3A5C'; ctx.font='700 13px Arial'; var dt=(new Date()).toISOString().slice(0,10); var dW=ctx.measureText(dt).width; ctx.fillText(dt, pageW-left-dW, fy+7);
    return canvas;
  }
  function _exDownload(title, canvas){ var a=document.createElement('a'); a.download='BRZ_'+_exSlug(title)+'_'+(new Date()).toISOString().slice(0,10)+'.png'; a.href=canvas.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove(); }

  window.brzExportCard = function(btn){
    var card=_exCard(btn);
    if(!_exIsAnalysis(card)) return _prevExportCardFinal ? _prevExportCardFinal(btn) : void 0;
    try{ var meta=_exMeta(card), canvas=_exBuildCanvas(card); _exDownload(meta.title||'Prices reported by Agrinvest Desk', canvas); }
    catch(e){ console.error('final analysis export', e); alert('Falha ao gerar PNG: '+(e&&e.message||e)); }
  };
  window.brzCardCanvas = function(card){
    if(!_exIsAnalysis(card)) return _prevCardCanvasFinal ? _prevCardCanvasFinal(card) : Promise.reject(new Error('Card não encontrado'));
    try{ return Promise.resolve(_exBuildCanvas(card)); } catch(e){ return Promise.reject(e); }
  };
})();
