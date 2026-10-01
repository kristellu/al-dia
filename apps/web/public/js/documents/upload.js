// Carga de documentos y confirmación de los valores leídos
import { daysIn, mFull, mLow, mk } from '../core/dates.js';
import { $, dec, esc, fmt, fmtDate, newId, num, qOf } from '../core/utils.js';
import { errMsg, extract } from './pdf.js';
import { prepare } from '../domain/actions.js';
import { save } from '../services/sync.js';
import { M, state } from '../state/store.js';
import { closeModal, openModal, segQ } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';

export function missingNote(r){return r&&r._missing&&r._missing.length?`<div class="warnbox">No encontré: ${esc(r._missing.join(', '))}. Complétalo antes de guardar.</div>`:''}
export function openUpload(kind){
  const isP=kind==='payroll';
  openModal(isP?'Cargar comprobante de nómina':'Cargar extracto',`
    <label class="drop"><input type="file" id="file" accept=".pdf,application/pdf">
      <strong>Elige el ${isP?'comprobante':'extracto'} en PDF</strong><br><span class="muted small">Se lee aquí mismo, en tu navegador. El archivo no se envía ni se guarda: solo los valores que confirmes.</span></label>
    <p class="muted small" style="margin-top:12px">${isP?'Busco el período, el total devengado, las deducciones y el neto pagado, y verifico que cuadren entre sí.':'Busco banco, producto, últimos 4 dígitos, saldo, pago mínimo, fecha límite, tasa y cupo. Nunca guardo el número completo.'}</p>
    <div class="mactions"><button class="btn ghost" data-act="${isP?'manual-payroll':'manual-statement'}">Ingresar los datos a mano</button></div>`,
  root=>{root.querySelector('#file').addEventListener('change',async ev=>{const file=ev.target.files[0];if(!file)return;
    root.querySelector('.mbody').innerHTML=`<div style="text-align:center;padding:24px 0"><div class="spinner" aria-hidden="true"></div><p>Leyendo el documento…</p></div>`;
    try{const r=await extract(file,kind);isP?payrollConfirm(r):statementConfirm(r)}
    catch(e){root.querySelector('.mbody').innerHTML=`<div class="warnbox">${esc(errMsg(e))}</div><div class="mactions"><button class="btn" data-act="close-modal">Cancelar</button><button class="btn primary" data-act="${isP?'manual-payroll':'manual-statement'}">Ingresar a mano</button></div>`}})});
}
export function payrollConfirm(r,manual){
  let fin=r.periodo_fin||null, ini=r.periodo_inicio||null;
  let k=state.cur, q=1, day=null;
  if(fin&&/^\d{4}-\d{2}-\d{2}$/.test(fin)){const[y,m,d]=fin.split('-').map(Number);k=mk(y,m);q=qOf(d);day=d}
  if(r.fecha_pago&&/^\d{4}-\d{2}-\d{2}$/.test(r.fecha_pago)){const[y,m,d]=r.fecha_pago.split('-').map(Number);if(mk(y,m)===k)day=d}
  const dev=+r.total_devengado||0, ded=+r.total_deducciones||0, net=+r.neto_pagado||0;
  const mismatch=dev&&ded&&net&&Math.abs(dev-ded-net)>1;
  const edit=manual||!net||(r._missing&&r._missing.length>0);
  openModal(manual?'Registrar nómina':'Revisa antes de guardar',`
    ${!edit?`<div class="result"><p class="ok">Comprobante procesado ✓</p><p>${mFull(k)} · Quincena ${q}${ini&&fin?` <span class="muted small">(${fmtDate(ini)} al ${fmtDate(fin)})</span>`:''}</p>
      <p class="muted small" style="margin-top:8px">Neto recibido</p><div class="big">${fmt(net)}</div>
      <p class="small" style="margin-top:6px">Deducciones: ${fmt(ded)} <span class="muted">· devengado ${fmt(dev)}</span></p></div>
      <p class="muted small" style="margin-bottom:14px">Solo el neto cuenta como ingreso. Las deducciones quedan como información y no se suman a tus gastos.</p>`:''}
    ${manual?'':missingNote(r)}${!manual&&r._consistent?'<p class="small" style="color:var(--free);margin-bottom:12px">Los valores cuadran: devengado menos deducciones da el neto.</p>':''}
    ${mismatch?`<div class="warnbox">Devengado menos deducciones no coincide con el neto. Revisa los valores antes de confirmar.</div>`:''}
    <form id="f" ${edit?'':'hidden'}>
      <div class="frow"><div class="field"><label for="pm">Mes</label><input id="pm" name="month" type="month" value="${k}"></div>
      <div class="field"><span class="flabel">Quincena</span>${segQ(q)}</div></div>
      <div class="frow"><div class="field"><label for="pdv">Total devengado</label><input id="pdv" name="dev" inputmode="numeric" value="${dev?fmt(dev):''}"></div>
      <div class="field"><label for="pdd">Total deducciones</label><input id="pdd" name="ded" inputmode="numeric" value="${ded?fmt(ded):''}"></div></div>
      <div class="frow"><div class="field"><label for="pn">Neto pagado</label><input id="pn" name="net" inputmode="numeric" required value="${net?fmt(net):''}"></div>
      <div class="field"><label for="pd">Día de pago</label><input id="pd" name="day" type="number" min="1" max="31" value="${day||''}"></div></div>
    </form>
    <div class="mactions">${edit?'':'<button class="btn" data-act="edit-extracted">Editar información</button>'}<button class="btn primary" data-act="confirm-payroll">Confirmar ingreso</button></div>`,
  root=>{const f=root.querySelector('#f');['dev','ded','net'].forEach(n=>f[n].addEventListener('input',()=>{const x=num(f[n].value);f[n].value=x?fmt(x):''}))});
}
export function confirmPayroll(){
  const f=$('#modalIn #f'); const net=num(f.net.value); if(!net){f.hidden=false;f.net.focus();return}
  const k=f.month.value||state.cur, q=+f.querySelector('[name=q]:checked').value, day=+f.day.value||(q===1?15:daysIn(k));
  const mo=M(k)||(prepare(k),M(k));
  const ix=mo.incomes.findIndex(i=>i.type==='salario'&&i.q===q&&i.status!=='recibido');
  const item={id:newId(),name:`Nómina ${q===1?'primera':'segunda'} quincena`,amount:net,gross:num(f.dev.value)||null,deductions:num(f.ded.value)||null,type:'salario',category:'Salario',day:Math.min(day,daysIn(k)),q,status:'recibido',recurring:true,note:''};
  if(ix>=0){item.id=mo.incomes[ix].id;mo.incomes[ix]=item}else{mo.incomes.forEach(i=>{if(i.type==='salario'&&i.q===q)i.recurring=false});mo.incomes.push(item)}
  save();closeModal();state.cur=k;render();toast(`Ingreso registrado en ${mLow(k)}, quincena ${q}`);
}
export function statementConfirm(r,manual){
  const l4=String(r.ultimos4||'').replace(/\D/g,'').slice(-4);
  const match=state.S.debts.find(d=>l4&&d.last4===l4)||null;
  let m=r.mes_extracto&&/^\d{4}-\d{2}$/.test(r.mes_extracto)?r.mes_extracto:state.cur;
  const v={banco:r.banco||match?.bank||'',producto:r.producto||match?.name||'',tipo:r.tipo||match?.kind||'tarjeta',l4,saldo:+r.saldo_total||0,min:+r.pago_minimo||0,tot:+r.pago_total||0,fecha:r.fecha_limite||'',tasa:r.tasa_ea??'',cupo:+r.cupo||0,cdisp:+r.cupo_disponible||0};
  const F=(id,l,val,attrs='inputmode="numeric"')=>`<div class="field"><label for="${id}">${l}</label><input id="${id}" name="${id}" ${attrs} value="${esc(val)}"></div>`;
  openModal(manual?'Registrar extracto':'Revisa antes de guardar',`
    ${!manual?`<div class="result"><p class="ok">Extracto procesado ✓</p><p>${esc(v.producto||'Producto')}${v.l4?' •••• '+esc(v.l4):''} <span class="muted small">${esc(v.banco)}</span></p><p class="muted small" style="margin-top:8px">Saldo total</p><div class="big">${fmt(v.saldo)}</div>${match?`<p class="small">Lo asocio a tu producto "${esc(match.name)}".</p>`:''}</div>`:''}
    ${manual?'':missingNote(r)}
    <form id="f">
      <div class="frow">${F('banco','Banco',v.banco,'')}${F('producto','Producto',v.producto,'required')}</div>
      <div class="frow">${F('l4','Últimos 4 dígitos',v.l4,'inputmode="numeric" maxlength="4"')}${F('mes','Mes del extracto',m,'type="month"')}</div>
      <div class="frow">${F('saldo','Saldo total',v.saldo?fmt(v.saldo):'')}${F('fecha','Fecha límite',v.fecha,'type="date"')}</div>
      <div class="frow">${F('min','Pago mínimo',v.min?fmt(v.min):'')}${F('tot','Pago total',v.tot?fmt(v.tot):'')}</div>
      <div class="frow">${F('cupo','Cupo',v.cupo?fmt(v.cupo):'')}${F('cdisp','Cupo disponible',v.cdisp?fmt(v.cdisp):'')}</div>
      ${F('tasa','Tasa E.A. (%)',v.tasa,'inputmode="decimal"')}
      <div class="field"><span class="flabel">Tipo</span><div class="seg"><label><input type="radio" name="tipo" value="tarjeta" ${v.tipo!=='credito'?'checked':''}>Tarjeta</label><label><input type="radio" name="tipo" value="credito" ${v.tipo==='credito'?'checked':''}>Crédito</label></div></div>
      <label class="inline-check"><input type="checkbox" class="check" name="addpay" checked> Agregar el pago a mis compromisos del mes de la fecha límite</label>
      <div class="field"><span class="flabel">¿Qué valor vas a pagar?</span><div class="seg"><label><input type="radio" name="paywhich" value="min">Mínimo</label><label><input type="radio" name="paywhich" value="tot" checked>Total del período</label></div></div>
    </form>
    <div class="mactions"><button class="btn" data-act="close-modal">Cancelar</button><button class="btn primary" data-act="confirm-statement">Guardar extracto</button></div>`,
  root=>{const f=root.querySelector('#f');['saldo','min','tot','cupo','cdisp'].forEach(n=>f[n].addEventListener('input',()=>{const x=num(f[n].value);f[n].value=x?fmt(x):''}));if(manual)f.producto.focus()});
}
export function confirmStatement(){
  const f=$('#modalIn #f'); if(!f.producto.value.trim()){f.producto.focus();return}
  const l4=f.l4.value.replace(/\D/g,'').slice(-4), tipo=f.querySelector('[name=tipo]:checked').value;
  let d=state.S.debts.find(x=>l4&&x.last4===l4)||state.S.debts.find(x=>x.name.toLowerCase()===f.producto.value.trim().toLowerCase());
  if(!d){d={id:newId(),name:f.producto.value.trim(),bank:f.banco.value.trim(),last4:l4,kind:tipo};state.S.debts.push(d)}
  else{d.bank=f.banco.value.trim()||d.bank;if(l4)d.last4=l4}
  const mes=f.mes.value||state.cur; state.S.balances[d.id]=state.S.balances[d.id]||{};
  const rec={saldo:num(f.saldo.value),minimo:num(f.min.value)||null,total:num(f.tot.value)||null,fecha:f.fecha.value||null,tasa:dec(f.tasa.value),cupo:num(f.cupo.value)||null,cupoDisp:num(f.cdisp.value)||null};
  state.S.balances[d.id][mes]=rec;
  if(f.addpay.checked){const amt=f.querySelector('[name=paywhich]:checked').value==='min'?rec.minimo:rec.total||rec.minimo;
    if(amt){let pk=mes,day=null;if(rec.fecha){const[y,m,dd]=rec.fecha.split('-').map(Number);pk=mk(y,m);day=dd}
      const mo=M(pk)||(prepare(pk),M(pk));
      const ex=mo.expenses.find(e=>e.debtId===d.id&&e.status!=='pagado');
      const data={name:`Pago ${d.name}`,amount:amt,category:tipo==='tarjeta'?'Tarjetas de crédito':'Créditos y deudas',day,q:day?qOf(day):2,status:'pendiente',recurring:true,note:'',debtId:d.id,paidOn:null};
      if(ex)Object.assign(ex,data);else mo.expenses.push({id:newId(),...data});}}
  save();closeModal();render();toast('Extracto guardado');
}
