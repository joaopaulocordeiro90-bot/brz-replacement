
(function(){
  var SNAPSHOT_LOCK_ID='2026-07-31-DEAL-MARKET-SNAPSHOT-V25';

  function repair(){
    try{
      if(typeof DEALS_BASE==='undefined' || typeof state==='undefined' || !state) return;
      var baseMap=new Map((DEALS_BASE||[]).map(function(d){ return [String(d.id),d]; }));
      var changed=0;

      (state.negocios||[]).forEach(function(d){
        var b=baseMap.get(String(d.id));
        if(!b || !b.marketSnapshotLocked) return;

        var fields=[
          'cbot','cambio','cbotFechamento','cambioFechamento',
          'marketSnapshotLocked','marketSnapshotTime','marketSnapshotSource'
        ];
        fields.forEach(function(f){
          if(b[f]!==undefined && d[f]!==b[f]){ d[f]=b[f]; changed++; }
        });
        brzRestoreDealMarketSnapshot(d);
      });

      state._dealMarketSnapshotLockId=SNAPSHOT_LOCK_ID;

      try{
        if(typeof persist==='function') persist();
        else if(typeof saveState==='function') saveState();
        else localStorage.setItem('brzState',JSON.stringify(state));
      }catch(_e){}

      try{ if(typeof portComparisonCache!=='undefined' && portComparisonCache.clear) portComparisonCache.clear(); }catch(_e2){}
      try{ if(typeof replacementCache!=='undefined' && replacementCache.clear) replacementCache.clear(); }catch(_e3){}
      try{ if(typeof _pcCache!=='undefined') _pcCache={}; }catch(_e4){}
      try{ if(typeof _activeDealsCache!=='undefined') _activeDealsCache={key:null,rows:null}; }catch(_e5){}

      if(changed){
        try{ if(typeof renderAll==='function') renderAll(); }catch(_e6){}
        try{
          if(typeof renderAnalise==='function' && document.getElementById('analise') &&
             document.getElementById('analise').classList.contains('active')) renderAnalise();
        }catch(_e7){}
      }
    }catch(e){ console.error('deal snapshot repair',e); }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){ setTimeout(repair,350); });
  }else{
    setTimeout(repair,350);
  }
})();
