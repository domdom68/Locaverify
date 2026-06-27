import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// ── Pricing data ──────────────────────────────────────────────────
const FREE_PACK = {
  id: null, name: 'Découverte', price: 'Gratuit',
  badge: '✦ Offert', badgeColor: 'bg-green-100 text-green-700',
  highlight: false, isSubscription: false, isFree: true,
  description: 'Pour découvrir le service',
  features: ['5 analyses incluses à l\'inscription', 'Rapport PDF téléchargeable', 'Sans carte bancaire'],
  cta: 'Déjà activé ✓', ctaDisabled: true,
};

const PRODUCTS = [
  {
    id: 'pack', name: 'Pack Essentiel', price: '4,99 €',
    badge: 'Paiement unique', badgeColor: 'bg-slate-100 text-slate-600',
    highlight: false, isSubscription: false,
    description: 'Pour une recherche ponctuelle',
    features: ['10 analyses', 'Rapport PDF', 'Validité 1 an', 'Sans engagement'],
    cta: 'Acheter le pack', perUnit: '0,50 € / analyse',
  },
  {
    id: 'solo', name: 'Solo', price: '29,99 €',
    badge: 'Le plus populaire', badgeColor: 'bg-blue-100 text-blue-700',
    highlight: true, isSubscription: true,
    description: 'Pour les particuliers actifs',
    features: ['Analyses illimitées*', 'Rapport PDF', 'Historique complet', 'Partage de rapport', 'Support email'],
    cta: 'Souscrire — 29,99 €/an', perUnit: 'soit 2,50 €/mois',
    footnote: '* Fair Use : 500 analyses/an',
  },
  {
    id: 'pro', name: 'Pro', price: '99 €',
    badge: 'Professionnels', badgeColor: 'bg-purple-100 text-purple-700',
    highlight: false, isSubscription: true,
    description: 'Agents, juristes, associations',
    features: ['Analyses illimitées*', 'Accès API REST', 'Export CSV historique', 'Support prioritaire', 'Facturation pro'],
    cta: 'Souscrire — 99 €/an', perUnit: 'soit 8,25 €/mois',
    footnote: '* Fair Use : 2 000 analyses/an',
  },
];

// ── Plan badge component ─────────────────────────────────────────
function CurrentPlanBanner({ profile, planState }) {
  const navigate = useNavigate();
  if (!profile || profile.plan === 'free') return null;

  const isSubscription = profile.plan === 'solo' || profile.plan === 'pro';
  const expiresAt = profile.plan_expires_at
    ? new Date(profile.plan_expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const handlePortal = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API}/api/payment/portal`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-blue-50 border border-blue-200 rounded-2xl mb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg flex-shrink-0">
          {profile.plan === 'pro' ? '⭐' : '✓'}
        </div>
        <div>
          <p className="font-semibold text-blue-900 text-sm">
            Abonnement {profile.plan === 'solo' ? 'Solo' : 'Pro'} actif
          </p>
          <p className="text-blue-700 text-xs mt-0.5">
            {isSubscription
              ? `${planState?.usageThisYear || 0} analyses utilisées cette année · Renouvellement ${expiresAt || 'automatique'}`
              : `${profile.credits || 0} crédits restants`}
          </p>
        </div>
      </div>
      {isSubscription && (
        <button onClick={handlePortal}
          className="flex-shrink-0 px-4 py-2 rounded-xl border border-blue-300 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors">
          Gérer mon abonnement →
        </button>
      )}
    </div>
  );
}

// ── Main Paiement page ───────────────────────────────────────────
export default function Paiement() {
  const { profile } = useAuth();
  const [loadingProduct, setLoadingProduct] = useState(null);
  const [planState, setPlanState] = useState(null);

  useEffect(() => {
    async function loadPlan() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API}/api/user/plan`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setPlanState(data);
    }
    loadPlan();
  }, []);

  const handleCheckout = async (productId) => {
    setLoadingProduct(productId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/api/payment/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error);
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
    setLoadingProduct(null);
  };

  return (
    <div className="animate-fadeIn max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-serif text-slate-900 mb-2" style={{ fontFamily: "'DM Serif Display', serif" }}>
          Choisissez votre formule
        </h1>
        <p className="text-slate-500 text-sm">Commencez gratuitement. Passez à l'illimité quand vous en avez besoin.</p>
      </div>

      {/* Current plan banner */}
      <CurrentPlanBanner profile={profile} planState={planState}/>

      {/* Free pack reminder */}
      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-6 text-sm text-green-800">
        <span className="text-lg flex-shrink-0">🎁</span>
        <span>
          <strong>Pack Découverte</strong> — 5 analyses gratuites offertes à l'inscription.
          {profile?.credits > 0 && profile?.plan === 'free'
            ? <> Il vous reste <strong>{profile.credits} crédit{profile.credits > 1 ? 's' : ''}</strong>.</>
            : null}
        </span>
        <span className="ml-auto flex-shrink-0 px-3 py-1 rounded-full bg-green-200 text-green-800 text-xs font-semibold">Déjà activé ✓</span>
      </div>

      {/* Pricing grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        {PRODUCTS.map((p) => (
          <div key={p.id}
            className={`bg-white rounded-2xl flex flex-col relative transition-shadow hover:shadow-lg ${
              p.highlight ? 'border-2 border-blue-500 shadow-md shadow-blue-100' : 'border border-slate-200'
            }`}>

            {/* Badge */}
            <div className="px-6 pt-6 pb-0">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${p.badgeColor}`}>
                {p.badge}
              </span>
            </div>

            {/* Header */}
            <div className="px-6 pt-4 pb-5 border-b border-slate-100">
              <h2 className="font-serif text-xl text-slate-900 mb-1" style={{ fontFamily: "'DM Serif Display', serif" }}>
                {p.name}
              </h2>
              <p className="text-xs text-slate-400 mb-3">{p.description}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-900">{p.price}</span>
                {p.isSubscription && <span className="text-slate-400 text-sm">/an</span>}
              </div>
              {p.perUnit && <p className="text-xs text-slate-400 mt-1">{p.perUnit}</p>}
            </div>

            {/* Features */}
            <ul className="px-6 py-5 space-y-2.5 flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-green-500 flex-shrink-0">
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M4.5 7L6.5 9L9.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            {/* Footnote */}
            {p.footnote && (
              <p className="px-6 pb-2 text-xs text-slate-400">{p.footnote}</p>
            )}

            {/* CTA */}
            <div className="px-6 pb-6">
              <button
                onClick={() => handleCheckout(p.id)}
                disabled={loadingProduct !== null}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                  p.highlight
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}>
                {loadingProduct === p.id
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  : <>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M1 8H15" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    {p.cta}
                  </>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Comparaison détaillée</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs">Fonctionnalité</th>
                {['Découverte', 'Essentiel', 'Solo', 'Pro'].map(n => (
                  <th key={n} className="px-4 py-3 text-slate-700 font-semibold text-xs text-center">{n}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                ['Nombre d\'analyses',    '5',          '10',         '500/an',       'Illimité'],
                ['Rapport PDF',           '✅',          '✅',          '✅',            '✅'],
                ['Reverse image search',  '✅',          '✅',          '✅',            '✅'],
                ['Base communautaire',    '✅',          '✅',          '✅',            '✅'],
                ['Historique analyses',   '30 jours',   '1 an',       'Illimité',     'Illimité'],
                ['Partage de rapport',    '❌',          '✅',          '✅',            '✅'],
                ['Export CSV',            '❌',          '❌',          '❌',            '✅'],
                ['Accès API REST',        '❌',          '❌',          '❌',            '✅'],
                ['Support',               '—',           'Email',      'Email',        'Prioritaire'],
                ['Facturation pro',       '❌',          '❌',          '❌',            '✅'],
                ['Prix',                  'Gratuit',    '4,99 €',     '29,99 €/an',   '99 €/an'],
              ].map(([feature, ...vals]) => (
                <tr key={feature} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-slate-700 font-medium">{feature}</td>
                  {vals.map((v, i) => (
                    <td key={i} className={`px-4 py-3 text-center text-slate-600 ${i === 2 ? 'font-medium text-blue-700' : ''}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security badges */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-6 text-xs text-slate-400 flex-wrap">
          {['🔒 Paiement sécurisé SSL', '💳 Stripe PCI DSS niveau 1', '↩️ Résiliation en 1 clic', '🏦 Aucune donnée bancaire stockée'].map(t => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
