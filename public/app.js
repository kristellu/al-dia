'use strict';
/* ============ Utilidades ============ */
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MES_C=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIAS=['dom','lun','mar','mié','jue','vie','sáb'];
const DEFAULT_CATS=['Vivienda','Servicios','Alimentación','Transporte','Créditos y deudas','Tarjetas de crédito','Salud','Educación','Entretenimiento','Suscripciones','Familia','Ahorro / inversión','Gastos personales','Otros'];
const INCOME_CATS=['Salario','Bonificación','Comisión','Freelance','Reembolso','Venta de activo','Otro ingreso'];
const DEBT_CATS=['Créditos y deudas','Tarjetas de crédito'];
const CAT_COLORS=['#27497A','#1C7A58','#A86D0C','#A3404D','#5B4F9E','#2E8A9A','#B05A2A','#6E7F2E','#8E3E7C','#3F6FB0','#7A6A55','#4D8F6E','#9C7A1A','#6B7B8C'];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>(n<0?'−':'')+'$'+Math.round(Math.abs(n||0)).toLocaleString('es-CO');
const fmtM=n=>Math.abs(n)>=1e6?(n<0?'−':'')+'$'+(Math.abs(n)/1e6).toLocaleString('es-CO',{maximumFractionDigits:1})+' M':fmt(n);
const num=s=>{const d=String(s??'').replace(/[^\d]/g,'');return d?Number(d):0};
const dec=s=>{const v=parseFloat(String(s??'').replace(/[^\d.,]/g,'').replace(',','.'));return isNaN(v)?null:v};
const newId=()=>crypto.randomUUID();
const sum=(a,f)=>a.reduce((t,x)=>t+(f?f(x):x),0);
const mk=(y,m)=>y+'-'+String(m).padStart(2,'0');
const parseMk=k=>{const[y,m]=k.split('-').map(Number);return{y,m}};
const addM=(k,d)=>{let{y,m}=parseMk(k);m+=d;while(m>12){m-=12;y++}while(m<1){m+=12;y--}return mk(y,m)};
const daysIn=k=>{const{y,m}=parseMk(k);return new Date(y,m,0).getDate()};
const mName=k=>{const s=MESES[parseMk(k).m-1];return s[0].toUpperCase()+s.slice(1)};
const mLow=k=>MESES[parseMk(k).m-1];
const mFull=k=>mName(k)+' '+parseMk(k).y;
const NOW=new Date();
const TODAY_K=mk(NOW.getFullYear(),NOW.getMonth()+1);
const TODAY_D=NOW.getDate();
const isoToday=()=>NOW.toISOString().slice(0,10);
const qOf=d=>d<=15?1:2;
const catColor=c=>{const i=S.categories.indexOf(c);return CAT_COLORS[(i<0?S.categories.length:i)%CAT_COLORS.length]};

/* ============ Estado ============ */
let S=blank();
let view='inicio', cur=TODAY_K, movFilter='todos', selCat=null, USERS=null;
function blank(){return{v:1,categories:[...DEFAULT_CATS],budgets:{},months:{},debts:[],balances:{}}}
function normalize(o){
  const s=JSON.parse(JSON.stringify(o||{}));
  const b=blank();
  s.categories=Array.isArray(s.categories)&&s.categories.length?s.categories:b.categories;
  s.budgets=s.budgets||{}; s.months=s.months||{}; s.debts=s.debts||[]; s.balances=s.balances||{};
  for(const k in s.months){const m=s.months[k];m.incomes=m.incomes||[];m.expenses=m.expenses||[];}
  s.v=1; return s;
}
const hasAny=()=>Object.keys(S.months).length>0||S.debts.length>0;
const M=k=>S.months[k];
const ensure=k=>{if(!S.months[k])S.months[k]={incomes:[],expenses:[],closed:false};return S.months[k]};

/* ============ API, sesión y sincronización ============ */
let ME=null, WIN=null, synced=null;
async function api(path,{method='GET',body,auth=true}={}){
  const opt={method,credentials:'same-origin',headers:{Accept:'application/json'}};
  if(method!=='GET')opt.headers['X-Requested-With']='al-dia';
  if(body!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(body)}
  let r;try{r=await fetch(path,opt)}catch(e){throw{status:0,message:'No hay conexión con el servidor.'}}
  let d=null;try{d=await r.json()}catch(e){}
  if(!r.ok){if(r.status===401&&auth)onLoggedOut();throw{status:r.status,message:(d&&d.error)||'Error '+r.status}}
  return d||{};
}
function setSync(mode){const el=$('#sync');el.className='sync '+(mode==='cloud'?'cloud':mode==='err'?'err':'');
  el.textContent=({cloud:'Guardado',pending:'Guardando…',err:'Sin conexión, reintentando'})[mode]||''}

/* El navegador trabaja con el estado completo (S); al servidor solo viajan las diferencias por fila. */
function flatten(st){
  const f={categories:{},months:{},debts:{},movements:{},balances:{}};
  st.categories.forEach((c,i)=>f.categories[c]={name:c,sort_order:i,budget:st.budgets[c]||null});
  Object.entries(st.months).forEach(([k,m])=>{
    f.months[k]={month:k,closed:m.closed?1:0,closed_at:m.closed&&m.snapshot?m.snapshot.cerradoEl||null:null,snapshot:m.snapshot||null};
    m.expenses.forEach(e=>f.movements[e.id]={id:e.id,month:k,kind:'gasto',name:e.name,amount:e.amount,category:e.category||null,day:e.day||null,quincena:e.q,status:e.status==='pagado'?'pagado':'pendiente',paid_on:e.status==='pagado'?e.paidOn||null:null,recurring:e.recurring?1:0,note:e.note||null,income_type:null,gross:null,deductions:null,debt_id:e.debtId||null});
    m.incomes.forEach(i=>f.movements[i.id]={id:i.id,month:k,kind:'ingreso',name:i.name,amount:i.amount,category:i.category||null,day:i.day||null,quincena:i.q,status:i.status==='recibido'?'recibido':'pendiente',paid_on:null,recurring:i.recurring?1:0,note:i.note||null,income_type:i.type==='salario'?'salario':'extra',gross:i.gross||null,deductions:i.deductions||null,debt_id:null});
  });
  st.debts.forEach(d=>f.debts[d.id]={id:d.id,name:d.name,bank:d.bank||null,last4:d.last4||null,kind:d.kind==='credito'?'credito':'tarjeta'});
  Object.entries(st.balances).forEach(([id,bm])=>Object.entries(bm).forEach(([k,b])=>{
    f.balances[id+'|'+k]={debt_id:id,month:k,saldo:b.saldo||0,minimo:b.minimo??null,total:b.total??null,fecha_limite:b.fecha||null,tasa_ea:b.tasa??null,cupo:b.cupo??null,cupo_disponible:b.cupoDisp??null}}));
  return f;
}
function fromServer(d){
  const s=blank();
  if(d.categories.length){s.categories=d.categories.map(c=>c.name);d.categories.forEach(c=>{if(c.budget)s.budgets[c.name]=c.budget})}
  d.months.forEach(m=>{let snap=null;try{snap=m.snapshot_json?JSON.parse(m.snapshot_json):null}catch(e){}
    s.months[m.month]={incomes:[],expenses:[],closed:!!m.closed,snapshot:snap}});
  d.movements.forEach(r=>{const m=s.months[r.month];if(!m)return;
    if(r.kind==='gasto')m.expenses.push({id:r.id,name:r.name,amount:r.amount,category:r.category,day:r.day,q:r.quincena,status:r.status,paidOn:r.paid_on,recurring:!!r.recurring,note:r.note||'',debtId:r.debt_id||undefined});
    else m.incomes.push({id:r.id,name:r.name,amount:r.amount,type:r.income_type||'extra',category:r.category,day:r.day,q:r.quincena,status:r.status,recurring:!!r.recurring,note:r.note||'',gross:r.gross,deductions:r.deductions})});
  s.debts=d.debts.map(r=>({id:r.id,name:r.name,bank:r.bank||'',last4:r.last4||'',kind:r.kind}));
  d.balances.forEach(b=>{(s.balances[b.debt_id]=s.balances[b.debt_id]||{})[b.month]={saldo:b.saldo,minimo:b.minimo,total:b.total,fecha:b.fecha_limite,tasa:b.tasa_ea,cupo:b.cupo,cupoDisp:b.cupo_disponible}});
  return s;
}
function diff(a,b){
  const up={},del={};let n=0;
  for(const t of Object.keys(b)){up[t]=[];del[t]=[];
    for(const k in b[t])if(!a[t][k]||JSON.stringify(a[t][k])!==JSON.stringify(b[t][k])){up[t].push(b[t][k]);n++}
    for(const k in a[t])if(!b[t][k]){del[t].push(t==='categories'?a[t][k].name:k);n++}}
  return n?{upserts:up,deletes:del}:null;
}
let saveTimer=null, syncing=false, again=false;
function save(){if(!synced)return;setSync('pending');clearTimeout(saveTimer);saveTimer=setTimeout(flush,600)}
async function flush(){
  if(!synced)return; if(syncing){again=true;return}
  const next=flatten(S), d=diff(synced,next);
  if(!d){setSync('cloud');return}
  syncing=true;
  try{const r=await api('/api/sync',{method:'POST',body:d});synced=next;setSync('cloud');
    if(r.skipped)toast(`Se omitieron ${r.skipped} registros fuera de los últimos ${WIN.retention} meses.`)}
  catch(e){
    if(e.status===401)return;
    if(e.status>=400&&e.status<500){toast(e.message+'. Recargando lo guardado.');await loadState()}
    else{setSync('err');setTimeout(flush,5000)}}
  finally{syncing=false;if(again){again=false;flush()}}
}
window.addEventListener('beforeunload',e=>{if(synced&&diff(synced,flatten(S))){e.preventDefault();e.returnValue=''}});

async function loadState(){
  const r=await api('/api/state');
  ME=r.user;WIN=r.window;S=normalize(fromServer(r.data));synced=flatten(S);
  if(!r.data.categories.length){synced.categories={};save()} // primera vez: guarda las categorías por defecto
  if(cur<WIN.cutoff||cur>WIN.max)cur=WIN.current;
  showApp();render();setSync('cloud');
}
function showApp(){document.body.classList.remove('logged-out');$('#acctBtn').textContent=ME?ME.displayName:'Cuenta'}
function onLoggedOut(){ME=null;WIN=null;synced=null;S=blank();USERS=null;closeModal();showLogin()}
function showLogin(msg){
  document.body.classList.add('logged-out');
  $('#app').innerHTML=`<div class="login"><h1>Al día</h1><p class="muted">Ingresa para ver cuánto tienes libre este mes.</p>
    <form id="loginForm" autocomplete="on">
      ${msg?`<div class="warnbox">${esc(msg)}</div>`:''}
      <div class="field"><label for="lu">Usuario</label><input id="lu" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
      <div class="field"><label for="lp">Contraseña</label><input id="lp" name="password" type="password" autocomplete="current-password" required></div>
      <p id="loginErr" class="small" style="color:var(--debt);min-height:1.5em" role="alert"></p>
      <button class="btn primary" style="width:100%;justify-content:center">Ingresar</button>
    </form></div>`;
  const f=$('#loginForm');f.username.focus();
  f.addEventListener('submit',async ev=>{ev.preventDefault();const btn=f.querySelector('button');btn.disabled=true;$('#loginErr').textContent='';
    try{const r=await api('/api/auth/login',{method:'POST',body:{username:f.username.value,password:f.password.value},auth:false});
      if(r.mustChangePassword){const me=await api('/api/auth/me');ME=me.user;WIN=me.window;showApp();$('#app').innerHTML='';passwordForm(true)}
      else await loadState()}
    catch(e){$('#loginErr').textContent=e.message;f.password.value='';f.password.focus()}
    finally{btn.disabled=false}});
}
async function boot(){
  try{const me=await api('/api/auth/me',{auth:false});ME=me.user;WIN=me.window;
    if(ME.mustChangePassword){showApp();$('#app').innerHTML='';passwordForm(true);return}
    await loadState()}
  catch(e){if(e.status===401)showLogin();else{document.body.classList.add('logged-out');$('#app').innerHTML=`<div class="login"><h1>No se pudo cargar</h1><p class="muted">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reintentar</button></div>`}}
}
function exportBackup(){
  const blob=new Blob([JSON.stringify({app:'al-dia',exportado:new Date().toISOString(),datos:S},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`al-dia-respaldo-${isoToday()}.json`;
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast('Respaldo descargado');
}
function importBackup(){
  const inp=document.createElement('input');inp.type='file';inp.accept='application/json,.json';
  inp.onchange=async()=>{const f=inp.files[0];if(!f)return;
    try{const o=JSON.parse(await f.text());const d=o&&o.app==='al-dia'?o.datos:o;
      if(!d||typeof d!=='object'||!d.months)throw new Error('formato');
      if(!confirm('Esto reemplaza tus datos guardados por los del respaldo. ¿Continuar?'))return;
      S=normalize(d);for(const k in S.months)if(k<WIN.cutoff)delete S.months[k];
      save();render();toast('Respaldo restaurado')}
    catch(e){toast('El archivo no es un respaldo válido de Al día')}};
  inp.click();
}

/* ============ Cálculos ============ */
function stats(k){
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
    recurring:sum(mo.expenses.filter(e=>e.recurring),e=>e.amount)};
}
function debtTotal(k){let t=0,any=false;S.debts.forEach(d=>{const b=(S.balances[d.id]||{})[k];if(b){t+=b.saldo||0;any=true}});return any?t:null}
function prevWithData(k){for(let i=1;i<=24;i++){const p=addM(k,-i);if(M(p))return p}return null}
function catSum(k,c){const mo=M(k);return mo?sum(mo.expenses.filter(e=>e.category===c),e=>e.amount):null}

function insights(k){
  const out=[], s=stats(k), pk=addM(k,-1), ps=M(pk)?stats(pk):null;
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
  Object.entries(S.budgets).forEach(([c,b])=>{if(!b)return;const u=s.byCat[c]||0;
    if(u>b)out.push({tone:'bad',title:`Superaste el presupuesto de ${c}`,body:`Llevas ${fmt(u)} de ${fmt(b)}.`});
    else if(u/b>=0.8)out.push({tone:'warn',title:`Vas en ${Math.round(u/b*100)} % del presupuesto de ${c}`,body:`Te quedan ${fmt(b-u)} para el resto del mes.`});});
  return out;
}

/* ============ Render ============ */
function render(){
  if(!ME||!WIN)return;
  $('#monthLabel').textContent=mFull(cur);
  const atCut=addM(cur,-1)<WIN.cutoff;$('#prevBtn').disabled=atCut;
  $('#prevBtn').title=atCut?`Solo se conservan los últimos ${WIN.retention} meses`:'';
  $('#adminTab').hidden=ME.role!=='admin';
  $('#prevBtn').textContent='‹ '+mName(addM(cur,-1));
  $('#nextBtn').textContent=mName(addM(cur,1))+' ›';
  document.querySelectorAll('nav.tabs button').forEach(b=>{if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  const app=$('#app');
  if(view==='deudas'){app.innerHTML=vDeudas();return}
  if(view==='usuarios'){app.innerHTML=vUsuarios();if(!USERS)loadUsers();return}
  if(!M(cur)){app.innerHTML=vEmptyMonth();return}
  app.innerHTML=({inicio:vInicio,movimientos:vMov,calendario:vCal,analisis:vAnalisis})[view]();
}

function vEmptyMonth(){
  const src=prevWithData(cur);
  if(!hasAny())return `<div class="monthempty">
    <h1>Empecemos por lo que entra y lo que tienes que pagar.</h1>
    <p>Carga tu comprobante de nómina o agrega tus pagos fijos del mes. Con eso ya puedo decirte cuánto tienes libre de verdad.</p>
    <div class="hero-actions">
      <button class="btn primary" data-act="upload-payroll">Cargar comprobante de nómina</button>
      <button class="btn" data-act="start-empty">Agregar mis pagos a mano</button>
      <button class="btn ghost" data-act="demo">Ver con datos de ejemplo</button>
    </div></div>`;
  const rec=src?[...M(src).expenses,...M(src).incomes].filter(x=>x.recurring).length:0;
  return `<div class="monthempty">
    <h1>${mName(cur)} aún no está preparado.</h1>
    <p>${src&&rec?`Puedo traer tus ${rec} compromisos recurrentes de ${mLow(src)} como pendientes, para que solo tengas que marcarlos cuando los pagues.`:'Todavía no hay compromisos recurrentes para copiar. Puedes empezar el mes vacío.'}</p>
    <div class="hero-actions">
      ${src&&rec?`<button class="btn primary" data-act="prepare">Preparar ${mLow(cur)}</button>`:''}
      <button class="btn${src&&rec?'':' primary'}" data-act="start-empty">Empezar ${mLow(cur)} vacío</button>
    </div></div>`;
}

function ribbon(k){
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

function quinCard(q,k){
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

function expRow(e,k,showDate=true){
  const N=daysIn(k), late=e.status!=='pagado'&&((k===TODAY_K&&e.day<TODAY_D)||k<TODAY_K);
  const soon=!late&&e.status!=='pagado'&&k===TODAY_K&&e.day>=TODAY_D&&e.day-TODAY_D<=7;
  return `<div class="row ${e.status==='pagado'?'done':''}">
    <input type="checkbox" class="check" data-toggle="e:${e.id}" ${e.status==='pagado'?'checked':''} aria-label="Marcar ${esc(e.name)} como pagado">
    <div class="clickable" data-act="edit-exp" data-id="${e.id}" style="cursor:pointer">
      <div class="rname">${esc(e.name)}${e.note?`<span class="note" title="${esc(e.note)}" aria-label="Observación: ${esc(e.note)}">i</span>`:''}${late?'<span class="tag late">Vencido</span>':soon?'<span class="tag soon">Pronto</span>':''}${e.recurring?'<span class="tag">Mensual</span>':''}</div>
      <div class="rmeta">${showDate?(e.day?e.day+' '+MES_C[parseMk(k).m-1]+' · ':''):''}${esc(e.category)}${e.status==='pagado'&&e.paidOn?' · pagado el '+fmtDate(e.paidOn):''}</div>
    </div>
    <div class="ramt">${fmt(e.amount)}</div></div>`;
}
function incRow(i,k){
  return `<div class="row ${i.status==='recibido'?'':''}">
    <input type="checkbox" class="check" data-toggle="i:${i.id}" ${i.status==='recibido'?'checked':''} aria-label="Marcar ${esc(i.name)} como recibido">
    <div class="clickable" data-act="edit-inc" data-id="${i.id}" style="cursor:pointer">
      <div class="rname">${esc(i.name)}<span class="tag ${i.type==='salario'?'sal':'ext'}">${i.type==='salario'?'Salario':esc(i.category||'Adicional')}</span>${i.note?`<span class="note" title="${esc(i.note)}">i</span>`:''}${i.status!=='recibido'?'<span class="tag soon">Por recibir</span>':''}</div>
      <div class="rmeta">Quincena ${i.q}${i.day?' · día '+i.day:''}${i.deductions?' · deducciones '+fmt(i.deductions)+' (informativo)':''}</div>
    </div>
    <div class="ramt" style="color:var(--free)">+${fmt(i.amount)}</div></div>`;
}
function fmtDate(iso){const[y,m,d]=iso.split('-').map(Number);return d+' '+MES_C[m-1]}

function vInicio(){
  const k=cur, s=stats(k), mo=M(k), pk=addM(k,-1), ps=M(pk)?stats(pk):null;
  let sent;
  if(s.totInc===0) sent='Aún no registras ingresos este mes. Carga tu comprobante para ver cuánto queda libre.';
  else if(s.libre<0) sent=`Lo que te falta pagar supera lo que ya recibiste. ${s.pendI>0?`Cuando entren los ${fmt(s.pendI)} pendientes quedarías en ${fmt(s.proj)}.`:''}`;
  else sent=`libres de verdad, después de separar lo que ya pagaste y los ${fmt(s.pend)} que aún te faltan.${s.pendI>0?` Cuando entren los ${fmt(s.pendI)} por recibir, cerrarías ${mLow(k)} con ${fmt(s.proj)}.`:''}`;
  const pendList=mo.expenses.filter(e=>e.status!=='pagado').sort((a,b)=>(a.day||99)-(b.day||99));
  let up=[];
  if(k===TODAY_K) up=pendList.filter(e=>e.day&&e.day-TODAY_D<=7);
  else if(k<TODAY_K) up=pendList;
  const ins=insights(k).slice(0,4);
  const cats=Object.entries(s.byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  return `
  ${mo.closed?`<div class="closed-banner"><span>${mName(k)} está cerrado. Lo que ves es la fotografía final del mes.</span><button class="btn" data-act="reopen">Reabrir ${mLow(k)}</button></div>`:''}
  <section class="hero">
    <p class="hero-q">¿Cuánto tengo libre en ${mLow(k)}?</p>
    <div class="hero-n ${s.libre<0?'neg':''}">${fmt(s.libre)}</div>
    <p class="hero-s">${sent}</p>
    ${ribbon(k)}
    <div class="hero-actions">
      <button class="btn primary" data-act="upload-payroll">Cargar comprobante</button>
      <button class="btn" data-act="add-exp">Agregar gasto</button>
      <button class="btn" data-act="add-inc">Agregar ingreso</button>
    </div>
  </section>
  <dl class="strip">
    <div><dt>Recibido</dt><dd>${fmt(s.rec)}</dd></div>
    <div><dt>Por recibir</dt><dd>${fmt(s.pendI)}</dd></div>
    <div><dt>Pagado</dt><dd>${fmt(s.paid)}</dd></div>
    <div><dt>Por pagar</dt><dd>${fmt(s.pend)}</dd></div>
    <div><dt>Comprometido</dt><dd>${Math.round(s.pct*100)} % de tus ingresos</dd></div>
    <div><dt>A deudas</dt><dd>${fmt(s.deudas)}</dd></div>
    <div><dt>A ahorro</dt><dd>${fmt(s.ahorro)}</dd></div>
  </dl>
  <section class="block"><div class="block-head"><h2>Tus dos quincenas</h2></div>
    <div class="quins">${s.q.map(q=>quinCard(q,k)).join('')}</div></section>
  ${up.length?`<section class="block"><div class="block-head"><h2>${k===TODAY_K?'Próximos 7 días':'Quedó sin pagar'}</h2></div>
    <div class="upcoming">${up.map(e=>{const late=(k===TODAY_K&&e.day<TODAY_D)||k<TODAY_K;return `<div class="up ${late?'late':''}"><span class="small muted">${late?'Venció el':'Vence el'} ${e.day} de ${mLow(k)}</span><div style="font-weight:500">${esc(e.name)}</div><b>${fmt(e.amount)}</b></div>`}).join('')}</div></section>`:''}
  <section class="block"><div class="block-head"><h2>Lo que falta pagar</h2><span class="muted small">${pendList.length} pendiente${pendList.length===1?'':'s'} · ${fmt(s.pend)}</span></div>
    <div class="list">${pendList.length?pendList.map(e=>expRow(e,k)).join(''):`<div class="empty">No tienes pagos pendientes en ${mLow(k)}.</div>`}</div></section>
  ${ins.length?`<section class="block"><div class="block-head"><h2>Lo que vale la pena mirar</h2><button class="btn ghost" data-view-go="analisis">Ver análisis</button></div>
    <div class="insights">${ins.map(i=>`<div class="ins ${i.tone}"><div><h3>${esc(i.title)}</h3><p>${esc(i.body)}</p></div></div>`).join('')}</div></section>`:''}
  ${cats.length?`<section class="block"><div class="block-head"><h2>En qué se va la plata</h2>${ps?`<span class="muted small">${s.comp<=ps.comp?'Gastaste '+fmt(ps.comp-s.comp)+' menos':'Gastaste '+fmt(s.comp-ps.comp)+' más'} que en ${mLow(pk)}</span>`:''}</div>
    <div class="dist">${cats.map(([c,v])=>`<div class="drow" style="cursor:default"><span>${esc(c)}</span><span class="dtrack"><i style="width:${v/s.comp*100}%;background:${catColor(c)}"></i></span><span class="muted" style="text-align:right">${Math.round(v/s.comp*100)} %</span><span style="text-align:right">${fmt(v)}</span></div>`).join('')}</div></section>`:''}
  `;
}

function vMov(){
  const k=cur, mo=M(k), s=stats(k);
  const inc=[...mo.incomes].sort((a,b)=>a.q-b.q||(a.day||0)-(b.day||0));
  const ex=[...mo.expenses].sort((a,b)=>(a.day||99)-(b.day||99));
  const showI=movFilter!=='gastos', showE=movFilter!=='ingresos';
  const fl=(v,l)=>`<button class="chip" aria-pressed="${movFilter===v}" data-filter="${v}">${l}</button>`;
  return `<section class="hero" style="padding-bottom:0"><div class="block-head"><h1 style="font-size:2rem">Movimientos de ${mLow(k)}</h1>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="add-inc">Agregar ingreso</button><button class="btn primary" data-act="add-exp">Agregar gasto</button></div></div>
    <div class="filters">${fl('todos','Todos')}${fl('ingresos','Ingresos')}${fl('gastos','Gastos')}</div></section>
  ${showI?`<section class="block" style="margin-top:12px"><div class="block-head"><h2>Ingresos</h2><span class="muted small">${fmt(s.rec)} recibido · ${fmt(s.pendI)} por recibir</span></div>
    <div class="list">${inc.length?inc.map(i=>incRow(i,k)).join(''):`<div class="empty">Sin ingresos registrados. <button class="btn ghost" data-act="upload-payroll">Cargar comprobante</button></div>`}</div></section>`:''}
  ${showE?`<section class="block"><div class="block-head"><h2>Gastos</h2><span class="muted small">${fmt(s.paid)} pagado · ${fmt(s.pend)} pendiente</span></div>
    <div class="list">${[1,2].map(q=>{const l=ex.filter(e=>e.q===q);return `<div class="list-label"><span>${q===1?'Primera quincena':'Segunda quincena'}</span><span>${fmt(sum(l,e=>e.amount))}</span></div>`+(l.length?l.map(e=>expRow(e,k)).join(''):'<div class="empty small">Nada en esta quincena.</div>')}).join('')}</div></section>`:''}`;
}

function vCal(){
  const k=cur, mo=M(k), N=daysIn(k), {y,m}=parseMk(k);
  const byDay={};
  mo.expenses.forEach(e=>{const d=e.day||(e.q===1?15:N);(byDay[d]=byDay[d]||[]).push({...e,kind:'e'})});
  mo.incomes.forEach(i=>{const d=i.day||(i.q===1?15:N);(byDay[d]=byDay[d]||[]).push({...i,kind:'i'})});
  const days=Object.keys(byDay).map(Number).sort((a,b)=>a-b);
  const block=q=>{const ds=days.filter(d=>qOf(d)===q);if(!ds.length)return '<p class="muted" style="padding:14px 0">Sin movimientos en esta quincena.</p>';
    return ds.map(d=>{const wd=DIAS[new Date(y,m-1,d).getDay()];return `<div class="aday ${k===TODAY_K&&d===TODAY_D?'today':''}"><div class="d">${d}<small>${wd}${k===TODAY_K&&d===TODAY_D?' · hoy':''}</small></div><div class="aitems">${byDay[d].map(it=>it.kind==='i'
      ?`<div class="aitem"><input type="checkbox" class="check" data-toggle="i:${it.id}" ${it.status==='recibido'?'checked':''} aria-label="Recibido"><span>${esc(it.name)} <span class="tag ${it.type==='salario'?'sal':'ext'}">Ingreso</span></span><b style="color:var(--free)">+${fmt(it.amount)}</b></div>`
      :`<div class="aitem"><input type="checkbox" class="check" data-toggle="e:${it.id}" ${it.status==='pagado'?'checked':''} aria-label="Pagado"><span style="${it.status==='pagado'?'color:var(--muted);text-decoration:line-through':''}">${esc(it.name)}${it.note?` <span class="note" title="${esc(it.note)}">i</span>`:''}${it.status!=='pagado'&&((k===TODAY_K&&d<TODAY_D)||k<TODAY_K)?' <span class="tag late">Vencido</span>':''}</span><b>${fmt(it.amount)}</b></div>`).join('')}</div></div>`}).join('')};
  return `<section class="hero" style="padding-bottom:0"><h1 style="font-size:2rem">Agenda de ${mLow(k)}</h1><p class="muted" style="margin-top:6px">Qué entra y qué tienes que pagar, día por día.</p></section>
  <div class="qdiv">Primera quincena · 1 al 15</div><div class="agenda">${block(1)}</div>
  <div class="qdiv">Segunda quincena · 16 al ${N}</div><div class="agenda">${block(2)}</div>`;
}

function debtMonths(){const set=new Set();Object.values(S.balances).forEach(b=>Object.keys(b).forEach(k=>set.add(k)));return [...set].sort()}
function vDeudas(){
  const k=cur, pk=addM(k,-1), t=debtTotal(k), tp=debtTotal(pk);
  const months=debtMonths().filter(x=>x<=k).slice(-8);
  const actions=`<div class="hero-actions"><button class="btn primary" data-act="upload-statement">Cargar extracto</button><button class="btn" data-act="add-debt">Agregar producto</button>${S.debts.length?'<button class="btn" data-act="add-balance">Registrar saldo</button>':''}</div>`;
  if(!S.debts.length)return `<div class="monthempty"><h1>¿Cuánto debes de verdad?</h1><p>Carga el extracto de una tarjeta o crédito y lo registro aquí. Mes a mes verás si la deuda baja o solo se está moviendo de un lado a otro.</p>${actions}</div>`;
  const rows=S.debts.map(d=>{const b=S.balances[d.id]||{};const a=b[pk]?.saldo,c=b[k]?.saldo;const v=(a!=null&&c!=null)?c-a:null;
    return `<tr><td>${esc(d.name)}${d.last4?` <span class="muted small">•••• ${esc(d.last4)}</span>`:''}</td><td>${a!=null?fmt(a):'—'}</td><td>${c!=null?fmt(c):'—'}</td><td class="${v==null?'':v<=0?'down':'up-c'}">${v==null?'—':(v>0?'+':'')+fmt(v)}</td><td>${b[k]?.fecha?fmtDate(b[k].fecha):'—'}</td></tr>`}).join('');
  return `<section class="hero"><p class="hero-q">Deuda total en ${mLow(k)}</p>
    <div class="hero-n" style="color:var(--ink)">${t!=null?fmt(t):'Sin saldo'}</div>
    <p class="hero-s">${t!=null&&tp!=null?(t<=tp?`<span class="down">↓ ${fmt(tp-t)}</span> frente a ${mLow(pk)}. Vas bien: la deuda está bajando.`:`<span class="up-c">↑ ${fmt(t-tp)}</span> frente a ${mLow(pk)}. Revisa si estás trasladando saldos.`):t==null?`Aún no registras saldos para ${mLow(k)}. Carga los extractos del mes.`:'Registra también el mes anterior para ver la variación.'}</p>
    ${actions}</section>
  <section class="block"><div class="block-head"><h2>Producto por producto</h2></div>
    <div class="tscroll"><table><thead><tr><th>Producto</th><th>${mName(pk)}</th><th>${mName(k)}</th><th>Variación</th><th>Fecha límite</th></tr></thead><tbody>${rows}</tbody></table></div></section>
  ${months.length>1?`<section class="block"><div class="block-head"><h2>Cómo ha evolucionado</h2></div><div class="chartbox">${debtChart(months)}</div></section>`:''}
  <section class="block"><div class="block-head"><h2>Historial</h2></div><div class="debtcards">${S.debts.map(d=>{const b=S.balances[d.id]||{};const ks=Object.keys(b).sort().slice(-6);
    const tr=ks.length>1?b[ks[ks.length-1]].saldo-b[ks[0]].saldo:null;
    return `<div class="dc"><div style="display:flex;justify-content:space-between;gap:8px"><h3>${esc(d.name)}</h3><button class="btn ghost small" data-act="edit-debt" data-id="${d.id}">Editar</button></div>
      <p class="muted small">${esc(d.bank||'')}${d.last4?' · •••• '+esc(d.last4):''}</p>
      ${tr!=null?`<p style="margin-top:8px" class="${tr<=0?'down':'up-c'}">${tr<=0?'↓':'↑'} ${fmtM(Math.abs(tr))} en ${ks.length} meses</p>`:''}
      <ol>${ks.map(x=>`<li><span>${mName(x)}</span><span>${fmtM(b[x].saldo)}${b[x].minimo?` <span class="muted small">mín. ${fmtM(b[x].minimo)}</span>`:''}</span></li>`).join('')||'<li class="muted">Sin saldos</li>'}</ol></div>`}).join('')}</div></section>`;
}
function debtChart(months){
  const W=700,H=230,P={l:70,r:16,t:16,b:34};
  const totals=months.map(m=>debtTotal(m)||0); const mx=Math.max(...totals)*1.1||1;
  const X=i=>P.l+(months.length===1?0:i*(W-P.l-P.r)/(months.length-1)), Y=v=>P.t+(1-v/mx)*(H-P.t-P.b);
  let g='';
  [0,.5,1].forEach(f=>{const v=mx*f;g+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="${P.l-8}" y="${Y(v)+4}" text-anchor="end" style="fill:var(--muted);font-size:12px">${fmtM(v)}</text>`});
  S.debts.forEach((d,di)=>{const pts=months.map((m,i)=>{const b=(S.balances[d.id]||{})[m];return b?[X(i),Y(b.saldo)]:null}).filter(Boolean);
    if(pts.length>1)g+=`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" style="stroke:${CAT_COLORS[(di+3)%CAT_COLORS.length]};stroke-width:1.5;opacity:.55"/>`});
  g+=`<polyline points="${totals.map((v,i)=>X(i)+','+Y(v)).join(' ')}" fill="none" style="stroke:var(--ink);stroke-width:3"/>`;
  totals.forEach((v,i)=>{g+=`<circle cx="${X(i)}" cy="${Y(v)}" r="4.5" style="fill:var(--ink)"><title>${mName(months[i])}: ${fmt(v)}</title></circle><text x="${X(i)}" y="${H-10}" text-anchor="middle" style="fill:var(--muted);font-size:12px">${MES_C[parseMk(months[i]).m-1]}</text>`});
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución de la deuda total">${g}</svg><div class="legend"><span style="--c:var(--ink)">Total</span>${S.debts.map((d,di)=>`<span style="--c:${CAT_COLORS[(di+3)%CAT_COLORS.length]}">${esc(d.name)}</span>`).join('')}</div>`;
}

function monthsChart(k){
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

function vAnalisis(){
  const k=cur, s=stats(k), mo=M(k), pk=prevWithData(k), ps=pk?stats(pk):null;
  const per100=s.totInc?Math.round(s.comp/s.totInc*100):0;
  const cats=Object.entries(s.byCat).sort((a,b)=>b[1]-a[1]);
  const ins=insights(k);
  const cmp=[];
  if(ps){const d=s.comp-ps.comp;cmp.push(d<=0?`Gastaste ${fmt(-d)} menos que en ${mLow(pk)}.`:`Gastaste ${fmt(d)} más que en ${mLow(pk)}.`);
    const di=s.totInc-ps.totInc; if(di!==0)cmp.push(`Tus ingresos ${di>0?'subieron':'bajaron'} ${fmt(Math.abs(di))} frente a ${mLow(pk)}.`);
    if(ps.ahorro||s.ahorro)cmp.push(`Destinaste ${fmt(s.ahorro)} a ahorro (en ${mLow(pk)} fueron ${fmt(ps.ahorro)}).`);
    if(ps.totInc&&s.totInc)cmp.push(`Comprometiste el ${Math.round(s.pct*100)} % de tus ingresos; en ${mLow(pk)} fue el ${Math.round(ps.pct*100)} %.`);}
  if(s.totInc&&s.deudas)cmp.push(`Tus pagos de deuda representaron el ${Math.round(s.deudas/s.totInc*100)} % de tus ingresos este mes.`);
  if(s.comp&&s.recurring)cmp.push(`Tus gastos recurrentes representan el ${Math.round(s.recurring/s.comp*100)} % de tus gastos totales.`);
  const budCats=S.categories.filter(c=>S.budgets[c]);
  return `<section class="hero" style="padding-bottom:0"><h1 style="font-size:2rem">Cómo va ${mLow(k)}</h1></section>
  <section class="block" style="margin-top:20px">
    <div class="bigpair">
      <div><span class="muted small">Ingresos</span><div class="n">${fmt(s.totInc)}</div></div>
      <div><span class="muted small">Gastos comprometidos</span><div class="n">${fmt(s.comp)}</div></div>
      <div><span class="muted small">Queda</span><div class="n" style="color:${s.proj<0?'var(--debt)':'var(--free)'}">${fmt(s.proj)}</div></div>
      <div><span class="muted small">Gastos sobre ingresos</span><div class="n">${per100} %</div></div>
    </div>
    ${s.totInc?`<p class="plain">De cada $100 que recibes, tienes comprometidos $${per100}.${per100>90?' Es un margen muy estrecho para imprevistos.':per100>75?' Tienes poco espacio para imprevistos.':''}</p>`:''}
  </section>
  <section class="block"><div class="block-head"><h2>Proyección de cierre</h2></div>
    <div class="proj">
      <span class="muted">Disponible hoy (recibido menos pagado)</span><span>${fmt(s.rec-s.paid)}</span>
      <span class="muted">Pagos pendientes</span><span>−${fmt(s.pend)}</span>
      <span class="muted">Ingresos pendientes</span><span>+${fmt(s.pendI)}</span>
      <span class="tot">Te quedaría al cierre</span><span class="tot" style="color:${s.proj<0?'var(--debt)':'var(--free)'}">${fmt(s.proj)}</span>
    </div>
    <p class="muted small" style="margin-top:10px;max-width:60ch">Es lo que realmente te queda, aunque el saldo de tu cuenta hoy muestre más: parte de ese dinero ya tiene destino.</p>
  </section>
  ${ins.length?`<section class="block"><div class="block-head"><h2>Observaciones</h2></div><div class="insights">${ins.map(i=>`<div class="ins ${i.tone}"><div><h3>${esc(i.title)}</h3><p>${esc(i.body)}</p></div></div>`).join('')}</div></section>`:''}
  <section class="block"><div class="block-head"><h2>Distribución de gastos</h2><span class="muted small">Toca una categoría para ver qué la compone</span></div>
    <div class="dist">${cats.length?cats.map(([c,v])=>`<button class="drow" data-cat="${esc(c)}" aria-expanded="${selCat===c}"><span>${esc(c)}</span><span class="dtrack"><i style="width:${v/s.comp*100}%;background:${catColor(c)}"></i></span><span class="muted" style="text-align:right">${Math.round(v/s.comp*100)} %</span><span style="text-align:right">${fmt(v)}</span></button>${selCat===c?`<div class="drill">${mo.expenses.filter(e=>e.category===c).map(e=>`<div><span>${esc(e.name)}</span><span>${fmt(e.amount)}</span></div>`).join('')}</div>`:''}`).join(''):'<p class="muted">Aún no hay gastos este mes.</p>'}</div></section>
  <section class="block"><div class="block-head"><h2>Presupuestos</h2><button class="btn ghost" data-act="budgets">Definir presupuestos</button></div>
    ${budCats.length?`<div class="budgets">${budCats.map(c=>{const b=S.budgets[c],u=s.byCat[c]||0,p=u/b;return `<div class="bud"><div style="display:flex;justify-content:space-between"><h3>${esc(c)}</h3><span class="${p>1?'up-c':p>=.8?'':'muted'}" style="${p>=.8&&p<=1?'color:var(--due)':''}">${Math.round(p*100)} %</span></div><div class="bar"><i style="width:${Math.min(p,1)*100}%;background:${p>1?'var(--debt)':p>=.8?'var(--due)':'var(--free)'}"></i></div><p class="small muted">${fmt(u)} de ${fmt(b)}${p>1?' · te pasaste por '+fmt(u-b):''}</p></div>`}).join('')}</div>`:'<p class="muted">Define un tope para las categorías que quieras vigilar. No bloquea gastos, solo te avisa.</p>'}</section>
  <section class="block"><div class="block-head"><h2>Comparación con meses anteriores</h2></div>
    ${monthsChart(k)||'<p class="muted">Necesitas al menos dos meses registrados para comparar.</p>'}
    ${cmp.length?`<div class="insights" style="margin-top:14px">${cmp.map(c=>`<div class="ins"><div><p style="color:var(--ink);margin:0">${esc(c)}</p></div></div>`).join('')}</div>`:''}
  </section>
  <section class="block"><div class="block-head"><h2>Cierre del mes</h2></div>
    ${mo.closed?`<p class="muted">${mName(k)} está cerrado${mo.snapshot?` con ${fmt(mo.snapshot.final)} disponibles al final`:''}.</p><div class="hero-actions"><button class="btn" data-act="reopen">Reabrir ${mLow(k)}</button></div>`
    :`<p class="muted" style="max-width:62ch">Al cerrar ${mLow(k)} guardo una fotografía de cómo terminó (ingresos, gastos, pendientes, deuda y distribución) y preparo ${mLow(addM(k,1))} con tus compromisos recurrentes.</p><div class="hero-actions"><button class="btn primary" data-act="close-month">Cerrar ${mLow(k)}</button></div>`}
  </section>`;
}

/* ============ Acciones ============ */
function prepare(k){
  const src=prevWithData(k); const mo=ensure(k);
  if(src){const s=M(src);
    s.expenses.filter(e=>e.recurring).forEach(e=>mo.expenses.push({...e,id:newId(),status:'pendiente',paidOn:null,day:Math.min(e.day||1,daysIn(k))}));
    s.incomes.filter(i=>i.recurring).forEach(i=>mo.incomes.push({...i,id:newId(),status:'pendiente',day:i.day?Math.min(i.day,daysIn(k)):null}));}
}
function closeMonth(k){
  const mo=M(k), s=stats(k);
  mo.closed=true;
  mo.snapshot={ingresos:s.totInc,recibido:s.rec,gastos:s.comp,pagado:s.paid,pendiente:s.pend,deuda:debtTotal(k),distribucion:s.byCat,final:s.proj,cerradoEl:isoToday()};
  const nx=addM(k,1); if(!M(nx))prepare(nx);
  save(); cur=nx; render(); toast(`${mName(k)} cerrado. ${mName(nx)} está listo.`);
}
function toggle(kind,id){
  const mo=M(cur); if(!mo)return;
  if(kind==='e'){const e=mo.expenses.find(x=>x.id===id);if(!e)return;e.status=e.status==='pagado'?'pendiente':'pagado';e.paidOn=e.status==='pagado'?isoToday():null}
  else{const i=mo.incomes.find(x=>x.id===id);if(!i)return;i.status=i.status==='recibido'?'pendiente':'recibido'}
  save(); render();
}
let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2800)}

/* ============ Modal ============ */
const dlg=$('#modal');
function openModal(title,body,onMount){$('#modalIn').innerHTML=`<div class="mhead"><h2>${title}</h2><button class="x" data-act="close-modal" aria-label="Cerrar">×</button></div><div class="mbody">${body}</div>`;if(!dlg.open)dlg.showModal();onMount&&onMount($('#modalIn'))}
function closeModal(){if(dlg.open)dlg.close()}
dlg.addEventListener('click',e=>{if(e.target===dlg)closeModal()});

function catOptions(sel,list){return list.map(c=>`<option ${c===sel?'selected':''}>${esc(c)}</option>`).join('')+(list===S.categories?'<option value="__new">+ Nueva categoría…</option>':'')}
function segQ(q){return `<div class="seg" role="radiogroup" aria-label="Quincena"><label><input type="radio" name="q" value="1" ${q===1?'checked':''}>Primera</label><label><input type="radio" name="q" value="2" ${q===2?'checked':''}>Segunda</label></div>`}

function expenseForm(id){
  const mo=ensure(cur), e=id?mo.expenses.find(x=>x.id===id):null, N=daysIn(cur);
  const v=e||{name:'',amount:'',category:'Vivienda',day:'',q:1,status:'pendiente',recurring:true,note:''};
  openModal(e?'Editar gasto':'Nuevo gasto',`<form id="f">
    <div class="field"><label for="fn">Nombre del gasto</label><input id="fn" name="name" required placeholder="Ej. Arriendo" value="${esc(v.name)}"></div>
    <div class="frow"><div class="field"><label for="fa">Valor</label><input id="fa" name="amount" required inputmode="numeric" placeholder="$0" value="${v.amount?fmt(v.amount):''}"></div>
    <div class="field"><label for="fd">Día de pago</label><input id="fd" name="day" type="number" min="1" max="${N}" placeholder="1 a ${N}" value="${v.day||''}"></div></div>
    <div class="field"><label for="fc">Categoría</label><select id="fc" name="category">${catOptions(v.category,S.categories)}</select></div>
    <div class="field"><span class="flabel">Quincena</span>${segQ(v.q)}</div>
    <div class="field"><span class="flabel">Estado</span><div class="seg"><label><input type="radio" name="status" value="pendiente" ${v.status!=='pagado'?'checked':''}>Pendiente</label><label><input type="radio" name="status" value="pagado" ${v.status==='pagado'?'checked':''}>Pagado</label></div></div>
    <label class="inline-check"><input type="checkbox" class="check" name="recurring" ${v.recurring?'checked':''}> Repetir cada mes</label>
    <div class="field"><label for="fo">Observaciones (opcional)</label><textarea id="fo" name="note" placeholder="Ej. Última cuota">${esc(v.note||'')}</textarea></div>
    <div class="mactions">${e?'<button type="button" class="btn danger" data-act="del-exp" data-id="'+e.id+'">Eliminar</button><span class="spacer"></span>':''}<button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn primary">Guardar gasto</button></div></form>`,
  root=>{const f=root.querySelector('#f');let qTouched=!!e;
    f.amount.addEventListener('input',()=>{const n=num(f.amount.value);f.amount.value=n?fmt(n):''});
    f.querySelectorAll('[name=q]').forEach(r=>r.addEventListener('change',()=>qTouched=true));
    f.day.addEventListener('input',()=>{const d=+f.day.value;if(d&&!qTouched)f.querySelector(`[name=q][value="${qOf(d)}"]`).checked=true});
    f.category.addEventListener('change',()=>{if(f.category.value==='__new'){const n=(prompt('Nombre de la nueva categoría')||'').trim();if(n){if(!S.categories.includes(n))S.categories.push(n);f.category.innerHTML=catOptions(n,S.categories)}else f.category.value=v.category}});
    f.addEventListener('submit',ev=>{ev.preventDefault();const amount=num(f.amount.value);if(!amount){f.amount.focus();return}
      const day=Math.min(Math.max(+f.day.value||0,0),N)||null;
      const data={name:f.name.value.trim(),amount,category:f.category.value,day,q:+f.querySelector('[name=q]:checked').value,status:f.querySelector('[name=status]:checked').value,recurring:f.recurring.checked,note:f.note.value.trim()};
      if(e){if(data.status==='pagado'&&e.status!=='pagado')data.paidOn=isoToday();if(data.status!=='pagado')data.paidOn=null;Object.assign(e,data)}
      else mo.expenses.push({id:newId(),...data,paidOn:data.status==='pagado'?isoToday():null});
      save();closeModal();render();toast(e?'Gasto actualizado':'Gasto agregado')});
    f.name.focus()});
}
function incomeForm(id){
  const mo=ensure(cur), i=id?mo.incomes.find(x=>x.id===id):null, N=daysIn(cur);
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
function budgetsForm(){
  openModal('Presupuestos por categoría',`<form id="f"><p class="muted small" style="margin-bottom:14px">Deja en blanco las categorías que no quieras vigilar.</p>
    ${S.categories.filter(c=>c!=='Ahorro / inversión').map((c,ix)=>`<div class="field"><label for="b${ix}">${esc(c)}</label><input id="b${ix}" data-cat="${esc(c)}" inputmode="numeric" placeholder="Sin tope" value="${S.budgets[c]?fmt(S.budgets[c]):''}"></div>`).join('')}
    <div class="mactions"><button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn primary">Guardar presupuestos</button></div></form>`,
  root=>{const f=root.querySelector('#f');f.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',()=>{const n=num(inp.value);inp.value=n?fmt(n):''}));
    f.addEventListener('submit',ev=>{ev.preventDefault();f.querySelectorAll('input').forEach(inp=>{const n=num(inp.value);if(n)S.budgets[inp.dataset.cat]=n;else delete S.budgets[inp.dataset.cat]});save();closeModal();render();toast('Presupuestos guardados')})});
}
function debtForm(id){
  const d=id?S.debts.find(x=>x.id===id):null; const v=d||{name:'',bank:'',last4:'',kind:'tarjeta'};
  openModal(d?'Editar producto':'Nuevo producto de deuda',`<form id="f">
    <div class="field"><label for="dn">Nombre</label><input id="dn" name="name" required placeholder="Ej. Tarjeta principal" value="${esc(v.name)}"></div>
    <div class="frow"><div class="field"><label for="db">Banco</label><input id="db" name="bank" value="${esc(v.bank)}"></div>
    <div class="field"><label for="dl">Últimos 4 dígitos</label><input id="dl" name="last4" inputmode="numeric" maxlength="4" pattern="\\d{0,4}" value="${esc(v.last4)}"></div></div>
    <div class="field"><span class="flabel">Tipo</span><div class="seg"><label><input type="radio" name="kind" value="tarjeta" ${v.kind!=='credito'?'checked':''}>Tarjeta de crédito</label><label><input type="radio" name="kind" value="credito" ${v.kind==='credito'?'checked':''}>Crédito</label></div></div>
    <div class="mactions">${d?'<button type="button" class="btn danger" data-act="del-debt" data-id="'+d.id+'">Eliminar</button><span class="spacer"></span>':''}<button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn primary">Guardar producto</button></div></form>`,
  root=>{const f=root.querySelector('#f');f.addEventListener('submit',ev=>{ev.preventDefault();
    const data={name:f.name.value.trim(),bank:f.bank.value.trim(),last4:f.last4.value.replace(/\D/g,'').slice(-4),kind:f.querySelector('[name=kind]:checked').value};
    if(d)Object.assign(d,data);else S.debts.push({id:newId(),...data});save();closeModal();render();toast('Producto guardado')})});
}
function balanceForm(pre){
  const v=pre||{};
  openModal('Registrar saldo',`<form id="f">
    <div class="field"><label for="bp">Producto</label><select id="bp" name="debt">${S.debts.map(d=>`<option value="${d.id}" ${d.id===v.debtId?'selected':''}>${esc(d.name)}${d.last4?' •••• '+esc(d.last4):''}</option>`).join('')}</select></div>
    <div class="frow"><div class="field"><label for="bm">Mes del extracto</label><input id="bm" name="month" type="month" value="${v.month||cur}"></div>
    <div class="field"><label for="bs">Saldo total</label><input id="bs" name="saldo" inputmode="numeric" required value="${v.saldo?fmt(v.saldo):''}"></div></div>
    <div class="frow"><div class="field"><label for="bmin">Pago mínimo</label><input id="bmin" name="minimo" inputmode="numeric" value="${v.minimo?fmt(v.minimo):''}"></div>
    <div class="field"><label for="bf">Fecha límite</label><input id="bf" name="fecha" type="date" value="${v.fecha||''}"></div></div>
    <div class="mactions"><button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn primary">Guardar saldo</button></div></form>`,
  root=>{const f=root.querySelector('#f');['saldo','minimo'].forEach(n=>f[n].addEventListener('input',()=>{const x=num(f[n].value);f[n].value=x?fmt(x):''}));
    f.addEventListener('submit',ev=>{ev.preventDefault();const id=f.debt.value;S.balances[id]=S.balances[id]||{};
      S.balances[id][f.month.value]={...(S.balances[id][f.month.value]||{}),saldo:num(f.saldo.value),minimo:num(f.minimo.value)||null,fecha:f.fecha.value||null};
      save();closeModal();render();toast('Saldo registrado')})});
}

/* ============ Carga de documentos (lectura local, sin IA) ============ */
/* Todo ocurre en el navegador: pdf.js extrae el texto y reglas simples
   (palabras clave + expresiones regulares + validación cruzada) ubican los valores. */
const MES_IDX={enero:1,ene:1,febrero:2,feb:2,marzo:3,mar:3,abril:4,abr:4,mayo:5,may:5,junio:6,jun:6,julio:7,jul:7,agosto:8,ago:8,septiembre:9,setiembre:9,sep:9,sept:9,set:9,octubre:10,oct:10,noviembre:11,nov:11,diciembre:12,dic:12};
const MES_RX='enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept|sep|set|oct|nov|dic';
const norm=t=>t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
const iso=(y,m,d)=>{y=+y;if(y<100)y+=2000;m=+m;d=+d;if(m<1||m>12||d<1||d>31||y<2000||y>2100)return null;return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`};

/* Convierte "$ 7.754.426", "7.754.426,00" o "7,754,426.00" en 7754426 */
function parseMoney(raw){
  let t=String(raw).replace(/[$\s]/g,'').replace(/^-/,'');
  if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t))return Math.round(parseFloat(t.replace(/\./g,'').replace(',','.')));
  if(/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t))return Math.round(parseFloat(t.replace(/,/g,'')));
  if(/^\d+([.,]\d{1,2})?$/.test(t))return Math.round(parseFloat(t.replace(',','.')));
  return null;
}
/* Todos los montos del texto con su posición. Exige separadores de miles o signo $ para no confundir con cédulas o códigos. */
function moneyTokens(t){
  const out=[],rx=/\$\s?\d[\d.,]*\d|\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?\b/g;let m;
  while((m=rx.exec(t))){const v=parseMoney(m[0]);if(v!=null&&v>=1000)out.push({v,i:m.index,end:m.index+m[0].length})}
  return out;
}
/* Todas las fechas del texto con su posición */
function dateTokens(t){
  const out=[],add=(m,d)=>{if(d)out.push({iso:d,i:m.index})};let m;
  const r1=/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g; while((m=r1.exec(t)))add(m,iso(m[3],m[2],m[1]));
  const r2=/\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g; while((m=r2.exec(t)))add(m,iso(m[1],m[2],m[3]));
  const r3=new RegExp(`\\b(\\d{1,2})(?:\\s+de)?[\\s\\/\\-]+(${MES_RX})\\.?(?:\\s+de|\\s+del)?[\\s\\/\\-]+(\\d{4}|\\d{2})\\b`,'g'); while((m=r3.exec(t)))add(m,iso(m[3],MES_IDX[m[2]],m[1]));
  const r4=new RegExp(`\\b(${MES_RX})\\.?\\s+(\\d{1,2}),?(?:\\s+de)?\\s+(\\d{4})\\b`,'g'); while((m=r4.exec(t)))add(m,iso(m[3],MES_IDX[m[1]],m[2]));
  return out.sort((a,b)=>a.i-b.i);
}
/* Posiciones donde aparece una etiqueta */
function labelPos(t,rx){const out=[],g=new RegExp(rx.source,'g');let m;while((m=g.exec(t)))out.push(m.index+m[0].length);return out}
/* Primeros montos que siguen a cada aparición de la etiqueta */
function candidatesAfter(t,money,rx,win=260,n=4){
  const seen=new Set(),out=[];
  labelPos(t,rx).forEach(p=>money.filter(x=>x.i>=p&&x.i-p<=win).slice(0,n).forEach(x=>{if(!seen.has(x.v)){seen.add(x.v);out.push(x.v)}}));
  return out;
}
const firstAfter=(t,money,rx,win)=>candidatesAfter(t,money,rx,win,1)[0]??null;
function dateAfter(t,dates,rx,win=120){for(const p of labelPos(t,rx)){const d=dates.find(x=>x.i>=p&&x.i-p<=win);if(d)return d.iso}return null}

function parsePayroll(raw){
  const t=norm(raw), money=moneyTokens(t), dates=dateTokens(t);
  const RX={dev:/total\s+devengad[oa]s?|total\s+devengos|devengos\s+totales|total\s+ingresos|devengado\s+total/,
            ded:/total\s+deduccion(?:es)?|total\s+descuentos|deducciones\s+totales|total\s+deducido/,
            net:/neto\s+(?:a\s+)?pagar|neto\s+pagado|neto\s+recibido|total\s+a\s+pagar|valor\s+neto|neto\s+a\s+consignar|total\s+neto/};
  const cD=candidatesAfter(t,money,RX.dev), cX=candidatesAfter(t,money,RX.ded), cN=candidatesAfter(t,money,RX.net);
  let dev=cD[0]??null, ded=cX[0]??null, net=cN[0]??null, consistent=false;
  /* Validación cruzada: busca la combinación donde devengado − deducciones = neto (tolera tablas donde etiquetas y valores van en filas separadas) */
  const pool=[...new Set([...cD,...cX,...cN])];
  outer: for(const a of (cD.length?cD:pool))for(const b of (cX.length?cX:pool))for(const c of (cN.length?cN:pool)){
    if(a>b&&a>c&&Math.abs(a-b-c)<=2){dev=a;ded=b;net=c;consistent=true;break outer}}
  if(!net&&dev&&ded&&dev>ded)net=dev-ded;
  if(!ded&&dev&&net&&dev>net)ded=dev-net;
  /* Período */
  let ini=null,fin=null;
  const per=new RegExp(`del\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+de\\s+(${MES_RX})\\.?(?:\\s+de|\\s+del)?\\s+(\\d{4})`).exec(t);
  if(per){const mm=MES_IDX[per[3]];ini=iso(per[4],mm,per[1]);fin=iso(per[4],mm,per[2])}
  if(!fin){for(const p of labelPos(t,/periodo(?:\s+(?:de\s+)?(?:pago|liquidado|liquidacion|nomina))?|fecha\s+(?:de\s+)?inicio|desde/)){
      const ds=dates.filter(x=>x.i>=p&&x.i-p<=160).slice(0,2);if(ds.length===2){[ini,fin]=[ds[0].iso,ds[1].iso].sort();break}}}
  if(!fin){const ds=dates.map(d=>d.iso).sort();for(let i=0;i<ds.length-1;i++){const a=ds[i],b=ds[i+1];if(a.slice(0,7)===b.slice(0,7)&&((+a.slice(8)===1&&+b.slice(8)>=14&&+b.slice(8)<=16)||(+a.slice(8)===16&&+b.slice(8)>=28))){ini=a;fin=b;break}}}
  const pago=dateAfter(t,dates,/fecha\s+(?:de\s+)?(?:pago|consignacion|abono)/);
  const missing=[];if(!dev)missing.push('total devengado');if(!ded)missing.push('total deducciones');if(!net)missing.push('neto pagado');if(!fin)missing.push('período');
  return{periodo_inicio:ini,periodo_fin:fin,total_devengado:dev,total_deducciones:ded,neto_pagado:net,fecha_pago:pago,_missing:missing,_consistent:consistent};
}

const BANCOS=[['bancolombia','Bancolombia'],['davivienda','Davivienda'],['bbva','BBVA'],['banco de bogota','Banco de Bogotá'],['occidente','Banco de Occidente'],['banco popular','Banco Popular'],['av villas','AV Villas'],['caja social','Banco Caja Social'],['itau','Itaú'],['colpatria','Scotiabank Colpatria'],['scotiabank','Scotiabank Colpatria'],['falabella','Banco Falabella'],['pichincha','Banco Pichincha'],['nubank','Nu'],['nu financiera','Nu'],['lulo','Lulo Bank'],['rappicard','RappiCard'],['rappi','RappiCard'],['serfinanza','Serfinanza'],['finandina','Finandina'],['banco agrario','Banco Agrario'],['gnb sudameris','GNB Sudameris'],['sudameris','GNB Sudameris'],['citibank','Citibank'],['tuya','Tuya'],['icetex','ICETEX'],['coopcentral','Coopcentral'],['banco w','Banco W'],['mibanco','Mibanco']];
function parseStatement(raw){
  const t=norm(raw), money=moneyTokens(t), dates=dateTokens(t);
  const banco=(BANCOS.find(([k])=>t.includes(k))||[])[1]||null;
  /* Últimos 4 dígitos: solo se conserva el final, nunca el número completo */
  let l4=null;const m4=/(?:\*{2,}|x{3,}|•{2,}|\.{3,}|terminad[ao]\s+en|finalizad[ao]\s+en)\s*(\d{4})\b/.exec(t)||/\b\d{4}[\s-]?\d{2,6}[\s-]?\d{2,6}[\s-]?(\d{4})\b/.exec(t);
  if(m4)l4=m4[1];
  const credKw=/credito\s+(?:de\s+)?(?:vehiculo|vehicular|libre\s+inversion|hipotecario|de\s+vivienda|educativo|rotativo)|leasing|libranza|credito\s+de\s+consumo|plan\s+de\s+pagos|cuotas?\s+pendientes/;
  const tipo=credKw.test(t)&&!/tarjeta\s+de\s+credito/.test(t)?'credito':'tarjeta';
  let producto=null;
  if(tipo==='tarjeta'){const fr=(/american\s+express|amex/.test(t)?'American Express':/mastercard/.test(t)?'Mastercard':/diners/.test(t)?'Diners':/visa/.test(t)?'Visa':'Tarjeta');
    const lv=(/infinite/.test(t)?' Infinite':/black/.test(t)?' Black':/signature/.test(t)?' Signature':/platinum|platino/.test(t)?' Platinum':/gold|oro/.test(t)?' Gold':'');producto=fr+lv}
  else{const c=credKw.exec(t);producto=c?c[0].replace(/credito/g,'crédito').replace(/vehiculo/g,'vehículo').replace(/inversion/g,'inversión').replace(/^./,x=>x.toUpperCase()):'Crédito'}
  const CDISP=/cupo\s+disponible|disponible\s+(?:para\s+)?(?:compras|avances)/;
  const saldo=firstAfter(t,money,/saldo\s+total|nuevo\s+saldo|saldo\s+a\s+la\s+fecha|deuda\s+total|total\s+deuda|saldo\s+actual|saldo\s+(?:de\s+)?capital|saldo\s+pendiente|saldo\s+a\s+(?:su\s+)?cargo/);
  const minimo=firstAfter(t,money,/pago\s+minimo|valor\s+minimo|minimo\s+a\s+pagar|valor\s+(?:de\s+la\s+)?cuota|cuota\s+del\s+mes|valor\s+a\s+pagar/);
  const total=firstAfter(t,money,/pago\s+total|pago\s+de\s+contado|pago\s+alterno|total\s+a\s+pagar/);
  const cdisp=firstAfter(t,money,CDISP,120);
  let cupo=null;for(const p of labelPos(t,/cupo\s+(?:total|asignado|aprobado)|cupo\b/)){if(CDISP.test(t.slice(p-6,p+20)))continue;const x=money.find(z=>z.i>=p&&z.i-p<=120);if(x){cupo=x.v;break}}
  const fecha=dateAfter(t,dates,/fecha\s+(?:limite|maxima)\s+(?:de\s+)?pago|pague(?:se)?\s+(?:antes\s+de|hasta)|pagar\s+(?:antes\s+de|hasta)|fecha\s+de\s+pago|fecha\s+limite/,160);
  const tm=/tasa[^%]{0,60}?(?:efectiva\s+anual|e\.?\s?a\.?)[^%\d]{0,25}(\d{1,2}(?:[.,]\d{1,4})?)\s*%/.exec(t)||/(\d{1,2}(?:[.,]\d{1,4})?)\s*%\s*(?:e\.?\s?a\.?|efectiv[oa]\s+anual)/.exec(t);
  const tasa=tm?parseFloat(tm[1].replace(',','.')):null;
  const corte=dateAfter(t,dates,/fecha\s+(?:de\s+)?corte|corte\s+(?:al|a)|periodo\s+facturado|fecha\s+(?:del\s+)?extracto|fecha\s+de\s+generacion/,160);
  const mes=(corte||fecha||'').slice(0,7)||null;
  const missing=[];if(!saldo)missing.push('saldo total');if(!minimo&&!total)missing.push('valor a pagar');if(!fecha)missing.push('fecha límite');if(!l4)missing.push('últimos 4 dígitos');
  return{banco,producto,tipo,ultimos4:l4,saldo_total:saldo,pago_minimo:minimo,pago_total:total,fecha_limite:fecha,tasa_ea:tasa,cupo,cupo_disponible:cdisp,mes_extracto:mes,_missing:missing};
}

async function pdfToText(file){
  if(!window.pdfjsLib)throw{code:'no_pdf'};
  try{pdfjsLib.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.min.js'}catch(e){}
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;
  let out='';
  for(let p=1;p<=Math.min(pdf.numPages,8);p++){const pg=await pdf.getPage(p);const tc=await pg.getTextContent();
    /* Reconstruye líneas por posición vertical para conservar el orden etiqueta → valor */
    const rows={};tc.items.forEach(it=>{const y=Math.round(it.transform[5]/3);(rows[y]=rows[y]||[]).push(it)});
    Object.keys(rows).map(Number).sort((a,b)=>b-a).forEach(y=>{out+=rows[y].sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ')+'\n'})}
  return out;
}
async function extract(file,kind){
  const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  if(!isPdf)throw{code:'not_pdf'};
  const text=await pdfToText(file);
  if(text.replace(/\s/g,'').length<60)throw{code:'scanned'};
  return kind==='payroll'?parsePayroll(text):parseStatement(text);
}
function errMsg(e){const c=e&&e.code;return ({not_pdf:'Por ahora solo leo archivos PDF con texto. Para una foto, ingresa los datos a mano.',scanned:'El PDF parece escaneado (es una imagen) y no tiene texto que leer. Ingresa los datos a mano.',no_pdf:'No se pudo cargar el lector de PDF. Ingresa los datos a mano.'})[c]||'No pude leer el documento. Revisa que sea el comprobante o extracto correcto, o ingresa los datos a mano.'}
function missingNote(r){return r&&r._missing&&r._missing.length?`<div class="warnbox">No encontré: ${esc(r._missing.join(', '))}. Complétalo antes de guardar.</div>`:''}

function openUpload(kind){
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
function payrollConfirm(r,manual){
  let fin=r.periodo_fin||null, ini=r.periodo_inicio||null;
  let k=cur, q=1, day=null;
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
function confirmPayroll(){
  const f=$('#modalIn #f'); const net=num(f.net.value); if(!net){f.hidden=false;f.net.focus();return}
  const k=f.month.value||cur, q=+f.querySelector('[name=q]:checked').value, day=+f.day.value||(q===1?15:daysIn(k));
  const mo=M(k)||(prepare(k),M(k));
  const ix=mo.incomes.findIndex(i=>i.type==='salario'&&i.q===q&&i.status!=='recibido');
  const item={id:newId(),name:`Nómina ${q===1?'primera':'segunda'} quincena`,amount:net,gross:num(f.dev.value)||null,deductions:num(f.ded.value)||null,type:'salario',category:'Salario',day:Math.min(day,daysIn(k)),q,status:'recibido',recurring:true,note:''};
  if(ix>=0){item.id=mo.incomes[ix].id;mo.incomes[ix]=item}else{mo.incomes.forEach(i=>{if(i.type==='salario'&&i.q===q)i.recurring=false});mo.incomes.push(item)}
  save();closeModal();cur=k;render();toast(`Ingreso registrado en ${mLow(k)}, quincena ${q}`);
}
function statementConfirm(r,manual){
  const l4=String(r.ultimos4||'').replace(/\D/g,'').slice(-4);
  const match=S.debts.find(d=>l4&&d.last4===l4)||null;
  let m=r.mes_extracto&&/^\d{4}-\d{2}$/.test(r.mes_extracto)?r.mes_extracto:cur;
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
function confirmStatement(){
  const f=$('#modalIn #f'); if(!f.producto.value.trim()){f.producto.focus();return}
  const l4=f.l4.value.replace(/\D/g,'').slice(-4), tipo=f.querySelector('[name=tipo]:checked').value;
  let d=S.debts.find(x=>l4&&x.last4===l4)||S.debts.find(x=>x.name.toLowerCase()===f.producto.value.trim().toLowerCase());
  if(!d){d={id:newId(),name:f.producto.value.trim(),bank:f.banco.value.trim(),last4:l4,kind:tipo};S.debts.push(d)}
  else{d.bank=f.banco.value.trim()||d.bank;if(l4)d.last4=l4}
  const mes=f.mes.value||cur; S.balances[d.id]=S.balances[d.id]||{};
  const rec={saldo:num(f.saldo.value),minimo:num(f.min.value)||null,total:num(f.tot.value)||null,fecha:f.fecha.value||null,tasa:dec(f.tasa.value),cupo:num(f.cupo.value)||null,cupoDisp:num(f.cdisp.value)||null};
  S.balances[d.id][mes]=rec;
  if(f.addpay.checked){const amt=f.querySelector('[name=paywhich]:checked').value==='min'?rec.minimo:rec.total||rec.minimo;
    if(amt){let pk=mes,day=null;if(rec.fecha){const[y,m,dd]=rec.fecha.split('-').map(Number);pk=mk(y,m);day=dd}
      const mo=M(pk)||(prepare(pk),M(pk));
      const ex=mo.expenses.find(e=>e.debtId===d.id&&e.status!=='pagado');
      const data={name:`Pago ${d.name}`,amount:amt,category:tipo==='tarjeta'?'Tarjetas de crédito':'Créditos y deudas',day,q:day?qOf(day):2,status:'pendiente',recurring:true,note:'',debtId:d.id,paidOn:null};
      if(ex)Object.assign(ex,data);else mo.expenses.push({id:newId(),...data});}}
  save();closeModal();render();toast('Extracto guardado');
}

/* ============ Cuenta y usuarios ============ */
function accountMenu(){
  openModal(esc(ME.displayName),`<p class="muted">Usuario <b>${esc(ME.username)}</b>${ME.role==='admin'?' · administrador':''}</p>
    <p class="muted small" style="margin:6px 0 18px">Se conservan los últimos ${WIN.retention} meses de movimientos (desde ${mLow(WIN.cutoff)} ${parseMk(WIN.cutoff).y}).</p>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn" data-act="change-pass">Cambiar contraseña</button>
      ${ME.role==='admin'?'<button class="btn" data-act="go-users">Administrar usuarios</button>':''}
      <button class="btn danger" data-act="logout">Cerrar sesión</button></div>`);
}
function passwordForm(forced){
  openModal(forced?'Crea tu contraseña':'Cambiar contraseña',`<form id="f">
    ${forced?'<p class="muted small" style="margin-bottom:14px">Por seguridad, reemplaza la contraseña temporal que te asignaron.</p>':''}
    <div class="field"><label for="pc">Contraseña actual</label><input id="pc" name="current" type="password" autocomplete="current-password" required></div>
    <div class="field"><label for="pn1">Nueva contraseña</label><input id="pn1" name="next" type="password" autocomplete="new-password" minlength="10" required><span class="muted small">Mínimo 10 caracteres, con letras y números.</span></div>
    <div class="field"><label for="pn2">Repite la nueva contraseña</label><input id="pn2" name="next2" type="password" autocomplete="new-password" required></div>
    <p id="pErr" class="small" style="color:var(--debt)" role="alert"></p>
    <div class="mactions">${forced?'<button type="button" class="btn" data-act="logout">Cerrar sesión</button>':'<button type="button" class="btn" data-act="close-modal">Cancelar</button>'}<button class="btn primary">Guardar contraseña</button></div></form>`,
  root=>{const f=root.querySelector('#f');f.current.focus();
    if(forced)dlg.addEventListener('cancel',e=>e.preventDefault(),{once:true});
    f.addEventListener('submit',async ev=>{ev.preventDefault();
      if(f.next.value!==f.next2.value){$('#pErr').textContent='Las contraseñas nuevas no coinciden.';return}
      try{await api('/api/auth/password',{method:'POST',body:{current:f.current.value,next:f.next.value}});closeModal();toast('Contraseña actualizada');if(forced)await loadState()}
      catch(e){$('#pErr').textContent=e.message}})});
}
async function loadUsers(){try{USERS=(await api('/api/admin/users')).users;if(view==='usuarios')render()}catch(e){toast(e.message)}}
function vUsuarios(){
  const rows=USERS?USERS.map(u=>{const locked=u.locked_until&&Date.parse(u.locked_until)>Date.now();
    return `<tr><td><b>${esc(u.display_name)}</b><br><span class="muted small">${esc(u.username)}</span></td>
      <td>${u.role==='admin'?'Administrador':'Usuario'}</td><td>${u.retention_months} meses</td>
      <td>${!u.active?'<span class="tag late">Inactivo</span>':locked?'<span class="tag soon">Bloqueado</span>':u.must_change_password?'<span class="tag soon">Debe cambiar clave</span>':'<span class="tag ext">Activo</span>'}</td>
      <td>${u.last_login_at?fmtDate(u.last_login_at.slice(0,10)):'Nunca'}</td>
      <td><button class="btn ghost small" data-act="edit-user" data-id="${esc(u.id)}">Editar</button></td></tr>`}).join(''):'';
  return `<section class="hero" style="padding-bottom:0"><div class="block-head"><h1 style="font-size:2rem">Usuarios</h1><button class="btn primary" data-act="new-user">Nuevo usuario</button></div>
    <p class="muted" style="max-width:62ch">Aquí defines quién puede entrar, su rol y cuántos meses de información se conservan para cada persona.</p></section>
    <section class="block" style="margin-top:20px">${USERS?`<div class="tscroll"><table><thead><tr><th>Persona</th><th>Rol</th><th>Retención</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="spinner" aria-label="Cargando"></div>'}</section>`;
}
function userForm(id){
  const u=id?USERS.find(x=>x.id===id):null, isSelf=u&&u.username===ME.username;
  const locked=u&&u.locked_until&&Date.parse(u.locked_until)>Date.now();
  openModal(u?'Editar usuario':'Nuevo usuario',`<form id="f">
    <div class="frow"><div class="field"><label for="uu">Usuario</label><input id="uu" name="username" ${u?'disabled':''} required pattern="[a-z0-9._\\-]{3,40}" autocapitalize="none" value="${esc(u?u.username:'')}"></div>
    <div class="field"><label for="un">Nombre</label><input id="un" name="display_name" required value="${esc(u?u.display_name:'')}"></div></div>
    <div class="frow"><div class="field"><label for="ur">Rol</label><select id="ur" name="role" ${isSelf?'disabled':''}><option value="user" ${u&&u.role==='user'?'selected':''}>Usuario</option><option value="admin" ${u&&u.role==='admin'?'selected':''}>Administrador</option></select></div>
    <div class="field"><label for="ut">Meses que se conservan</label><input id="ut" name="retention_months" type="number" min="1" max="24" required value="${u?u.retention_months:4}"></div></div>
    <div class="field"><label for="up">${u?'Restablecer contraseña (opcional)':'Contraseña temporal'}</label><input id="up" name="password" type="password" autocomplete="new-password" ${u?'':'required'} minlength="10"><span class="muted small">La persona deberá cambiarla al ingresar.</span></div>
    ${u&&!isSelf?`<label class="inline-check"><input type="checkbox" class="check" name="active" ${u.active?'checked':''}> Puede ingresar</label>`:''}
    ${locked?'<label class="inline-check"><input type="checkbox" class="check" name="unlock" checked> Desbloquear por intentos fallidos</label>':''}
    ${u?'<p class="muted small" style="margin-bottom:12px">Si reduces los meses de retención, la información más antigua se elimina la próxima vez que la persona ingrese.</p>':''}
    <p id="uErr" class="small" style="color:var(--debt)" role="alert"></p>
    <div class="mactions">${u&&!isSelf?`<button type="button" class="btn danger" data-act="del-user" data-id="${esc(u.id)}">Eliminar</button><span class="spacer"></span>`:''}<button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn primary">${u?'Guardar cambios':'Crear usuario'}</button></div></form>`,
  root=>{const f=root.querySelector('#f');
    f.addEventListener('submit',async ev=>{ev.preventDefault();
      const body={display_name:f.display_name.value,retention_months:+f.retention_months.value};
      if(!isSelf)body.role=f.role.value;
      if(f.password.value)body.password=f.password.value;
      if(f.active)body.active=f.active.checked;
      if(f.unlock&&f.unlock.checked)body.unlock=true;
      try{
        if(u){await api('/api/admin/users/'+encodeURIComponent(u.id),{method:'PATCH',body});
          if(isSelf&&body.retention_months!==WIN.retention)await loadState()}
        else{body.username=f.username.value.trim().toLowerCase();await api('/api/admin/users',{method:'POST',body})}
        closeModal();USERS=null;render();toast(u?'Usuario actualizado':'Usuario creado')}
      catch(e){$('#uErr').textContent=e.message}})});
}
async function deleteUser(id){
  const u=USERS.find(x=>x.id===id);if(!u)return;
  if(!confirm(`¿Eliminar a ${u.display_name} y toda su información? Esta acción no se puede deshacer.`))return;
  try{await api('/api/admin/users/'+encodeURIComponent(id),{method:'DELETE'});closeModal();USERS=null;render();toast('Usuario eliminado')}catch(e){toast(e.message)}
}

/* ============ Datos de ejemplo ============ */
function loadDemo(){
  const k=cur, base=[['Arriendo',1650000,'Vivienda',5],['Crédito educativo',310000,'Créditos y deudas',5],['Mercado',920000,'Alimentación',8],['Internet y celular',185000,'Servicios',12],['Gasolina',380000,'Transporte',14],['Pago tarjeta principal',2100000,'Tarjetas de crédito',20,'d1'],['Cuota del carro',890000,'Créditos y deudas',20,'d3'],['Gas y energía',290000,'Servicios',20],['Restaurantes y salidas',420000,'Entretenimiento',24],['Streaming',62000,'Suscripciones',22],['Ahorro programado',500000,'Ahorro / inversión',28]];
  S=blank(); S.budgets={'Entretenimiento':600000,'Alimentación':1000000};
  S.debts=[{id:'d1',name:'Tarjeta principal',bank:'Banco ejemplo',last4:'0000',kind:'tarjeta'},{id:'d2',name:'Tarjeta secundaria',bank:'Banco ejemplo',last4:'1111',kind:'tarjeta'},{id:'d3',name:'Crédito vehículo',bank:'Financiera ejemplo',last4:'2222',kind:'credito'}];
  [-3,-2,-1,0].forEach((off,ix)=>{const mkk=addM(k,off);if(mkk<WIN.cutoff)return;const mo={incomes:[],expenses:[],closed:off<0};const N=daysIn(mkk);
    const cm=off===0&&k===TODAY_K;
    mo.incomes.push({id:newId(),name:'Nómina primera quincena',amount:6800000,type:'salario',category:'Salario',day:15,q:1,status:cm&&TODAY_D<15?'pendiente':'recibido',recurring:true,note:''});
    mo.incomes.push({id:newId(),name:'Nómina segunda quincena',amount:7100000,type:'salario',category:'Salario',day:N,q:2,status:cm&&TODAY_D<N?'pendiente':'recibido',recurring:true,note:''});
    if(off===-2)mo.incomes.push({id:newId(),name:'Proyecto freelance',amount:1200000,type:'extra',category:'Freelance',day:22,q:2,status:'recibido',recurring:false,note:''});
    base.forEach(([n,a,c,d,debt])=>{let amt=a;if(c==='Entretenimiento')amt=[300000,340000,360000,520000][ix];if(c==='Tarjetas de crédito')amt=[2300000,2200000,2100000,2100000][ix];
      const paid=!cm||d<TODAY_D-1; mo.expenses.push({id:newId(),name:n,amount:amt,category:c,day:d,q:qOf(d),status:paid?'pagado':'pendiente',paidOn:paid?mkk+'-'+String(Math.min(d,N)).padStart(2,'0'):null,recurring:c!=='Entretenimiento',note:n==='Cuota del carro'&&off===0?'Faltan 18 cuotas':'',debtId:debt||undefined})});
    S.months[mkk]=mo;
    const bal={d1:[9200000,8200000,7400000,6600000],d2:[4400000,4100000,3700000,3300000],d3:[26900000,26150000,25350000,24550000]};
    for(const id in bal){S.balances[id]=S.balances[id]||{};S.balances[id][mkk]={saldo:bal[id][ix],minimo:id==='d3'?890000:Math.round(bal[id][ix]*0.08),fecha:mkk+'-20'}}
    if(off<0){const s=stats(mkk);mo.snapshot={ingresos:s.totInc,gastos:s.comp,final:s.proj}}
  });
  save();render();toast('Datos de ejemplo cargados. Puedes borrarlos cuando quieras desde Análisis.');
}

/* ============ Eventos ============ */
document.addEventListener('click',e=>{
  const v=e.target.closest('[data-view]');if(v&&v.closest('nav.tabs')){view=v.dataset.view;selCat=null;render();window.scrollTo(0,0);return}
  const vg=e.target.closest('[data-view-go]');if(vg){view=vg.dataset.viewGo;render();window.scrollTo(0,0);return}
  const fl=e.target.closest('[data-filter]');if(fl){movFilter=fl.dataset.filter;render();return}
  const dc=e.target.closest('[data-cat]');if(dc&&dc.classList.contains('drow')){selCat=selCat===dc.dataset.cat?null:dc.dataset.cat;render();return}
  const a=e.target.closest('[data-act]');if(!a)return;
  const id=a.dataset.id, mo=M(cur);
  switch(a.dataset.act){
    case 'prev':if(addM(cur,-1)>=WIN.cutoff){cur=addM(cur,-1);render()}break;
    case 'next':cur=addM(cur,1);render();break;
    case 'close-modal':closeModal();break;
    case 'add-exp':expenseForm();break;
    case 'edit-exp':expenseForm(id);break;
    case 'add-inc':incomeForm();break;
    case 'edit-inc':incomeForm(id);break;
    case 'del-exp':if(confirm('¿Eliminar este gasto?')){mo.expenses=mo.expenses.filter(x=>x.id!==id);save();closeModal();render()}break;
    case 'del-inc':if(confirm('¿Eliminar este ingreso?')){mo.incomes=mo.incomes.filter(x=>x.id!==id);save();closeModal();render()}break;
    case 'prepare':prepare(cur);save();render();toast(`${mName(cur)} preparado con tus compromisos recurrentes`);break;
    case 'start-empty':ensure(cur);save();render();expenseForm();break;
    case 'demo':loadDemo();break;
    case 'upload-payroll':openUpload('payroll');break;
    case 'upload-statement':openUpload('statement');break;
    case 'manual-payroll':payrollConfirm({},true);break;
    case 'manual-statement':statementConfirm({},true);break;
    case 'edit-extracted':{const f=$('#modalIn #f');f.hidden=false;a.remove();f.querySelector('input').focus();break}
    case 'confirm-payroll':confirmPayroll();break;
    case 'confirm-statement':confirmStatement();break;
    case 'budgets':budgetsForm();break;
    case 'add-debt':debtForm();break;
    case 'edit-debt':debtForm(id);break;
    case 'del-debt':if(confirm('¿Eliminar este producto y su historial de saldos?')){S.debts=S.debts.filter(x=>x.id!==id);delete S.balances[id];save();closeModal();render()}break;
    case 'add-balance':balanceForm();break;
    case 'close-month':if(confirm(`¿Cerrar ${mLow(cur)}? Podrás reabrirlo después.`))closeMonth(cur);break;
    case 'reopen':mo.closed=false;save();render();toast(`${mName(cur)} reabierto`);break;
    case 'export':exportBackup();break;
    case 'account':accountMenu();break;
    case 'logout':closeModal();api('/api/auth/logout',{method:'POST'}).catch(()=>{}).finally(onLoggedOut);break;
    case 'change-pass':passwordForm(false);break;
    case 'go-users':closeModal();view='usuarios';render();window.scrollTo(0,0);break;
    case 'new-user':userForm();break;
    case 'edit-user':userForm(id);break;
    case 'del-user':deleteUser(id);break;
    case 'import':importBackup();break;
    case 'reset':if(confirm('Esto borra todos tus datos de la aplicación. ¿Continuar?')){S=blank();save();render()}break;
  }
});
document.addEventListener('change',e=>{const t=e.target.closest('[data-toggle]');if(t){const[k,id]=t.dataset.toggle.split(':');toggle(k,id)}});

/* Pie de página con borrado total */
const foot=document.createElement('footer');foot.className='wrap';foot.style.cssText='padding-top:0;padding-bottom:140px';
foot.innerHTML='<div class="muted small" style="border-top:1px solid var(--line);padding-top:16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span style="flex:1 1 320px" id="footNote">Tus datos se guardan en tu cuenta. Los comprobantes y extractos se leen en tu navegador y no se almacenan.</span><button class="btn small" data-act="export">Descargar respaldo</button><button class="btn small" data-act="import">Restaurar respaldo</button><button class="btn ghost small danger" data-act="reset">Borrar todos mis datos</button></div>';
document.body.insertBefore(foot,$('#modal'));

boot();
