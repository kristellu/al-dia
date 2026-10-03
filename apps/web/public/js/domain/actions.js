// Acciones sobre el mes: preparar, cerrar y marcar pagado/recibido
import { addM, daysIn, isoToday, mName } from '../core/dates.js';
import { newId } from '../core/utils.js';
import { debtTotal, prevWithData, stats } from './calc.js';
import { save } from '../services/sync.js';
import { M, ensure, state } from '../state/store.js';
import { expenseForm } from '../forms/movements.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';

export function prepare(k){
  const src=prevWithData(k); const mo=ensure(k);
  if(src){const s=M(src);
    // Un gasto de valor variable conserva sus datos, pero su valor queda en $0 por confirmar
    s.expenses.filter(e=>e.recurring).forEach(e=>mo.expenses.push({...e,id:newId(),status:'pendiente',paidOn:null,day:Math.min(e.day||1,daysIn(k)),...(e.variable?{amount:0,toConfirm:true}:{})}));
    s.incomes.filter(i=>i.recurring).forEach(i=>mo.incomes.push({...i,id:newId(),status:'pendiente',day:i.day?Math.min(i.day,daysIn(k)):null}));}
}
export function closeMonth(k){
  const mo=M(k), s=stats(k);
  mo.closed=true;
  mo.snapshot={ingresos:s.totInc,recibido:s.rec,gastos:s.comp,pagado:s.paid,pendiente:s.pend,deuda:debtTotal(k),distribucion:s.byCat,final:s.proj,cerradoEl:isoToday()};
  const nx=addM(k,1); if(!M(nx))prepare(nx);
  save(); state.cur=nx; render(); toast(`${mName(k)} cerrado. ${mName(nx)} está listo.`);
}
export function toggle(kind,id){
  const mo=M(state.cur); if(!mo)return;
  if(kind==='e'){const e=mo.expenses.find(x=>x.id===id);if(!e)return;
    if(e.toConfirm&&e.status!=='pagado'){render();expenseForm(id);toast('Primero confirma el valor de este mes');return}
    e.status=e.status==='pagado'?'pendiente':'pagado';e.paidOn=e.status==='pagado'?isoToday():null}
  else{const i=mo.incomes.find(x=>x.id===id);if(!i)return;i.status=i.status==='recibido'?'pendiente':'recibido'}
  save(); render();
}
