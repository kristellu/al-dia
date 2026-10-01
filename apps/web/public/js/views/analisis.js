// Vista: Análisis
import { addM, mLow, mName } from '../core/dates.js';
import { esc, fmt } from '../core/utils.js';
import { insights, prevWithData, stats } from '../domain/calc.js';
import { M, catColor, state } from '../state/store.js';
import { monthsChart } from '../ui/charts.js';

export function vAnalisis(){
  const k=state.cur, s=stats(k), mo=M(k), pk=prevWithData(k), ps=pk?stats(pk):null;
  const per100=s.totInc?Math.round(s.comp/s.totInc*100):0;
  const cats=Object.entries(s.byCat).sort((a,b)=>b[1]-a[1]);
  const ins=insights(k);
  const cmp=[];
  if(ps){const d=s.comp-ps.comp;cmp.push(d<=0?`Gastaste ${fmt(-d)} menos que en ${mLow(pk)}.`:`Gastaste ${fmt(d)} más que en ${mLow(pk)}.`);
    const di=s.totInc-ps.totInc; if(di!==0)cmp.push(`Tus ingresos ${di>0?'subieron':'bajaron'} ${fmt(Math.abs(di))} frente a ${mLow(pk)}.`);
    if(ps.ahorro||s.ahorro)cmp.push(`Destinaste ${fmt(s.ahorro)} a ahorro (en ${mLow(pk)} fueron ${fmt(ps.ahorro)}).`);
    if(ps.totInc&&s.totInc)cmp.push(`Comprometiste el ${Math.round(s.pct*100)} % de tus ingresos; en ${mLow(pk)} fue el ${Math.round(ps.pct*100)} %.`);}
  if(s.totInc&&s.deudas)cmp.push(`Tus pagos de deuda representaron el ${Math.round(s.deudas/s.totInc*100)} % de tus ingresos este mes.`);
  if(s.comp&&s.recurring)cmp.push(`Tus gastos recurrentes representan el ${Math.round(s.recurring/s.comp*100)} % de tus gastos totales.`);
  const budCats=state.S.categories.filter(c=>state.S.budgets[c]);
  return `<section class="hero" style="padding-bottom:0"><h1 style="font-size:2rem">Cómo va ${mLow(k)}</h1></section>
  <section class="block" style="margin-top:20px">
    <div class="bigpair">
      <div><span class="muted small">Ingresos</span><div class="n">${fmt(s.totInc)}</div></div>
      <div><span class="muted small">Gastos comprometidos</span><div class="n">${fmt(s.comp)}</div></div>
      <div><span class="muted small">Queda</span><div class="n" style="color:${s.proj<0?'var(--debt)':'var(--free)'}">${fmt(s.proj)}</div></div>
      <div><span class="muted small">Gastos sobre ingresos</span><div class="n">${per100} %</div></div>
    </div>
    ${s.totInc?`<p class="plain">De cada $100 que recibes, tienes comprometidos $${per100}.${per100>90?' Es un margen muy estrecho para imprevistos.':per100>75?' Tienes poco espacio para imprevistos.':''}</p>`:''}
  </section>
  <section class="block"><div class="block-head"><h2>Proyección de cierre</h2></div>
    <div class="proj">
      <span class="muted">Disponible hoy (recibido menos pagado)</span><span>${fmt(s.rec-s.paid)}</span>
      <span class="muted">Pagos pendientes</span><span>−${fmt(s.pend)}</span>
      <span class="muted">Ingresos pendientes</span><span>+${fmt(s.pendI)}</span>
      <span class="tot">Te quedaría al cierre</span><span class="tot" style="color:${s.proj<0?'var(--debt)':'var(--free)'}">${fmt(s.proj)}</span>
    </div>
    <p class="muted small" style="margin-top:10px;max-width:60ch">Es lo que realmente te queda, aunque el saldo de tu cuenta hoy muestre más: parte de ese dinero ya tiene destino.</p>
  </section>
  ${ins.length?`<section class="block"><div class="block-head"><h2>Observaciones</h2></div><div class="insights">${ins.map(i=>`<div class="ins ${i.tone}"><div><h3>${esc(i.title)}</h3><p>${esc(i.body)}</p></div></div>`).join('')}</div></section>`:''}
  <section class="block"><div class="block-head"><h2>Distribución de gastos</h2><span class="muted small">Toca una categoría para ver qué la compone</span></div>
    <div class="dist">${cats.length?cats.map(([c,v])=>`<button class="drow" data-cat="${esc(c)}" aria-expanded="${state.selCat===c}"><span>${esc(c)}</span><span class="dtrack"><i style="width:${v/s.comp*100}%;background:${catColor(c)}"></i></span><span class="muted" style="text-align:right">${Math.round(v/s.comp*100)} %</span><span style="text-align:right">${fmt(v)}</span></button>${state.selCat===c?`<div class="drill">${mo.expenses.filter(e=>e.category===c).map(e=>`<div><span>${esc(e.name)}</span><span>${fmt(e.amount)}</span></div>`).join('')}</div>`:''}`).join(''):'<p class="muted">Aún no hay gastos este mes.</p>'}</div></section>
  <section class="block"><div class="block-head"><h2>Presupuestos</h2><button class="btn ghost" data-act="budgets">Definir presupuestos</button></div>
    ${budCats.length?`<div class="budgets">${budCats.map(c=>{const b=state.S.budgets[c],u=s.byCat[c]||0,p=u/b;return `<div class="bud"><div style="display:flex;justify-content:space-between"><h3>${esc(c)}</h3><span class="${p>1?'up-c':p>=.8?'':'muted'}" style="${p>=.8&&p<=1?'color:var(--due)':''}">${Math.round(p*100)} %</span></div><div class="bar"><i style="width:${Math.min(p,1)*100}%;background:${p>1?'var(--debt)':p>=.8?'var(--due)':'var(--free)'}"></i></div><p class="small muted">${fmt(u)} de ${fmt(b)}${p>1?' · te pasaste por '+fmt(u-b):''}</p></div>`}).join('')}</div>`:'<p class="muted">Define un tope para las categorías que quieras vigilar. No bloquea gastos, solo te avisa.</p>'}</section>
  <section class="block"><div class="block-head"><h2>Comparación con meses anteriores</h2></div>
    ${monthsChart(k)||'<p class="muted">Necesitas al menos dos meses registrados para comparar.</p>'}
    ${cmp.length?`<div class="insights" style="margin-top:14px">${cmp.map(c=>`<div class="ins"><div><p style="color:var(--ink);margin:0">${esc(c)}</p></div></div>`).join('')}</div>`:''}
  </section>
  <section class="block"><div class="block-head"><h2>Cierre del mes</h2></div>
    ${mo.closed?`<p class="muted">${mName(k)} está cerrado${mo.snapshot?` con ${fmt(mo.snapshot.final)} disponibles al final`:''}.</p><div class="hero-actions"><button class="btn" data-act="reopen">Reabrir ${mLow(k)}</button></div>`
    :`<p class="muted" style="max-width:62ch">Al cerrar ${mLow(k)} guardo una fotografía de cómo terminó (ingresos, gastos, pendientes, deuda y distribución) y preparo ${mLow(addM(k,1))} con tus compromisos recurrentes.</p><div class="hero-actions"><button class="btn primary" data-act="close-month">Cerrar ${mLow(k)}</button></div>`}
  </section>`;
}
