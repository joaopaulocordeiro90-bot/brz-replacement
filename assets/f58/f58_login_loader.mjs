/* F58: keep the credential form disabled until every public asset is hashed.
 * The only subsequent network calls for business data are made by the F40
 * bootstrap after Supabase sign-in; this module never reads passwords/JWTs.
 */
import {verifyF58PublicRelease} from './f58_manifest_gate.mjs';
const $=id=>document.getElementById(id);
const status=message=>{if($('status'))$('status').textContent=message;};
const filesToLoad=[
 'assets/f42/f42_hydrate.js',
 'assets/f40/f40_boot.js',
 'assets/f50/f50_uat_probe.js',
 'assets/f51/f51_uat_matrix.js',
 'assets/f52/f52_uat_readonly.js'
];
function sri(hex){
 const bytes=new Uint8Array(hex.match(/../g).map(h=>parseInt(h,16)));
 return 'sha256-'+btoa(String.fromCharCode(...bytes));
}
async function run(){
 const credentials=[$('user'),$('pass'),$('go')];
 credentials.forEach(el=>{if(el)el.disabled=true;});
 status('F58 · conferindo integridade dos arquivos públicos antes de habilitar o login…');
 try{
  const receipt=await verifyF58PublicRelease({baseURL:new URL('.',location.href),
   onProgress:(n,t)=>status('F58 · verificando arquivos públicos: '+n+'/'+t)});
  window.__BRZF58_PREFLIGHT=Object.freeze({verified:true,resources:receipt.verifiedResources,
   readOnly:true,productionApproved:false});
  for(const path of filesToLoad){
   await new Promise((ok,fail)=>{
    const script=document.createElement('script');
    script.src=path;script.async=false;script.crossOrigin='anonymous';
    script.integrity=sri(receipt.files[path]);
    script.onload=ok;script.onerror=()=>fail(Error('F58_BOOT_MODULE_FAILED'));
    document.body.appendChild(script);
   });
  }
 }catch(e){
  window.__BRZF58_PREFLIGHT=Object.freeze({verified:false,readOnly:true,productionApproved:false});
  credentials.forEach(el=>{if(el)el.disabled=true;});
  status('F58 BLOQUEADO: arquivos públicos ausentes, incompletos ou divergentes. '+
    'Não informe sua senha. Solicite revisão do pacote.');
 }
}
run();
