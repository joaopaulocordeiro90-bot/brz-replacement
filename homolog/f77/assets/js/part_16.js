
/*
 * Exportação determinística das tabelas da Análise — V11.
 *
 * Esta camada é deliberadamente a última do arquivo. Ela substitui todos os
 * exportadores anteriores apenas dentro da aba Análise e atende os dois modos:
 * tabela normal (.a-table) e tabela TAB (.a-tab-table).
 *
 * A imagem é desenhada diretamente em Canvas. Nenhum clone é anexado ao DOM,
 * portanto o MutationObserver do i18n, os breakpoints responsivos, o scroll e
 * o html2canvas não conseguem alterar texto, largura ou alinhamento durante a
 * captura.
 */
(function(){
  'use strict';

  var VERSION='11.0.0';
  var previousExport=window.brzExportCard;
  var previousCanvas=window.brzCardCanvas;
  var BRAND=window.BRZ_EXPORT_BRAND||{name:'AGRINVEST COMMODITIES',sub:'A Division of Marex'};

  function cardFromButton(btn){
    return btn&&btn.closest?btn.closest('.p-card, .a-card, .idc-card, .fd-card'):null;
  }

  function isAnalysisTableCard(card){
    if(!card||!card.closest||!card.closest('#analise, #report')||!card.querySelector('table.a-table, table.a-tab-table')) return false;
    return !!(card.querySelector('.a-tabbtn')||card.closest('.a-tblpair, .a-tblsingle'));
  }

  function canvas2d(){
    var c=document.createElement('canvas');
    var x=c.getContext&&c.getContext('2d');
    if(!x) throw new Error('Canvas 2D indisponível');
    return {canvas:c,ctx:x};
  }

  function normalizeInline(value){
    return String(value==null?'':value)
      .replace(/\u00A0/g,' ')
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g,'')
      .replace(/\u00AD/g,'')
      .replace(/[ \t\f\v]+/g,' ')
      .trim();
  }

  function normalizeMultiline(value){
    var lines=String(value==null?'':value)
      .replace(/\r/g,'')
      .replace(/\u00A0/g,' ')
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g,'')
      .replace(/\u00AD/g,'')
      .split('\n')
      .map(normalizeInline);
    while(lines.length&&lines[0]==='') lines.shift();
    while(lines.length&&lines[lines.length-1]==='') lines.pop();
    return lines.join('\n');
  }

  function nodeTextWithBreaks(node){
    if(!node) return '';
    if(node.nodeType===3) return node.nodeValue||'';
    if(node.nodeType!==1) return '';
    var tag=String(node.tagName||'').toUpperCase();
    if(tag==='BR') return '\n';
    if(tag==='BUTTON'||tag==='SELECT'||tag==='INPUT'||tag==='SVG'||tag==='STYLE'||tag==='SCRIPT') return '';
    var out='';
    for(var i=0;i<node.childNodes.length;i++) out+=nodeTextWithBreaks(node.childNodes[i]);
    return out;
  }

  function exactCellText(cell){
    /* Alerta/botão de ocultar são só de tela: nunca entram na foto. */
    if(cell&&cell.querySelector&&cell.querySelector('.a-noexport')){
      cell=cell.cloneNode(true);
      Array.prototype.forEach.call(cell.querySelectorAll('.a-noexport'),function(n){ n.parentNode.removeChild(n); });
    }

    return normalizeMultiline(nodeTextWithBreaks(cell));
  }

  function fold(value){
    var s=normalizeInline(value).toUpperCase();
    try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){}
    return s;
  }

  /*
   * Corrige somente separação tipográfica. Não traduz nenhum nome.
   * Exemplos protegidos: TOCentro -> TO Centro, MTNorth -> MT North,
   * GOSouth -> GO South, PRCampoGerais -> PR Campo Gerais.
   */
  function repairGeographySpacing(value){
    var s=normalizeInline(value);
    /* 09/10/2026: rótulos de porto (FAS Rio Grande, FAS Paguá, FAS SFS) não são UF colada; três maiúsculas seguidas de espaço ficam inteiras. */
    if(!/^[A-Z]{3,}\s/.test(s)) s=s.replace(/^([A-Z]{2})(?=[A-ZÀ-ÖØ-Þ])/,'$1 ');
    s=s.replace(/([a-zà-öø-ÿ])([A-ZÀ-ÖØ-Þ])/g,'$1 $2');
    s=s.replace(/\b(Campo|Campos)(?=Gerais\b)/g,'$1 ');
    s=s.replace(/\b(M[eé]dio|Mid)(?=Norte|Sul|North|South\b)/gi,'$1 ');
    return normalizeInline(s);
  }

  function computedColor(el,fallback){
    try{
      var c=getComputedStyle(el).color;
      if(c&&c!=='transparent'&&c!=='rgba(0, 0, 0, 0)') return c;
    }catch(e){}
    return fallback||'#25364A';
  }

  function computedBackground(el,fallback){
    try{
      var c=getComputedStyle(el).backgroundColor;
      if(c&&c!=='transparent'&&c!=='rgba(0, 0, 0, 0)') return c;
    }catch(e){}
    return fallback||'';
  }

  function computedWeight(el,fallback){
    try{
      var w=parseInt(getComputedStyle(el).fontWeight,10);
      if(isFinite(w)) return w;
    }catch(e){}
    return fallback||400;
  }

  function exportMeta(card,table){
    var meta={title:'Prices reported by Agrinvest Desk'};
    try{
      if(typeof window._brzExportMeta==='function'){
        var m=window._brzExportMeta(card);
        if(m) meta=m;
      }
    }catch(e){}
    var kind=table.classList.contains('a-tab-table')?'TAB':'NORMAL';
    return {title:normalizeInline(meta.title)||'Prices reported by Agrinvest Desk',sub:'',kind:kind};
  }

  function primaryHeaderMap(table,colCount){
    var map=new Array(colCount);
    var rows=Array.from(table.querySelectorAll('thead tr'));
    for(var r=0;r<rows.length;r++){
      if(rows[r].classList.contains('a-tab-units')) continue;
      var logical=0;
      Array.from(rows[r].children).forEach(function(cell){
        var span=Math.max(1,parseInt(cell.getAttribute('colspan')||'1',10)||1);
        var txt=normalizeInline(exactCellText(cell).replace(/\n/g,' '));
        for(var k=0;k<span&&logical+k<colCount;k++) if(!map[logical+k]) map[logical+k]=txt;
        logical+=span;
      });
      if(map.some(Boolean)) break;
    }
    for(var i=0;i<map.length;i++) if(!map[i]) map[i]='';
    return map;
  }

  function roleIsGeography(role){
    return /^(ORIGEM|ORIGIN|REGIAO|REGION|CORREDOR|CORRIDOR)$/.test(fold(role));
  }

  function cellAlignment(cell,isHeader,role){
    return 'left';
  }

  function cellVisual(cell,row,isHeader,isUnits){
    var target=cell.querySelector('[data-export-color], .a-tab-delta, .a-sorgo-usdt')||cell;
    var color=computedColor(target,isHeader?(isUnits?'#64748B':'#405166'):'#25364A');
    var bg='';
    var weight=computedWeight(target,isHeader?800:400);
    if(cell.classList.contains('a-tab-margin')){
      bg=computedBackground(cell,'#8B8D90')||'#8B8D90';
      color='#FFFFFF';
      weight=800;
    }else if(cell.querySelector('.a-tab-delta.up')){
      color='#DC2626'; weight=800;
    }else if(cell.querySelector('.a-tab-delta.down')){
      color='#16A34A'; weight=800;
    }else if(cell.querySelector('.a-tab-delta.flat')){
      color='#6B7280'; weight=700;
    }else if(cell.classList.contains('a-sorgo-usdt')){
      color='#9A7B19'; weight=800;
    }
    if(row.classList.contains('a-tr-hl')) weight=Math.max(weight,700);
    return {color:color,bg:bg,weight:weight};
  }

  function readTable(card){
    var table=card.querySelector('table.a-tab-table')||card.querySelector('table.a-table');
    if(!table) throw new Error('Tabela de Análise não encontrada');
    var domRows=Array.from(table.querySelectorAll('thead tr, tbody tr')).filter(function(r){return !r.classList.contains('brz-conf-row');});
    var colCount=0;
    domRows.forEach(function(row){
      var n=0;
      Array.from(row.children).forEach(function(cell){
        n+=Math.max(1,parseInt(cell.getAttribute('colspan')||'1',10)||1);
      });
      colCount=Math.max(colCount,n);
    });
    var headerMap=primaryHeaderMap(table,colCount);
    var rows=[];
    domRows.forEach(function(row){
      var inHead=!!row.closest('thead');
      var isUnits=row.classList.contains('a-tab-units');
      var logical=0;
      var cells=[];
      Array.from(row.children).forEach(function(cell){
        var span=Math.max(1,parseInt(cell.getAttribute('colspan')||'1',10)||1);
        var role=headerMap[logical]||'';
        var text=exactCellText(cell);
        var deltaNode=cell.querySelector('.a-tab-delta');
        var deltaDir=deltaNode?(deltaNode.classList.contains('up')?'up':(deltaNode.classList.contains('down')?'down':'flat')):'';
        if(deltaDir) text=normalizeInline(text.replace(/^[▲▼■▴▾]\s*/,''));
        if(!inHead&&span===1&&roleIsGeography(role)) text=repairGeographySpacing(text);
        var visual=cellVisual(cell,row,inHead,isUnits);
        cells.push({
          text:text,
          logical:logical,
          colspan:span,
          align:cellAlignment(cell,inHead,role),
          color:visual.color,
          bg:visual.bg,
          weight:visual.weight,
          role:role,
          isMargin:cell.classList.contains('a-tab-margin'),
          isDelta:!!deltaNode,
          deltaDir:deltaDir
        });
        logical+=span;
      });
      rows.push({
        section:inHead?'head':'body',
        isUnits:isUnits,
        isSection:!inHead&&cells.some(function(c){return c.colspan>1;}),
        isSorghum:row.classList.contains('a-sorgo-sep')||row.classList.contains('a-sorgo-row'),
        highlighted:row.classList.contains('a-tr-hl'),
        cells:cells
      });
    });
    return {
      table:table,
      mode:table.classList.contains('a-tab-table')?'tab':'normal',
      colCount:colCount,
      headers:headerMap,
      rows:rows,
      meta:exportMeta(card,table)
    };
  }

  function fontSpec(weight,size){
    return (weight>=700?'700 ':'400 ')+size+'px "Arial Nova Cond", "Arial Narrow", Arial, sans-serif';
  }

  function semanticMin(role,index,mode){
    var f=fold(role);
    if(/ORIGEM|ORIGIN/.test(f)) return 176;
    if(/REGIAO|REGION|CORREDOR|CORRIDOR/.test(f)) return mode==='tab'?168:146;
    if(/EMBARQUE|SHIPMENT/.test(f)) return 96;
    if(/REF/.test(f)) return 88;
    if(f==='CBOT') return 82;
    if(/CAMBIO|FX/.test(f)) return 92;
    if(/CASH/.test(f)) return 104;
    if(/FRETE|FREIGHT/.test(f)) return 96;
    if(/MODAL/.test(f)) return 78;
    if(/PORTO|PORT/.test(f)) return 96;
    if(/REPLACEMENT/.test(f)) return 128;
    if(/BASIS/.test(f)) return 118;
    if(/GROSS|MARGEM|MARGIN/.test(f)) return 108;
    if(/DOD|WOW|MOM|VAR/.test(f)) return 78;
    if(/CFR/.test(f)) return 144;
    if(/FOB/.test(f)) return 92;
    if(index===0) return mode==='tab'?84:152;
    return 84;
  }

  function semanticMax(role,mode){
    var f=fold(role);
    if(/ORIGEM|ORIGIN/.test(f)) return 260;
    if(/REGIAO|REGION|CORREDOR|CORRIDOR/.test(f)) return 226;
    if(/PORTO|PORT|MODAL/.test(f)) return 145;
    if(/REPLACEMENT|BASIS|GROSS|MARGEM|MARGIN|CFR/.test(f)) return 165;
    if(/EMBARQUE|SHIPMENT|REF|CBOT|CAMBIO|FX|CASH|FRETE|FREIGHT|FOB|DOD|WOW|MOM|VAR/.test(f)) return 130;
    return mode==='tab'?150:190;
  }

  function longestLine(value){
    var lines=String(value||'').split('\n');
    var best='';
    for(var i=0;i<lines.length;i++) if(lines[i].length>best.length) best=lines[i];
    return best;
  }

  function computeWidths(data,measureCtx){
    var widths=[];
    for(var i=0;i<data.colCount;i++) widths[i]=semanticMin(data.headers[i],i,data.mode);
    data.rows.forEach(function(row){
      row.cells.forEach(function(cell){
        if(cell.colspan!==1) return;
        var size=row.section==='head'?(row.isUnits?12.8:14):15.6;
        measureCtx.font=fontSpec(cell.weight,size);
        var measured=Math.ceil(measureCtx.measureText(longestLine(cell.text)).width)+22;
        var cap=semanticMax(data.headers[cell.logical],data.mode);
        widths[cell.logical]=Math.max(widths[cell.logical],Math.min(measured,cap));
      });
    });
    var total=widths.reduce(function(a,b){return a+b;},0);
    var target=data.mode==='tab'?1420:1120;
    if(total<target){
      var candidates=[];
      for(var c=0;c<widths.length;c++){
        var role=fold(data.headers[c]);
        if(/ORIGEM|ORIGIN|REGIAO|REGION|CORREDOR|CORRIDOR|PORTO|PORT/.test(role)) candidates.push(c);
      }
      if(!candidates.length) for(var d=0;d<widths.length;d++) candidates.push(d);
      var add=(target-total)/candidates.length;
      candidates.forEach(function(idx){widths[idx]+=add;});
    }
    return widths.map(function(w){return Math.ceil(w);});
  }

  function splitLongToken(ctx,token,maxWidth){
    var out=[],part='';
    for(var i=0;i<token.length;i++){
      var test=part+token.charAt(i);
      if(part&&ctx.measureText(test).width>maxWidth){out.push(part);part=token.charAt(i);}
      else part=test;
    }
    if(part) out.push(part);
    return out.length?out:[''];
  }

  function wrapText(ctx,value,maxWidth,font,allowWrap){
    ctx.font=font;
    var paragraphs=String(value==null?'':value).split('\n');
    var lines=[];
    paragraphs.forEach(function(paragraph){
      var p=normalizeInline(paragraph);
      if(!p){lines.push('');return;}
      if(!allowWrap||ctx.measureText(p).width<=maxWidth){lines.push(p);return;}
      var words=p.split(' '),line='';
      words.forEach(function(word){
        if(ctx.measureText(word).width>maxWidth){
          if(line){lines.push(line);line='';}
          var pieces=splitLongToken(ctx,word,maxWidth);
          for(var pi=0;pi<pieces.length-1;pi++) lines.push(pieces[pi]);
          line=pieces[pieces.length-1];
          return;
        }
        var test=line?line+' '+word:word;
        if(line&&ctx.measureText(test).width>maxWidth){lines.push(line);line=word;}
        else line=test;
      });
      if(line) lines.push(line);
    });
    return lines.length?lines:[''];
  }

  function columnWidth(widths,start,span){
    var w=0;
    for(var i=start;i<Math.min(widths.length,start+span);i++) w+=widths[i];
    return w;
  }

  function preparedRows(data,widths,measureCtx){
    return data.rows.map(function(row){
      var maxLines=1;
      var cells=row.cells.map(function(cell){
        var size=row.section==='head'?(row.isUnits?12.8:14):15.6;
        var font=fontSpec(cell.weight,size);
        var w=columnWidth(widths,cell.logical,cell.colspan);
        var role=fold(cell.role);
        var allow=row.section==='head'||row.isSection||/ORIGEM|ORIGIN|REGIAO|REGION|CORREDOR|CORRIDOR/.test(role);
        var lines=wrapText(measureCtx,cell.text,Math.max(10,w-18),font,allow);
        maxLines=Math.max(maxLines,lines.length);
        return Object.assign({},cell,{font:font,fontSize:size,lines:lines,width:w});
      });
      var lineH=row.section==='head'?(row.isUnits?14.2:15.8):18;
      var vPad=row.section==='head'?(row.isUnits?10:15):14;
      var minH=row.section==='head'?(row.isUnits?28:38):(row.isSection?36:36);
      var height=Math.max(minH,maxLines*lineH+vPad);
      return Object.assign({},row,{cells:cells,lineHeight:lineH,height:Math.ceil(height)});
    });
  }

  function drawLines(ctx,cell,x,y,w,h,lineHeight){
    ctx.font=cell.font;
    ctx.fillStyle=cell.color||'#25364A';
    ctx.textBaseline='middle';
    if(cell.deltaDir&&cell.lines.length===1){
      var value=cell.lines[0],icon=7,gap=4;
      var start=x+9;
      var mid=y+h/2;
      ctx.beginPath();
      if(cell.deltaDir==='up'){
        ctx.moveTo(start+icon/2,mid-icon/2);
        ctx.lineTo(start+icon,mid+icon/2);
        ctx.lineTo(start,mid+icon/2);
        ctx.closePath();
        ctx.fill();
      }else if(cell.deltaDir==='down'){
        ctx.moveTo(start,mid-icon/2);
        ctx.lineTo(start+icon,mid-icon/2);
        ctx.lineTo(start+icon/2,mid+icon/2);
        ctx.closePath();
        ctx.fill();
      }else{
        ctx.fillRect(start+1.5,mid-2,4,4);
      }
      ctx.textAlign='left';
      ctx.fillText(value,start+icon+gap,mid);
      return;
    }
    var block=cell.lines.length*lineHeight;
    var cy=y+(h-block)/2+lineHeight/2;
    var align=cell.align||'left';
    ctx.textAlign=align;
    var tx=align==='right'?x+w-9:(align==='center'?x+w/2:x+9);
    for(var i=0;i<cell.lines.length;i++) ctx.fillText(cell.lines[i],tx,cy+i*lineHeight);
    ctx.textAlign='left';
  }

  function drawWrappedTitle(ctx,title,x,y,maxWidth){
    var font=fontSpec(800,20);
    var lines=wrapText(ctx,title,maxWidth,font,true).slice(0,2);
    ctx.font=font;
    ctx.fillStyle='#10283A';
    ctx.textBaseline='top';
    ctx.textAlign='left';
    for(var i=0;i<lines.length;i++) ctx.fillText(lines[i],x,y+i*22);
    return lines.length*22;
  }

  function exportLanguage(){
    var lang='pt';
    try{
      if(typeof _currentLang!=='undefined'&&_currentLang) lang=String(_currentLang);
      else if(document.documentElement&&document.documentElement.lang) lang=String(document.documentElement.lang);
    }catch(e){}
    return lang.toLowerCase().indexOf('en')===0?'en':'pt';
  }

  function localizedFooterDate(date){
    var d=date||new Date();
    var dd=String(d.getDate()).padStart(2,'0');
    var mm=String(d.getMonth()+1).padStart(2,'0');
    var yyyy=String(d.getFullYear());
    return exportLanguage()==='en'?(mm+'/'+dd+'/'+yyyy):(dd+'/'+mm+'/'+yyyy);
  }

  function dropColumnsByRole(data, roleRe){
    // Remove colunas cujo role casa com roleRe, reindexando logical e headers.
    var drop={}; // logical index -> true
    Object.keys(data.headers||{}).forEach(function(k){
      if(roleRe.test(fold(data.headers[k]))) drop[parseInt(k,10)]=true;
    });
    var dropList=Object.keys(drop).map(function(x){return parseInt(x,10);});
    if(!dropList.length) return data;
    // mapa antigo->novo índice
    var remap={}, nn=0;
    for(var i=0;i<data.colCount;i++){ if(!drop[i]){ remap[i]=nn; nn++; } }
    // headers novos
    var newHeaders={};
    Object.keys(data.headers).forEach(function(k){ var ki=parseInt(k,10);
      if(!drop[ki]) newHeaders[remap[ki]]=data.headers[k]; });
    // linhas: filtra células (respeitando que colunas dropadas têm colspan 1 no corpo/header simples)
    data.rows.forEach(function(row){
      var out=[], lg=0;
      row.cells.forEach(function(c){
        // uma célula pode cobrir várias colunas (colspan>1, ex. separador Sorgo/seções)
        if(c.colspan===1){
          if(!drop[c.logical]){ c.logical=remap[c.logical]; out.push(c); }
        } else {
          // colspan largo (título de seção): reduz o span pelo nº de colunas dropadas que ele cobre
          var covered=0; for(var x=c.logical;x<c.logical+c.colspan;x++){ if(drop[x]) covered++; }
          c.colspan=Math.max(1,c.colspan-covered);
          c.logical=remap[c.logical]!=null?remap[c.logical]:0;
          out.push(c);
        }
      });
      row.cells=out;
    });
    data.colCount=nn;
    data.headers=newHeaders;
    return data;
  }

  function buildCanvas(card){
    var data=readTable(card);
    /* Ocultar a coluna Frete SOMENTE na foto da tabela normal (decisão João 05/08).
       A TAB mantém o Frete; a tela (DOM) não é afetada — só o export. */
    if(data.mode==='normal') data=dropColumnsByRole(data,/FRETE|FREIGHT/);
    var probe=canvas2d();
    var widths=computeWidths(data,probe.ctx);
    var rows=preparedRows(data,widths,probe.ctx);
    var totalW=widths.reduce(function(a,b){return a+b;},0);
    var marginX=28,top=24,brandW=232;
    var pageW=Math.max(1180,totalW+marginX*2);
    var titleMax=Math.max(300,pageW-marginX*2-brandW-32);
    probe.ctx.font=fontSpec(800,20);
    var titleLines=wrapText(probe.ctx,data.meta.title,titleMax,fontSpec(800,20),true).slice(0,2);
    var titleH=Math.max(22,titleLines.length*22);
    var subH=0;
    var headerH=Math.max(46,titleH+8);
    var tableY=top+headerH+12;
    var tableH=rows.reduce(function(a,r){return a+r.height;},0);
    var footGap=15,footH=30,bottom=18;
    var pageH=tableY+tableH+footGap+footH+bottom;
    /* TAMANHO DA FOTO = TAMANHO DA TABELA (João 05/08, revisto após os exemplos):
       nada de página forçada em retrato — isso enchia a imagem de branco em tabelas curtas.
       A página acompanha o conteúdo; tabelas longas saem naturalmente verticais. */
    var scale=2;
    var pixels=pageW*pageH*scale*scale;
    if(pixels>72000000) scale=Math.max(1.25,Math.sqrt(72000000/(pageW*pageH)));
    if(pageW*scale>16000) scale=Math.min(scale,16000/pageW);

    var out=canvas2d(),canvas=out.canvas,ctx=out.ctx;
    canvas.width=Math.max(1,Math.ceil(pageW*scale));
    canvas.height=Math.max(1,Math.ceil(pageH*scale));
    canvas.style.width=pageW+'px';
    canvas.style.height=pageH+'px';
    ctx.scale(scale,scale);
    ctx.fillStyle='#FFFFFF';
    ctx.fillRect(0,0,pageW,pageH);

    drawWrappedTitle(ctx,data.meta.title,marginX,top,titleMax);
    ctx.textAlign='right';
    ctx.font=fontSpec(800,12);
    ctx.fillStyle='#1A3A5C';
    ctx.textBaseline='top';
    ctx.fillText(BRAND.name||'AGRINVEST COMMODITIES',pageW-marginX,top+1);
    ctx.font=fontSpec(400,11);
    ctx.fillStyle='#6B7280';
    ctx.fillText(BRAND.sub||'A Division of Marex',pageW-marginX,top+16);
    ctx.textAlign='left';
    ctx.strokeStyle='#1A3A5C';
    ctx.lineWidth=2.25;
    ctx.beginPath();
    ctx.moveTo(marginX,top+headerH-5);
    ctx.lineTo(pageW-marginX,top+headerH-5);
    ctx.stroke();

    var xPos=[marginX];
    widths.forEach(function(w){xPos.push(xPos[xPos.length-1]+w);});
    var y=tableY;
    var lastHeadIndex=-1;
    for(var hi=0;hi<rows.length;hi++) if(rows[hi].section==='head') lastHeadIndex=hi;

    rows.forEach(function(row,rowIndex){
      var rowBg='';
      if(row.section==='head') rowBg=row.isUnits?'#F7F9FB':'#F1F4F7';
      else if(row.isSection) rowBg='#FBF8EF';
      else if(row.highlighted) rowBg='#EEF4FC';
      else if(row.isSorghum) rowBg='#FCFAF4';
      if(rowBg){ctx.fillStyle=rowBg;ctx.fillRect(marginX,y,totalW,row.height);}

      row.cells.forEach(function(cell){
        var x=xPos[cell.logical];
        var w=columnWidth(widths,cell.logical,cell.colspan);
        if(cell.bg){ctx.fillStyle=cell.bg;ctx.fillRect(x,y,w,row.height);}
        drawLines(ctx,cell,x,y,w,row.height,row.lineHeight);
      });

      if(row.isSection){
        ctx.strokeStyle='#B5963E';
        ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.moveTo(marginX,y+0.75);
        ctx.lineTo(marginX+totalW,y+0.75);
        ctx.stroke();
      }

      ctx.strokeStyle=(rowIndex===lastHeadIndex)?'#1A3A5C':'#E6EBF0';
      ctx.lineWidth=(rowIndex===lastHeadIndex)?1.6:1;
      ctx.beginPath();
      ctx.moveTo(marginX,y+row.height);
      ctx.lineTo(marginX+totalW,y+row.height);
      ctx.stroke();
      y+=row.height;
    });

    ctx.strokeStyle='#E6EBF0';
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(marginX,tableY);
    ctx.lineTo(marginX+totalW,tableY);
    ctx.stroke();

    var fy=tableY+tableH+footGap;
    ctx.strokeStyle='#E3E8EE';
    ctx.beginPath();
    ctx.moveTo(marginX,fy);
    ctx.lineTo(pageW-marginX,fy);
    ctx.stroke();
    ctx.textAlign='left';
    ctx.textBaseline='top';
    ctx.font=fontSpec(400,10.5);
    ctx.fillStyle='#9CA3AF';
    ctx.fillText('BRZ Replacement Engine',marginX,fy+9);
    var today=localizedFooterDate(new Date());
    ctx.textAlign='right';
    ctx.font=fontSpec(700,13);
    ctx.fillStyle='#1A3A5C';
    ctx.fillText(today,pageW-marginX,fy+7);
    ctx.textAlign='left';

    canvas.setAttribute('data-brz-analysis-export-version',VERSION);
    canvas.setAttribute('data-brz-analysis-export-mode',data.mode);
    return canvas;
  }

  function slug(value){
    if(typeof window._brzSlug==='function') return window._brzSlug(value);
    var s=String(value||'analise');
    try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){}
    return s.replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,50)||'analise';
  }

  function downloadCanvas(title,canvas){
    var name='BRZ_'+slug(title)+'_'+(new Date()).toISOString().slice(0,10)+'.png';
    if(canvas.toBlob){
      canvas.toBlob(function(blob){
        if(!blob){downloadDataUrl();return;}
        var url=URL.createObjectURL(blob);
        var a=document.createElement('a');
        a.download=name;
        a.href=url;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function(){try{URL.revokeObjectURL(url);}catch(e){}},1500);
      },'image/png');
      return;
    }
    downloadDataUrl();
    function downloadDataUrl(){
      var a=document.createElement('a');
      a.download=name;
      a.href=canvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  function fixComparisonPlaceholder(){
    try{
      var sels=document.querySelectorAll('#analise select[onchange*="setAnaliseCompare"]');
      for(var i=0;i<sels.length;i++){
        var opt=sels[i].querySelector('option[value=""]');
        if(opt) opt.textContent=' - ';
      }
    }catch(e){}
  }

  try{
    if(typeof window.renderAnalise==='function'){
      var priorRenderAnalise=window.renderAnalise;
      window.renderAnalise=function(){
        var result=priorRenderAnalise.apply(this,arguments);
        fixComparisonPlaceholder();
        return result;
      };
    }
  }catch(e){}
  setTimeout(fixComparisonPlaceholder,0);

  window.brzExportCard=function(btn){
    var card=cardFromButton(btn);
    if(!isAnalysisTableCard(card)) return previousExport?previousExport(btn):void 0;
    try{
      var data=readTable(card);
      var canvas=buildCanvas(card);
      downloadCanvas(data.meta.title,canvas);
    }catch(e){
      console.error('BRZ deterministic analysis export V11',e);
      alert('Falha ao gerar PNG da tabela: '+(e&&e.message?e.message:e));
    }
  };

  window.brzCardCanvas=function(card){
    if(!isAnalysisTableCard(card)) return previousCanvas?previousCanvas(card):Promise.reject(new Error('Card não encontrado'));
    try{return Promise.resolve(buildCanvas(card));}
    catch(e){return Promise.reject(e);}
  };

  window.__BRZ_ANALYSIS_EXPORT_V11__={
    version:VERSION,
    readTable:readTable,
    buildCanvas:buildCanvas,
    fixComparisonPlaceholder:fixComparisonPlaceholder,
    localizedFooterDate:localizedFooterDate
  };
})();
