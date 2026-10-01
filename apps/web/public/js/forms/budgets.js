// Formulario de presupuestos por categoría
import { esc, fmt, num } from '../core/utils.js';
import { save } from '../services/sync.js';
import { state } from '../state/store.js';
import { closeModal, openModal } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';

export function budgetsForm(){
  openModal('Presupuestos por categoría',`<form id="f"><p class="muted small" style="margin-bottom:14px">Deja en blanco las categorías que no quieras vigilar.</p>
    ${state.S.categories.filter(c=>c!=='Ahorro / inversión').map((c,ix)=>`<div class="field"><label for="b${ix}">${esc(c)}</label><input id="b${ix}" data-cat="${esc(c)}" inputmode="numeric" placeholder="Sin tope" value="${state.S.budgets[c]?fmt(state.S.budgets[c]):''}"></div>`).join('')}
    <div class="mactions"><button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn primary">Guardar presupuestos</button></div></form>`,
  root=>{const f=root.querySelector('#f');f.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',()=>{const n=num(inp.value);inp.value=n?fmt(n):''}));
    f.addEventListener('submit',ev=>{ev.preventDefault();f.querySelectorAll('input').forEach(inp=>{const n=num(inp.value);if(n)state.S.budgets[inp.dataset.cat]=n;else delete state.S.budgets[inp.dataset.cat]});save();closeModal();render();toast('Presupuestos guardados')})});
}
