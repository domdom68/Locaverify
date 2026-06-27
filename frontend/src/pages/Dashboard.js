import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

function ScoreBadge({ score }) {
  if (score >= 70) return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold">🔴 Risque élevé ({score})</span>;
  if (score >= 35) return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">🟡 Risque modéré ({score})</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold">🟢 Faible risque ({score})</span>;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalyses() {
      const { data } = await supabase
        .from('analyses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setAnalyses(data ?? []);
      setLoading(false);
    }
    fetchAnalyses();
  }, []);

  const credits = profile?.credits ?? 0;

  return (
    <div className="animate-fadeIn">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-['DM_Serif_Display',serif] text-slate-900 mb-1" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Tableau de bord
          </h1>
          <p className="text-sm text-slate-500">{profile?.email}</p>
        </div>
        <Link to="/analyser" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors self-start">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Nouvelle analyse
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          {profile?.plan === 'solo' || profile?.plan === 'pro' ? (
            <>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Abonnement</p>
              <p className="text-2xl font-bold text-blue-600">{profile.plan === 'pro' ? '⭐ Pro' : '✓ Solo'}</p>
              <Link to="/paiement" className="text-xs text-blue-600 hover:underline mt-1 inline-block">Gérer →</Link>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Crédits restants</p>
              <p className={`text-3xl font-bold ${credits === 0 ? 'text-red-600' : credits <= 3 ? 'text-amber-600' : 'text-blue-600'}`}>{credits}</p>
              <Link to="/paiement" className="text-xs text-blue-600 hover:underline mt-1 inline-block">Recharger →</Link>
            </>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Analyses effectuées</p>
          <p className="text-3xl font-bold text-slate-900">{analyses.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 col-span-2 sm:col-span-1">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Annonces suspectes</p>
          <p className="text-3xl font-bold text-red-500">{analyses.filter(a => a.risk_score >= 70).length}</p>
        </div>
      </div>

      {/* No credits warning */}
      {credits === 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6 text-sm text-amber-800">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5"><path d="M8 2L14 13H2L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 6V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill="currentColor"/></svg>
          <div>
            <strong>Plus de crédits disponibles.</strong> Achetez un pack pour continuer à analyser des annonces.
            <Link to="/paiement" className="block mt-1 text-amber-700 font-semibold hover:underline">Voir les packs →</Link>
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-2xl border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">Historique des analyses</h2>
          <span className="text-xs text-slate-400">{analyses.length} résultat{analyses.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : analyses.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-slate-500 text-sm mb-4">Aucune analyse pour l'instant.</p>
            <Link to="/analyser" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
              Analyser ma première annonce
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {analyses.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{a.title || a.url || 'Annonce sans titre'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {a.localisation && <span>{a.localisation} · </span>}
                    {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <ScoreBadge score={a.risk_score} />
                  <Link to={`/rapport/${a.id}`} className="text-xs text-blue-600 font-medium hover:underline flex-shrink-0">
                    Voir →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
