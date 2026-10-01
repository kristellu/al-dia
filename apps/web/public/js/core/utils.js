// Utilidades generales: DOM, escape de HTML, formato de dinero y fechas cortas
import { MES_C } from './constants.js';

export const $=s=>document.querySelector(s);
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt=n=>(n<0?'−':'')+'$'+Math.round(Math.abs(n||0)).toLocaleString('es-CO');
export const fmtM=n=>Math.abs(n)>=1e6?(n<0?'−':'')+'$'+(Math.abs(n)/1e6).toLocaleString('es-CO',{maximumFractionDigits:1})+' M':fmt(n);
export const num=s=>{const d=String(s??'').replace(/[^\d]/g,'');return d?Number(d):0};
export const dec=s=>{const v=parseFloat(String(s??'').replace(/[^\d.,]/g,'').replace(',','.'));return isNaN(v)?null:v};
export const newId=()=>crypto.randomUUID();
export const sum=(a,f)=>a.reduce((t,x)=>t+(f?f(x):x),0);
export const qOf=d=>d<=15?1:2;
export function fmtDate(iso){const[y,m,d]=iso.split('-').map(Number);return d+' '+MES_C[m-1]}
