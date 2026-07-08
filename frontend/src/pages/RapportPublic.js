import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function ScoreBadge({ score }) {
  if (score >= 70) return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-semibold">🔴 Risque élevé — {score}/100</span>;
  if (score >= 35) return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">🟡 Risque modéré — {score}/100</span>;
  return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">🟢 Faible risque — {score}/100</span>;
}

export default function RapportPublic() {
  const { token } = useParams();
  const [analyse, setAnalyse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/api/share/public/${token}`);
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        setAnalyse(await res.json());
      } catch (err) { setError(err.message); }
      setLoading(false);
    }
    load();
  }, [token]);

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
        <Link to="/connexion" className="text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          Analyser une annonce
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {loading && <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>}

        {error && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">🔒</div>
            <p className="text-slate-700 font-semibold mb-2">{error}</p>
            <Link to="/" className="text-sm text-blue-600 hover:underline">Retour à l'accueil</Link>
          </div>
        )}

        {analyse && (
          <div className="space-y-4 animate-fadeIn">
            {/* Banner */}
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5V8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Rapport partagé par un utilisateur Seculoca · Lecture seule
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <ScoreBadge score={analyse.risk_score}/>
              <p className="text-slate-600 text-sm mt-3 leading-relaxed">{analyse.summary}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[['Localisation', analyse.localisation], ['Prix', analyse.prix ? `${analyse.prix} €/${analyse.duree_prix || 'mois'}` : null],
                ['Analysé le', new Date(analyse.created_at).toLocaleDateString('fr-FR')]].map(([l, v]) => (
                <div key={l} className="bg-slate-50 rounded-xl p-3.5">
                  <p className="text-xs text-slate-400 font-medium mb-1">{l}</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{v || '—'}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <p className="font-semibold text-slate-900 text-sm">Détail des critères</p>
              </div>
              <div className="divide-y divide-slate-50">
                {(analyse.criteria || []).map((c, i) => {
                  const cfg = { ok: { icon: '✅', cls: 'text-green-700', bg: 'bg-green-50' }, warning: { icon: '⚠️', cls: 'text-amber-700', bg: 'bg-amber-50' }, danger: { icon: '🚨', cls: 'text-red-700', bg: 'bg-red-50' }, info: { icon: 'ℹ️', cls: 'text-blue-700', bg: 'bg-blue-50' } }[c.status] || { icon: 'ℹ️', cls: 'text-blue-700', bg: 'bg-blue-50' };
                  return (
                    <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                      <span className="text-lg flex-shrink-0">{cfg.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{c.label}</p>
                        <p className={`text-xs mt-0.5 ${cfg.cls}`}>{c.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <div className="bg-slate-900 rounded-2xl p-6 text-center">
              <p className="text-white font-semibold mb-1">Vérifiez vos propres annonces</p>
              <p className="text-slate-400 text-sm mb-4">5 analyses gratuites à l'inscription · sans carte bancaire</p>
              <Link to="/connexion"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors">
                Créer un compte gratuit →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
