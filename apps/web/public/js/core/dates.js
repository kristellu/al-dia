// Meses financieros (YYYY-MM) y fecha de hoy
import { MESES } from './constants.js';

export const mk=(y,m)=>y+'-'+String(m).padStart(2,'0');
export const parseMk=k=>{const[y,m]=k.split('-').map(Number);return{y,m}};
export const addM=(k,d)=>{let{y,m}=parseMk(k);m+=d;while(m>12){m-=12;y++}while(m<1){m+=12;y--}return mk(y,m)};
export const daysIn=k=>{const{y,m}=parseMk(k);return new Date(y,m,0).getDate()};
export const mName=k=>{const s=MESES[parseMk(k).m-1];return s[0].toUpperCase()+s.slice(1)};
export const mLow=k=>MESES[parseMk(k).m-1];
export const mFull=k=>mName(k)+' '+parseMk(k).y;
export const NOW=new Date();
export const TODAY_K=mk(NOW.getFullYear(),NOW.getMonth()+1);
export const TODAY_D=NOW.getDate();
export const isoToday=()=>NOW.toISOString().slice(0,10);
