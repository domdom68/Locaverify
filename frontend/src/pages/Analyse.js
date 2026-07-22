import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function ScoreRing({ score }) {
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? '#DC2626' : score >= 35 ? '#D97706' : '#059669';
  const label = score >= 70 ? 'Risque élevé' : score >= 35 ? 'Risque modéré' : 'Faible risque';
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="10"/>
        <circle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px', transition: 'stroke-dashoffset 1s ease' }}/>
        <text x="60" y="57" textAnchor="middle" dominantBaseline="middle" fontSize="26" fontWeight="700" fill={color}>{score}</text>
        <text x="60" y="77" textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#94A3B8">/100</text>
      </svg>
      <span className="text-sm font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

function CriterionRow({ icon, label, status, detail }) {
  const statusConfig = {
    ok:      { icon: '✅', cls: 'text-green-600', bg: 'bg-green-50', label: 'OK' },
    warning: { icon: '⚠️', cls: 'text-amber-600', bg: 'bg-amber-50', label: 'Attention' },
    danger:  { icon: '🚨', cls: 'text-red-600',   bg: 'bg-red-50',   label: 'Suspect' },
    info:    { icon: 'ℹ️', cls: 'text-blue-600',  bg: 'bg-blue-50',  label: 'Info' },
  };
  const cfg = statusConfig[status] || statusConfig.info;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <span className="text-lg flex-shrink-0">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.cls}`}>{cfg.label}</span>
        </div>
        <p className={`text-xs mt-0.5 ${cfg.cls}`}>{detail}</p>
      </div>
    </div>
  );
}

const EMPTY_FORM = { url: '', description: '', prix: '', localisation: '', proprietaire: '', telephone: '', duree_prix: 'mois'  };

export default function Analyse() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]       = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');
  const [step, setStep]       = useState('idle');
  const [mode, setMode]       = useState('full'); // 'full' | 'quick'

  const credits = profile?.credits ?? 0;
  const update = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // ── Auto-fill from URL ───────────────────────────────────────
  const handleUrlBlur = async () => {
    if (!form.url || !form.url.startsWith('http')) return;
    setScraping(true);
    try {
      const { data: { session } } = await (await import('../lib/supabase')).supabase.auth.getSession();
      const res = await fetch(`${API}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ url: form.url }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setForm(f => ({
          ...f,
          description:  data.data.description  || f.description,
          prix:         data.data.prix          || f.prix,
          localisation: data.data.localisation  || f.localisation,
        }));
      }
    } catch {}
    setScraping(false);
  };

  // ── DPE cross-check, step 2 ───────────────────────────────────
  // The ADEME API blocks server/datacenter IPs, so this network call
  // must happen from the browser. We fetch the raw candidates here, then
  // send them to the backend which does the actual matching + scoring
  // (all business logic stays server-side and auditable). This runs
  // in the background after the main result is already shown — a bonus
  // signal that refines the score a moment later, not a blocking step.
  const verifyDpe = async (analyseId, queryUrl, token) => {
    try {
      const ademeRes = await fetch(queryUrl);
      const ademeJson = await ademeRes.json();

      const verifyRes = await fetch(`${API}/api/analyse/${analyseId}/dpe-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ candidates: ademeJson.results || [] }),
      });
      if (!verifyRes.ok) return;

      const verifyData = await verifyRes.json();
      setResult(prev => (prev ? { ...prev, risk_score: verifyData.risk_score, criteria: verifyData.criteria } : prev));
    } catch {
      // Silent fail — DPE check is a bonus signal, not a critical path.
      // If it fails (ad blocker, offline, etc.), the report still stands
      // on its other criteria.
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (credits <= 0) return;
    setLoading(true); setError(''); setStep('loading');
    try {
      const { data: { session } } = await (await import('../lib/supabase')).supabase.auth.getSession();
      const res = await fetch(`${API}/api/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      const data = await res.json();
      setResult(data); setStep('done');
      await refreshProfile();

      // Kick off the DPE check in the background (non-blocking)
      if (data.dpeCheck?.needed && data.dpeCheck?.queryUrl) {
        verifyDpe(data.id, data.dpeCheck.queryUrl, session.access_token);
      }

      // Check low credits
      fetch(`${API}/api/alerts/low-credits`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      }).catch(() => {});
    } catch (err) {
      setError(err.message); setStep('idle');
    }
    setLoading(false);
  };

  return (
    <div className="animate-fadeIn max-w-2xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif text-slate-900 mb-1" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Analyser une annonce
          </h1>
          <p className="text-sm text-slate-500">Collez l'URL et les champs se remplissent automatiquement.</p>
        </div>
        {/* Mode toggle */}
        {step !== 'done' && (
          <div className="flex bg-slate-100 rounded-lg p-1 self-start">
            {[['full', '📋 Complet'], ['quick', '⚡ Rapide']].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {credits === 0 && step !== 'done' && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-5 text-sm text-red-700">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill="currentColor"/></svg>
          Plus de crédits. <Link to="/paiement" className="font-semibold underline ml-1">Acheter un pack</Link>
        </div>
      )}

      {credits <= 2 && credits > 0 && step !== 'done' && (
        <div className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl mb-5 text-sm text-amber-800">
          ⚠️ Il ne vous reste que <strong className="mx-1">{credits} crédit{credits > 1 ? 's' : ''}</strong>.
          <Link to="/paiement" className="ml-auto text-amber-700 font-semibold hover:underline flex-shrink-0">Recharger →</Link>
        </div>
      )}

      {step !== 'done' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* URL field — always shown */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                URL de l'annonce
                <span className="text-slate-400 font-normal ml-1">(remplissage automatique)</span>
              </label>
              <div className="relative">
                <input type="url" value={form.url} onChange={update('url')} onBlur={handleUrlBlur}
                  placeholder="https://www.leboncoin.fr/annonce/..."
                  className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                {scraping && <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>}
              </div>
              {scraping && <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><span className="animate-pulse">●</span> Récupération des informations…</p>}
            </div>

            {/* Quick mode: just URL + description */}
            {mode === 'quick' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Texte ou informations complémentaires</label>
                <textarea value={form.description} onChange={update('description')} required rows={4}
                  placeholder="Si l'URL n'a pas suffi, collez ici le texte de l'annonce…"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"/>
                {(!form.localisation || !form.prix) && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Pour une analyse plus précise, <button type="button" onClick={() => setMode('full')} className="underline font-medium">passez en mode Complet</button> pour renseigner ville et prix.</p>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Prix (€)</label>
                      <div className="flex gap-2">
                        <input type="number" value={form.prix} onChange={update('prix')} required placeholder="850"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                        <select value={form.duree_prix} onChange={update('duree_prix')}
                          className="px-3 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                          <option value="jour">/ jour</option>
                          <option value="semaine">/ semaine</option>
                          <option value="mois">/ mois</option>
                        </select>
                      </div>
                    </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Ville / Localisation</label>
                    <input type="text" value={form.localisation} onChange={update('localisation')} required placeholder="Paris 15e"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom du propriétaire / contact</label>
                  <input type="text" value={form.proprietaire} onChange={update('proprietaire')} placeholder="Jean Dupont"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Numéro de téléphone du contact</label>
                  <input type="tel" value={form.telephone} onChange={update('telephone')} placeholder="06 12 34 56 78"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Texte de l'annonce
                    {form.description && <span className="text-green-600 font-normal ml-2 text-xs">✓ Rempli automatiquement</span>}
                  </label>
                  <textarea value={form.description} onChange={update('description')} required rows={6}
                    placeholder="Collez ici le texte complet de l'annonce…"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"/>
                </div>
              </>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-600">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill="currentColor"/></svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || credits === 0}
              className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Analyse en cours…</>
                : <>🔍 Analyser — 1 crédit</>}
            </button>
            <p className="text-center text-xs text-slate-400">
              Il vous reste <strong className="text-slate-600">{credits} crédit{credits !== 1 ? 's' : ''}</strong>
            </p>
          </form>
        </div>
      )}

      {step === 'loading' && (
        <div className="mt-5 bg-blue-50 rounded-2xl border border-blue-100 p-8 text-center animate-fadeIn">
          <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
          <p className="text-blue-700 font-medium text-sm">Analyse IA en cours…</p>
          <p className="text-blue-400 text-xs mt-1">Vérification du prix · Analyse du texte · Détection des signaux</p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="animate-fadeIn space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <ScoreRing score={result.risk_score}/>
              <div className="flex-1 text-center sm:text-left">
                <h2 className="font-serif text-xl text-slate-900 mb-2" style={{ fontFamily: "'DM Serif Display', serif" }}>Résultat de l'analyse</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{result.summary}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-1">Détail des critères</h3>
            {result.criteria?.map((c, i) => <CriterionRow key={i} {...c}/>)}
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setStep('idle'); setResult(null); setForm(EMPTY_FORM); }}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors">
              Nouvelle analyse
            </button>
            <Link to={`/rapport/${result.id}`}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors text-center flex items-center justify-center gap-2">
              📄 Voir le rapport complet
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}