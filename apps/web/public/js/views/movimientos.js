// Vista: Movimientos
import { mLow } from '../core/dates.js';
import { fmt, sum } from '../core/utils.js';
import { stats } from '../domain/calc.js';
import { M, state } from '../state/store.js';
import { expRow, incRow } from '../ui/components.js';

export function vMov(){
  const k=state.cur, mo=M(k), s=stats(k);
  const inc=[...mo.incomes].sort((a,b)=>a.q-b.q||(a.day||0)-(b.day||0));
  const ex=[...mo.expenses].sort((a,b)=>(a.day||99)-(b.day||99));
  const showI=state.movFilter!=='gastos', showE=state.movFilter!=='ingresos';
  const fl=(v,l)=>`<button class="chip" aria-pressed="${state.movFilter===v}" data-filter="${v}">${l}</button>`;
  return `<section class="hero" style="padding-bottom:0"><div class="block-head"><h1 style="font-size:2rem">Movimientos de ${mLow(k)}</h1>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="add-inc">Agregar ingreso</button><button class="btn primary" data-act="add-exp">Agregar gasto</button></div></div>
    <div class="filters">${fl('todos','Todos')}${fl('ingresos','Ingresos')}${fl('gastos','Gastos')}</div></section>
  ${showI?`<section class="block" style="margin-top:12px"><div class="block-head"><h2>Ingresos</h2><span class="muted small">${fmt(s.rec)} recibido · ${fmt(s.pendI)} por recibir</span></div>
    <div class="list">${inc.length?inc.map(i=>incRow(i,k)).join(''):`<div class="empty">Sin ingresos registrados. <button class="btn ghost" data-act="upload-payroll">Cargar comprobante</button></div>`}</div></section>`:''}
  ${showE?`<section class="block"><div class="block-head"><h2>Gastos</h2><span class="muted small">${fmt(s.paid)} pagado · ${fmt(s.pend)} pendiente</span></div>
    <div class="list">${[1,2].map(q=>{const l=ex.filter(e=>e.q===q);return `<div class="list-label"><span>${q===1?'Primera quincena':'Segunda quincena'}</span><span>${fmt(sum(l,e=>e.amount))}</span></div>`+(l.length?l.map(e=>expRow(e,k)).join(''):'<div class="empty small">Nada en esta quincena.</div>')}).join('')}</div></section>`:''}`;
}
