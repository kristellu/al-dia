// Sincronización: el navegador envía al servidor solo las filas que cambiaron
import { $ } from '../core/utils.js';
import { api } from './api.js';
import { loadState } from './session.js';
import { blank, state } from '../state/store.js';
import { toast } from '../ui/toast.js';

export function setSync(mode){const el=$('#sync');el.className='sync '+(mode==='cloud'?'cloud':mode==='err'?'err':'');
  el.textContent=({cloud:'Guardado',pending:'Guardando…',err:'Sin conexión, reintentando'})[mode]||''}
/* El navegador trabaja con el estado completo (S); al servidor solo viajan las diferencias por fila. */
export function flatten(st){
  const f={categories:{},months:{},debts:{},movements:{},balances:{}};
  st.categories.forEach((c,i)=>f.categories[c]={name:c,sort_order:i,budget:st.budgets[c]||null});
  Object.entries(st.months).forEach(([k,m])=>{
    f.months[k]={month:k,closed:m.closed?1:0,closed_at:m.closed&&m.snapshot?m.snapshot.cerradoEl||null:null,snapshot:m.snapshot||null};
    m.expenses.forEach(e=>f.movements[e.id]={id:e.id,month:k,kind:'gasto',name:e.name,amount:e.amount,category:e.category||null,day:e.day||null,quincena:e.q,status:e.status==='pagado'?'pagado':'pendiente',paid_on:e.status==='pagado'?e.paidOn||null:null,recurring:e.recurring?1:0,note:e.note||null,income_type:null,gross:null,deductions:null,debt_id:e.debtId||null,variable_amount:e.variable?1:0,amount_pending:e.variable&&e.toConfirm?1:0,flagged:e.flagged?1:0});
    m.incomes.forEach(i=>f.movements[i.id]={id:i.id,month:k,kind:'ingreso',name:i.name,amount:i.amount,category:i.category||null,day:i.day||null,quincena:i.q,status:i.status==='recibido'?'recibido':'pendiente',paid_on:null,recurring:i.recurring?1:0,note:i.note||null,income_type:i.type==='salario'?'salario':'extra',gross:i.gross||null,deductions:i.deductions||null,debt_id:null,variable_amount:0,amount_pending:0,flagged:0});
  });
  st.debts.forEach(d=>f.debts[d.id]={id:d.id,name:d.name,bank:d.bank||null,last4:d.last4||null,kind:d.kind==='credito'?'credito':'tarjeta'});
  Object.entries(st.balances).forEach(([id,bm])=>Object.entries(bm).forEach(([k,b])=>{
    f.balances[id+'|'+k]={debt_id:id,month:k,saldo:b.saldo||0,minimo:b.minimo??null,total:b.total??null,fecha_limite:b.fecha||null,tasa_ea:b.tasa??null,cupo:b.cupo??null,cupo_disponible:b.cupoDisp??null}}));
  return f;
}
export function fromServer(d){
  const s=blank();
  if(d.categories.length){s.categories=d.categories.map(c=>c.name);d.categories.forEach(c=>{if(c.budget)s.budgets[c.name]=c.budget})}
  d.months.forEach(m=>{let snap=null;try{snap=m.snapshot_json?JSON.parse(m.snapshot_json):null}catch(e){}
    s.months[m.month]={incomes:[],expenses:[],closed:!!m.closed,snapshot:snap}});
  d.movements.forEach(r=>{const m=s.months[r.month];if(!m)return;
    if(r.kind==='gasto')m.expenses.push({id:r.id,name:r.name,amount:r.amount,category:r.category,day:r.day,q:r.quincena,status:r.status,paidOn:r.paid_on,recurring:!!r.recurring,note:r.note||'',debtId:r.debt_id||undefined,variable:!!r.variable_amount,toConfirm:!!r.amount_pending,flagged:!!r.flagged});
    else m.incomes.push({id:r.id,name:r.name,amount:r.amount,type:r.income_type||'extra',category:r.category,day:r.day,q:r.quincena,status:r.status,recurring:!!r.recurring,note:r.note||'',gross:r.gross,deductions:r.deductions})});
  s.debts=d.debts.map(r=>({id:r.id,name:r.name,bank:r.bank||'',last4:r.last4||'',kind:r.kind}));
  d.balances.forEach(b=>{(s.balances[b.debt_id]=s.balances[b.debt_id]||{})[b.month]={saldo:b.saldo,minimo:b.minimo,total:b.total,fecha:b.fecha_limite,tasa:b.tasa_ea,cupo:b.cupo,cupoDisp:b.cupo_disponible}});
  return s;
}
export function diff(a,b){
  const up={},del={};let n=0;
  for(const t of Object.keys(b)){up[t]=[];del[t]=[];
    for(const k in b[t])if(!a[t][k]||JSON.stringify(a[t][k])!==JSON.stringify(b[t][k])){up[t].push(b[t][k]);n++}
    for(const k in a[t])if(!b[t][k]){del[t].push(t==='categories'?a[t][k].name:k);n++}}
  return n?{upserts:up,deletes:del}:null;
}
let saveTimer=null, syncing=false, again=false;
export function save(){if(!state.synced)return;setSync('pending');clearTimeout(saveTimer);saveTimer=setTimeout(flush,600)}
export async function flush(){
  if(!state.synced)return; if(syncing){again=true;return}
  const next=flatten(state.S), d=diff(state.synced,next);
  if(!d){setSync('cloud');return}
  syncing=true;
  try{const r=await api('/api/sync',{method:'POST',body:d});state.synced=next;setSync('cloud');
    if(r.skipped)toast(`Se omitieron ${r.skipped} registros fuera de los últimos ${state.WIN.retention} meses.`)}
  catch(e){
    if(e.status===401)return;
    if(e.status>=400&&e.status<500){toast(e.message+'. Recargando lo guardado.');await loadState()}
    else{setSync('err');setTimeout(flush,5000)}}
  finally{syncing=false;if(again){again=false;flush()}}
}
