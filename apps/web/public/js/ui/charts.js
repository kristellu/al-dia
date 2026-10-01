// Gráficos SVG: evolución de deuda e ingresos vs. gastos
import { CAT_COLORS, MES_C } from '../core/constants.js';
import { addM, mName, parseMk } from '../core/dates.js';
import { esc, fmt, fmtM } from '../core/utils.js';
import { debtTotal, stats } from '../domain/calc.js';
import { M, state } from '../state/store.js';

export function debtChart(months){
  const W=700,H=230,P={l:70,r:16,t:16,b:34};
  const totals=months.map(m=>debtTotal(m)||0); const mx=Math.max(...totals)*1.1||1;
  const X=i=>P.l+(months.length===1?0:i*(W-P.l-P.r)/(months.length-1)), Y=v=>P.t+(1-v/mx)*(H-P.t-P.b);
  let g='';
  [0,.5,1].forEach(f=>{const v=mx*f;g+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="${P.l-8}" y="${Y(v)+4}" text-anchor="end" style="fill:var(--muted);font-size:12px">${fmtM(v)}</text>`});
  state.S.debts.forEach((d,di)=>{const pts=months.map((m,i)=>{const b=(state.S.balances[d.id]||{})[m];return b?[X(i),Y(b.saldo)]:null}).filter(Boolean);
    if(pts.length>1)g+=`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" style="stroke:${CAT_COLORS[(di+3)%CAT_COLORS.length]};stroke-width:1.5;opacity:.55"/>`});
  g+=`<polyline points="${totals.map((v,i)=>X(i)+','+Y(v)).join(' ')}" fill="none" style="stroke:var(--ink);stroke-width:3"/>`;
  totals.forEach((v,i)=>{g+=`<circle cx="${X(i)}" cy="${Y(v)}" r="4.5" style="fill:var(--ink)"><title>${mName(months[i])}: ${fmt(v)}</title></circle><text x="${X(i)}" y="${H-10}" text-anchor="middle" style="fill:var(--muted);font-size:12px">${MES_C[parseMk(months[i]).m-1]}</text>`});
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución de la deuda total">${g}</svg><div class="legend"><span style="--c:var(--ink)">Total</span>${state.S.debts.map((d,di)=>`<span style="--c:${CAT_COLORS[(di+3)%CAT_COLORS.length]}">${esc(d.name)}</span>`).join('')}</div>`;
}
export function monthsChart(k){
  const ks=[];for(let i=5;i>=0;i--){const x=addM(k,-i);if(M(x))ks.push(x)}
  if(ks.length<2)return '';
  const W=700,H=220,P={l:70,r:10,t:14,b:30}; const data=ks.map(x=>{const s=stats(x);return{k:x,i:s.totInc,g:s.comp}});
  const mx=Math.max(...data.map(d=>Math.max(d.i,d.g)))*1.1||1; const bw=(W-P.l-P.r)/ks.length; const Y=v=>P.t+(1-v/mx)*(H-P.t-P.b);
  let g='';[0,.5,1].forEach(f=>{const v=mx*f;g+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="${P.l-8}" y="${Y(v)+4}" text-anchor="end" style="fill:var(--muted);font-size:12px">${fmtM(v)}</text>`});
  data.forEach((d,i)=>{const x0=P.l+i*bw+bw*.18,w=bw*.3;
    g+=`<rect x="${x0}" y="${Y(d.i)}" width="${w}" height="${Y(0)-Y(d.i)}" rx="3" style="fill:var(--free)"><title>Ingresos ${mName(d.k)}: ${fmt(d.i)}</title></rect>`;
    g+=`<rect x="${x0+w+4}" y="${Y(d.g)}" width="${w}" height="${Y(0)-Y(d.g)}" rx="3" style="fill:var(--due)"><title>Gastos ${mName(d.k)}: ${fmt(d.g)}</title></rect>`;
    g+=`<text x="${P.l+i*bw+bw/2}" y="${H-8}" text-anchor="middle" style="fill:${d.k===k?'var(--ink)':'var(--muted)'};font-size:12px;font-weight:${d.k===k?600:400}">${MES_C[parseMk(d.k).m-1]}</text>`});
  return `<div class="chartbox"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos y gastos de los últimos meses">${g}</svg><div class="legend"><span style="--c:var(--free)">Ingresos</span><span style="--c:var(--due)">Gastos comprometidos</span></div></div>`;
}
