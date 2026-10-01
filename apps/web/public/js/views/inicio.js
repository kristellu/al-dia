// Vista: Inicio
import { TODAY_D, TODAY_K, addM, mLow, mName } from '../core/dates.js';
import { esc, fmt } from '../core/utils.js';
import { insights, stats } from '../domain/calc.js';
import { M, catColor, state } from '../state/store.js';
import { expRow, quinCard, ribbon } from '../ui/components.js';

export function vInicio(){
  const k=state.cur, s=stats(k), mo=M(k), pk=addM(k,-1), ps=M(pk)?stats(pk):null;
  let sent;
  if(s.totInc===0) sent='Aún no registras ingresos este mes. Carga tu comprobante para ver cuánto queda libre.';
  else if(s.libre<0) sent=`Lo que te falta pagar supera lo que ya recibiste. ${s.pendI>0?`Cuando entren los ${fmt(s.pendI)} pendientes quedarías en ${fmt(s.proj)}.`:''}`;
  else sent=`libres de verdad, después de separar lo que ya pagaste y los ${fmt(s.pend)} que aún te faltan.${s.pendI>0?` Cuando entren los ${fmt(s.pendI)} por recibir, cerrarías ${mLow(k)} con ${fmt(s.proj)}.`:''}`;
  const pendList=mo.expenses.filter(e=>e.status!=='pagado').sort((a,b)=>(a.day||99)-(b.day||99));
  let up=[];
  if(k===TODAY_K) up=pendList.filter(e=>e.day&&e.day-TODAY_D<=7);
  else if(k<TODAY_K) up=pendList;
  const ins=insights(k).slice(0,4);
  const cats=Object.entries(s.byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  return `
  ${mo.closed?`<div class="closed-banner"><span>${mName(k)} está cerrado. Lo que ves es la fotografía final del mes.</span><button class="btn" data-act="reopen">Reabrir ${mLow(k)}</button></div>`:''}
  <section class="hero">
    <p class="hero-q">¿Cuánto tengo libre en ${mLow(k)}?</p>
    <div class="hero-n ${s.libre<0?'neg':''}">${fmt(s.libre)}</div>
    <p class="hero-s">${sent}</p>
    ${ribbon(k)}
    <div class="hero-actions">
      <button class="btn primary" data-act="upload-payroll">Cargar comprobante</button>
      <button class="btn" data-act="add-exp">Agregar gasto</button>
      <button class="btn" data-act="add-inc">Agregar ingreso</button>
    </div>
  </section>
  <dl class="strip">
    <div><dt>Recibido</dt><dd>${fmt(s.rec)}</dd></div>
    <div><dt>Por recibir</dt><dd>${fmt(s.pendI)}</dd></div>
    <div><dt>Pagado</dt><dd>${fmt(s.paid)}</dd></div>
    <div><dt>Por pagar</dt><dd>${fmt(s.pend)}</dd></div>
    <div><dt>Comprometido</dt><dd>${Math.round(s.pct*100)} % de tus ingresos</dd></div>
    <div><dt>A deudas</dt><dd>${fmt(s.deudas)}</dd></div>
    <div><dt>A ahorro</dt><dd>${fmt(s.ahorro)}</dd></div>
  </dl>
  <section class="block"><div class="block-head"><h2>Tus dos quincenas</h2></div>
    <div class="quins">${s.q.map(q=>quinCard(q,k)).join('')}</div></section>
  ${up.length?`<section class="block"><div class="block-head"><h2>${k===TODAY_K?'Próximos 7 días':'Quedó sin pagar'}</h2></div>
    <div class="upcoming">${up.map(e=>{const late=(k===TODAY_K&&e.day<TODAY_D)||k<TODAY_K;return `<div class="up ${late?'late':''}"><span class="small muted">${late?'Venció el':'Vence el'} ${e.day} de ${mLow(k)}</span><div style="font-weight:500">${esc(e.name)}</div><b>${fmt(e.amount)}</b></div>`}).join('')}</div></section>`:''}
  <section class="block"><div class="block-head"><h2>Lo que falta pagar</h2><span class="muted small">${pendList.length} pendiente${pendList.length===1?'':'s'} · ${fmt(s.pend)}</span></div>
    <div class="list">${pendList.length?pendList.map(e=>expRow(e,k)).join(''):`<div class="empty">No tienes pagos pendientes en ${mLow(k)}.</div>`}</div></section>
  ${ins.length?`<section class="block"><div class="block-head"><h2>Lo que vale la pena mirar</h2><button class="btn ghost" data-view-go="analisis">Ver análisis</button></div>
    <div class="insights">${ins.map(i=>`<div class="ins ${i.tone}"><div><h3>${esc(i.title)}</h3><p>${esc(i.body)}</p></div></div>`).join('')}</div></section>`:''}
  ${cats.length?`<section class="block"><div class="block-head"><h2>En qué se va la plata</h2>${ps?`<span class="muted small">${s.comp<=ps.comp?'Gastaste '+fmt(ps.comp-s.comp)+' menos':'Gastaste '+fmt(s.comp-ps.comp)+' más'} que en ${mLow(pk)}</span>`:''}</div>
    <div class="dist">${cats.map(([c,v])=>`<div class="drow" style="cursor:default"><span>${esc(c)}</span><span class="dtrack"><i style="width:${v/s.comp*100}%;background:${catColor(c)}"></i></span><span class="muted" style="text-align:right">${Math.round(v/s.comp*100)} %</span><span style="text-align:right">${fmt(v)}</span></div>`).join('')}</div></section>`:''}
  `;
}
