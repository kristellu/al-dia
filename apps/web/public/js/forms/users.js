// Administración de usuarios: carga, formulario y eliminación
import { $, esc } from '../core/utils.js';
import { api } from '../services/api.js';
import { loadState } from '../services/session.js';
import { state } from '../state/store.js';
import { closeModal, openModal } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';

export async function loadUsers(){try{state.USERS=(await api('/api/admin/users')).users;if(state.view==='usuarios')render()}catch(e){toast(e.message)}}
export function userForm(id){
  const u=id?state.USERS.find(x=>x.id===id):null, isSelf=u&&u.username===state.ME.username;
  const locked=u&&u.locked_until&&Date.parse(u.locked_until)>Date.now();
  openModal(u?'Editar usuario':'Nuevo usuario',`<form id="f">
    <div class="frow"><div class="field"><label for="uu">Usuario</label><input id="uu" name="username" ${u?'disabled':''} required pattern="[a-z0-9._\\-]{3,40}" autocapitalize="none" value="${esc(u?u.username:'')}"></div>
    <div class="field"><label for="un">Nombre</label><input id="un" name="display_name" required value="${esc(u?u.display_name:'')}"></div></div>
    <div class="frow"><div class="field"><label for="ur">Rol</label><select id="ur" name="role" ${isSelf?'disabled':''}><option value="user" ${u&&u.role==='user'?'selected':''}>Usuario</option><option value="admin" ${u&&u.role==='admin'?'selected':''}>Administrador</option></select></div>
    <div class="field"><label for="ut">Meses que se conservan</label><input id="ut" name="retention_months" type="number" min="1" max="24" required value="${u?u.retention_months:4}"></div></div>
    <div class="field"><label for="up">${u?'Restablecer contraseña (opcional)':'Contraseña temporal'}</label><input id="up" name="password" type="password" autocomplete="new-password" ${u?'':'required'} minlength="10"><span class="muted small">La persona deberá cambiarla al ingresar.</span></div>
    ${u&&!isSelf?`<label class="inline-check"><input type="checkbox" class="check" name="active" ${u.active?'checked':''}> Puede ingresar</label>`:''}
    ${locked?'<label class="inline-check"><input type="checkbox" class="check" name="unlock" checked> Desbloquear por intentos fallidos</label>':''}
    ${u?'<p class="muted small" style="margin-bottom:12px">Si reduces los meses de retención, la información más antigua se elimina la próxima vez que la persona ingrese.</p>':''}
    <p id="uErr" class="small" style="color:var(--debt)" role="alert"></p>
    <div class="mactions">${u&&!isSelf?`<button type="button" class="btn danger" data-act="del-user" data-id="${esc(u.id)}">Eliminar</button><span class="spacer"></span>`:''}<button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn primary">${u?'Guardar cambios':'Crear usuario'}</button></div></form>`,
  root=>{const f=root.querySelector('#f');
    f.addEventListener('submit',async ev=>{ev.preventDefault();
      const body={display_name:f.display_name.value,retention_months:+f.retention_months.value};
      if(!isSelf)body.role=f.role.value;
      if(f.password.value)body.password=f.password.value;
      if(f.active)body.active=f.active.checked;
      if(f.unlock&&f.unlock.checked)body.unlock=true;
      try{
        if(u){await api('/api/admin/users/'+encodeURIComponent(u.id),{method:'PATCH',body});
          if(isSelf&&body.retention_months!==state.WIN.retention)await loadState()}
        else{body.username=f.username.value.trim().toLowerCase();await api('/api/admin/users',{method:'POST',body})}
        closeModal();state.USERS=null;render();toast(u?'Usuario actualizado':'Usuario creado')}
      catch(e){$('#uErr').textContent=e.message}})});
}
export async function deleteUser(id){
  const u=state.USERS.find(x=>x.id===id);if(!u)return;
  if(!confirm(`¿Eliminar a ${u.display_name} y toda su información? Esta acción no se puede deshacer.`))return;
  try{await api('/api/admin/users/'+encodeURIComponent(id),{method:'DELETE'});closeModal();state.USERS=null;render();toast('Usuario eliminado')}catch(e){toast(e.message)}
}
