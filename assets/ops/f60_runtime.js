/* BRZ F60 - Diagnostico operacional para snapshot V4FQ, sem alterar motor financeiro.
   GitHub Pages e estatico: estado local nao e sincronizacao entre computadores. */
(function () {
  'use strict';
  if (window.__BRZF60_READY__) return;
  window.__BRZF60_READY__ = true;
  const VERSION = 'F60-2026-11-16';
  const BASELINE = 4011;
  const SECTIONS = ['inicial','analise','report','corredores','negocios','fretes','outros',
    'mercado','premios','regras','auditoria','backup','mapa','estados','portos'];
  function getStatus() {
    const s = (typeof state !== 'undefined') ? state : null;
    const negocios = Array.isArray(s && s.negocios) ? s.negocios : [];
    const ids = negocios.map(x => String(x && x.id || ''));
    const uniques = new Set(ids);
    const missing = SECTIONS.filter(id => !document.getElementById(id));
    const build = (typeof brzFileBuildId === 'function') ? brzFileBuildId() : null;
    let persisted = false, storageAvailable = false, storedBuild = null, storageError = null;
    try {
      const key = '__brz_f60_check__';
      localStorage.setItem(key, VERSION);
      storageAvailable = localStorage.getItem(key) === VERSION;
      localStorage.removeItem(key);
      const raw = (typeof STORAGE_KEY !== 'undefined') ? localStorage.getItem(STORAGE_KEY) : null;
      persisted = !!raw;
      if (raw) storedBuild = JSON.parse(raw)._fileBuildId || null;
    } catch(e) { storageError = String(e && e.message || e); }
    const stateUsable = negocios.length >= BASELINE && uniques.size === negocios.length && !ids.includes('');
    return {
      schema:'BRZ_F60_LOCAL_READINESS', version:VERSION, generatedAt:new Date().toISOString(),
      sourceBuild:build, snapshotDate:'2026-11-13', source:'BRZ_Replacement_V4FQ_F35_HOMOLOGACAO.html',
      deals:negocios.length, dealIdsUnique:uniques.size === negocios.length,
      missingDealIds:ids.filter(id => !id).length,
      products:[...new Set(negocios.map(x => x && x.produto).filter(Boolean))].sort(),
      freightRoadCount:Array.isArray(s && s.fretesRodo) ? s.fretesRodo.length : null,
      freightRailCount:Array.isArray(s && s.fretesFerro) ? s.fretesFerro.length : null,
      modulesTotal:SECTIONS.length, modulesFound:SECTIONS.length - missing.length, missingModules:missing,
      exportJsonAvailable:typeof downloadBackup === 'function',
      exportHtmlAvailable:typeof downloadHtmlSnapshot === 'function',
      browserStorageAvailable:storageAvailable, browserStatePreviouslySaved:persisted,
      savedBuild:storedBuild, storageError:storageError,
      status:stateUsable && !missing.length && storageAvailable ? 'ESTRUTURA_LOCAL_OK' : 'REVISAR',
      financeCertified:false, crossDeviceSync:false, backendWriteEnabled:false,
      note:'Verificacao estrutural e de IDs. Nao certifica replacement, D-1/D-7/D-30, valores financeiros ou sincronizacao remota.'
    };
  }
  const css = document.createElement('style');
  css.textContent = '#brzf60-button{position:fixed;left:14px;bottom:14px;z-index:2147483005;background:#133a54;color:#fff;border:1px solid #67b0ca;border-radius:7px;padding:9px 13px;font:600 12px Arial,sans-serif;cursor:pointer}' +
    '#brzf60-panel{position:fixed;bottom:59px;left:14px;z-index:2147483006;width:min(440px,calc(100vw - 28px));max-height:min(75vh,700px);overflow:auto;border:1px solid #aec5d4;border-radius:10px;padding:15px;box-shadow:0 14px 30px #0004;background:#fff;color:#173249;font:13px/1.45 Arial,sans-serif;box-sizing:border-box}' +
    '#brzf60-panel[hidden]{display:none!important}#brzf60-panel h3{margin:0 0 8px;font-size:17px}#brzf60-panel p{margin:7px 0}#brzf60-panel .brzf60-note{background:#f0f5f9;border-left:3px solid #237a9e;padding:8px 10px;font-size:12px}' +
    '#brzf60-panel button{margin:5px 5px 5px 0;padding:9px 10px;cursor:pointer;border:1px solid #b9cad4;background:#f5f8fc;border-radius:6px;color:#163b53;font:600 12px Arial}' +
    '#brzf60-panel button.primary{background:#174d70;color:white;border-color:#174d70}#brzf60-details{white-space:pre-wrap;font:12px/1.6 Consolas,monospace;max-height:175px;overflow:auto;background:#f4f6f8;border:1px solid #dee7ed;padding:9px}' +
    '#brzf60-message{font-size:12px;color:#9a371f;min-height:18px}';
  document.head.appendChild(css);
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.id = 'brzf60-button'; trigger.textContent = 'Diagnóstico BRZ';
  const panel = document.createElement('section');
  panel.id = 'brzf60-panel'; panel.hidden = true; panel.setAttribute('aria-label','Diagnóstico operacional BRZ');
  panel.innerHTML = '<h3>BRZ · Diagnóstico operacional</h3>' +
    '<p class="brzf60-note">Esta versão usa dados de 13/11/2026. Edições ficam neste navegador e <b>não são sincronizadas entre dispositivos</b>. Faça backup antes de editar.</p>' +
    '<p id="brzf60-overview">Verificando…</p><div id="brzf60-details"></div>' +
    '<div><button class="primary" id="brzf60-backup">Baixar backup JSON</button>' +
    '<button id="brzf60-html">Baixar HTML com alterações</button>' +
    '<button id="brzf60-report">Relatório diagnóstico</button></div>' +
    '<p>Restaurar backup JSON desta <b>mesma versão</b>:</p>' +
    '<input id="brzf60-import" type="file" accept="application/json,.json" aria-label="Selecionar backup JSON" />' +
    '<p id="brzf60-message" role="status"></p>';
  document.body.appendChild(trigger);
  document.body.appendChild(panel);
  const $ = id => document.getElementById(id);
  function render() {
    const a = getStatus();
    $('brzf60-overview').textContent = a.deals.toLocaleString('pt-BR') + ' negócios | ' +
      a.modulesFound + '/' + a.modulesTotal + ' módulos | ' +
      (a.browserStorageAvailable ? 'armazenamento local disponível' : 'armazenamento local indisponível');
    $('brzf60-details').textContent = 'Estrutura: ' + a.status + '\n' +
      'Build: ' + a.sourceBuild + '\n' +
      'IDs únicos: ' + (a.dealIdsUnique ? 'sim' : 'NÃO') + '\n' +
      'Ausências de módulos: ' + (a.missingModules.join(', ') || 'nenhuma') + '\n' +
      'Backup JSON/HTML: ' + (a.exportJsonAvailable && a.exportHtmlAvailable ? 'disponíveis' : 'verificar') + '\n' +
      'Estado local existente: ' + (a.browserStatePreviouslySaved ? 'sim' : 'não') + '\n' +
      'Banco e sincronização entre dispositivos: NÃO habilitados';
  }
  trigger.onclick = function () { panel.hidden = !panel.hidden; if (!panel.hidden) render(); };
  $('brzf60-backup').onclick = function () {
    if (typeof downloadBackup === 'function') downloadBackup();
    else $('brzf60-message').textContent = 'Exportação JSON não disponível.';
  };
  $('brzf60-html').onclick = function () {
    if (typeof downloadHtmlSnapshot === 'function') downloadHtmlSnapshot();
    else $('brzf60-message').textContent = 'Exportação HTML não disponível.';
  };
  $('brzf60-report').onclick = function () {
    const data = JSON.stringify(getStatus(), null, 2);
    const url = URL.createObjectURL(new Blob([data], {type:'application/json'}));
    const a = document.createElement('a'); a.href=url; a.download='BRZ_F60_DIAGNOSTICO.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  };
  $('brzf60-import').onchange = async function (ev) {
    const input = ev.target, file = input.files && input.files[0];
    if (!file) return;
    $('brzf60-message').textContent = 'Validando backup antes da restauração…';
    try {
      if (file.size > 120000000) throw Error('Arquivo excede 120 MB.');
      const value = JSON.parse(await file.text());
      if (!value || !Array.isArray(value.negocios) || value.negocios.length < BASELINE)
        throw Error('Backup incompleto: negócios ausentes.');
      const ids = value.negocios.map(d => String(d && d.id || ''));
      const unique = new Set(ids);
      if (ids.some(id=>!id) || unique.size !== ids.length) throw Error('IDs ausentes ou duplicados no backup.');
      if (typeof brzFileBuildId !== 'function' || value._fileBuildId !== brzFileBuildId())
        throw Error('Build divergente. Restaure apenas backup gerado por esta mesma versão.');
      const el = document.getElementById('dataState');
      const canonical = JSON.parse(el && el.textContent || 'null');
      if (!canonical || !Array.isArray(canonical.negocios)) throw Error('Base canônica indisponível.');
      if (canonical.negocios.some(d => !unique.has(String(d.id))))
        throw Error('O backup não inclui todos os negócios do snapshot canônico.');
      if (typeof STORAGE_KEY === 'undefined') throw Error('Chave de armazenamento ausente.');
      const ok = confirm('Restaurar ' + ids.length.toLocaleString('pt-BR') +
        ' negócios deste backup? O estado local atual será substituído. Recomenda-se baixar o backup atual antes de continuar.');
      if (!ok) { $('brzf60-message').textContent = 'Restauração cancelada.'; return; }
      const slim = Object.assign({}, value);
      delete slim.fretesRodo; delete slim.fretesFerro; delete slim.precos;
      const serialized = JSON.stringify(slim);
      localStorage.setItem(STORAGE_KEY, serialized);
      if (localStorage.getItem(STORAGE_KEY) !== serialized)
        throw Error('Não foi possível confirmar o estado gravado.');
      $('brzf60-message').textContent = 'Backup restaurado. Recarregando a plataforma…';
      window.location.reload();
    } catch(e) {
      $('brzf60-message').textContent = 'Restauração bloqueada: ' + (e && e.message || e);
    } finally { input.value = ''; }
  };
  window.BRZF60 = Object.freeze({version:VERSION, status:getStatus, refresh:render});
})();