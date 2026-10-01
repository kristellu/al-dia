// Vista: Usuarios (solo administradores)
import { esc, fmtDate } from '../core/utils.js';
import { state } from '../state/store.js';

export function vUsuarios(){
  const rows=state.USERS?state.USERS.map(u=>{const locked=u.locked_until&&Date.parse(u.locked_until)>Date.now();
    return `<tr><td><b>${esc(u.display_name)}</b><br><span class="muted small">${esc(u.username)}</span></td>
      <td>${u.role==='admin'?'Administrador':'Usuario'}</td><td>${u.retention_months} meses</td>
      <td>${!u.active?'<span class="tag late">Inactivo</span>':locked?'<span class="tag soon">Bloqueado</span>':u.must_change_password?'<span class="tag soon">Debe cambiar clave</span>':'<span class="tag ext">Activo</span>'}</td>
      <td>${u.last_login_at?fmtDate(u.last_login_at.slice(0,10)):'Nunca'}</td>
      <td><button class="btn ghost small" data-act="edit-user" data-id="${esc(u.id)}">Editar</button></td></tr>`}).join(''):'';
  return `<section class="hero" style="padding-bottom:0"><div class="block-head"><h1 style="font-size:2rem">Usuarios</h1><button class="btn primary" data-act="new-user">Nuevo usuario</button></div>
    <p class="muted" style="max-width:62ch">Aquí defines quién puede entrar, su rol y cuántos meses de información se conservan para cada persona.</p></section>
    <section class="block" style="margin-top:20px">${state.USERS?`<div class="tscroll"><table><thead><tr><th>Persona</th><th>Rol</th><th>Retención</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="spinner" aria-label="Cargando"></div>'}</section>`;
}
