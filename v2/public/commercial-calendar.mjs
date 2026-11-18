// BRZ Replacement 2.0 — regras de calendário e frete obtidas do HTML operacional C49/V4GE.
// Referências: dataRules V4EL-1 (12/11/2026), brzMesesCBOT, brzDolEmbarque,
// brzRailDiscountFactor e calcReplacement. Sem recorrer a dados de mercado externos.
// Pure functions: não alteram histórico, DB, preço nem parâmetros persistidos.
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PT=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const LETTERS="FGHJKMNQUVXZ";
const EN_BY_PT={jan:"Jan",fev:"Feb",mar:"Mar",abr:"Apr",mai:"May",jun:"Jun",jul:"Jul",ago:"Aug",set:"Sep",out:"Oct",nov:"Nov",dez:"Dec"};
const MONTH_WORDS={janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
const clean=x=>String(x??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
function isoDateValid(s){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s??""));if(!m)return false;const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));return d.getUTCFullYear()===+m[1]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[3];}
function monthYear(year,month){if(!Number.isInteger(year)||!Number.isInteger(month)||month<1||month>12)return null;return String(year)+"-"+String(month).padStart(2,"0");}
export function parseShipMonth(value){
 const s=String(value??"").trim();
 if(/^20\d{2}-(0[1-9]|1[0-2])$/.test(s))return s;
 const m=/^([A-Za-z]{3})-(\d{2})$/.exec(s);
 if(m){const word=clean(m[1]);const en=EN_BY_PT[word]||MONTHS.find(x=>clean(x)===word);const n=MONTHS.indexOf(en);return n<0?null:monthYear(2000+Number(m[2]),n+1);}
 return null;
}
export function nextMonth(ym){const s=parseShipMonth(ym);if(!s)return null;const [y,m]=s.split("-").map(Number);return m===12?monthYear(y+1,1):monthYear(y,m+1);}
function fromDate(date){return isoDateValid(date)?date.slice(0,7):null;}
function pickupMonth(trade){
 if(isoDateValid(trade?.window_end))return {month:fromDate(trade.window_end),source:"fim_da_retirada"};
 if(isoDateValid(trade?.window_start))return {month:fromDate(trade.window_start),source:"inicio_da_retirada_sem_fim"};
 const notes=clean(trade?.notes);
 const status=clean(trade?.crop_year)+" "+clean(trade?.status)+" "+notes;
 const word=status.match(/\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/);
 if(word&&isoDateValid(trade?.trade_date)){
  const n=MONTH_WORDS[word[1]],year=Number(trade.trade_date.slice(0,4));
  return {month:monthYear(year,n),source:"mes_por_extenso_sem_ano_verificado"};
 }
 if(/\b(disponivel|imediat[oa]|spot)\b/.test(status)&&isoDateValid(trade?.trade_date))
  return {month:fromDate(trade.trade_date),source:"spot_sem_data"};
 return {month:null,source:"sem_data_de_retirada"};
}
export function inferShipment({trade,product,port}={}){
 const p=clean(product||trade?.product);
 const pick=pickupMonth(trade);
 if(!pick.month)return {shipMonth:null,source:pick.source,confidence:"INDETERMINADO",exception:null};
 let ship=nextMonth(pick.month),exception=null;
 const isCorn=p==="milho"||p==="sorgo";
 if(isCorn&&clean(port).replace(/^porto (?:de|do|da) /,"")==="santos"&&ship.endsWith("-01")){
  ship=pick.month;exception="milho_santos_janeiro_para_dezembro";
 }
 return {shipMonth:ship,pickupMonth:pick.month,source:pick.source,
  confidence:pick.source==="mes_por_extenso_sem_ano_verificado"?"INDICATIVO":"REGRA_VIGENTE",exception};
}
const SOY=[
 ["2000-01-01",{Dec:"F+1"}],
 ["2026-07-29",{Aug:"X",Sep:"X",Oct:"X",Nov:"X",Dec:"F+1"}],
 ["2026-08-01",{Jan:"H",Feb:"H",Mar:"K",Apr:"K",May:"N",Jun:"N",Jul:"Q",Aug:"X",Sep:"X",Oct:"X",Nov:"X",Dec:"F+1"}],
 ["2026-10-26",{Jan:"H",Feb:"H",Mar:"H",Apr:"K",May:"N",Jun:"N",Jul:"Q",Aug:"X",Sep:"X",Oct:"X",Nov:"X",Dec:"F+1"}],
 ["2026-11-04",{Jan:"H",Feb:"H",Mar:"H",Apr:"K",May:"N",Jun:"N",Jul:"Q",Aug:"U",Sep:"X",Oct:"X",Nov:"X",Dec:"F+1"}]
];
const CORN=[
 ["2026-08-03",{Jan:"Z",Feb:"Z",Mar:"Z",Apr:"Z",May:"Z",Jun:"Z",Jul:"Z",Aug:"Z",Sep:"Z",Oct:"Z",Nov:"Z",Dec:"Z"}],
 ["2026-10-01",{Jan:"H",Feb:"H",Mar:"H",Apr:"Z",May:"Z",Jun:"Z",Jul:"Z",Aug:"Z",Sep:"Z",Oct:"Z",Nov:"Z",Dec:"Z"}],
 ["2026-11-04",{Jan:"H",Feb:"H",Mar:"H",Apr:"K",May:"K",Jun:"N",Jul:"Z",Aug:"Z",Sep:"Z",Oct:"Z",Nov:"Z",Dec:"Z"}]
];
export function expectedCbotContract({product,shipMonth,tradeDate}={}){
 const ym=parseShipMonth(shipMonth);
 if(!ym||!isoDateValid(tradeDate))return {contract:null,reason:"Embarque ou data do negócio inválida"};
 const p=clean(product),regimes=p==="soja"?SOY:(p==="milho"||p==="sorgo"?CORN:null);
 if(!regimes)return {contract:null,reason:"Produto sem regra CBOT registrada"};
 const month=Number(ym.slice(5))-1,monthKey=MONTHS[month],year=Number(ym.slice(2,4));
 const regimesValid=regimes.filter(([since])=>tradeDate>=since);
 if(!regimesValid.length)return {contract:null,reason:"Vigência histórica CBOT anterior à tabela disponível"};
 const [since,map]=regimesValid[regimesValid.length-1];
 let code=map[monthKey]||null;
 let override=null;
 // Auditoria V4GI/C53 (17/11): milho SET/27 usa U27; C49 tinha Z27.
 // A exceção é posterior ao C49; aplica-se a novos negócios a partir de 17/11.
 if((p==="milho"||p==="sorgo")&&tradeDate>="2026-11-17"&&ym==="2027-09"){
  code="U";override="AUDITORIA_V4GI_C53_SET27_U27";
 }
 if(!code)return {contract:null,reason:"Sem contrato definido para este mês na vigência "+since,validSince:since};
 const match=/^([FGHJKMNQUVXZ])(\+1)?$/.exec(code);
 if(!match)return {contract:null,reason:"Código de regra inválido"};
 const yy=(year+(match[2]?1:0))%100;
 return {contract:match[1]+String(yy).padStart(2,"0"),validSince:since,
  rule:p==="soja"?"meses.cbot.soja":"meses.cbot.milho",override,
  reference:"C49/dataRules V4EL-1"+(override?" + C53":"")};
}
export function expectedDolContract(shipMonth){
 const ym=parseShipMonth(shipMonth);if(!ym)return null;
 const month=Number(ym.slice(5))-1,yy=ym.slice(2,4);
 return {contract:"DOL"+LETTERS[month]+yy,key:PT[month]+yy};
}
function asMoney(x,label){if(x==null||x==="")return 0;const n=Number(x);if(!Number.isFinite(n)||n<0)throw Error(label+" inválido");return n;}
function amountOverride(x,fallback,max=1){if(x===null||x===undefined||x==="")return fallback;const n=Number(x);return Number.isFinite(n)&&n>=0&&n<=max?n:fallback;}
export function railDiscount({port,originUf,shipMonth,tradeDate,forceFull=false,overrideFull=false}={}){
 const p=clean(port),uf=clean(originUf),ym=parseShipMonth(shipMonth),year=ym?Number(ym.slice(0,4)):null;
 if(forceFull||overrideFull)return {factor:1,reason:"override_tarifa_cheia"};
 if(year!=null&&year>=2027)return {factor:1,reason:"safra_nova_sem_desconto"};
 if(p!=="santos")return {factor:1,reason:"sem_desconto_neste_destino"};
 if(uf!=="go"||year!==2026)return {factor:0.85,reason:"santos_regra_geral"};
 const stages=[["2026-08-18",0.875],["2026-08-19",0.90],["2026-08-20",0.925],["2026-08-21",0.95],["2026-08-24",0.975],["2026-08-25",1]];
 let f=0.85;
 for(const [d,n] of stages){if(tradeDate>=d)f=n;else break;}
 return {factor:f,reason:"transicao_go_2026"};
}
export function projectFreight({
 tradeDate,shipMonth,roadBrlT=0,railBrlT=0,bargeBrlT=0,
 roadMinimumBrlT=50,perTradeRoadFloor=0,freightFinalTable=false,freightTotalManual=false,
 road2027Override=null,rail2027Override=null,extraPct=null,fixedAdditionalBrlT=0,
 railTariffUndiscounted=false,port="",originUf="",forceRailFull=false,
 tradeId="",pedroRoadAgioPct=null
}={}){
 const ym=parseShipMonth(shipMonth);
 if(!ym||!isoDateValid(tradeDate))return {ok:false,reasons:["Data do negócio ou embarque inválidos"]};
 const roadRaw=asMoney(roadBrlT,"Frete rodoviário"),railRaw=asMoney(railBrlT,"Frete ferroviário"),
  bargeRaw=asMoney(bargeBrlT,"Frete barcaça");
 if(!roadRaw&&!railRaw&&!bargeRaw)return {ok:false,reasons:["Nenhum trecho logístico cadastrado"]};
 const minRoad=asMoney(roadMinimumBrlT,"Piso rodoviário"),dealFloor=asMoney(perTradeRoadFloor,"Piso individual");
 const railFactor=railTariffUndiscounted?railDiscount({port,originUf,shipMonth:ym,tradeDate,forceFull:forceRailFull}).factor:1;
 const roadBase=Math.max(roadRaw,dealFloor);
 const railBase=railRaw*railFactor;
 const roadFloor=freightFinalTable?roadBase:(roadBase>0?Math.max(minRoad,roadBase):0);
 const yearBase=Math.max(Number(tradeDate.slice(0,4)),2026),ahead=Number(ym.slice(0,4))-yearBase;
 const projected2028=ahead>=2&&!freightTotalManual;
 const projected2027=ahead>=1&&!projected2028&&!freightTotalManual;
 const prospective=tradeDate>="2026-10-26";
 const roadRate=projected2028?0.20:(projected2027?amountOverride(road2027Override,prospective?0:0.12):0);
 const railRate=projected2028?0.20:(projected2027?amountOverride(rail2027Override,prospective?0.10:0.14):0);
 const bargeRate=projected2028?0.20:0;
 const extra=amountOverride(extraPct,0,0.50);
 const fixed=asMoney(fixedAdditionalBrlT,"Adicional fixo R$/t");
 const pedro=(tradeId==="nf261117_22"&&clean(port)==="santos"&&Number(pedroRoadAgioPct)===0.15)?1.15:1;
 const road=(roadFloor*(1+roadRate)+fixed)*(1+extra)*pedro;
 const rail=railBase*(1+railRate)*(1+extra);
 const barge=bargeRaw*(1+bargeRate)*(1+extra);
 return {ok:true,reasons:[],yearBase,ahead,projected2027,projected2028,shipMonth:ym,
  road,rail,barge,totalBrlT:road+rail+barge,
  rates:{road:roadRate,rail:railRate,barge:bargeRate,extra,railDiscountFactor:railFactor},
  source:"C49/calcReplacement; dataRules V4EL-1",assumptions:"As tarifas de entrada devem representar base ainda não projetada"};
}
