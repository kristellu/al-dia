// Respaldo JSON: descargar y restaurar
import { isoToday } from '../core/dates.js';
import { save } from './sync.js';
import { normalize, state } from '../state/store.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';

export function exportBackup(){
  const blob=new Blob([JSON.stringify({app:'al-dia',exportado:new Date().toISOString(),datos:state.S},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`al-dia-respaldo-${isoToday()}.json`;
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast('Respaldo descargado');
}
export function importBackup(){
  const inp=document.createElement('input');inp.type='file';inp.accept='application/json,.json';
  inp.onchange=async()=>{const f=inp.files[0];if(!f)return;
    try{const o=JSON.parse(await f.text());const d=o&&o.app==='al-dia'?o.datos:o;
      if(!d||typeof d!=='object'||!d.months)throw new Error('formato');
      if(!confirm('Esto reemplaza tus datos guardados por los del respaldo. ¿Continuar?'))return;
      state.S=normalize(d);for(const k in state.S.months)if(k<state.WIN.cutoff)delete state.S.months[k];
      save();render();toast('Respaldo restaurado')}
    catch(e){toast('El archivo no es un respaldo válido de Al día')}};
  inp.click();
}
