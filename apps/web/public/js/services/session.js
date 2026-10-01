// Sesión: arranque, ingreso, carga del estado y salida
import { $, esc } from '../core/utils.js';
import { passwordForm } from '../forms/account.js';
import { api } from './api.js';
import { flatten, fromServer, save, setSync } from './sync.js';
import { blank, normalize, state } from '../state/store.js';
import { closeModal } from '../ui/modal.js';
import { render } from '../ui/render.js';

export async function loadState(){
  const r=await api('/api/state');
  state.ME=r.user;state.WIN=r.window;state.S=normalize(fromServer(r.data));state.synced=flatten(state.S);
  if(!r.data.categories.length){state.synced.categories={};save()} // primera vez: guarda las categorías por defecto
  if(state.cur<state.WIN.cutoff||state.cur>state.WIN.max)state.cur=state.WIN.current;
  showApp();render();setSync('cloud');
}
export function showApp(){document.body.classList.remove('logged-out');$('#acctBtn').textContent=state.ME?state.ME.displayName:'Cuenta'}
export function onLoggedOut(){state.ME=null;state.WIN=null;state.synced=null;state.S=blank();state.USERS=null;closeModal();showLogin()}
export function showLogin(msg){
  document.body.classList.add('logged-out');
  $('#app').innerHTML=`<div class="login"><h1>Al día</h1><p class="muted">Ingresa para ver cuánto tienes libre este mes.</p>
    <form id="loginForm" autocomplete="on">
      ${msg?`<div class="warnbox">${esc(msg)}</div>`:''}
      <div class="field"><label for="lu">Usuario</label><input id="lu" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
      <div class="field"><label for="lp">Contraseña</label><input id="lp" name="password" type="password" autocomplete="current-password" required></div>
      <p id="loginErr" class="small" style="color:var(--debt);min-height:1.5em" role="alert"></p>
      <button class="btn primary" style="width:100%;justify-content:center">Ingresar</button>
    </form></div>`;
  const f=$('#loginForm');f.username.focus();
  f.addEventListener('submit',async ev=>{ev.preventDefault();const btn=f.querySelector('button');btn.disabled=true;$('#loginErr').textContent='';
    try{const r=await api('/api/auth/login',{method:'POST',body:{username:f.username.value,password:f.password.value},auth:false});
      if(r.mustChangePassword){const me=await api('/api/auth/me');state.ME=me.user;state.WIN=me.window;showApp();$('#app').innerHTML='';passwordForm(true)}
      else await loadState()}
    catch(e){$('#loginErr').textContent=e.message;f.password.value='';f.password.focus()}
    finally{btn.disabled=false}});
}
export async function boot(){
  try{const me=await api('/api/auth/me',{auth:false});state.ME=me.user;state.WIN=me.window;
    if(state.ME.mustChangePassword){showApp();$('#app').innerHTML='';passwordForm(true);return}
    await loadState()}
  catch(e){if(e.status===401)showLogin();else{document.body.classList.add('logged-out');$('#app').innerHTML=`<div class="login"><h1>No se pudo cargar</h1><p class="muted">${esc(e.message)}</p><button class="btn" data-act="reload">Reintentar</button></div>`}}
}
