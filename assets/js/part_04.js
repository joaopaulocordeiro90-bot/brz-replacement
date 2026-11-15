
/* BRZ Replacement · V2k export engines · canvas PNG and self-contained A4 PDF
   Keep this script after r3 base script; do not change market data or trading snapshots. */
(function(){
 'use strict';
 var PT=function(pt,en){return typeof ppeL==='function'?ppeL(pt,en):pt;};
 var S=function(v){return v===null||v===undefined?'':String(v);};
 var FM=function(v,n){return v===null||v===undefined||!Number.isFinite(Number(v))?'—':(typeof r3F==='function'?r3F(Number(v),n):Number(v).toFixed(n));};
 var safe=function(v){return S(v).replace(/\s+/g,' ').trim();};
 var fnameDate=function(){return (typeof r3RefDate==='function'?r3RefDate():'2026-10-15');};
 var prettyDate=function(d){d=S(d);return /^\d{4}-\d{2}-\d{2}$/.test(d)?d.slice(8)+'/'+d.slice(5,7)+'/'+d.slice(0,4):d;};
 function saveBlob(blob, name){
   var url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
   setTimeout(function(){URL.revokeObjectURL(url);},3000);
 }
 function color(hex){return hex;}
 function drawText(ctx,txt,x,y,maxWidth,align,font,ink){
   txt=safe(txt);ctx.font=font||'13px Arial';ctx.fillStyle=ink||'#243648';
   maxWidth=Math.max(8,maxWidth||500);while(txt.length>1&&ctx.measureText(txt).width>maxWidth)txt=txt.slice(0,-2)+'…';
   ctx.textAlign=align||'left';ctx.fillText(txt,x,y);
 }
 function drawDerivPNG(card){
   /* 09/11/2026 (João): foto sem a coluna de frete, sem sub-legendas nos números (só a praça mantém a linha de região) e com a faixa dos negócios fechados no padrão do sorgo */
   var prod=(card.id==='r3-card-Soymeal'?'Soymeal':'Soyoil');
   var rows=typeof r3ExportDerivRows==='function'?r3ExportDerivRows(prod):[];
   var title=prod==='Soymeal'?PT('Replacement Farelo','Soymeal Replacement'):PT('Replacement Óleo','Soyoil Replacement');
   var cols=[PT('ORIGEM','ORIGIN'),PT('PORTO','PORT'),PT('PREÇO','PRICE')+' (R$/t)',PT('FOB PORTO','FOB PORT')+' (R$/t)','FX (R$/US$)',PT('REPLACEMENT FOB','FOB REPLACEMENT')+' (US$/t)','BASIS ('+r3DerivativeBasisUnit(prod)+')'];
   if(prod==='Soymeal')cols=cols.concat(['D-1','D-7','D-30']);
   var widths=prod==='Soymeal'?[265,170,185,255,145,275,245,140,140,140]:[270,190,200,250,150,290,292], W=prod==='Soymeal'?2024:1706,L=32,headerY=158,rowTop=179,rowH=62,bandH=44;
   var items=[]; rows.forEach(function(r,k){ if(r.isTrade && (k===0||!rows[k-1].isTrade)) items.push({band:true}); items.push({row:r}); });
   var H=rowTop+items.reduce(function(a,it){return a+(it.band?bandH:rowH);},0)+(items.length?0:rowH)+(prod==='Soymeal'?94:68);
   var canvas=document.createElement('canvas');canvas.width=W*2;canvas.height=H*2;
   var ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,W,H);
   ctx.textBaseline='alphabetic';
   drawText(ctx,title,L,52,850,'left','bold 25px Arial','#10283A');
   drawText(ctx,'AGRINVEST COMMODITIES',W-33,40,400,'right','bold 15px Arial','#1A3A5C');
   drawText(ctx,'A Division of Marex',W-33,60,400,'right','12px Arial','#6B7280');
   ctx.strokeStyle='#1A3A5C';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(L,79);ctx.lineTo(W-L,79);ctx.stroke();
   var x=L;cols.forEach(function(c,i){
     drawText(ctx,c,i<2?x+12:x+widths[i]-10,headerY,widths[i]-22,i<2?'left':'right','bold 13px Arial','#667487');x+=widths[i];
   });
   ctx.beginPath();ctx.moveTo(L,171);ctx.lineTo(W-L,171);ctx.stroke();
   var yy=rowTop, zebra=0, nTrades=rows.filter(function(r){return r.isTrade;}).length;
   items.forEach(function(it){
     if(it.band){
       var g=ctx.createLinearGradient(L,0,W-L,0); g.addColorStop(0,'rgba(181,150,62,0.20)'); g.addColorStop(1,'rgba(181,150,62,0.04)');
       ctx.fillStyle=g; ctx.fillRect(L,yy-7,W-2*L,bandH);
       ctx.strokeStyle='#B5963E'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(L,yy-7); ctx.lineTo(W-L,yy-7); ctx.stroke();
       ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(L,yy-7+bandH); ctx.lineTo(W-L,yy-7+bandH); ctx.stroke();
       drawText(ctx,PT('NEGÓCIOS FECHADOS · MESA AGRINVEST','CLOSED TRADES · AGRINVEST DESK'),L+14,yy+20,520,'left','bold 13px Arial','#0B1F3A');
       drawText(ctx,prettyDate(fnameDate())+' · '+nTrades+' '+PT('negócio(s)','trade(s)')+' · '+PT('replacement FOB em US$/t · físico convertido + frete até o porto','FOB replacement in US$/t · cash converted + inland freight'),L+330,yy+20,1200,'left','12px Arial','#54748D');
       yy+=bandH; zebra=0; return;
     }
     var r=it.row;
     if(zebra%2){ctx.fillStyle='#F7F9FC';ctx.fillRect(L,yy-7,W-2*L,rowH);} zebra++;
     var v=[r.city,r.port,FM(r.phys,2),FM(r.fobPortR,2),FM(r.fx,4),FM(r.replacement,2),r3DerivativeBasisFormatted(r.basis,prod)];
     if(prod==='Soymeal')v=v.concat([r3MealDeltaFormat(r.mealDeltas&&r.mealDeltas.d1),r3MealDeltaFormat(r.mealDeltas&&r.mealDeltas.d7),r3MealDeltaFormat(r.mealDeltas&&r.mealDeltas.d30)]);
     var subOrig=r.isTrade?'':safe(r.region); /* 09/11 (João): negócio da mesa na foto só com a praça; sem partes nem tonelada */
     var xx=L;
     for(var i=0;i<widths.length;i++){
       var align=i<2?'left':'right', xpos=i<2?xx+12:xx+widths[i]-11;
       drawText(ctx,v[i],xpos,yy+26,widths[i]-23,align,(i>=5)?'bold 17px Arial':i===0?'bold 16px Arial':'15px Arial',(i>=7&&r.mealDeltas&&[r.mealDeltas.d1,r.mealDeltas.d7,r.mealDeltas.d30][i-7]!=null)?([r.mealDeltas.d1,r.mealDeltas.d7,r.mealDeltas.d30][i-7]>0?'#137B53':[r.mealDeltas.d1,r.mealDeltas.d7,r.mealDeltas.d30][i-7]<0?'#C14438':'#10283A'):(i>=5?'#10283A':'#2D4054'));
       if(i===0&&subOrig)drawText(ctx,subOrig,xpos,yy+43,widths[i]-24,align,'11px Arial','#7C899A');
       xx+=widths[i];
     }
     ctx.strokeStyle='#E3E9F0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(L,yy+rowH-7);ctx.lineTo(W-L,yy+rowH-7);ctx.stroke();
     yy+=rowH;
   });
   if(!rows.length) drawText(ctx,PT('Sem origens selecionadas','No origins selected'),L+13,rowTop+32,450,'left','15px Arial','#6B7280');
   var footY=H-38;ctx.strokeStyle='#DCE2E9';ctx.beginPath();ctx.moveTo(L,footY-17);ctx.lineTo(W-L,footY-17);ctx.stroke();
   if(prod==='Soymeal')drawText(ctx,'D-1 11/11 · D-7 05/11 · D-30 13/10 · Δ basis (US$/st); N/D = referência histórica indisponível · frete de grãos indicativo',L,footY-27,W-90,'left','12px Arial','#61738A');
   drawText(ctx,'BRZ Replacement Engine',L,footY+1,400,'left','12px Arial','#8893A1');
   drawText(ctx,prettyDate(fnameDate()),W-L,footY+1,400,'right','bold 14px Arial','#1A3A5C');
   canvas.toBlob(function(blob){if(blob)saveBlob(blob,'BRZ_Replacement_'+(prod==='Soymeal'?'Farelo':'Oleo')+'_'+fnameDate()+'.png');else alert(PT('Falha ao gerar PNG','Failed to generate PNG'));},'image/png');
 }
 // PDF 1.4 writer. Standard WinAnsi Helvetica fonts; portrait A4, 14 rows per page.
 function char1252(c){var k=c.charCodeAt(0);if(k<=255)return String.fromCharCode(k);var map={'—':'-','–':'-','’':"'",'‘':"'",'“':'"','”':'"','…':String.fromCharCode(133),'€':String.fromCharCode(128),'™':String.fromCharCode(153),'−':'-','→':'>','•':'*'};return map[c]||'?';}
 function latin(v){return Array.from(S(v)).map(char1252).join('');}
 function literal(v){return '('+latin(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/\r|\n/g,' ')+')';}
 function fnum(v){return (Math.round(v*100)/100).toFixed(2);}
 var sizes=[54,43,29,39,45,27,42,43,37,23,23,23,45,52,45];
 // Preserve full Truck / Truck+Rail shipments as a unit across A4 page breaks.
 function makePDFPages(rows){
   var zones=[],groups={};
   rows.forEach(function(row){var key=row.region;if(!groups[key]){groups[key]=[];zones.push(key);}groups[key].push(row);});
   var pages=[];
   zones.forEach(function(city){
     var data=groups[city],batches=[],batch=[],groupNo=-1,previousShip=null;
     data.forEach(function(r){
       if(previousShip!==r.ship){groupNo++;previousShip=r.ship;}
       var last=batch.length?batch[batch.length-1]:null;
       // Group rows by shipment before chunking into pages.
       if(last&&last.ship===r.ship){last.rows.push(r);}
       else batch.push({ship:r.ship,band:groupNo,rows:[r]});
     });
     var current=[],count=0;
     batch.forEach(function(g){
       if(count && count+g.rows.length>16){batches.push(current);current=[];count=0;}
       current.push(g);count+=g.rows.length;
     });
     if(current.length)batches.push(current);
     batches.forEach(function(batch,i){
       var lines=[];
       batch.forEach(function(g){g.rows.forEach(function(r){lines.push({row:r,band:g.band,newGroup:r===g.rows[0]});});});
       pages.push({city:city,lines:lines,part:i+1,parts:batches.length});
     });
   });
   return pages;
 }
 function buildPDF(rows){
   var pages=makePDFPages(rows),objs=[null,'','',
     '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
     '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
   var pageIds=[];
   var PAGEW=595.28,PAGEH=841.89,X0=12.65,X1=582.65;
   var measure=document.createElement('canvas').getContext('2d');
   function widthApprox(s,fs,bold){measure.font=(bold?'bold ':'')+fs+'px Arial';return measure.measureText(latin(s)).width;}
   pages.forEach(function(pg,idx){
     var cmd=[];
     function rect(x,y,w,h,fill){var rgb=fill.match(/\w\w/g).map(function(v){return parseInt(v,16)/255;});cmd.push(fnum(rgb[0])+' '+fnum(rgb[1])+' '+fnum(rgb[2])+' rg '+fnum(x)+' '+fnum(y)+' '+fnum(w)+' '+fnum(h)+' re f');}
     function line(x1,y1,x2,y2,c,th){var rgb=c.match(/\w\w/g).map(function(v){return parseInt(v,16)/255;});cmd.push(fnum(rgb[0])+' '+fnum(rgb[1])+' '+fnum(rgb[2])+' RG '+fnum(th||1)+' w '+fnum(x1)+' '+fnum(y1)+' m '+fnum(x2)+' '+fnum(y2)+' l S');}
     function write(t,x,y,fs,bold,fill,align,max){
       t=safe(t);var limit=Math.max(6,(max||200)-4),out=t;
       while(out.length>1&&widthApprox(out,fs,bold)>limit)out=out.slice(0,-2)+'…';
       var rgb=fill.match(/\w\w/g).map(function(v){return parseInt(v,16)/255;});
       var tw=widthApprox(out,fs,bold),pos=align==='right'?x-tw:align==='center'?x-tw/2:x;
       cmd.push(fnum(rgb[0])+' '+fnum(rgb[1])+' '+fnum(rgb[2])+' rg BT /F'+(bold?'2':'1')+' '+fnum(fs)+' Tf 1 0 0 1 '+fnum(pos)+' '+fnum(y)+' Tm '+literal(out)+' Tj ET');
     }
     rect(0,0,PAGEW,PAGEH,'FFFFFF');
     write(PT('Preços reportados pela mesa Agrinvest','Prices reported by Agrinvest Desk'),X0,802,16,true,'10283A','left',346);
     write('AGRINVEST COMMODITIES',X1,802,8.4,true,'1A3A5C','right',170);
     write('A Division of Marex',X1,790,7.4,false,'6B7280','right',170);
     line(X0,777,X1,777,'1A3A5C',1.5);
     write(pg.city,X0,753,14,true,'10283A','left',345);
     var reg=pg.lines[0]?pg.lines[0].row:null;
     write((reg&&reg.uf?S(reg.uf)+'  |  ':'')+PT('Porto','Port')+': '+(reg&&reg.port||'—')+'  |  '+prettyDate(fnameDate()),X0,738,8.2,false,'6B7280','left',490);
     if(pg.lines.some(function(d){return d.row.modal==='T+R';}))
       write(PT('T = rodoviário  |  T+R = rodoviário + ferrovia','T = truck  |  T+R = truck + rail'),X0,725,7.3,false,'6B7280','left',510);
     if(pg.parts>1) write((pg.part===1?PT('Parte','Part'):PT('Continuação','Continued'))+' '+pg.part+'/'+pg.parts,X1,754,8,false,'6B7280','right',155);
     var headerTop=710,headH=34,rowH=36.5,headerBottom=headerTop-headH;
     rect(X0,headerBottom,X1-X0,headH,'EFF3F8');
     var labelRows=[
       [PT('Origem','Origin')],[PT('Embarque','Shipment')],['CBOT'],['Chicago','¢/b'],['Cash','R$/sc'],[PT('Modal','Mode')],[PT('Frete','Freight'),'R$/t'],[PT('Porto','Port')],['FOB','¢/b'],['DoD'],['WoW'],['MoM'],['CFR China','¢/b'],['Basis CFR','China'],['Gross','Margin']
     ];
     var xi=X0;
     labelRows.forEach(function(lines,i){
       var align=[0,1,2,5,7].indexOf(i)>=0?'left':'right',pos=align==='left'?xi+3:xi+sizes[i]-3;
       lines.forEach(function(part,li){
         var fs=(i===1?6.1:([9,10,11].indexOf(i)>=0?5.5:6.6));
         while(fs>5.0&&widthApprox(part,fs,true)>sizes[i]-6)fs-=0.2;
         write(part,pos,headerTop-(lines.length===1?22:(li===0?14:27)),fs,true,'5C6E83',align,sizes[i]-5);
       });
       xi+=sizes[i];
     });
     line(X0,headerBottom,X1,headerBottom,'1A3A5C',1.25);
     pg.lines.forEach(function(entry,i){
       var r=entry.row,y=headerBottom-(i+1)*rowH;
       if(entry.band%2) rect(X0,y,X1-X0,rowH,'F0F4F9');
       if(entry.newGroup){
         // Readable separator appears only when shipment changes.
         line(X0,y+rowH,X1,y+rowH,'B9C9D9',0.7);
         rect(X0,y+1,2.2,rowH-2,entry.band%2?'9AB1C9':'C4D3E3');
       }
       var shipText=S(r.ship).replace(/^SPOT · /,'');
       var vals=[S(r.region).replace(/ - [A-Z]{2}$/,''),shipText,r.contract,FM(r.cbot,1),FM(r.cash,2),r.modal,FM(r.freight,0),r.port,FM(r.fob,0),r.dod==null?'—':((r.dod>0?'+':'')+FM(r.dod,0)),r.wow==null?'—':((r.wow>0?'+':'')+FM(r.wow,0)),r.mom==null?'—':((r.mom>0?'+':'')+FM(r.mom,0)),FM(r.cfr,0),FM(r.chinaBasis,0),r.margin==null?'—':((r.margin>0?'+':'')+FM(r.margin,0))];
       var notes=[r.uf||'',r.ship.indexOf('SPOT ·')===0?'SPOT':'','', '',r.indicative?(r.freightProxy?'PPE proxy frete':'PPE ind.'):(r.cashType==='Cash'?'Cash '+String(r.quoteDate||'').slice(5):r.cashType||''),'','','',r.indicative?(r.quote&&r.quote.proxy?'Ref. '+r.quote.benchmarkPort:'PPE ind.'):'','','','','',r.chinaSide||''];
       var x=X0;
       for(var j=0;j<sizes.length;j++){
         var left=[0,1,2,5,7].indexOf(j)>=0,xp=left?x+3:x+sizes[j]-3;
         var col=j===14?(r.margin==null?'8895A3':r.margin>0?'009E55':r.margin<0?'D71920':'35465A'):'2B3E52';
         var fs=(j===0?6.45:j===1?6.85:j===7?6.65:7.15);
         write(vals[j],xp,y+21,fs,j===14||j===1,col,left?'left':'right',sizes[j]-6);
         if(notes[j]) write(notes[j],xp,y+8,5.8,false,'74849A',left?'left':'right',sizes[j]-6);
         x+=sizes[j];
       }
       line(X0,y,X1,y,'DFE7EF',0.55);
     });
     line(X0,39,X1,39,'DDE5ED',0.75);
     write('BRZ Replacement Engine',X0,26,7.5,false,'8794A4','left',260);
     write(PT('Página','Page')+' '+(idx+1)+'/'+pages.length,X1,26,7.5,true,'1A3A5C','right',130);
     var stream=cmd.join('\n')+'\n';
     var streamId=objs.push('<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream')-1;
     var pageId=objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+streamId+' 0 R >>')-1;
     pageIds.push(pageId);
   });
   objs[1]='<< /Type /Catalog /Pages 2 0 R >>';
   objs[2]='<< /Type /Pages /Kids ['+pageIds.map(function(id){return id+' 0 R';}).join(' ')+'] /Count '+pageIds.length+' >>';
   var result='%PDF-1.4\n%BRZ1\n',offsets=[0];
   for(var j=1;j<objs.length;j++){offsets[j]=result.length;result+=j+' 0 obj\n'+objs[j]+'\nendobj\n';}
   var xref=result.length;
   result+='xref\n0 '+objs.length+'\n0000000000 65535 f \n';
   for(var k=1;k<objs.length;k++)result+=('0000000000'+offsets[k]).slice(-10)+' 00000 n \n';
   result+='trailer\n<< /Size '+objs.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
   var bytes=new Uint8Array(result.length);for(var z=0;z<result.length;z++)bytes[z]=result.charCodeAt(z)&255;
   return new Blob([bytes],{type:'application/pdf'});
 }
 function exportSoyPDF(){
   var rows=typeof r3ExportSoyRows==='function'?r3ExportSoyRows():[];
   if(!rows.length){alert(PT('Nenhuma linha de soja selecionada.','No selected soybean rows.'));return;}
   var pdf=buildPDF(rows);
   saveBlob(pdf,'BRZ_Replacement_Soja_'+fnameDate()+'.pdf');
 }
 window.r3ExportCard=function(card){
   if(!card)return;
   try{
     if(card.id==='r3-card-soy'){exportSoyPDF();return;}
     if(card.id==='r3-card-Soymeal'||card.id==='r3-card-Soyoil'){drawDerivPNG(card);return;}
     alert(PT('Tabela desconhecida','Unknown table'));
   }catch(err){console.error('Exportação R3 V2k:',err);alert(PT('Não foi possível exportar: ','Export failed: ')+err.message);}
 };
 window.__r3V2kTest={buildPDF:buildPDF,makePDFPages:makePDFPages,drawDerivPNG:drawDerivPNG,exportSoyPDF:exportSoyPDF};
})();

