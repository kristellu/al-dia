// Vista: Calendario
import { DIAS } from '../core/constants.js';
import { TODAY_D, TODAY_K, daysIn, mLow, parseMk } from '../core/dates.js';
import { esc, fmt, qOf } from '../core/utils.js';
import { M, state } from '../state/store.js';

export function vCal(){
  const k=state.cur, mo=M(k), N=daysIn(k), {y,m}=parseMk(k);
  const byDay={};
  mo.expenses.forEach(e=>{const d=e.day||(e.q===1?15:N);(byDay[d]=byDay[d]||[]).push({...e,kind:'e'})});
  mo.incomes.forEach(i=>{const d=i.day||(i.q===1?15:N);(byDay[d]=byDay[d]||[]).push({...i,kind:'i'})});
  const days=Object.keys(byDay).map(Number).sort((a,b)=>a-b);
  const block=q=>{const ds=days.filter(d=>qOf(d)===q);if(!ds.length)return '<p class="muted" style="padding:14px 0">Sin movimientos en esta quincena.</p>';
    return ds.map(d=>{const wd=DIAS[new Date(y,m-1,d).getDay()];return `<div class="aday ${k===TODAY_K&&d===TODAY_D?'today':''}"><div class="d">${d}<small>${wd}${k===TODAY_K&&d===TODAY_D?' · hoy':''}</small></div><div class="aitems">${byDay[d].map(it=>it.kind==='i'
      ?`<div class="aitem"><input type="checkbox" class="check" data-toggle="i:${it.id}" ${it.status==='recibido'?'checked':''} aria-label="Recibido"><span>${esc(it.name)} <span class="tag ${it.type==='salario'?'sal':'ext'}">Ingreso</span></span><b style="color:var(--free)">+${fmt(it.amount)}</b></div>`
      :`<div class="aitem"><input type="checkbox" class="check" data-toggle="e:${it.id}" ${it.status==='pagado'?'checked':''} aria-label="Pagado"><span style="${it.status==='pagado'?'color:var(--muted);text-decoration:line-through':''}">${esc(it.name)}${it.note?` <span class="note" title="${esc(it.note)}">i</span>`:''}${it.status!=='pagado'&&((k===TODAY_K&&d<TODAY_D)||k<TODAY_K)?' <span class="tag late">Vencido</span>':''}</span><b>${fmt(it.amount)}</b></div>`).join('')}</div></div>`}).join('')};
  return `<section class="hero" style="padding-bottom:0"><h1 style="font-size:2rem">Agenda de ${mLow(k)}</h1><p class="muted" style="margin-top:6px">Qué entra y qué tienes que pagar, día por día.</p></section>
  <div class="qdiv">Primera quincena · 1 al 15</div><div class="agenda">${block(1)}</div>
  <div class="qdiv">Segunda quincena · 16 al ${N}</div><div class="agenda">${block(2)}</div>`;
}
