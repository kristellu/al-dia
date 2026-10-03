// Datos de ejemplo
import { TODAY_D, TODAY_K, addM, daysIn } from '../core/dates.js';
import { newId, qOf } from '../core/utils.js';
import { stats } from './calc.js';
import { save } from '../services/sync.js';
import { blank, state } from '../state/store.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';

export function loadDemo(){
  const k=state.cur, base=[['Arriendo',1650000,'Vivienda',5],['Crédito educativo',310000,'Créditos y deudas',5],['Mercado',920000,'Alimentación',8],['Internet y celular',185000,'Servicios',12],['Gasolina',380000,'Transporte',14],['Pago tarjeta principal',2100000,'Tarjetas de crédito',20,'d1'],['Cuota del carro',890000,'Créditos y deudas',20,'d3'],['Gas y energía',290000,'Servicios',20],['Restaurantes y salidas',420000,'Entretenimiento',24],['Streaming',62000,'Suscripciones',22],['Ahorro programado',500000,'Ahorro / inversión',28]];
  state.S=blank(); state.S.budgets={'Entretenimiento':600000,'Alimentación':1000000};
  state.S.debts=[{id:'d1',name:'Tarjeta principal',bank:'Banco ejemplo',last4:'0000',kind:'tarjeta'},{id:'d2',name:'Tarjeta secundaria',bank:'Banco ejemplo',last4:'1111',kind:'tarjeta'},{id:'d3',name:'Crédito vehículo',bank:'Financiera ejemplo',last4:'2222',kind:'credito'}];
  [-3,-2,-1,0].forEach((off,ix)=>{const mkk=addM(k,off);if(mkk<state.WIN.cutoff)return;const mo={incomes:[],expenses:[],closed:off<0};const N=daysIn(mkk);
    const cm=off===0&&k===TODAY_K;
    mo.incomes.push({id:newId(),name:'Nómina primera quincena',amount:6800000,type:'salario',category:'Salario',day:15,q:1,status:cm&&TODAY_D<15?'pendiente':'recibido',recurring:true,note:''});
    mo.incomes.push({id:newId(),name:'Nómina segunda quincena',amount:7100000,type:'salario',category:'Salario',day:N,q:2,status:cm&&TODAY_D<N?'pendiente':'recibido',recurring:true,note:''});
    if(off===-2)mo.incomes.push({id:newId(),name:'Proyecto freelance',amount:1200000,type:'extra',category:'Freelance',day:22,q:2,status:'recibido',recurring:false,note:''});
    base.forEach(([n,a,c,d,debt])=>{let amt=a;if(c==='Entretenimiento')amt=[300000,340000,360000,520000][ix];if(c==='Tarjetas de crédito')amt=[2300000,2200000,2100000,2100000][ix];
      const paid=!cm||d<TODAY_D-1; mo.expenses.push({id:newId(),name:n,amount:amt,category:c,day:d,q:qOf(d),status:paid?'pagado':'pendiente',paidOn:paid?mkk+'-'+String(Math.min(d,N)).padStart(2,'0'):null,recurring:c!=='Entretenimiento',variable:!!debt,note:n==='Cuota del carro'&&off===0?'Faltan 18 cuotas':'',debtId:debt||undefined})});
    state.S.months[mkk]=mo;
    const bal={d1:[9200000,8200000,7400000,6600000],d2:[4400000,4100000,3700000,3300000],d3:[26900000,26150000,25350000,24550000]};
    for(const id in bal){state.S.balances[id]=state.S.balances[id]||{};state.S.balances[id][mkk]={saldo:bal[id][ix],minimo:id==='d3'?890000:Math.round(bal[id][ix]*0.08),fecha:mkk+'-20'}}
    if(off<0){const s=stats(mkk);mo.snapshot={ingresos:s.totInc,gastos:s.comp,final:s.proj}}
  });
  save();render();toast('Datos de ejemplo cargados. Puedes borrarlos cuando quieras desde Análisis.');
}
