// Formularios de gasto e ingreso
import { INCOME_CATS } from '../core/constants.js';
import { daysIn, isoToday } from '../core/dates.js';
import { esc, fmt, newId, num, qOf } from '../core/utils.js';
import { save } from '../services/sync.js';
import { ensure, state } from '../state/store.js';
import { catOptions, closeModal, openModal, segQ } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';

export function expenseForm(id){
  const mo=ensure(state.cur), e=id?mo.expenses.find(x=>x.id===id):null, N=daysIn(state.cur);
  const v=e||{name:'',amount:'',category:'Vivienda',day:'',q:1,status:'pendiente',recurring:true,note:''};
  openModal(e?'Editar gasto':'Nuevo gasto',`<form id="f">
    <div class="field"><label for="fn">Nombre del gasto</label><input id="fn" name="name" required placeholder="Ej. Arriendo" value="${esc(v.name)}"></div>
    <div class="frow"><div class="field"><label for="fa">Valor</label><input id="fa" name="amount" required inputmode="numeric" placeholder="$0" value="${v.amount?fmt(v.amount):''}"></div>
    <div class="field"><label for="fd">Día de pago</label><input id="fd" name="day" type="number" min="1" max="${N}" placeholder="1 a ${N}" value="${v.day||''}"></div></div>
    <div class="field"><label for="fc">Categoría</label><select id="fc" name="category">${catOptions(v.category,state.S.categories)}</select></div>
    <div class="field"><span class="flabel">Quincena</span>${segQ(v.q)}</div>
    <div class="field"><span class="flabel">Estado</span><div class="seg"><label><input type="radio" name="status" value="pendiente" ${v.status!=='pagado'?'checked':''}>Pendiente</label><label><input type="radio" name="status" value="pagado" ${v.status==='pagado'?'checked':''}>Pagado</label></div></div>
    <label class="inline-check"><input type="checkbox" class="check" name="recurring" ${v.recurring?'checked':''}> Repetir cada mes</label>
    <div class="field"><label for="fo">Observaciones (opcional)</label><textarea id="fo" name="note" placeholder="Ej. Última cuota">${esc(v.note||'')}</textarea></div>
    <div class="mactions">${e?'<button type="button" class="btn danger" data-act="del-exp" data-id="'+e.id+'">Eliminar</button><span class="spacer"></span>':''}<button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn primary">Guardar gasto</button></div></form>`,
  root=>{const f=root.querySelector('#f');let qTouched=!!e;
    f.amount.addEventListener('input',()=>{const n=num(f.amount.value);f.amount.value=n?fmt(n):''});
    f.querySelectorAll('[name=q]').forEach(r=>r.addEventListener('change',()=>qTouched=true));
    f.day.addEventListener('input',()=>{const d=+f.day.value;if(d&&!qTouched)f.querySelector(`[name=q][value="${qOf(d)}"]`).checked=true});
    f.category.addEventListener('change',()=>{if(f.category.value==='__new'){const n=(prompt('Nombre de la nueva categoría')||'').trim();if(n){if(!state.S.categories.includes(n))state.S.categories.push(n);f.category.innerHTML=catOptions(n,state.S.categories)}else f.category.value=v.category}});
    f.addEventListener('submit',ev=>{ev.preventDefault();const amount=num(f.amount.value);if(!amount){f.amount.focus();return}
      const day=Math.min(Math.max(+f.day.value||0,0),N)||null;
      const data={name:f.name.value.trim(),amount,category:f.category.value,day,q:+f.querySelector('[name=q]:checked').value,status:f.querySelector('[name=status]:checked').value,recurring:f.recurring.checked,note:f.note.value.trim()};
      if(e){if(data.status==='pagado'&&e.status!=='pagado')data.paidOn=isoToday();if(data.status!=='pagado')data.paidOn=null;Object.assign(e,data)}
      else mo.expenses.push({id:newId(),...data,paidOn:data.status==='pagado'?isoToday():null});
      save();closeModal();render();toast(e?'Gasto actualizado':'Gasto agregado')});
    f.name.focus()});
}
export function incomeForm(id){
  const mo=ensure(state.cur), i=id?mo.incomes.find(x=>x.id===id):null, N=daysIn(state.cur);
  const v=i||{name:'',amount:'',type:'extra',category:'Bonificación',day:'',q:1,status:'recibido',recurring:false,note:''};
  openModal(i?'Editar ingreso':'Nuevo ingreso',`<form id="f">
    <div class="field"><label for="fn">Nombre</label><input id="fn" name="name" required placeholder="Ej. Proyecto freelance" value="${esc(v.name)}"></div>
    <div class="frow"><div class="field"><label for="fa">Valor neto</label><input id="fa" name="amount" required inputmode="numeric" placeholder="$0" value="${v.amount?fmt(v.amount):''}"></div>
    <div class="field"><label for="fd">Día</label><input id="fd" name="day" type="number" min="1" max="${N}" value="${v.day||''}"></div></div>
    <div class="field"><label for="fc">Tipo</label><select id="fc" name="category">${catOptions(v.type==='salario'?'Salario':v.category,INCOME_CATS)}</select></div>
    <div class="field"><span class="flabel">Quincena</span>${segQ(v.q)}</div>
    <div class="field"><span class="flabel">Estado</span><div class="seg"><label><input type="radio" name="status" value="recibido" ${v.status==='recibido'?'checked':''}>Recibido</label><label><input type="radio" name="status" value="pendiente" ${v.status!=='recibido'?'checked':''}>Por recibir</label></div></div>
    <label class="inline-check"><input type="checkbox" class="check" name="recurring" ${v.recurring?'checked':''}> Se repite cada mes</label>
    <div class="field"><label for="fo">Observaciones (opcional)</label><textarea id="fo" name="note">${esc(v.note||'')}</textarea></div>
    <div class="mactions">${i?'<button type="button" class="btn danger" data-act="del-inc" data-id="'+i.id+'">Eliminar</button><span class="spacer"></span>':''}<button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn primary">Guardar ingreso</button></div></form>`,
  root=>{const f=root.querySelector('#f');let qTouched=!!i;
    f.amount.addEventListener('input',()=>{const n=num(f.amount.value);f.amount.value=n?fmt(n):''});
    f.querySelectorAll('[name=q]').forEach(r=>r.addEventListener('change',()=>qTouched=true));
    f.day.addEventListener('input',()=>{const d=+f.day.value;if(d&&!qTouched)f.querySelector(`[name=q][value="${qOf(d)}"]`).checked=true});
    f.addEventListener('submit',ev=>{ev.preventDefault();const amount=num(f.amount.value);if(!amount){f.amount.focus();return}
      const cat=f.category.value;
      const data={name:f.name.value.trim(),amount,type:cat==='Salario'?'salario':'extra',category:cat,day:Math.min(+f.day.value||0,N)||null,q:+f.querySelector('[name=q]:checked').value,status:f.querySelector('[name=status]:checked').value,recurring:f.recurring.checked,note:f.note.value.trim()};
      if(i)Object.assign(i,data);else mo.incomes.push({id:newId(),...data});
      save();closeModal();render();toast(i?'Ingreso actualizado':'Ingreso agregado')});
    f.name.focus()});
}
