// Cliente HTTP de la API (/api/*) con cabecera anti-CSRF
import { onLoggedOut } from './session.js';

export async function api(path,{method='GET',body,auth=true}={}){
  const opt={method,credentials:'same-origin',headers:{Accept:'application/json'}};
  if(method!=='GET')opt.headers['X-Requested-With']='al-dia';
  if(body!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(body)}
  let r;try{r=await fetch(path,opt)}catch(e){throw{status:0,message:'No hay conexión con el servidor.'}}
  let d=null;try{d=await r.json()}catch(e){}
  if(!r.ok){if(r.status===401&&auth)onLoggedOut();throw{status:r.status,message:(d&&d.error)||'Error '+r.status}}
  return d||{};
}
