// Estado de la aplicación. Las variables que cambian viven en `state` para poder
// reasignarlas desde cualquier módulo (un `let` importado no se puede reasignar).
import { CAT_COLORS, DEFAULT_CATS } from '../core/constants.js';
import { TODAY_K } from '../core/dates.js';

export const state={S:blank(),view:'inicio',cur:TODAY_K,movFilter:'todos',selCat:null,USERS:null,ME:null,WIN:null,synced:null};
export const catColor=c=>{const i=state.S.categories.indexOf(c);return CAT_COLORS[(i<0?state.S.categories.length:i)%CAT_COLORS.length]};
export function blank(){return{v:1,categories:[...DEFAULT_CATS],budgets:{},months:{},debts:[],balances:{}}}
export function normalize(o){
  const s=JSON.parse(JSON.stringify(o||{}));
  const b=blank();
  s.categories=Array.isArray(s.categories)&&s.categories.length?s.categories:b.categories;
  s.budgets=s.budgets||{}; s.months=s.months||{}; s.debts=s.debts||[]; s.balances=s.balances||{};
  for(const k in s.months){const m=s.months[k];m.incomes=m.incomes||[];m.expenses=m.expenses||[];}
  s.v=1; return s;
}
export const hasAny=()=>Object.keys(state.S.months).length>0||state.S.debts.length>0;
export const M=k=>state.S.months[k];
export const ensure=k=>{if(!state.S.months[k])state.S.months[k]={incomes:[],expenses:[],closed:false};return state.S.months[k]};
