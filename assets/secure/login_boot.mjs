/* BRZ secure sign-in: verify deployed static engine, then unlock Supabase login.
   No business data, password or token is stored by this bootstrap. */
const el=id=>document.getElementById(id);
const allowed=location.protocol==='https:'&&location.hostname==='joaopaulocordeiro90-bot.github.io'
  &&location.pathname==='/brz-replacement/acesso.html';
function status(s){el('status').textContent=s;}
function hex(bytes){return [...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function sha256(bytes){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));}
async function load(){
 const controls=[el('user'),el('pass'),el('go')];
 controls.forEach(x=>x.disabled=true);
 try{
  if(!allowed||!window.isSecureContext||window.top!==window) throw Error('Endereço de acesso não autorizado');
  if(!crypto?.subtle)throw Error('SHA-256 nativo indisponível');
  status('Verificando integridade dos componentes públicos…');
  const manifestResp=await fetch('./MANIFEST_F58_PUBLIC_SHA256.json',{cache:'no-store',credentials:'same-origin'});
  if(!manifestResp.ok)throw Error('Manifesto de dependências indisponível');
  const manifest=await manifestResp.json();
  if(manifest?.schema!=='BRZ_F58_PUBLIC_STATIC_PREFLIGHT_V1'||typeof manifest.files!=='object')
   throw Error('Manifesto não reconhecido');
  const entries=Object.entries(manifest.files)
   .filter(([p])=>p!=='index.html'&&p!=='.nojekyll'&&p!=='README_F58.txt');
  if(entries.length<68||entries.length>110)throw Error('Componentes incompletos');
  let done=0,cursor=0;
  const workers=Array.from({length:6},()=> (async()=>{
   while(cursor<entries.length){
    const [name,record]=entries[cursor++];
    if(!/^[a-zA-Z0-9._/-]+$/.test(name)||name.includes('..')||name.startsWith('/'))throw Error('Caminho inválido');
    const res=await fetch('./'+name,{cache:'no-store',credentials:'same-origin',redirect:'error'});
    if(!res.ok)throw Error('Componente ausente: '+name);
    const bytes=await res.arrayBuffer();
    if(bytes.byteLength!==record.bytes||await sha256(bytes)!==record.sha256)
      throw Error('Componente divergente: '+name);
    done++;
    if(done%15===0||done===entries.length)status('Conferindo interface: '+done+'/'+entries.length);
   }
  })());
  await Promise.all(workers);
  // F42 is defined in its own script (not in F40). Install it with the
  // sealed manifest integrity before enabling the authenticated loader.
  const f42Path='assets/f42/f42_hydrate.js';
  const f42Entry=manifest.files[f42Path];
  if(!f42Entry||!/^[a-f0-9]{64}$/.test(f42Entry.sha256))
    throw Error('F42 ausente do manifesto');
  const sri='sha256-'+btoa(String.fromCharCode(
    ...f42Entry.sha256.match(/../g).map(h=>parseInt(h,16))));
  await new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='./'+f42Path;
    script.crossOrigin='anonymous';
    script.integrity=sri;
    script.async=false;
    script.onload=resolve;
    script.onerror=()=>reject(Error('F42: componente autenticado não carregado'));
    document.body.appendChild(script);
  });
  if(typeof window.__BRZF42_HYDRATE!=='function')
    throw Error('F42: função de hidratação indisponível');
  // Read-only authentication is handled by F40; this flag applies only to
  // this completed local asset preflight and is not a production approval.
  window.__BRZF58_PREFLIGHT=Object.freeze({verified:true,readOnly:true,productionApproved:false,
    verifiedResources:done});
  const script=document.createElement('script');
  script.src='./assets/secure/f40_login.js?v=20261116f42fix';
  script.async=false;
  script.onerror=()=>{controls.forEach(x=>x.disabled=true);status('Não foi possível carregar o login protegido.');};
  document.body.appendChild(script);
 }catch(err){
  controls.forEach(x=>x.disabled=true);
  status('Acesso protegido bloqueado: '+(err?.message||String(err)));
 }
}
load();
