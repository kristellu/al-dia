// Cálculos del mes: totales, quincenas, deuda y observaciones
import { DEBT_CATS } from '../core/constants.js';
import { addM, mLow } from '../core/dates.js';
import { fmt, fmtM, sum } from '../core/utils.js';
import { M, state } from '../state/store.js';

export function stats(k){
  const mo=M(k)||{incomes:[],expenses:[]};
  const rec=sum(mo.incomes.filter(i=>i.status==='recibido'),i=>i.amount);
  const pendI=sum(mo.incomes.filter(i=>i.status!=='recibido'),i=>i.amount);
  const paid=sum(mo.expenses.filter(e=>e.status==='pagado'),e=>e.amount);
  const pend=sum(mo.expenses.filter(e=>e.status!=='pagado'),e=>e.amount);
  const totInc=rec+pendI, comp=paid+pend;
  const byCat={}; mo.expenses.forEach(e=>{byCat[e.category]=(byCat[e.category]||0)+e.amount});
  const q=[1,2].map(n=>{
    const inc=mo.incomes.filter(i=>i.q===n), ex=mo.expenses.filter(e=>e.q===n);
    const incT=sum(inc,i=>i.amount), incR=sum(inc.filter(i=>i.status==='recibido'),i=>i.amount);
    const p=sum(ex.filter(e=>e.status==='pagado'),e=>e.amount), d=sum(ex.filter(e=>e.status!=='pagado'),e=>e.amount);
    return{n,inc:incT,incR,paid:p,pend:d,comp:p+d,libre:incT-p-d};
  });
  return{rec,pendI,totInc,paid,pend,comp,libre:rec-paid-pend,proj:totInc-comp,
    deudas:sum(mo.expenses.filter(e=>DEBT_CATS.includes(e.category)),e=>e.amount),
    ahorro:sum(mo.expenses.filter(e=>e.category==='Ahorro / inversión'),e=>e.amount),
    pct:totInc?comp/totInc:0, byCat, q,
    recurring:sum(mo.expenses.filter(e=>e.recurring&&!e.variable),e=>e.amount), // sin los de valor variable: cambian por naturaleza
    toConfirm:mo.expenses.filter(e=>e.toConfirm)};
}
export function debtTotal(k){let t=0,any=false;state.S.debts.forEach(d=>{const b=(state.S.balances[d.id]||{})[k];if(b){t+=b.saldo||0;any=true}});return any?t:null}
export function prevWithData(k){for(let i=1;i<=24;i++){const p=addM(k,-i);if(M(p))return p}return null}
export function catSum(k,c){const mo=M(k);return mo?sum(mo.expenses.filter(e=>e.category===c),e=>e.amount):null}
export function insights(k){
  const out=[], s=stats(k), pk=addM(k,-1), ps=M(pk)?stats(pk):null;
  if(s.toConfirm.length)out.push({tone:'warn',title:s.toConfirm.length===1?'Tienes 1 pago con valor por confirmar':`Tienes ${s.toConfirm.length} pagos con valor por confirmar`,body:`${s.toConfirm.map(e=>e.name).join(', ')}. Mientras no registres el valor, no se descuenta de lo que tienes libre.`});
  if(ps&&ps.recurring>0&&Math.abs(s.recurring-ps.recurring)/ps.recurring>0.04){
    out.push({tone:s.recurring>ps.recurring?'warn':'good',title:s.recurring>ps.recurring?'Tus compromisos recurrentes aumentaron':'Tus compromisos recurrentes bajaron',body:`Pasaron de ${fmtM(ps.recurring)} en ${mLow(pk)} a ${fmtM(s.recurring)} en ${mLow(k)}.`});
  }
  s.q.forEach(q=>{if(q.inc>0&&q.libre<0)out.push({tone:'bad',title:`La ${q.n===1?'primera':'segunda'} quincena está sobrecomprometida`,body:`Comprometiste ${fmt(-q.libre)} más de lo que entra en ese período.`})});
  const c1=s.q[0].comp,c2=s.q[1].comp;
  if(c1+c2>0){const sh=c2/(c1+c2);
    if(sh>0.62)out.push({tone:'info',title:`El ${Math.round(sh*100)} % de tus pagos cae en la segunda quincena`,body:'Podrías mover algunos compromisos a la primera para equilibrar tu flujo.'});
    else if(sh<0.38)out.push({tone:'info',title:`El ${Math.round((1-sh)*100)} % de tus pagos cae en la primera quincena`,body:'Podrías mover algunos compromisos a la segunda para equilibrar tu flujo.'});}
  const d0=debtTotal(pk),d1=debtTotal(k);
  if(d0!=null&&d1!=null&&d0!==d1)out.push({tone:d1<d0?'good':'bad',title:d1<d0?'Tu deuda disminuyó este mes':'Tu deuda aumentó este mes',body:`Saldo anterior ${fmtM(d0)}, saldo actual ${fmtM(d1)}.`});
  Object.keys(s.byCat).forEach(c=>{
    const prev=[1,2,3].map(i=>catSum(addM(k,-i),c)).filter(v=>v!=null&&v>0);
    if(!prev.length)return; const avg=sum(prev)/prev.length, v=s.byCat[c];
    if(v>avg*1.2&&v-avg>50000)out.push({tone:'warn',title:`${c} está creciendo`,body:`Subió ${Math.round((v/avg-1)*100)} % frente al promedio de ${prev.length===1?'el mes anterior':'los últimos '+prev.length+' meses'}.`});
  });
  Object.entries(state.S.budgets).forEach(([c,b])=>{if(!b)return;const u=s.byCat[c]||0;
    if(u>b)out.push({tone:'bad',title:`Superaste el presupuesto de ${c}`,body:`Llevas ${fmt(u)} de ${fmt(b)}.`});
    else if(u/b>=0.8)out.push({tone:'warn',title:`Vas en ${Math.round(u/b*100)} % del presupuesto de ${c}`,body:`Te quedan ${fmt(b-u)} para el resto del mes.`});});
  return out;
}
export function debtMonths(){const set=new Set();Object.values(state.S.balances).forEach(b=>Object.keys(b).forEach(k=>set.add(k)));return [...set].sort()}
