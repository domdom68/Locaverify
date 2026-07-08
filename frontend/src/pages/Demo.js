import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function ScoreRing({ score }) {
  const radius = 44;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? '#DC2626' : score >= 35 ? '#D97706' : '#059669';
  const label = score >= 70 ? 'Risque élevé' : score >= 35 ? 'Risque modéré' : 'Faible risque';
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="9"/>
        <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="9"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50px 50px', transition: 'stroke-dashoffset 1s ease' }}/>
        <text x="50" y="47" textAnchor="middle" dominantBaseline="middle" fontSize="22" fontWeight="700" fill={color}>{score}</text>
        <text x="50" y="63" textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#94A3B8">/100</text>
      </svg>
      <span className="text-sm font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

const STATUS_CFG = {
  ok:      { icon: '✅', bg: 'bg-green-50', text: 'text-green-700', label: 'OK' },
  warning: { icon: '⚠️', bg: 'bg-amber-50',  text: 'text-amber-700',  label: 'Attention' },
  danger:  { icon: '🚨', bg: 'bg-red-50',    text: 'text-red-700',    label: 'Suspect' },
  info:    { icon: 'ℹ️', bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'Info' },
};

export default function Demo() {
  const [form, setForm]     = useState({ url: '', description: '', prix: '', localisation: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [scraping, setScraping] = useState(false);

  const update = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // Auto-fill from URL
  const handleUrlBlur = async () => {
    if (!form.url || !form.url.startsWith('http')) return;
    setScraping(true);
    try {
      const res = await fetch(`${API}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/demo/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 5L10.5 6.5V9.5L8 11L5.5 9.5V6.5L8 5Z" fill="white"/></svg>
          </div>
          <span className="font-semibold text-slate-900">Seculoca</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/connexion" className="text-sm text-slate-600 hover:text-slate-900 font-medium">Connexion</Link>
          <Link to="/connexion" className="text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            Créer un compte — 5 analyses gratuites
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-4 border border-blue-100">
            🔓 1 analyse gratuite · sans inscription
          </div>
          <h1 className="text-3xl font-serif text-slate-900 mb-2" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Testez Seculoca maintenant
          </h1>
          <p className="text-slate-500 text-sm">Collez une annonce — l'IA l'analyse en quelques secondes.</p>
        </div>

        {!result ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* URL with autofill */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  URL de l'annonce
                  <span className="text-slate-400 font-normal ml-1">(LeBonCoin, SeLoger, PAP…)</span>
                </label>
                <div className="relative">
                  <input type="url" value={form.url}
                    onChange={update('url')} onBlur={handleUrlBlur}
                    placeholder="https://www.leboncoin.fr/annonce/..."
                    className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                  {scraping && (
                    <div className="absolute right-3 top-3.5">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                    </div>
                  )}
                </div>
                {scraping && <p className="text-xs text-blue-600 mt-1">Récupération des informations de l'annonce…</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Prix / mois (€)</label>
                  <input type="number" value={form.prix} onChange={update('prix')} required
                    placeholder="850"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Ville</label>
                  <input type="text" value={form.localisation} onChange={update('localisation')} required
                    placeholder="Paris 11e"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Texte de l'annonce
                  {form.description && <span className="text-green-600 font-normal ml-2 text-xs">✓ Rempli automatiquement</span>}
                </label>
                <textarea value={form.description} onChange={update('description')} required rows={5}
                  placeholder="Copiez-collez ici le texte complet de l'annonce…"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"/>
              </div>

              {error && (
                <div className="p-3 bg-red-50 rounded-lg text-sm text-red-600 flex items-start gap-2">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="mt-0.5 flex-shrink-0"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill="currentColor"/></svg>
                  <div>
                    {error}
                    {error.includes('déjà utilisé') && (
                      <Link to="/connexion" className="block mt-1 font-semibold underline">Créer un compte gratuit (5 analyses) →</Link>
                    )}
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Analyse en cours…</>
                  : <>🔍 Analyser cette annonce gratuitement</>}
              </button>

              <p className="text-center text-xs text-slate-400">
                1 analyse gratuite par jour · Résultats non sauvegardés ·{' '}
                <Link to="/connexion" className="text-blue-600 hover:underline">Créer un compte</Link> pour 5 analyses + historique
              </p>
            </form>
          </div>
        ) : (
          <div className="space-y-4 animate-fadeIn">
            {/* Score */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col sm:flex-row items-center gap-6">
              <ScoreRing score={result.risk_score}/>
              <div className="flex-1 text-center sm:text-left">
                <p className="font-semibold text-slate-900 mb-1">Résultat de l'analyse</p>
                <p className="text-sm text-slate-600 leading-relaxed">{result.summary}</p>
              </div>
            </div>

            {/* Criteria */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <p className="font-semibold text-slate-900 text-sm">Détail de l'analyse — {result.criteria?.length || 0} critères</p>
              </div>
              <div className="divide-y divide-slate-50">
                {result.criteria?.map((c, i) => {
                  const cfg = STATUS_CFG[c.status] || STATUS_CFG.info;
                  return (
                    <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                      <span className="text-lg flex-shrink-0">{cfg.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-900">{c.label}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{c.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <div className="bg-slate-900 rounded-2xl p-6 text-center">
              <p className="text-white font-semibold text-base mb-1">Vous avez utilisé votre analyse gratuite</p>
              <p className="text-slate-400 text-sm mb-5">Créez un compte pour obtenir 5 analyses supplémentaires, l'historique complet et les rapports PDF.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/connexion" className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors">
                  Créer mon compte — c'est gratuit
                </Link>
                <button onClick={() => setResult(null)}
                  className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 font-medium text-sm hover:bg-slate-800 transition-colors">
                  Analyser une autre annonce
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
