import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const STATUS_CFG = {
  ok:      { icon: '✅', bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700',  badge: 'bg-green-100 text-green-700',  label: 'OK' },
  warning: { icon: '⚠️', bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700',  label: 'Attention' },
  danger:  { icon: '🚨', bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',    badge: 'bg-red-100 text-red-700',      label: 'Suspect' },
  info:    { icon: 'ℹ️', bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',    label: 'Info' },
};

function ScoreGauge({ score }) {
  const color = score >= 70 ? '#DC2626' : score >= 35 ? '#D97706' : '#059669';
  const label = score >= 70 ? 'Arnaque très probable' : score >= 35 ? 'Coordonnées suspectes' : 'Coordonnées cohérentes';
  const w = Math.min(100, score);
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-500">Risque</span>
          <span className="text-xs font-semibold" style={{ color }}>{label}</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${w}%`, background: color }} />
        </div>
      </div>
      <div className="text-3xl font-bold flex-shrink-0" style={{ color }}>{score}<span className="text-base font-normal text-slate-400">/100</span></div>
    </div>
  );
}

function IBANBadge({ iban }) {
  if (!iban) return null;
  const parts = iban.raw?.match(/.{1,4}/g) || [];
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {parts.map((p, i) => (
        <span key={i} className={`px-2.5 py-1 rounded-lg font-mono text-sm font-semibold ${i === 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>
          {p}
        </span>
      ))}
    </div>
  );
}

export default function VerifPaiement() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    iban: '',
    beneficiaryName: '',
    paymentMethod: '',
    paymentEmail: '',
    paymentPhone: '',
    proprietaire: '',
    localisation: '',
    contactEmail: '',
    additionalContext: '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/api/payment-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...form, analyseId: searchParams.get('from') || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono";
  const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

  return (
    <div className="animate-fadeIn max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-base">🔐</div>
          <h1 className="text-2xl font-serif text-slate-900" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Vérifier des coordonnées de paiement
          </h1>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          Vous avez reçu une demande de paiement d'avance ? Collez les coordonnées ici — Seculoca vérifie leur cohérence avec l'annonce et détecte les signaux d'arnaque.
        </p>
      </div>

      {/* Alert banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6 text-sm text-amber-800">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
          <path d="M8 2L14 13H2L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M8 6V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="8" cy="11" r="0.75" fill="currentColor"/>
        </svg>
        <div>
          <strong>Ne payez rien avant d'avoir visité le bien en personne.</strong> Aucun propriétaire légitime ne demande une caution ou un loyer à l'avance sans état des lieux et bail signé.
        </div>
      </div>

      {!result ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Section 1 - Coordonnées reçues */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Coordonnées reçues du prétendu propriétaire
              </p>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>
                    IBAN reçu
                    <span className="text-slate-400 font-normal ml-1">(spaces autorisés)</span>
                  </label>
                  <input type="text" value={form.iban} onChange={update('iban')}
                    placeholder="FR76 3000 6000 0112 3456 7890 189"
                    className={inputCls}/>
                  <p className="text-xs text-slate-400 mt-1">
                    Seculoca vérifie la validité mathématique et le pays de la banque — sans appel bancaire.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Nom du bénéficiaire</label>
                    <input type="text" value={form.beneficiaryName} onChange={update('beneficiaryName')}
                      placeholder="Jean Dupont"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                  </div>
                  <div>
                    <label className={labelCls}>Mode de paiement demandé</label>
                    <input type="text" value={form.paymentMethod} onChange={update('paymentMethod')}
                      placeholder="Virement SEPA, PayPal…"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Email de paiement</label>
                    <input type="email" value={form.paymentEmail} onChange={update('paymentEmail')}
                      placeholder="paiement@exemple.fr"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                  </div>
                  <div>
                    <label className={labelCls}>Téléphone de contact</label>
                    <input type="tel" value={form.paymentPhone} onChange={update('paymentPhone')}
                      placeholder="+33 6 00 00 00 00"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2 - Infos annonce */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Informations de l'annonce (pour comparaison)
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nom du propriétaire annoncé</label>
                  <input type="text" value={form.proprietaire} onChange={update('proprietaire')}
                    placeholder="Tel que dans l'annonce"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                </div>
                <div>
                  <label className={labelCls}>Ville de l'annonce</label>
                  <input type="text" value={form.localisation} onChange={update('localisation')}
                    placeholder="Paris, Lyon…"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                </div>
              </div>

              <div className="mt-4">
                <label className={labelCls}>
                  Email de contact de l'annonce
                  <span className="text-slate-400 font-normal ml-1">(optionnel)</span>
                </label>
                <input type="email" value={form.contactEmail} onChange={update('contactEmail')}
                  placeholder="contact@annonce.fr"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
              </div>
            </div>

            {/* Section 3 - Contexte avancé */}
            <div>
              <button type="button" onClick={() => setShowAdvanced(a => !a)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                  className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
                  <path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {showAdvanced ? 'Masquer' : 'Ajouter'} le message reçu (recommandé pour l'analyse IA)
              </button>

              {showAdvanced && (
                <div className="mt-3 animate-fadeIn">
                  <label className={labelCls}>
                    Message reçu du propriétaire
                    <span className="text-slate-400 font-normal ml-1">(email, SMS, WhatsApp…)</span>
                  </label>
                  <textarea value={form.additionalContext} onChange={update('additionalContext')}
                    rows={4}
                    placeholder="Collez ici le message reçu avec la demande de paiement — l'IA l'analysera pour détecter les formulations suspectes, l'urgence artificielle, les incohérences…"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"/>
                  <p className="text-xs text-slate-400 mt-1">
                    Plus vous fournissez de contexte, plus l'analyse IA sera précise.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-600">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || (!form.iban && !form.paymentMethod && !form.beneficiaryName)}
              className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Vérification en cours…</>
                : <>🔐 Vérifier ces coordonnées de paiement</>}
            </button>

            <p className="text-center text-xs text-slate-400">
              Cette vérification ne consomme <strong>pas de crédit</strong> — elle est incluse dans votre abonnement.
            </p>
          </form>
        </div>
      ) : (
        <div className="space-y-4 animate-fadeIn">
          {/* Score global */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">
                {result.risk_score >= 70 ? '🚨' : result.risk_score >= 35 ? '⚠️' : '✅'}
              </span>
              <h2 className="font-semibold text-slate-900">{result.verdict}</h2>
            </div>
            <ScoreGauge score={result.risk_score}/>
            <p className="text-sm text-slate-600 mt-4 leading-relaxed">{result.summary}</p>

            {/* IBAN details */}
            {result.ibanDetails?.valid && (
              <div className="mt-4 p-3 bg-slate-50 rounded-xl">
                <p className="text-xs font-medium text-slate-500 mb-1">IBAN analysé</p>
                <IBANBadge iban={result.ibanDetails}/>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_CFG[result.ibanDetails.riskLevel]?.badge}`}>
                    {STATUS_CFG[result.ibanDetails.riskLevel]?.icon} {result.ibanDetails.countryName}
                  </span>
                  <span className="text-xs text-slate-400">
                    {result.ibanDetails.isEU ? '• Zone UE/EEE' : '• Hors UE'}
                    {result.ibanDetails.isHighRisk ? ' • ⚠️ Pays à risque élevé' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Red flags */}
          {result.red_flags?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <p className="font-semibold text-red-800 text-sm mb-3 flex items-center gap-2">
                🚩 Signaux d'alarme détectés
              </p>
              <ul className="space-y-2">
                {result.red_flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                    <span className="mt-0.5 flex-shrink-0">•</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Détail des vérifications */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">
                Détail des vérifications — {result.checks.length} critère{result.checks.length > 1 ? 's' : ''}
              </h3>
            </div>
            <div className="divide-y divide-slate-50">
              {result.checks.map((c, i) => {
                const cfg = STATUS_CFG[c.status] || STATUS_CFG.info;
                return (
                  <div key={i} className="flex items-start gap-4 px-6 py-4">
                    <span className="text-xl flex-shrink-0">{cfg.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900">{c.label}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{c.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommandation */}
          <div className={`rounded-2xl border p-5 ${
            result.risk_score >= 70 ? 'bg-red-50 border-red-200' :
            result.risk_score >= 35 ? 'bg-amber-50 border-amber-200' :
            'bg-green-50 border-green-200'
          }`}>
            <p className="font-semibold text-sm text-slate-900 mb-1">💡 Recommandation</p>
            <p className="text-sm text-slate-700 leading-relaxed">{result.recommendation}</p>
          </div>

          {/* Si arnaque confirmée — ressources */}
          {result.risk_score >= 70 && (
            <div className="bg-slate-900 rounded-2xl p-5 text-sm text-slate-300 space-y-2">
              <p className="text-white font-semibold mb-3">📋 En cas d'arnaque confirmée</p>
              <p>• Signalez sur <strong className="text-white">signal.conso.gouv.fr</strong></p>
              <p>• Déposez plainte auprès de la <strong className="text-white">police ou gendarmerie</strong></p>
              <p>• Contactez <strong className="text-white">Info Escroqueries : 0 805 805 817</strong> (numéro gratuit)</p>
              <p>• Conservez tous les échanges (emails, SMS, captures d'écran)</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setResult(null); setForm({ iban:'',beneficiaryName:'',paymentMethod:'',paymentEmail:'',paymentPhone:'',proprietaire:'',localisation:'',contactEmail:'',additionalContext:'' }); }}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors">
              Nouvelle vérification
            </button>
            <Link to="/dashboard"
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors text-center">
              Tableau de bord
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
