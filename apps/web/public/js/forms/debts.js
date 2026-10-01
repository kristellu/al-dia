// Formularios de producto de deuda y saldo
import { esc, fmt, newId, num } from '../core/utils.js';
import { save } from '../services/sync.js';
import { state } from '../state/store.js';
import { closeModal, openModal } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';

export function debtForm(id){
  const d=id?state.S.debts.find(x=>x.id===id):null; const v=d||{name:'',bank:'',last4:'',kind:'tarjeta'};
  openModal(d?'Editar producto':'Nuevo producto de deuda',`<form id="f">
    <div class="field"><label for="dn">Nombre</label><input id="dn" name="name" required placeholder="Ej. Tarjeta principal" value="${esc(v.name)}"></div>
    <div class="frow"><div class="field"><label for="db">Banco</label><input id="db" name="bank" value="${esc(v.bank)}"></div>
    <div class="field"><label for="dl">Últimos 4 dígitos</label><input id="dl" name="last4" inputmode="numeric" maxlength="4" pattern="\\d{0,4}" value="${esc(v.last4)}"></div></div>
    <div class="field"><span class="flabel">Tipo</span><div class="seg"><label><input type="radio" name="kind" value="tarjeta" ${v.kind!=='credito'?'checked':''}>Tarjeta de crédito</label><label><input type="radio" name="kind" value="credito" ${v.kind==='credito'?'checked':''}>Crédito</label></div></div>
    <div class="mactions">${d?'<button type="button" class="btn danger" data-act="del-debt" data-id="'+d.id+'">Eliminar</button><span class="spacer"></span>':''}<button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn primary">Guardar producto</button></div></form>`,
  root=>{const f=root.querySelector('#f');f.addEventListener('submit',ev=>{ev.preventDefault();
    const data={name:f.name.value.trim(),bank:f.bank.value.trim(),last4:f.last4.value.replace(/\D/g,'').slice(-4),kind:f.querySelector('[name=kind]:checked').value};
    if(d)Object.assign(d,data);else state.S.debts.push({id:newId(),...data});save();closeModal();render();toast('Producto guardado')})});
}
export function balanceForm(pre){
  const v=pre||{};
  openModal('Registrar saldo',`<form id="f">
    <div class="field"><label for="bp">Producto</label><select id="bp" name="debt">${state.S.debts.map(d=>`<option value="${d.id}" ${d.id===v.debtId?'selected':''}>${esc(d.name)}${d.last4?' •••• '+esc(d.last4):''}</option>`).join('')}</select></div>
    <div class="frow"><div class="field"><label for="bm">Mes del extracto</label><input id="bm" name="month" type="month" value="${v.month||state.cur}"></div>
    <div class="field"><label for="bs">Saldo total</label><input id="bs" name="saldo" inputmode="numeric" required value="${v.saldo?fmt(v.saldo):''}"></div></div>
    <div class="frow"><div class="field"><label for="bmin">Pago mínimo</label><input id="bmin" name="minimo" inputmode="numeric" value="${v.minimo?fmt(v.minimo):''}"></div>
    <div class="field"><label for="bf">Fecha límite</label><input id="bf" name="fecha" type="date" value="${v.fecha||''}"></div></div>
    <div class="mactions"><button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn primary">Guardar saldo</button></div></form>`,
  root=>{const f=root.querySelector('#f');['saldo','minimo'].forEach(n=>f[n].addEventListener('input',()=>{const x=num(f[n].value);f[n].value=x?fmt(x):''}));
    f.addEventListener('submit',ev=>{ev.preventDefault();const id=f.debt.value;state.S.balances[id]=state.S.balances[id]||{};
      state.S.balances[id][f.month.value]={...(state.S.balances[id][f.month.value]||{}),saldo:num(f.saldo.value),minimo:num(f.minimo.value)||null,fecha:f.fecha.value||null};
      save();closeModal();render();toast('Saldo registrado')})});
}
