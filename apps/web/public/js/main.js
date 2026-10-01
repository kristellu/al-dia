// Punto de entrada: eventos globales, pie de página y arranque
import { addM, mLow, mName } from './core/dates.js';
import { $ } from './core/utils.js';
import { confirmPayroll, confirmStatement, openUpload, payrollConfirm, statementConfirm } from './documents/upload.js';
import { closeMonth, prepare, toggle } from './domain/actions.js';
import { loadDemo } from './domain/demo.js';
import { accountMenu, passwordForm } from './forms/account.js';
import { budgetsForm } from './forms/budgets.js';
import { balanceForm, debtForm } from './forms/debts.js';
import { expenseForm, incomeForm } from './forms/movements.js';
import { deleteUser, userForm } from './forms/users.js';
import { api } from './services/api.js';
import { exportBackup, importBackup } from './services/backup.js';
import { boot, onLoggedOut } from './services/session.js';
import { diff, flatten, save } from './services/sync.js';
import { M, blank, ensure, state } from './state/store.js';
import { closeModal, dlg } from './ui/modal.js';
import { render } from './ui/render.js';
import { toast } from './ui/toast.js';

window.addEventListener('beforeunload',e=>{if(state.synced&&diff(state.synced,flatten(state.S))){e.preventDefault();e.returnValue=''}});
dlg.addEventListener('click',e=>{if(e.target===dlg)closeModal()});
document.addEventListener('click',e=>{
  const v=e.target.closest('[data-view]');if(v&&v.closest('nav.tabs')){state.view=v.dataset.view;state.selCat=null;render();window.scrollTo(0,0);return}
  const vg=e.target.closest('[data-view-go]');if(vg){state.view=vg.dataset.viewGo;render();window.scrollTo(0,0);return}
  const fl=e.target.closest('[data-filter]');if(fl){state.movFilter=fl.dataset.filter;render();return}
  const dc=e.target.closest('[data-cat]');if(dc&&dc.classList.contains('drow')){state.selCat=state.selCat===dc.dataset.cat?null:dc.dataset.cat;render();return}
  const a=e.target.closest('[data-act]');if(!a)return;
  const id=a.dataset.id, mo=M(state.cur);
  switch(a.dataset.act){
    case 'prev':if(addM(state.cur,-1)>=state.WIN.cutoff){state.cur=addM(state.cur,-1);render()}break;
    case 'next':state.cur=addM(state.cur,1);render();break;
    case 'close-modal':closeModal();break;
    case 'add-exp':expenseForm();break;
    case 'edit-exp':expenseForm(id);break;
    case 'add-inc':incomeForm();break;
    case 'edit-inc':incomeForm(id);break;
    case 'del-exp':if(confirm('¿Eliminar este gasto?')){mo.expenses=mo.expenses.filter(x=>x.id!==id);save();closeModal();render()}break;
    case 'del-inc':if(confirm('¿Eliminar este ingreso?')){mo.incomes=mo.incomes.filter(x=>x.id!==id);save();closeModal();render()}break;
    case 'prepare':prepare(state.cur);save();render();toast(`${mName(state.cur)} preparado con tus compromisos recurrentes`);break;
    case 'start-empty':ensure(state.cur);save();render();expenseForm();break;
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
    case 'del-debt':if(confirm('¿Eliminar este producto y su historial de saldos?')){state.S.debts=state.S.debts.filter(x=>x.id!==id);delete state.S.balances[id];save();closeModal();render()}break;
    case 'add-balance':balanceForm();break;
    case 'close-month':if(confirm(`¿Cerrar ${mLow(state.cur)}? Podrás reabrirlo después.`))closeMonth(state.cur);break;
    case 'reopen':mo.closed=false;save();render();toast(`${mName(state.cur)} reabierto`);break;
    case 'export':exportBackup();break;
    case 'account':accountMenu();break;
    case 'logout':closeModal();api('/api/auth/logout',{method:'POST'}).catch(()=>{}).finally(onLoggedOut);break;
    case 'change-pass':passwordForm(false);break;
    case 'go-users':closeModal();state.view='usuarios';render();window.scrollTo(0,0);break;
    case 'new-user':userForm();break;
    case 'edit-user':userForm(id);break;
    case 'del-user':deleteUser(id);break;
    case 'import':importBackup();break;
    case 'reload':location.reload();break;
    case 'reset':if(confirm('Esto borra todos tus datos de la aplicación. ¿Continuar?')){state.S=blank();save();render()}break;
  }
});
document.addEventListener('change',e=>{const t=e.target.closest('[data-toggle]');if(t){const[k,id]=t.dataset.toggle.split(':');toggle(k,id)}});
/* Pie de página con borrado total */
const foot=document.createElement('footer');foot.className='wrap';foot.style.cssText='padding-top:0;padding-bottom:140px';
foot.innerHTML='<div class="muted small" style="border-top:1px solid var(--line);padding-top:16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span style="flex:1 1 320px" id="footNote">Tus datos se guardan en tu cuenta. Los comprobantes y extractos se leen en tu navegador y no se almacenan.</span><button class="btn small" data-act="export">Descargar respaldo</button><button class="btn small" data-act="import">Restaurar respaldo</button><button class="btn ghost small danger" data-act="reset">Borrar todos mis datos</button></div>';
document.body.insertBefore(foot,$('#modal'));
boot();
