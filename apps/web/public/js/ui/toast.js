// Aviso breve en pantalla
import { $ } from '../core/utils.js';

let toastT;
export function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2800)}
