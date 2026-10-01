// Menú de cuenta y cambio de contraseña
import { mLow, parseMk } from '../core/dates.js';
import { $, esc } from '../core/utils.js';
import { api } from '../services/api.js';
import { loadState } from '../services/session.js';
import { state } from '../state/store.js';
import { closeModal, dlg, openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';

export function accountMenu(){
  openModal(esc(state.ME.displayName),`<p class="muted">Usuario <b>${esc(state.ME.username)}</b>${state.ME.role==='admin'?' · administrador':''}</p>
    <p class="muted small" style="margin:6px 0 18px">Se conservan los últimos ${state.WIN.retention} meses de movimientos (desde ${mLow(state.WIN.cutoff)} ${parseMk(state.WIN.cutoff).y}).</p>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn" data-act="change-pass">Cambiar contraseña</button>
      ${state.ME.role==='admin'?'<button class="btn" data-act="go-users">Administrar usuarios</button>':''}
      <button class="btn danger" data-act="logout">Cerrar sesión</button></div>`);
}
export function passwordForm(forced){
  openModal(forced?'Crea tu contraseña':'Cambiar contraseña',`<form id="f">
    ${forced?'<p class="muted small" style="margin-bottom:14px">Por seguridad, reemplaza la contraseña temporal que te asignaron.</p>':''}
    <div class="field"><label for="pc">Contraseña actual</label><input id="pc" name="current" type="password" autocomplete="current-password" required></div>
    <div class="field"><label for="pn1">Nueva contraseña</label><input id="pn1" name="next" type="password" autocomplete="new-password" minlength="10" required><span class="muted small">Mínimo 10 caracteres, con letras y números.</span></div>
    <div class="field"><label for="pn2">Repite la nueva contraseña</label><input id="pn2" name="next2" type="password" autocomplete="new-password" required></div>
    <p id="pErr" class="small" style="color:var(--debt)" role="alert"></p>
    <div class="mactions">${forced?'<button type="button" class="btn" data-act="logout">Cerrar sesión</button>':'<button type="button" class="btn" data-act="close-modal">Cancelar</button>'}<button class="btn primary">Guardar contraseña</button></div></form>`,
  root=>{const f=root.querySelector('#f');f.current.focus();
    if(forced)dlg.addEventListener('cancel',e=>e.preventDefault(),{once:true});
    f.addEventListener('submit',async ev=>{ev.preventDefault();
      if(f.next.value!==f.next2.value){$('#pErr').textContent='Las contraseñas nuevas no coinciden.';return}
      try{await api('/api/auth/password',{method:'POST',body:{current:f.current.value,next:f.next.value}});closeModal();toast('Contraseña actualizada');if(forced)await loadState()}
      catch(e){$('#pErr').textContent=e.message}})});
}
