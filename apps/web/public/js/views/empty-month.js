// Vista: mes sin preparar / primera vez
import { mLow, mName } from '../core/dates.js';
import { prevWithData } from '../domain/calc.js';
import { M, hasAny, state } from '../state/store.js';

export function vEmptyMonth(){
  const src=prevWithData(state.cur);
  if(!hasAny())return `<div class="monthempty">
    <h1>Empecemos por lo que entra y lo que tienes que pagar.</h1>
    <p>Carga tu comprobante de nómina o agrega tus pagos fijos del mes. Con eso ya puedo decirte cuánto tienes libre de verdad.</p>
    <div class="hero-actions">
      <button class="btn primary" data-act="upload-payroll">Cargar comprobante de nómina</button>
      <button class="btn" data-act="start-empty">Agregar mis pagos a mano</button>
      <button class="btn ghost" data-act="demo">Ver con datos de ejemplo</button>
    </div></div>`;
  const rec=src?[...M(src).expenses,...M(src).incomes].filter(x=>x.recurring).length:0;
  return `<div class="monthempty">
    <h1>${mName(state.cur)} aún no está preparado.</h1>
    <p>${src&&rec?`Puedo traer tus ${rec} compromisos recurrentes de ${mLow(src)} como pendientes, para que solo tengas que marcarlos cuando los pagues.`:'Todavía no hay compromisos recurrentes para copiar. Puedes empezar el mes vacío.'}</p>
    <div class="hero-actions">
      ${src&&rec?`<button class="btn primary" data-act="prepare">Preparar ${mLow(state.cur)}</button>`:''}
      <button class="btn${src&&rec?'':' primary'}" data-act="start-empty">Empezar ${mLow(state.cur)} vacío</button>
    </div></div>`;
}
