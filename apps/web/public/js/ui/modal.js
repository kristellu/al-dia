// Diálogo modal y piezas de formulario compartidas
import { $, esc } from '../core/utils.js';
import { state } from '../state/store.js';

export const dlg=$('#modal');
export function openModal(title,body,onMount){$('#modalIn').innerHTML=`<div class="mhead"><h2>${title}</h2><button class="x" data-act="close-modal" aria-label="Cerrar">×</button></div><div class="mbody">${body}</div>`;if(!dlg.open)dlg.showModal();onMount&&onMount($('#modalIn'))}
export function closeModal(){if(dlg.open)dlg.close()}
export function catOptions(sel,list){return list.map(c=>`<option ${c===sel?'selected':''}>${esc(c)}</option>`).join('')+(list===state.S.categories?'<option value="__new">+ Nueva categoría…</option>':'')}
export function segQ(q){return `<div class="seg" role="radiogroup" aria-label="Quincena"><label><input type="radio" name="q" value="1" ${q===1?'checked':''}>Primera</label><label><input type="radio" name="q" value="2" ${q===2?'checked':''}>Segunda</label></div>`}
