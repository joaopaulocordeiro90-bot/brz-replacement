/* BRZ secure sign-in: verify deployed static engine, then unlock Supabase login.
   No business data, password or token is stored by this bootstrap. */
const el=id=>document.getElementById(id);
const allowed=location.protocol==='https:'&&location.hostname==='joaopaulocordeiro90-bot.github.io'
  &&['/brz-replacement/','/brz-replacement/index.html','/brz-replacement/pin.html'].includes(location.pathname);
function status(s){el('status').textContent=s;}
function hex(bytes){return [...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function sha256(bytes){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));}
async function load(){
 const pin=el('pin'),go=el('go');
 if(!pin||!go)throw Error('PIN_UI_CONTROLS_MISSING');
 const controls=[go];
 // PIN entry remains available while static integrity checks run.
 pin.disabled=false;go.disabled=true;
 try{
  if(!allowed||!window.isSecureContext||window.top!==window) throw Error('Endereço de acesso não autorizado');
  if(!crypto?.subtle)throw Error('SHA-256 nativo indisponível');
  status('Verificando a plataforma. Se a sessão ainda estiver válida nesta aba, a entrada será restaurada automaticamente, sem novo PIN…');
  const manifestResp=await fetch('./MANIFEST_F58_PUBLIC_SHA256.json',{cache:'no-store',credentials:'same-origin'});
  if(!manifestResp.ok)throw Error('Manifesto de dependências indisponível');
  const manifest=await manifestResp.json();
  if(manifest?.schema!=='BRZ_F58_PUBLIC_STATIC_PREFLIGHT_V1'||typeof manifest.files!=='object')
   throw Error('Manifesto não reconhecido');
  const entries=Object.entries(manifest.files)
   .filter(([p])=>p!=='index.html'&&p!=='.nojekyll'&&p!=='README_F58.txt');
  if(entries.length<68||entries.length>110)throw Error('Componentes incompletos');
  // Verified CacheStorage includes ONLY public static assets from this SHA-256
  // manifest. Never store PIN, JWT, trades, prices, freight or API responses.
  let assetCache=null;
  try{if('caches' in window)assetCache=await caches.open('brz-public-code-sha-v1');}
  catch(e){assetCache=null}
  async function verifiedStatic(name,record){
   const key='./'+name;
   if(assetCache){
    try{
     const cached=await assetCache.match(key);
     if(cached){
      const bytes=await cached.arrayBuffer();
      if(bytes.byteLength===record.bytes&&await sha256(bytes)===record.sha256)
       return;
      await assetCache.delete(key);
     }
    }catch(e){}
   }
   const res=await fetch(key,{cache:'no-store',credentials:'same-origin',redirect:'error'});
   if(!res.ok)throw Error('Componente ausente: '+name);
   const bytes=await res.arrayBuffer();
   if(bytes.byteLength!==record.bytes||await sha256(bytes)!==record.sha256)
     throw Error('Componente divergente: '+name);
   if(assetCache){
    try{await assetCache.put(key,new Response(bytes.slice(0),{
      headers:{'Content-Type':'application/octet-stream'}}));}catch(e){}
   }
  }
  let done=0,cursor=0;
  const workers=Array.from({length:10},()=> (async()=>{
   while(cursor<entries.length){
    const [name,record]=entries[cursor++];
    if(!/^[a-zA-Z0-9._/-]+$/.test(name)||name.includes('..')||name.startsWith('/'))throw Error('Caminho inválido');
    await verifiedStatic(name,record);
    done++;
    if(done%20===0||done===entries.length)status('Verificando módulos: '+done+'/'+entries.length);
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
  script.src='./assets/secure/f40_pin_login.js?v=20261116f63';
  script.async=false;
  script.onerror=()=>{controls.forEach(x=>x.disabled=true);status('Não foi possível carregar o login protegido.');};
  document.body.appendChild(script);
 }catch(err){
  go.disabled=true;
  status('Acesso protegido bloqueado: '+(err?.message||String(err)));
 }
}
load();


const GATEWAY='https://irekykmigdfvwozerkfa.supabase.co/functions/v1/brz-replacement-pin';
const pinFields=['email','password','newPin','newPinConfirm'];
async function sendGateway(body){
 const r=await fetch(GATEWAY,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(body),cache:'no-store',redirect:'error',credentials:'omit'});
 const data=await r.json().catch(()=>null);
 if(!r.ok||data?.ok!==true)throw Error(data?.error||'gateway_unavailable');
 return data;
}
async function initPin(){
 try{
  const status=await sendGateway({action:'status'});
  if(status.configured===false){
    el('setup').open=true;
    el('setupStatus').textContent='Primeiro acesso: defina um PIN com sua conta Supabase autorizada.';
  }
 }catch(e){
  el('setupStatus').textContent='Estado do PIN indisponível: '+e.message;
 }
}
el('setupForm').addEventListener('submit',async(event)=>{
 event.preventDefault();
 const result=el('setupStatus'),btn=el('pinSet');
 const pin=el('newPin').value,again=el('newPinConfirm').value;
 if(!/^[0-9]{6}$/.test(pin)||pin!==again){
  result.textContent='PIN inválido ou confirmação diferente.';return;
 }
 btn.disabled=true;result.textContent='Validando autorização e gravando PIN no Supabase…';
 try{
  const out=await sendGateway({action:'setup',email:el('email').value.trim(),
    password:el('password').value,pin});
  if(out.configured!==true)throw Error('setup_unconfirmed');
  result.textContent='PIN definido com sucesso. Utilize o campo PIN acima para entrar.';
  el('password').value='';el('newPin').value='';el('newPinConfirm').value='';
  el('setup').open=false;
  el('status').textContent='PIN configurado. Informe seus seis dígitos.';
  el('pin').focus();
 }catch(e){
  result.textContent=e.message==='invalid_credentials'
   ?'Conta ou senha Supabase incorreta.'
   :e.message==='unauthorized'?'Conta sem perfil mesa/admin.'
   :'Não foi possível definir PIN ('+e.message+').';
 }finally{btn.disabled=false;}
});
initPin();
