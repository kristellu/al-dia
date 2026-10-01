// Vista: Deudas
import { addM, mLow, mName } from '../core/dates.js';
import { esc, fmt, fmtDate, fmtM } from '../core/utils.js';
import { debtMonths, debtTotal } from '../domain/calc.js';
import { state } from '../state/store.js';
import { debtChart } from '../ui/charts.js';

export function vDeudas(){
  const k=state.cur, pk=addM(k,-1), t=debtTotal(k), tp=debtTotal(pk);
  const months=debtMonths().filter(x=>x<=k).slice(-8);
  const actions=`<div class="hero-actions"><button class="btn primary" data-act="upload-statement">Cargar extracto</button><button class="btn" data-act="add-debt">Agregar producto</button>${state.S.debts.length?'<button class="btn" data-act="add-balance">Registrar saldo</button>':''}</div>`;
  if(!state.S.debts.length)return `<div class="monthempty"><h1>¿Cuánto debes de verdad?</h1><p>Carga el extracto de una tarjeta o crédito y lo registro aquí. Mes a mes verás si la deuda baja o solo se está moviendo de un lado a otro.</p>${actions}</div>`;
  const rows=state.S.debts.map(d=>{const b=state.S.balances[d.id]||{};const a=b[pk]?.saldo,c=b[k]?.saldo;const v=(a!=null&&c!=null)?c-a:null;
    return `<tr><td>${esc(d.name)}${d.last4?` <span class="muted small">•••• ${esc(d.last4)}</span>`:''}</td><td>${a!=null?fmt(a):'—'}</td><td>${c!=null?fmt(c):'—'}</td><td class="${v==null?'':v<=0?'down':'up-c'}">${v==null?'—':(v>0?'+':'')+fmt(v)}</td><td>${b[k]?.fecha?fmtDate(b[k].fecha):'—'}</td></tr>`}).join('');
  return `<section class="hero"><p class="hero-q">Deuda total en ${mLow(k)}</p>
    <div class="hero-n" style="color:var(--ink)">${t!=null?fmt(t):'Sin saldo'}</div>
    <p class="hero-s">${t!=null&&tp!=null?(t<=tp?`<span class="down">↓ ${fmt(tp-t)}</span> frente a ${mLow(pk)}. Vas bien: la deuda está bajando.`:`<span class="up-c">↑ ${fmt(t-tp)}</span> frente a ${mLow(pk)}. Revisa si estás trasladando saldos.`):t==null?`Aún no registras saldos para ${mLow(k)}. Carga los extractos del mes.`:'Registra también el mes anterior para ver la variación.'}</p>
    ${actions}</section>
  <section class="block"><div class="block-head"><h2>Producto por producto</h2></div>
    <div class="tscroll"><table><thead><tr><th>Producto</th><th>${mName(pk)}</th><th>${mName(k)}</th><th>Variación</th><th>Fecha límite</th></tr></thead><tbody>${rows}</tbody></table></div></section>
  ${months.length>1?`<section class="block"><div class="block-head"><h2>Cómo ha evolucionado</h2></div><div class="chartbox">${debtChart(months)}</div></section>`:''}
  <section class="block"><div class="block-head"><h2>Historial</h2></div><div class="debtcards">${state.S.debts.map(d=>{const b=state.S.balances[d.id]||{};const ks=Object.keys(b).sort().slice(-6);
    const tr=ks.length>1?b[ks[ks.length-1]].saldo-b[ks[0]].saldo:null;
    return `<div class="dc"><div style="display:flex;justify-content:space-between;gap:8px"><h3>${esc(d.name)}</h3><button class="btn ghost small" data-act="edit-debt" data-id="${d.id}">Editar</button></div>
      <p class="muted small">${esc(d.bank||'')}${d.last4?' · •••• '+esc(d.last4):''}</p>
      ${tr!=null?`<p style="margin-top:8px" class="${tr<=0?'down':'up-c'}">${tr<=0?'↓':'↑'} ${fmtM(Math.abs(tr))} en ${ks.length} meses</p>`:''}
      <ol>${ks.map(x=>`<li><span>${mName(x)}</span><span>${fmtM(b[x].saldo)}${b[x].minimo?` <span class="muted small">mín. ${fmtM(b[x].minimo)}</span>`:''}</span></li>`).join('')||'<li class="muted">Sin saldos</li>'}</ol></div>`}).join('')}</div></section>`;
}
