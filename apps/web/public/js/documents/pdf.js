// Extracción de texto de PDF en el navegador con pdf.js
import { parsePayroll, parseStatement } from './parsers.js';

export async function pdfToText(file){
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
export async function extract(file,kind){
  const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  if(!isPdf)throw{code:'not_pdf'};
  const text=await pdfToText(file);
  if(text.replace(/\s/g,'').length<60)throw{code:'scanned'};
  return kind==='payroll'?parsePayroll(text):parseStatement(text);
}
export function errMsg(e){const c=e&&e.code;return ({not_pdf:'Por ahora solo leo archivos PDF con texto. Para una foto, ingresa los datos a mano.',scanned:'El PDF parece escaneado (es una imagen) y no tiene texto que leer. Ingresa los datos a mano.',no_pdf:'No se pudo cargar el lector de PDF. Ingresa los datos a mano.'})[c]||'No pude leer el documento. Revisa que sea el comprobante o extracto correcto, o ingresa los datos a mano.'}
