
(function(){
  var __prevExport = window.brzExportCard;
  var __prevCanvas = window.brzCardCanvas;

  function __card(btn){ return btn&&btn.closest ? btn.closest('.p-card, .a-card, .idc-card, .fd-card') : null; }
  function __isAnalysis(card){ return !!(card && card.querySelector && card.querySelector('.a-tab-table')); }
  function __meta(card){ return (window._brzExportMeta ? window._brzExportMeta(card) : {title:'Prices reported by Agrinvest Desk', sub:''}); }
  function __slug(s){ return window._brzSlug ? window._brzSlug(s) : String(s||'export').replace(/[^a-z0-9]+/gi,'_'); }
  function __txt(el){
    var t='';
    try{ t=(el.innerText || el.textContent || ''); }catch(e){ t=(el&&el.textContent)||''; }
    return String(t||'').replace(/\u00A0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function __one(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
  function __mapRegion(s){
    s=String(s||'').trim();
    s=s.replace(/Northeast/g,'Nordeste').replace(/Northwest/g,'Noroeste').replace(/Southeast/g,'Sudeste').replace(/Southwest/g,'Sudoeste').replace(/Center/g,'Centro').replace(/North/g,'Norte').replace(/South/g,'Sul');
    s=s.replace(/Campo\s*Gerais/g,'CampoGerais');
    return s;
  }
  function __color(el, fb){ try{ var c=getComputedStyle(el).color; return (c&&c!=='rgba(0, 0, 0, 0)')?c:(fb||'#2c3d50'); }catch(e){ return fb||'#2c3d50'; } }
  function __bg(el, fb){ try{ var c=getComputedStyle(el).backgroundColor; return (!c||c==='transparent'||c==='rgba(0, 0, 0, 0)')?(fb||''):c; }catch(e){ return fb||''; } }
  function __wgt(el, fb){ try{ return getComputedStyle(el).fontWeight || fb || '400'; }catch(e){ return fb || '400'; } }
  function __table(card){
    var table=card.querySelector('.a-tab-table');
    var rows=Array.from(table.querySelectorAll('thead tr, tbody tr'));
    var out=[], colCount=0;
    rows.forEach(function(row){
      var parent=(row.parentElement&&row.parentElement.tagName||'').toLowerCase();
      var cells=Array.from(row.children), logical=0, isSection=false;
      cells.forEach(function(c){ var cs=parseInt(c.getAttribute('colspan')||'1',10)||1; logical+=cs; if(cs>1&&parent!=='thead') isSection=true; });
      colCount=Math.max(colCount, logical); logical=0;
      var r={section:parent,isUnits:row.classList.contains('a-tab-units'),isSection:isSection,rowBg:__bg(row,''),cells:[]};
      cells.forEach(function(c){
        var cs=parseInt(c.getAttribute('colspan')||'1',10)||1;
        var txt=__txt(c), target=c.querySelector('[data-export-color]') || c.querySelector('.a-tab-delta, .a-tab-margin, span') || c;
        if(parent!=='thead' && logical===0) txt=__mapRegion(txt);
        var align='left';
        if(parent==='thead'){
          var h=__one(txt).toUpperCase();
          if(/DOD|WOW|MOM|VAR|BASIS|GROSS|REPLACEMENT|CFR|FOB|MARGIN/.test(h)) align='center';
        } else if(c.classList.contains('a-tab-margin')) align='center';
        else if(c.classList.contains('num') || /^(?:[+\-]?\d|\d{1,3}(?:[.,]\d{3})*[.,]\d+)/.test(__one(txt))) align='right';
        r.cells.push({
          text:txt, logical:logical, colspan:cs,
          align:align, color:__color(target, __color(c,'#2c3d50')),
          bg:c.classList.contains('a-tab-margin')?(__bg(c,'#8c8f93')||'#8c8f93'):__bg(c,''),
          weight:__wgt(target, __wgt(c,parent==='thead'?'800':'400')),
          wrap:(parent==='thead' || isSection)
        });
        logical+=cs;
      });
      out.push(r);
    });
    return {rows:out,colCount:colCount};
  }
  function __baseW(label, idx){
    label=String(label||'').toUpperCase();
    if(idx===0) return 215;
    if(/EMBARQUE|SHIPMENT/.test(label)) return 104;
    if(/REF/.test(label)) return 96;
    if(/CASH/.test(label)) return 110;
    if(/FRETE|FREIGHT/.test(label)) return 98;
    if(/MODAL/.test(label)) return 74;
    if(/PORTO|PORT/.test(label)) return 96;
    if(/FOB/.test(label) && !/CFR/.test(label)) return 86;
    if(/DOD|WOW|MOM/.test(label)) return 78;
    if(/CFR/.test(label)) return 170;
    return 100;
  }
  function __wrap(ctx, txt, maxWidth, font){
    ctx.font=font; txt=String(txt||'');
    var words=txt.split(/\s+/).filter(Boolean), out=[], line='';
    if(!words.length) return [''];
    words.forEach(function(w){ var test=line?line+' '+w:w; if(line&&ctx.measureText(test).width>maxWidth){ out.push(line); line=w; } else line=test; });
    if(line) out.push(line);
    return out.length?out:[''];
  }
  function __drawSpaced(ctx, txt, x, y, color, font, align, extra){
    txt=String(txt||'').trim(); extra=extra==null?4:extra; ctx.font=font; ctx.fillStyle=color; ctx.textBaseline='top';
    var words=txt.split(/\s+/).filter(Boolean); if(!words.length) return;
    var total=0; words.forEach(function(w,i){ total+=ctx.measureText(w).width; if(i<words.length-1) total+=extra; });
    var cx=(align==='right')?(x-total):(align==='center'?(x-total/2):x);
    words.forEach(function(w,i){ ctx.fillText(w,cx,y); cx+=ctx.measureText(w).width + (i<words.length-1?extra:0); });
  }
  function __build(card){
    var meta=__meta(card), brand=(window.BRZ_EXPORT_BRAND||{name:'AGRINVEST COMMODITIES',sub:'A Division of Marex'});
    var data=__table(card);
    var firstHeader=data.rows.find(function(r){ return r.section==='thead' && !r.isUnits; });
    var widths=[]; for(var i=0;i<data.colCount;i++) widths[i]=__baseW(firstHeader&&firstHeader.cells[i]?firstHeader.cells[i].text:'',i);
    var totalW=widths.reduce(function(a,b){return a+b;},0), left=28, top=26;
    var pageW=Math.max(1650, totalW+56), pageH=0;
    var mc=document.createElement('canvas').getContext('2d');
    function rowH(r){
      if(r.section==='thead' && !r.isUnits) return 28;
      if(r.section==='thead' && r.isUnits) return 22;
      if(r.isSection) return 28;
      return 30;
    }
    var tableH=0; data.rows.forEach(function(r){ tableH+=rowH(r); });
    pageH=top+46+tableH+54;
    var scale=3, canvas=document.createElement('canvas'); canvas.width=pageW*scale; canvas.height=pageH*scale;
    var ctx=canvas.getContext('2d'); ctx.scale(scale,scale); ctx.fillStyle='#fff'; ctx.fillRect(0,0,pageW,pageH);
    __drawSpaced(ctx, meta.title||'Prices reported by Agrinvest Desk', left, top, '#10283A', '800 20px Arial', 'left', 3.5);
    __drawSpaced(ctx, brand.name||'AGRINVEST COMMODITIES', pageW-left, top+1, '#1A3A5C', '800 12px Arial', 'right', 2.5);
    ctx.fillStyle='#6B7280'; ctx.font='400 11px Arial'; ctx.textBaseline='top'; ctx.fillText(brand.sub||'A Division of Marex', pageW-left-ctx.measureText(brand.sub||'A Division of Marex').width, top+15);
    ctx.strokeStyle='#1A3A5C'; ctx.lineWidth=2.25; ctx.beginPath(); ctx.moveTo(left, top+30); ctx.lineTo(pageW-left, top+30); ctx.stroke();
    var x0=left, y=top+44, xPos=[x0]; widths.forEach(function(w){ xPos.push(xPos[xPos.length-1]+w); });
    function drawText(text, x, y, w, h, align, color, font){
      ctx.font=font; ctx.fillStyle=color; ctx.textBaseline='middle'; ctx.textAlign=(align==='right'?'right':(align==='center'?'center':'left'));
      var tx=align==='right'?(x+w-10):(align==='center'?(x+w/2):(x+10)); ctx.fillText(text, tx, y+h/2); ctx.textAlign='left';
    }
    var startY=y;
    data.rows.forEach(function(r){
      var rh=rowH(r), rowBg=(r.section==='thead'?'#F1F5F9':(r.rowBg||''));
      if(rowBg){ ctx.fillStyle=rowBg; ctx.fillRect(x0,y,totalW,rh); }
      if(r.isSection){ ctx.strokeStyle='#C7A44E'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(x0,y+0.5); ctx.lineTo(x0+totalW,y+0.5); ctx.stroke(); }
      r.cells.forEach(function(c){
        var x=xPos[c.logical], w=xPos[c.logical+c.colspan]-xPos[c.logical];
        if(c.bg && c.bg!==rowBg){ ctx.fillStyle=c.bg; ctx.fillRect(x,y,w,rh); }
        var font=(r.section==='thead'?(r.isUnits?'700 8.8px Arial':'800 10px Arial'):((parseInt(c.weight,10)>=700||r.isSection)?'700 12px Arial':'400 12px Arial'));
        var color=r.section==='thead'?(r.isUnits?'#596579':'#4B5563'):(c.bg?'#ffffff':(c.color||'#2c3d50'));
        drawText(__one(c.text), x, y, w, rh, c.align, color, font);
      });
      ctx.strokeStyle='#E8EDF3'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x0,y+rh); ctx.lineTo(x0+totalW,y+rh); ctx.stroke();
      y+=rh;
    });
    ctx.strokeStyle='#E6EBF0'; ctx.lineWidth=1; ctx.strokeRect(x0, startY, totalW, tableH);
    var fy=y+12; ctx.strokeStyle='#E6EBF0'; ctx.beginPath(); ctx.moveTo(left, fy); ctx.lineTo(pageW-left, fy); ctx.stroke();
    __drawSpaced(ctx, 'BRZ Replacement Engine', left, fy+10, '#9CA3AF', '400 10.5px Arial', 'left', 2.5);
    var dt=(new Date()).toISOString().slice(0,10).replace(/-/g,''); __drawSpaced(ctx, dt, pageW-left, fy+8, '#1A3A5C', '700 13px Arial', 'right', 0);
    return canvas;
  }
  function __download(title, canvas){ var a=document.createElement('a'); a.download='BRZ_'+__slug(title)+'_'+(new Date()).toISOString().slice(0,10)+'.png'; a.href=canvas.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove(); }

  window.brzExportCard = function(btn){
    var card=__card(btn);
    if(!__isAnalysis(card)) return __prevExport ? __prevExport(btn) : void 0;
    try{ var meta=__meta(card), canvas=__build(card); __download(meta.title||'Prices reported by Agrinvest Desk', canvas); }
    catch(e){ console.error('analysis export v8', e); alert('Falha ao gerar PNG: '+(e&&e.message||e)); }
  };
  window.brzCardCanvas = function(card){
    if(!__isAnalysis(card)) return __prevCanvas ? __prevCanvas(card) : Promise.reject(new Error('Card não encontrado'));
    try{ return Promise.resolve(__build(card)); } catch(e){ return Promise.reject(e); }
  };
})();
