import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const SCAM_TYPES = [
  { key: 'fake_listing',    label: 'Annonce fictive',          icon: '🏠', desc: 'Le logement n\'existe pas ou n\'est pas disponible' },
  { key: 'stolen_photos',   label: 'Photos volées',            icon: '🖼️', desc: 'Les photos proviennent d\'un autre site ou annonce' },
  { key: 'fake_owner',      label: 'Fausse identité',          icon: '👤', desc: 'Le propriétaire se fait passer pour quelqu\'un d\'autre' },
  { key: 'advance_payment', label: 'Demande de paiement avant visite', icon: '💸', desc: 'Caution ou loyer demandé avant visite ou bail' },
  { key: 'other',           label: 'Autre arnaque',            icon: '⚠️', desc: 'Autre type de fraude non listé ci-dessus' },
];

function StatCard({ label, value, color = 'text-blue-600' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 text-center">
      <div className={`text-3xl font-bold ${color} mb-1`}>{value?.toLocaleString('fr-FR') ?? '—'}</div>
      <div className="text-xs text-slate-500 font-medium">{label}</div>
    </div>
  );
}

export default function Communaute() {
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [form, setForm] = useState({
    url: '', iban: '', phone: '', email: '',
    scamType: '', description: '', evidenceText: '',
    analyseId: searchParams.get('from') || '',
  });
  const [step, setStep] = useState('form'); // form | success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load stats
    fetch(`${API}/api/community/stats`)
      .then(r => r.json()).then(setStats).catch(() => {});
    // Load recent verified reports
    fetch(`${API}/api/community/recent`)
      .then(r => r.json()).then(setRecent).catch(() => {});
  }, []);

  const update = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.scamType) { setError('Sélectionnez un type d\'arnaque.'); return; }
    if (!form.url && !form.iban && !form.phone && !form.email) {
      setError('Renseignez au moins un élément identifiant (URL, IBAN, téléphone ou email).'); return;
    }
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/api/community/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep('success');
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all";

  return (
    <div className="animate-fadeIn max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-base">🛡️</div>
          <h1 className="text-2xl font-serif text-slate-900" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Base communautaire
          </h1>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          Chaque signalement enrichit la base de données partagée — protégeant automatiquement les prochains utilisateurs qui analyseront la même annonce.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-7">
          <StatCard label="Signalements" value={stats.totalReports} color="text-red-600"/>
          <StatCard label="Annonces répertoriées" value={stats.uniqueListings} color="text-amber-600"/>
          <StatCard label="IBAN signalés" value={stats.reportedIbans} color="text-slate-700"/>
        </div>
      )}

      {step === 'success' ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center animate-fadeIn">
          <div className="text-4xl mb-3">🛡️</div>
          <h2 className="font-semibold text-green-900 text-lg mb-2">Signalement enregistré</h2>
          <p className="text-green-700 text-sm leading-relaxed mb-6">
            Merci de contribuer à la protection de la communauté Seculoca. Votre signalement sera examiné et protégera automatiquement les prochains utilisateurs.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/dashboard" className="px-5 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors">
              Tableau de bord
            </Link>
            <button onClick={() => { setStep('form'); setForm({ url:'',iban:'',phone:'',email:'',scamType:'',description:'',evidenceText:'',analyseId:'' }); }}
              className="px-5 py-2.5 rounded-xl border border-green-300 text-green-700 font-medium text-sm hover:bg-green-100 transition-colors">
              Nouveau signalement
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-5 flex items-center gap-2">
            <span className="text-red-500">🚩</span> Signaler une arnaque
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Type d'arnaque */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-3">Type d'arnaque</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SCAM_TYPES.map(t => (
                  <button key={t.key} type="button" onClick={() => setForm(f => ({ ...f, scamType: t.key }))}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${form.scamType === t.key ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <span className="text-xl flex-shrink-0">{t.icon}</span>
                    <div>
                      <p className={`text-sm font-semibold ${form.scamType === t.key ? 'text-blue-800' : 'text-slate-800'}`}>{t.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Identifiants */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Éléments identifiants de l'arnaque <span className="text-slate-300 font-normal normal-case">(au moins 1)</span>
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">URL de l'annonce</label>
                  <input type="url" value={form.url} onChange={update('url')}
                    placeholder="https://www.leboncoin.fr/annonce/..."
                    className={inputCls}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">IBAN reçu</label>
                    <input type="text" value={form.iban} onChange={update('iban')}
                      placeholder="FR76 …"
                      className={inputCls + " font-mono"}/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone</label>
                    <input type="tel" value={form.phone} onChange={update('phone')}
                      placeholder="+33 6 …"
                      className={inputCls}/>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email de contact</label>
                  <input type="email" value={form.email} onChange={update('email')}
                    placeholder="fraudeur@exemple.com"
                    className={inputCls}/>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Description de l'arnaque
                <span className="text-slate-400 font-normal ml-1">(optionnel mais utile)</span>
              </label>
              <textarea value={form.description} onChange={update('description')} rows={3}
                placeholder="Décrivez brièvement comment l'arnaque s'est déroulée…"
                className={inputCls + " resize-none"}/>
            </div>

            {/* Preuves */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Copie des échanges reçus
                <span className="text-slate-400 font-normal ml-1">(email, SMS, WhatsApp — optionnel)</span>
              </label>
              <textarea value={form.evidenceText} onChange={update('evidenceText')} rows={3}
                placeholder="Collez ici les messages suspects reçus…"
                className={inputCls + " resize-none"}/>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-600">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Envoi en cours…</>
                : <>🛡️ Envoyer le signalement</>}
            </button>

            <p className="text-center text-xs text-slate-400">
              Ce signalement ne consomme pas de crédit · Vos coordonnées ne sont jamais publiées
            </p>
          </form>
        </div>
      )}

      {/* Recent verified reports */}
      {recent.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 text-sm">Signalements récents vérifiés</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {recent.slice(0, 8).map((r, i) => {
              const type = SCAM_TYPES.find(t => t.key === r.scamType);
              return (
                <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="text-lg flex-shrink-0 mt-0.5">{type?.icon || '⚠️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-800">{type?.label || r.scamType}</span>
                      {r.urlDomain && <span className="text-xs text-slate-400">· {r.urlDomain}</span>}
                    </div>
                    {r.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{r.description}</p>}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {new Date(r.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
