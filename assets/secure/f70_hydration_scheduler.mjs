/** BRZ F70 — deterministic authenticated source hydration.
 * No background prefetch, no overlapping historical reads and no writes.
 * Each stage is instantiated only after the previous source was verified.
 * A rejected stage leaves no pending historical pagination behind.
 */
export async function runHydrationStages(stages,{onStage=()=>{},isAborted=()=>false}={}){
 if(!Array.isArray(stages)||stages.length===0)throw Error('F70: fontes não configuradas');
 if(typeof onStage!=='function'||typeof isAborted!=='function')throw Error('F70: configuração inválida');
 const result=Object.create(null);
 const keys=new Set();
 for(let i=0;i<stages.length;i++){
  const {key,label,run}=stages[i]||{};
  if(typeof key!=='string'||!key||keys.has(key)||typeof label!=='string'||!label||typeof run!=='function')
    throw Error('F70: etapa inválida ou repetida');
  keys.add(key);
  if(isAborted())throw Error('F70: carregamento interrompido');
  onStage({key,label,index:i+1,total:stages.length});
  try{
   result[key]=await run();
   if(result[key]===undefined)throw Error('Fonte sem retorno');
  }catch(error){
   const failure=new Error(label+': '+(error?.message||String(error)));
   failure.stage=key;failure.cause=error;
   throw failure;
  }
 }
 return Object.freeze(result);
}
