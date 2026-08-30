import React from 'react';

/**
 * ReportCard — renders the client-facing report produced by the backend's
 * reportBuilder.js (`report` field on the /api/analyse response, or
 * recomputed from a saved analysis — see Rapport.js).
 *
 * Deliberately shows a qualitative tier + 6 grouped families, never the
 * exact 0-100 score or the 15 raw criteria — see reportBuilder.js for why.
 *
 * Visual direction: "Dashboard" — the option picked after reviewing three
 * design directions together (see the design canvas from that session).
 * Segmented risk meter instead of a plain colored banner, category cards
 * in a grid, dark navy panel for next steps — closer to the rest of the
 * app's own visual language (rounded-2xl white cards, blue-600 accents).
 */

const TIER_ORDER = ['faible', 'modere', 'eleve', 'critique'];

const TIER_CFG = {
  faible:   { label: 'Risque faible',   text: 'text-green-600', dot: '#16A34A' },
  modere:   { label: 'Risque modéré',   text: 'text-amber-600', dot: '#D97706' },
  eleve:    { label: 'Risque élevé',    text: 'text-red-600',   dot: '#DC2626' },
  critique: { label: 'Risque critique', text: 'text-red-700',   dot: '#B91C1C' },
};

const FAMILY_CFG = {
  alerte:    { bg: 'bg-red-50',   text: 'text-red-700',   label: 'Alerte' },
  attention: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'À vérifier' },
  conforme:  { bg: 'bg-green-50', text: 'text-green-700', label: 'Conforme' },
  partiel:   { bg: 'bg-slate-50', text: 'text-slate-500',  label: 'Non analysable' },
};

// Icônes cohérentes avec le reste de l'app (mêmes tracés que les messages
// d'erreur/succès de Login.js, Demo.js, etc.) — pas d'emoji, pour un rendu
// identique sur tous les écrans.
function TierIcon({ niveau, className }) {
  if (niveau === 'faible') {
    return (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" className={className}>
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 8L7 10L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2L14 13H2L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 6V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="11" r="0.75" fill="currentColor"/>
    </svg>
  );
}

function FamilyIcon({ statut }) {
  if (statut === 'conforme') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 8L7 10L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  if (statut === 'partiel') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 7V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="8" cy="4.75" r="0.75" fill="currentColor"/>
      </svg>
    );
  }
  // alerte + attention
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L14 13H2L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 6V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="11" r="0.75" fill="currentColor"/>
    </svg>
  );
}

// Jauge segmentée : 4 barres, celle du palier actuel pleinement colorée,
// les autres atténuées — donne du relief visuel sans jamais afficher un
// score exact (voir lib/reportBuilder.js pour le pourquoi).
function RiskMeter({ niveau }) {
  const activeIndex = Math.max(0, TIER_ORDER.indexOf(niveau));
  const SEGMENT_COLOR = { faible: '#16A34A', modere: '#D97706', eleve: '#DC2626', critique: '#DC2626' };
  const MUTED_COLOR = { faible: '#D1FAE5', modere: '#FEF3C7', eleve: '#FEE2E2', critique: '#FEE2E2' };
  const SEGMENT_LABEL = { faible: 'Faible', modere: 'Modéré', eleve: 'Élevé', critique: 'Critique' };

  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {TIER_ORDER.map((t, i) => (
          <div key={t} className="h-2 rounded-full"
            style={{ backgroundColor: i === activeIndex ? SEGMENT_COLOR[t] : MUTED_COLOR[t] }} />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {TIER_ORDER.map((t, i) => (
          <div key={t} className={`text-[10px] text-center ${i === activeIndex ? 'font-bold' : 'text-slate-400'}`}
            style={i === activeIndex ? { color: SEGMENT_COLOR[t] } : undefined}>
            {SEGMENT_LABEL[t]}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportCard({ report }) {
  if (!report) return null;
  const tierCfg = TIER_CFG[report.niveau] || TIER_CFG.modere;

  return (
    <div className="space-y-3">
      {/* Niveau de risque + jauge segmentée */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Niveau de risque</p>
        <div className={`flex items-center gap-2 mb-4 ${tierCfg.text}`}>
          <TierIcon niveau={report.niveau} />
          <span className="text-xl font-bold">{report.niveauLabel}</span>
        </div>
        <RiskMeter niveau={report.niveau} />
        <p className={`text-sm leading-relaxed mt-4 ${tierCfg.text}`}>{report.verdict}</p>
      </div>

      {/* Résumé des alertes */}
      {report.resumeAlertes?.length > 0 && (
        <div>
          <p className="font-semibold text-sm text-slate-900 mb-2 px-1">Ce qui a retenu notre attention</p>
          <div className="space-y-2">
            {report.resumeAlertes.map((txt, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 2L14 13H2L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 6V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill="currentColor"/></svg>
                </span>
                <span className="text-sm text-slate-700">{txt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Families — grille de cartes */}
      <div>
        <p className="font-semibold text-sm text-slate-900 mb-2 px-1">Analyse par catégories</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {report.familles.map((f, i) => {
            const cfg = FAMILY_CFG[f.statut] || FAMILY_CFG.partiel;
            return (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-slate-900">{f.titre}</p>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                    <FamilyIcon statut={f.statut} />{cfg.label.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{f.lecture}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next steps */}
      {report.prochainesEtapes?.length > 0 && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: '#0F1B35' }}>
          <p className="font-semibold text-sm text-white mb-3">Vos prochaines étapes</p>
          <ol className="space-y-2.5">
            {report.prochainesEtapes.map((txt, i) => (
              <li key={i} className="text-sm flex items-center gap-3 text-slate-100">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span>{txt}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {report.mention && (
        <p className="text-xs text-slate-400 text-center px-4 pt-1">{report.mention}</p>
      )}
    </div>
  );
}
