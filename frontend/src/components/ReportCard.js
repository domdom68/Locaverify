import React from 'react';

/**
 * ReportCard — renders the client-facing report produced by the backend's
 * reportBuilder.js (`report` field on the /api/analyse response, or
 * recomputed from a saved analysis — see Rapport.js).
 *
 * Deliberately shows a qualitative tier + 6 grouped families, never the
 * exact 0-100 score or the 15 raw criteria — see reportBuilder.js for why.
 */

const TIER_CFG = {
  faible:   { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  icon: '🟢' },
  modere:   { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  icon: '🟡' },
  eleve:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    icon: '🔴' },
  critique: { bg: 'bg-red-100',   border: 'border-red-300',    text: 'text-red-800',    icon: '🆘' },
};

const FAMILY_CFG = {
  alerte:   { bg: 'bg-red-50',   text: 'text-red-700',   icon: '🚨', label: 'Alerte' },
  attention:{ bg: 'bg-amber-50', text: 'text-amber-700', icon: '⚠️', label: 'À vérifier' },
  conforme: { bg: 'bg-green-50', text: 'text-green-700', icon: '✅', label: 'Conforme' },
  partiel:  { bg: 'bg-slate-50', text: 'text-slate-500',  icon: 'ℹ️', label: 'Non analysable' },
};

export default function ReportCard({ report }) {
  if (!report) return null;
  const tierCfg = TIER_CFG[report.niveau] || TIER_CFG.modere;

  return (
    <div className="space-y-4">
      {/* Verdict / tier banner */}
      <div className={`rounded-2xl border p-6 ${tierCfg.bg} ${tierCfg.border}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{tierCfg.icon}</span>
          <span className={`text-lg font-bold ${tierCfg.text}`}>{report.niveauLabel}</span>
        </div>
        <p className={`text-sm leading-relaxed ${tierCfg.text}`}>{report.verdict}</p>
      </div>

      {/* Résumé des alertes */}
      {report.resumeAlertes?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="font-semibold text-sm text-slate-900 mb-2">Ce qui a retenu notre attention</p>
          <ul className="space-y-1.5">
            {report.resumeAlertes.map((txt, i) => (
              <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span><span>{txt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Families */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">Analyse par catégories</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {report.familles.map((f, i) => {
            const cfg = FAMILY_CFG[f.statut] || FAMILY_CFG.partiel;
            return (
              <div key={i} className="flex items-start gap-4 px-6 py-4">
                <span className="text-xl flex-shrink-0">{cfg.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900">{f.titre}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{f.lecture}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next steps */}
      {report.prochainesEtapes?.length > 0 && (
        <div className={`rounded-2xl border p-5 ${tierCfg.bg} ${tierCfg.border}`}>
          <p className={`font-semibold text-sm mb-2 ${tierCfg.text}`}>Vos prochaines étapes</p>
          <ol className="space-y-1.5">
            {report.prochainesEtapes.map((txt, i) => (
              <li key={i} className={`text-sm flex items-start gap-2 ${tierCfg.text}`}>
                <span className="font-semibold">{i + 1}.</span><span>{txt}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {report.mention && (
        <p className="text-xs text-slate-400 text-center px-4">{report.mention}</p>
      )}
    </div>
  );
}
