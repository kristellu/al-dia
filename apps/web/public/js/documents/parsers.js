// Lectura de comprobantes de nómina y extractos (reglas, sin IA)

/* ============ Carga de documentos (lectura local, sin IA) ============ */
/* Todo ocurre en el navegador: pdf.js extrae el texto y reglas simples
   (palabras clave + expresiones regulares + validación cruzada) ubican los valores. */
export const MES_IDX={enero:1,ene:1,febrero:2,feb:2,marzo:3,mar:3,abril:4,abr:4,mayo:5,may:5,junio:6,jun:6,julio:7,jul:7,agosto:8,ago:8,septiembre:9,setiembre:9,sep:9,sept:9,set:9,octubre:10,oct:10,noviembre:11,nov:11,diciembre:12,dic:12};
export const MES_RX='enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept|sep|set|oct|nov|dic';
export const norm=t=>t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
export const iso=(y,m,d)=>{y=+y;if(y<100)y+=2000;m=+m;d=+d;if(m<1||m>12||d<1||d>31||y<2000||y>2100)return null;return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`};

/* Convierte "$ 7.754.426", "7.754.426,00" o "7,754,426.00" en 7754426 */
export function parseMoney(raw){
  let t=String(raw).replace(/[$\s]/g,'').replace(/^-/,'');
  if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t))return Math.round(parseFloat(t.replace(/\./g,'').replace(',','.')));
  if(/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t))return Math.round(parseFloat(t.replace(/,/g,'')));
  if(/^\d+([.,]\d{1,2})?$/.test(t))return Math.round(parseFloat(t.replace(',','.')));
  return null;
}
/* Todos los montos del texto con su posición. Exige separadores de miles o signo $ para no confundir con cédulas o códigos. */
export function moneyTokens(t){
  const out=[],rx=/\$\s?\d[\d.,]*\d|\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?\b/g;let m;
  while((m=rx.exec(t))){const v=parseMoney(m[0]);if(v!=null&&v>=1000)out.push({v,i:m.index,end:m.index+m[0].length})}
  return out;
}
/* Todas las fechas del texto con su posición */
export function dateTokens(t){
  const out=[],add=(m,d)=>{if(d)out.push({iso:d,i:m.index})};let m;
  const r1=/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g; while((m=r1.exec(t)))add(m,iso(m[3],m[2],m[1]));
  const r2=/\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g; while((m=r2.exec(t)))add(m,iso(m[1],m[2],m[3]));
  const r3=new RegExp(`\\b(\\d{1,2})(?:\\s+de)?[\\s\\/\\-]+(${MES_RX})\\.?(?:\\s+de|\\s+del)?[\\s\\/\\-]+(\\d{4}|\\d{2})\\b`,'g'); while((m=r3.exec(t)))add(m,iso(m[3],MES_IDX[m[2]],m[1]));
  const r4=new RegExp(`\\b(${MES_RX})\\.?\\s+(\\d{1,2}),?(?:\\s+de)?\\s+(\\d{4})\\b`,'g'); while((m=r4.exec(t)))add(m,iso(m[3],MES_IDX[m[1]],m[2]));
  return out.sort((a,b)=>a.i-b.i);
}
/* Posiciones donde aparece una etiqueta */
export function labelPos(t,rx){const out=[],g=new RegExp(rx.source,'g');let m;while((m=g.exec(t)))out.push(m.index+m[0].length);return out}
/* Primeros montos que siguen a cada aparición de la etiqueta */
export function candidatesAfter(t,money,rx,win=260,n=4){
  const seen=new Set(),out=[];
  labelPos(t,rx).forEach(p=>money.filter(x=>x.i>=p&&x.i-p<=win).slice(0,n).forEach(x=>{if(!seen.has(x.v)){seen.add(x.v);out.push(x.v)}}));
  return out;
}
export const firstAfter=(t,money,rx,win)=>candidatesAfter(t,money,rx,win,1)[0]??null;
export function dateAfter(t,dates,rx,win=120){for(const p of labelPos(t,rx)){const d=dates.find(x=>x.i>=p&&x.i-p<=win);if(d)return d.iso}return null}

export function parsePayroll(raw){
  const t=norm(raw), money=moneyTokens(t), dates=dateTokens(t);
  const RX={dev:/total\s+devengad[oa]s?|total\s+devengos|devengos\s+totales|total\s+ingresos|devengado\s+total/,
            ded:/total\s+deduccion(?:es)?|total\s+descuentos|deducciones\s+totales|total\s+deducido/,
            net:/neto\s+(?:a\s+)?pagar|neto\s+pagado|neto\s+recibido|total\s+a\s+pagar|valor\s+neto|neto\s+a\s+consignar|total\s+neto/};
  const cD=candidatesAfter(t,money,RX.dev), cX=candidatesAfter(t,money,RX.ded), cN=candidatesAfter(t,money,RX.net);
  let dev=cD[0]??null, ded=cX[0]??null, net=cN[0]??null, consistent=false;
  /* Validación cruzada: busca la combinación donde devengado − deducciones = neto (tolera tablas donde etiquetas y valores van en filas separadas) */
  const pool=[...new Set([...cD,...cX,...cN])];
  outer: for(const a of (cD.length?cD:pool))for(const b of (cX.length?cX:pool))for(const c of (cN.length?cN:pool)){
    if(a>b&&a>c&&Math.abs(a-b-c)<=2){dev=a;ded=b;net=c;consistent=true;break outer}}
  if(!net&&dev&&ded&&dev>ded)net=dev-ded;
  if(!ded&&dev&&net&&dev>net)ded=dev-net;
  /* Período */
  let ini=null,fin=null;
  const per=new RegExp(`del\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+de\\s+(${MES_RX})\\.?(?:\\s+de|\\s+del)?\\s+(\\d{4})`).exec(t);
  if(per){const mm=MES_IDX[per[3]];ini=iso(per[4],mm,per[1]);fin=iso(per[4],mm,per[2])}
  if(!fin){for(const p of labelPos(t,/periodo(?:\s+(?:de\s+)?(?:pago|liquidado|liquidacion|nomina))?|fecha\s+(?:de\s+)?inicio|desde/)){
      const ds=dates.filter(x=>x.i>=p&&x.i-p<=160).slice(0,2);if(ds.length===2){[ini,fin]=[ds[0].iso,ds[1].iso].sort();break}}}
  if(!fin){const ds=dates.map(d=>d.iso).sort();for(let i=0;i<ds.length-1;i++){const a=ds[i],b=ds[i+1];if(a.slice(0,7)===b.slice(0,7)&&((+a.slice(8)===1&&+b.slice(8)>=14&&+b.slice(8)<=16)||(+a.slice(8)===16&&+b.slice(8)>=28))){ini=a;fin=b;break}}}
  const pago=dateAfter(t,dates,/fecha\s+(?:de\s+)?(?:pago|consignacion|abono)/);
  const missing=[];if(!dev)missing.push('total devengado');if(!ded)missing.push('total deducciones');if(!net)missing.push('neto pagado');if(!fin)missing.push('período');
  return{periodo_inicio:ini,periodo_fin:fin,total_devengado:dev,total_deducciones:ded,neto_pagado:net,fecha_pago:pago,_missing:missing,_consistent:consistent};
}

export const BANCOS=[['bancolombia','Bancolombia'],['davivienda','Davivienda'],['bbva','BBVA'],['banco de bogota','Banco de Bogotá'],['occidente','Banco de Occidente'],['banco popular','Banco Popular'],['av villas','AV Villas'],['caja social','Banco Caja Social'],['itau','Itaú'],['colpatria','Scotiabank Colpatria'],['scotiabank','Scotiabank Colpatria'],['falabella','Banco Falabella'],['pichincha','Banco Pichincha'],['nubank','Nu'],['nu financiera','Nu'],['lulo','Lulo Bank'],['rappicard','RappiCard'],['rappi','RappiCard'],['serfinanza','Serfinanza'],['finandina','Finandina'],['banco agrario','Banco Agrario'],['gnb sudameris','GNB Sudameris'],['sudameris','GNB Sudameris'],['citibank','Citibank'],['tuya','Tuya'],['icetex','ICETEX'],['coopcentral','Coopcentral'],['banco w','Banco W'],['mibanco','Mibanco']];
export function parseStatement(raw){
  const t=norm(raw), money=moneyTokens(t), dates=dateTokens(t);
  const banco=(BANCOS.find(([k])=>t.includes(k))||[])[1]||null;
  /* Últimos 4 dígitos: solo se conserva el final, nunca el número completo */
  let l4=null;const m4=/(?:\*{2,}|x{3,}|•{2,}|\.{3,}|terminad[ao]\s+en|finalizad[ao]\s+en)\s*(\d{4})\b/.exec(t)||/\b\d{4}[\s-]?\d{2,6}[\s-]?\d{2,6}[\s-]?(\d{4})\b/.exec(t);
  if(m4)l4=m4[1];
  const credKw=/credito\s+(?:de\s+)?(?:vehiculo|vehicular|libre\s+inversion|hipotecario|de\s+vivienda|educativo|rotativo)|leasing|libranza|credito\s+de\s+consumo|plan\s+de\s+pagos|cuotas?\s+pendientes/;
  const tipo=credKw.test(t)&&!/tarjeta\s+de\s+credito/.test(t)?'credito':'tarjeta';
  let producto=null;
  if(tipo==='tarjeta'){const fr=(/american\s+express|amex/.test(t)?'American Express':/mastercard/.test(t)?'Mastercard':/diners/.test(t)?'Diners':/visa/.test(t)?'Visa':'Tarjeta');
    const lv=(/infinite/.test(t)?' Infinite':/black/.test(t)?' Black':/signature/.test(t)?' Signature':/platinum|platino/.test(t)?' Platinum':/gold|oro/.test(t)?' Gold':'');producto=fr+lv}
  else{const c=credKw.exec(t);producto=c?c[0].replace(/credito/g,'crédito').replace(/vehiculo/g,'vehículo').replace(/inversion/g,'inversión').replace(/^./,x=>x.toUpperCase()):'Crédito'}
  const CDISP=/cupo\s+disponible|disponible\s+(?:para\s+)?(?:compras|avances)/;
  const saldo=firstAfter(t,money,/saldo\s+total|nuevo\s+saldo|saldo\s+a\s+la\s+fecha|deuda\s+total|total\s+deuda|saldo\s+actual|saldo\s+(?:de\s+)?capital|saldo\s+pendiente|saldo\s+a\s+(?:su\s+)?cargo/);
  const minimo=firstAfter(t,money,/pago\s+minimo|valor\s+minimo|minimo\s+a\s+pagar|valor\s+(?:de\s+la\s+)?cuota|cuota\s+del\s+mes|valor\s+a\s+pagar/);
  const total=firstAfter(t,money,/pago\s+total|pago\s+de\s+contado|pago\s+alterno|total\s+a\s+pagar/);
  const cdisp=firstAfter(t,money,CDISP,120);
  let cupo=null;for(const p of labelPos(t,/cupo\s+(?:total|asignado|aprobado)|cupo\b/)){if(CDISP.test(t.slice(p-6,p+20)))continue;const x=money.find(z=>z.i>=p&&z.i-p<=120);if(x){cupo=x.v;break}}
  const fecha=dateAfter(t,dates,/fecha\s+(?:limite|maxima)\s+(?:de\s+)?pago|pague(?:se)?\s+(?:antes\s+de|hasta)|pagar\s+(?:antes\s+de|hasta)|fecha\s+de\s+pago|fecha\s+limite/,160);
  const tm=/tasa[^%]{0,60}?(?:efectiva\s+anual|e\.?\s?a\.?)[^%\d]{0,25}(\d{1,2}(?:[.,]\d{1,4})?)\s*%/.exec(t)||/(\d{1,2}(?:[.,]\d{1,4})?)\s*%\s*(?:e\.?\s?a\.?|efectiv[oa]\s+anual)/.exec(t);
  const tasa=tm?parseFloat(tm[1].replace(',','.')):null;
  const corte=dateAfter(t,dates,/fecha\s+(?:de\s+)?corte|corte\s+(?:al|a)|periodo\s+facturado|fecha\s+(?:del\s+)?extracto|fecha\s+de\s+generacion/,160);
  const mes=(corte||fecha||'').slice(0,7)||null;
  const missing=[];if(!saldo)missing.push('saldo total');if(!minimo&&!total)missing.push('valor a pagar');if(!fecha)missing.push('fecha límite');if(!l4)missing.push('últimos 4 dígitos');
  return{banco,producto,tipo,ultimos4:l4,saldo_total:saldo,pago_minimo:minimo,pago_total:total,fecha_limite:fecha,tasa_ea:tasa,cupo,cupo_disponible:cdisp,mes_extracto:mes,_missing:missing};
}
