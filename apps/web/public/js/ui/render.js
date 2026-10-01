// Pinta la vista activa y la cabecera del mes
import { addM, mFull, mName } from '../core/dates.js';
import { $ } from '../core/utils.js';
import { loadUsers } from '../forms/users.js';
import { M, state } from '../state/store.js';
import { vAnalisis } from '../views/analisis.js';
import { vCal } from '../views/calendario.js';
import { vDeudas } from '../views/deudas.js';
import { vEmptyMonth } from '../views/empty-month.js';
import { vInicio } from '../views/inicio.js';
import { vMov } from '../views/movimientos.js';
import { vUsuarios } from '../views/usuarios.js';

export function render(){
  if(!state.ME||!state.WIN)return;
  $('#monthLabel').textContent=mFull(state.cur);
  const atCut=addM(state.cur,-1)<state.WIN.cutoff;$('#prevBtn').disabled=atCut;
  $('#prevBtn').title=atCut?`Solo se conservan los últimos ${state.WIN.retention} meses`:'';
  $('#adminTab').hidden=state.ME.role!=='admin';
  $('#prevBtn').textContent='‹ '+mName(addM(state.cur,-1));
  $('#nextBtn').textContent=mName(addM(state.cur,1))+' ›';
  document.querySelectorAll('nav.tabs button').forEach(b=>{if(b.dataset.view===state.view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  const app=$('#app');
  if(state.view==='deudas'){app.innerHTML=vDeudas();return}
  if(state.view==='usuarios'){app.innerHTML=vUsuarios();if(!state.USERS)loadUsers();return}
  if(!M(state.cur)){app.innerHTML=vEmptyMonth();return}
  app.innerHTML=({inicio:vInicio,movimientos:vMov,calendario:vCal,analisis:vAnalisis})[state.view]();
}
