const API = 'https://determined-nourishment-production-ea9c.up.railway.app';
const APP = 'https://seculoca.fr';
const app = document.getElementById('app');

function scoreColor(s) { return s >= 70 ? 'red' : s >= 35 ? 'amber' : 'green'; }
function scoreLabel(s) { return s >= 70 ? 'Risque élevé' : s >= 35 ? 'Risque modéré' : 'Faible risque'; }
const SUPPORTED = ['leboncoin.fr','seloger.com','pap.fr','logic-immo.com','laforet.com','century21.fr','orpi.com'];

async function getToken() {
  return new Promise(r => chrome.storage.local.get('lv_token', d => r(d.lv_token || null)));
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';
  let host = '';
  try { host = new URL(url).hostname.replace('www.', ''); } catch {}
  const isListing = SUPPORTED.some(h => host.includes(h));

  if (!isListing) {
    app.innerHTML = '<div class="not-listing"><div class="icon">🏠</div><p>Naviguez sur une annonce de location pour l\'analyser.</p><p style="font-size:11px;margin-top:6px;color:#94a3b8">Supporte LeBonCoin, SeLoger, PAP, Logic-Immo…</p></div>';
    return;
  }

  const token = await getToken();
  if (!token) {
    app.innerHTML = '<div class="login-prompt"><div style="font-size:28px;margin-bottom:10px">🔐</div><p>Connectez-vous pour analyser cette annonce.</p><a href="' + APP + '/connexion" target="_blank" style="display:inline-block;background:#1E5FD4;color:white;padding:9px 18px;border-radius:9px;font-size:13px;font-weight:600;text-decoration:none">Se connecter</a><p style="margin-top:10px;font-size:11px;color:#94a3b8">5 analyses gratuites à l\'inscription</p></div>';
    return;
  }

  app.innerHTML = '<div class="url-pill" title="' + url + '">' + host + '</div><button class="btn btn-primary" id="analyzeBtn"><span>🔍</span> Analyser cette annonce</button><button class="btn btn-secondary" id="openAppBtn">Ouvrir dans Seculoca</button><div id="result"></div>';

  document.getElementById('openAppBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: APP + '/analyser?url=' + encodeURIComponent(url) });
  });

  document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Analyse en cours…';
    const resultDiv = document.getElementById('result');
    try {
      let scrapedData = {};
      try {
        const sr = await fetch(API + '/api/scrape', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({url}) });
        const sj = await sr.json();
        if (sj.success) scrapedData = sj.data;
      } catch {}
      const res = await fetch(API + '/api/analyse', {
        method: 'POST',
        headers: {'Content-Type':'application/json','Authorization':'Bearer '+token},
        body: JSON.stringify({url, ...scrapedData, description: scrapedData.description || 'Via extension navigateur'})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const c = scoreColor(data.risk_score);
      resultDiv.innerHTML = '<div class="result"><div class="score-row"><div><div class="score-num ' + c + '">' + data.risk_score + '</div><div class="score-label ' + c + '">' + scoreLabel(data.risk_score) + '</div></div><div class="score-summary">' + data.summary + '</div></div><div class="criteria">' + (data.criteria||[]).slice(0,4).map(cr => '<div class="criterion"><span>' + ({ok:'✅',warning:'⚠️',danger:'🚨',info:'ℹ️'}[cr.status]||'ℹ️') + '</span><div><div class="criterion-label">' + cr.label + '</div><div class="criterion-detail">' + cr.detail + '</div></div></div>').join('') + '</div><div class="cta"><p>Rapport PDF dans l\'app</p><a href="' + APP + '/rapport/' + data.id + '" target="_blank">Voir le rapport →</a></div></div>';
    } catch(err) {
      resultDiv.innerHTML = '<div class="error-msg">⚠️ ' + (err.message||'Erreur') + '</div>';
    }
    btn.disabled = false;
    btn.innerHTML = '<span>🔄</span> Relancer';
  });
}
init();
