// Componentes: cinta del mes, tarjeta de quincena y filas de movimientos
import { MES_C } from '../core/constants.js';
import { TODAY_D, TODAY_K, daysIn, parseMk } from '../core/dates.js';
import { esc, fmt, fmtDate } from '../core/utils.js';
import { M } from '../state/store.js';

export function ribbon(k){
  const mo=M(k), N=daysIn(k), W=1000, H=120, base=78, x=d=>((d-0.5)/N)*W;
  const items=[...mo.expenses.map(e=>({...e,kind:'e'})),...mo.incomes.map(i=>({...i,kind:'i'}))];
  const max=Math.max(1,...items.map(i=>i.amount));
  let g=`<rect x="0" y="${base}" width="${W}" height="2" style="fill:var(--line)"/>`;
  g+=`<rect x="${x(15.5)-0.5}" y="10" width="1" height="${base+14-10}" style="fill:var(--muted);opacity:.5"/>`;
  g+=`<text x="4" y="${base+30}" style="fill:var(--muted);font-size:20px">1</text><text x="${x(15.5)-8}" y="${base+30}" text-anchor="end" style="fill:var(--muted);font-size:20px">15</text><text x="${x(15.5)+8}" y="${base+30}" style="fill:var(--muted);font-size:20px">16</text><text x="${W-4}" y="${base+30}" text-anchor="end" style="fill:var(--muted);font-size:20px">${N}</text>`;
  if(k===TODAY_K){g+=`<rect x="${x(TODAY_D)-1}" y="4" width="2" height="${base}" style="fill:var(--accent)"/><text x="${x(TODAY_D)}" y="${base+30}" text-anchor="middle" style="fill:var(--accent);font-size:20px;font-weight:600">hoy</text>`}
  items.sort((a,b)=>a.amount-b.amount).forEach(it=>{
    const d=Math.min(Math.max(it.day||(it.q===1?15:N),1),N), hgt=8+(it.amount/max)*58, w=Math.max(6,W/N*0.55);
    const col=it.kind==='i'?'var(--free)':it.status==='pagado'?'var(--paid)':(k===TODAY_K&&d<TODAY_D)||k<TODAY_K?'var(--debt)':'var(--due)';
    if(it.kind==='i')g+=`<rect x="${x(d)-w/2}" y="${base-hgt}" width="${w}" height="${hgt}" rx="2" style="fill:${col};opacity:.35"/><rect x="${x(d)-w/2}" y="${base-hgt}" width="${w}" height="4" rx="2" style="fill:${col}"><title>${esc(it.name)}: ${fmt(it.amount)}</title></rect>`;
    else g+=`<rect x="${x(d)-w/2}" y="${base-hgt}" width="${w}" height="${hgt}" rx="2" style="fill:${col}"><title>${esc(it.name)}, día ${d}: ${fmt(it.amount)}</title></rect>`;
  });
  return `<div class="ribbon" aria-label="Línea del mes con ingresos y pagos por día"><svg viewBox="0 0 ${W} ${H}" role="img">${g}</svg>
  <div class="legend"><span style="--c:var(--free)">Ingresos</span><span style="--c:var(--due)">Por pagar</span><span style="--c:var(--debt)">Vencido</span><span style="--c:var(--paid)">Pagado</span></div></div>`;
}

export function quinCard(q,k){
  const N=daysIn(k), tot=Math.max(q.inc,q.comp,1);
  return `<article class="quin">
    <header><h3>${q.n===1?'Primera quincena':'Segunda quincena'}</h3><span class="muted small">${q.n===1?'1 al 15':'16 al '+N}</span></header>
    <div class="libre ${q.libre<0?'neg':''}">${fmt(q.libre)}</div>
    <p class="muted small">${q.libre<0?'te faltan para cubrir lo comprometido':'libres en esta quincena'}</p>
    <div class="bar" aria-hidden="true"><i style="width:${q.paid/tot*100}%;background:var(--paid)"></i><i style="width:${q.pend/tot*100}%;background:var(--due)"></i><i style="width:${Math.max(0,q.libre)/tot*100}%;background:var(--free)"></i></div>
    <div class="qrows">
      <span>Ingresos${q.inc>q.incR?' (incluye por recibir)':''}</span><span>${fmt(q.inc)}</span>
      <span>Ya pagado</span><span>${fmt(q.paid)}</span>
      <span>Por pagar</span><span>${fmt(q.pend)}</span>
    </div></article>`;
}

const FLAG='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 21V4m0 0h11l-2 4 2 4H5"/></svg>';
export function expRow(e,k,showDate=true){
  const N=daysIn(k), late=e.status!=='pagado'&&((k===TODAY_K&&e.day<TODAY_D)||k<TODAY_K);
  const soon=!late&&e.status!=='pagado'&&k===TODAY_K&&e.day>=TODAY_D&&e.day-TODAY_D<=7;
  return `<div class="row has-flag ${e.status==='pagado'?'done':''} ${e.flagged?'flagged':''}">
    <input type="checkbox" class="check" data-toggle="e:${e.id}" ${e.status==='pagado'?'checked':''} aria-label="Marcar ${esc(e.name)} como pagado">
    <div class="clickable" data-act="edit-exp" data-id="${e.id}" style="cursor:pointer">
      <div class="rname">${esc(e.name)}${e.note?`<span class="note" title="${esc(e.note)}" aria-label="Observación: ${esc(e.note)}">i</span>`:''}${late?'<span class="tag late">Vencido</span>':soon?'<span class="tag soon">Pronto</span>':''}${e.toConfirm?'<span class="tag soon">Por confirmar</span>':''}${e.recurring?`<span class="tag">${e.variable?'Mensual · valor variable':'Mensual'}</span>`:''}</div>
      <div class="rmeta">${showDate?(e.day?e.day+' '+MES_C[parseMk(k).m-1]+' · ':''):''}${esc(e.category)}${e.status==='pagado'&&e.paidOn?' · pagado el '+fmtDate(e.paidOn):''}</div>
    </div>
    <div class="ramt">${e.toConfirm?'<span class="muted small">Por confirmar</span>':fmt(e.amount)}</div>
    <button type="button" class="flagbtn" data-act="flag-exp" data-id="${e.id}" aria-pressed="${!!e.flagged}" aria-label="${e.flagged?'Quitar bandera roja de':'Marcar con bandera roja'} ${esc(e.name)}" title="${e.flagged?'Quitar bandera':'Marcar con bandera roja'}">${FLAG}</button></div>`;
}
export function incRow(i,k){
  return `<div class="row ${i.status==='recibido'?'':''}">
    <input type="checkbox" class="check" data-toggle="i:${i.id}" ${i.status==='recibido'?'checked':''} aria-label="Marcar ${esc(i.name)} como recibido">
    <div class="clickable" data-act="edit-inc" data-id="${i.id}" style="cursor:pointer">
      <div class="rname">${esc(i.name)}<span class="tag ${i.type==='salario'?'sal':'ext'}">${i.type==='salario'?'Salario':esc(i.category||'Adicional')}</span>${i.note?`<span class="note" title="${esc(i.note)}">i</span>`:''}${i.status!=='recibido'?'<span class="tag soon">Por recibir</span>':''}</div>
      <div class="rmeta">Quincena ${i.q}${i.day?' · día '+i.day:''}${i.deductions?' · deducciones '+fmt(i.deductions)+' (informativo)':''}</div>
    </div>
    <div class="ramt" style="color:var(--free)">+${fmt(i.amount)}</div></div>`;
}
