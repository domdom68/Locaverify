import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function ScoreBadge({ score }) {
  if (score >= 70) return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-semibold">🔴 Risque élevé — {score}/100</span>;
  if (score >= 35) return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">🟡 Risque modéré — {score}/100</span>;
  return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">🟢 Faible risque — {score}/100</span>;
}

// ── Feedback widget ──────────────────────────────────────────────
function FeedbackPanel({ analyseId }) {
  const [verdict, setVerdict]     = useState(null);
  const [comment, setComment]     = useState('');
  const [saved, setSaved]         = useState(false);
  const [loading, setLoading]     = useState(false);
  const [existing, setExisting]   = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API}/api/feedback/${analyseId}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json();
      if (data) { setExisting(data); setVerdict(data.verdict); setComment(data.comment || ''); setSaved(true); }
    }
    load();
  }, [analyseId]);

  const submit = async () => {
    if (!verdict) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${API}/api/feedback/${analyseId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ verdict, comment }),
    });
    setSaved(true); setLoading(false);
  };

  const VERDICTS = [
    { key: 'legit', label: 'Annonce légitime', icon: '✅', color: 'border-green-300 bg-green-50 text-green-700' },
    { key: 'scam',  label: 'C\'est une arnaque', icon: '🚨', color: 'border-red-300 bg-red-50 text-red-700' },
    { key: 'unsure',label: 'Je ne sais pas', icon: '🤔', color: 'border-slate-300 bg-slate-50 text-slate-600' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <h3 className="font-semibold text-slate-900 text-sm mb-1">💬 Votre avis sur ce résultat</h3>
      <p className="text-xs text-slate-400 mb-4">Votre retour améliore la précision du modèle pour tous les utilisateurs.</p>

      {saved ? (
        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-sm text-green-700">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M4 7L6.5 9.5L10 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Merci pour votre retour — verdict enregistré.
          <button className="ml-auto text-xs underline text-green-600" onClick={() => setSaved(false)}>Modifier</button>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-3 flex-wrap">
            {VERDICTS.map(v => (
              <button key={v.key} onClick={() => setVerdict(v.key)}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${verdict === v.key ? v.color + ' border-opacity-100' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>
          {verdict && (
            <div className="space-y-2 animate-fadeIn">
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                placeholder="Commentaire optionnel (ex: j'ai visité le logement, il existe vraiment)"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
              <button onClick={submit} disabled={loading}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                Envoyer mon avis
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Share panel ──────────────────────────────────────────────────
function SharePanel({ analyseId }) {
  const [shareUrl, setShareUrl]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const [watching, setWatching]   = useState(false);
  const [watchSaved, setWatchSaved] = useState(false);

  const generateLink = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API}/api/share/${analyseId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (data.shareUrl) setShareUrl(data.shareUrl);
    setLoading(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const toggleWatch = async () => {
    setWatching(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!watchSaved) {
      await fetch(`${API}/api/alerts/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ analyseId }),
      });
    } else {
      await fetch(`${API}/api/alerts/watch/${analyseId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    }
    setWatchSaved(!watchSaved);
    setWatching(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
      <h3 className="font-semibold text-slate-900 text-sm">Partager & surveiller</h3>

      {/* Share link */}
      <div>
        <p className="text-xs text-slate-500 mb-2">Partagez ce rapport sans que le destinataire ait besoin d'un compte.</p>
        {!shareUrl ? (
          <button onClick={generateLink} disabled={loading}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"/> : '🔗'}
            Générer un lien de partage
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 font-mono truncate">
              {shareUrl}
            </div>
            <button onClick={copyLink}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {copied ? '✓ Copié' : 'Copier'}
            </button>
          </div>
        )}
        {shareUrl && <p className="text-xs text-slate-400 mt-1.5">Lien valable 30 jours · accessible sans connexion</p>}
      </div>

      {/* Watch toggle */}
      <div className="pt-3 border-t border-slate-100">
        <p className="text-xs text-slate-500 mb-2">Être alerté si cette annonce est réanalysée avec un score différent.</p>
        <button onClick={toggleWatch} disabled={watching}
          className={`w-full py-2.5 rounded-xl border text-xs font-medium transition-colors flex items-center justify-center gap-2 ${watchSaved ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
          {watching ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/> : watchSaved ? '👁️ Annonce surveillée' : '👁 Surveiller cette annonce'}
          {watchSaved && <button onClick={e => { e.stopPropagation(); toggleWatch(); }} className="ml-auto text-blue-500 hover:text-blue-700 text-xs">Arrêter</button>}
        </button>
      </div>
    </div>
  );
}

// ── Main Rapport page ────────────────────────────────────────────
export default function Rapport() {
  const { id } = useParams();
  const [analyse, setAnalyse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('analyses').select('*').eq('id', id).single();
      setAnalyse(data); setLoading(false);
    }
    load();
  }, [id]);

  const exportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const criteria = analyse.criteria || [];
    const score = analyse.risk_score;
    const riskLabel = score >= 70 ? 'RISQUE ÉLEVÉ' : score >= 35 ? 'RISQUE MODÉRÉ' : 'FAIBLE RISQUE';
    const riskColor = score >= 70 ? [220, 38, 38] : score >= 35 ? [217, 119, 6] : [5, 150, 105];
    const statusLabel = { ok: '✅ OK', warning: '⚠️ Attention', danger: '🚨 Suspect', info: 'ℹ️ Info' };

    doc.setFillColor(15, 27, 53);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text('Seculoca', 14, 14);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Rapport d\'analyse — ' + new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), 14, 27);
    doc.setTextColor(...riskColor);
    doc.setFontSize(40); doc.setFont('helvetica', 'bold');
    doc.text(`${score}`, 168, 20);
    doc.setFontSize(9); doc.text(riskLabel, 155, 27);

    let y = 44;
    doc.setTextColor(30, 41, 59); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Informations', 14, y); y += 8;
    [['Localisation', analyse.localisation], ['Prix', analyse.prix ? `${analyse.prix} €/${analyse.duree_prix || 'mois'}` : '—'],
     ['Propriétaire', analyse.proprietaire], ['URL', analyse.url]].forEach(([k, v]) => {
      if (!v) return;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
      doc.text(k + ' :', 14, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42);
      doc.text(String(v).slice(0, 80), 48, y); y += 6;
    });

    y += 4; doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
    doc.text('Résumé', 14, y); y += 6;
    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105);
    const summary = doc.splitTextToSize(analyse.summary || '', 182);
    doc.text(summary, 14, y); y += summary.length * 5 + 8;

    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
    doc.text('Analyse détaillée', 14, y); y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Critère', 'Statut', 'Détail']],
      body: criteria.map(c => [c.label, statusLabel[c.status] || c.status, c.detail]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [15, 27, 53], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 28 }, 2: { cellWidth: 110 } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
      doc.text('Seculoca — seculoca.fr · Ce rapport est fourni à titre informatif.', 14, 290);
      doc.text(`${i}/${pageCount}`, 200, 290, { align: 'right' });
    }
    doc.save(`seculoca-${id.slice(0, 8)}.pdf`);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>;
  if (!analyse) return <div className="text-center py-20 text-slate-500">Rapport introuvable. <Link to="/dashboard" className="text-blue-600 underline">Retour</Link></div>;

  const criteria = analyse.criteria || [];

  return (
    <div className="animate-fadeIn max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link to="/dashboard" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-2 transition-colors">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Tableau de bord
          </Link>
          <h1 className="text-2xl font-serif text-slate-900" style={{ fontFamily: "'DM Serif Display', serif" }}>Rapport d'analyse</h1>
          <p className="text-xs text-slate-400 mt-1">
            {new Date(analyse.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button onClick={exportPDF}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-700 transition-colors self-start">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 12H13M8 3V10M8 10L5 7M8 10L11 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Télécharger PDF
        </button>
        <Link to={`/communaute?from=${id}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors self-start">
          🛡️ Signaler cette annonce
        </Link>
        <Link to={`/verifpaiement?from=${id}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors self-start">
          🔐 Vérifier un paiement demandé
        </Link>
      </div>

      {/* Score card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <ScoreBadge score={analyse.risk_score}/>
            <p className="text-slate-600 text-sm mt-3 leading-relaxed">{analyse.summary}</p>
          </div>
          <div className="flex-shrink-0 text-center">
            <div className="text-6xl font-bold" style={{ color: analyse.risk_score >= 70 ? '#DC2626' : analyse.risk_score >= 35 ? '#D97706' : '#059669' }}>
              {analyse.risk_score}
            </div>
            <div className="text-xs text-slate-400">/100</div>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[['Localisation', analyse.localisation], ['Prix', analyse.prix ? `${analyse.prix} € / ${analyse.duree_prix || 'mois'}` : null],
          ['Propriétaire', analyse.proprietaire], ['URL', analyse.url ? 'Fournie' : null]].map(([label, val]) => (
          <div key={label} className="bg-slate-50 rounded-xl p-3.5">
            <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
            <p className="text-sm font-semibold text-slate-800 truncate">{val || '—'}</p>
          </div>
        ))}
      </div>

      {/* Criteria */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">Détail de l'analyse — {criteria.length} critères</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {criteria.map((c, i) => {
            const statusConfig = {
              ok:      { icon: '✅', bg: 'bg-green-50', text: 'text-green-700', label: 'OK' },
              warning: { icon: '⚠️', bg: 'bg-amber-50', text: 'text-amber-700', label: 'Attention' },
              danger:  { icon: '🚨', bg: 'bg-red-50',   text: 'text-red-700',   label: 'Suspect' },
              info:    { icon: 'ℹ️', bg: 'bg-blue-50',  text: 'text-blue-700',  label: 'Info' },
            };
            const cfg = statusConfig[c.status] || statusConfig.info;
            return (
              <div key={i} className="flex items-start gap-4 px-6 py-4">
                <span className="text-xl flex-shrink-0">{cfg.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900">{c.label}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{c.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendation */}
      {analyse.recommendation && (
        <div className={`rounded-2xl border p-5 mb-4 ${analyse.risk_score >= 70 ? 'bg-red-50 border-red-200' : analyse.risk_score >= 35 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <p className="font-semibold text-sm text-slate-900 mb-1">💡 Notre recommandation</p>
          <p className="text-sm text-slate-600">{analyse.recommendation}</p>
        </div>
      )}

      {/* Share + Watch */}
      <div className="mb-4">
        <SharePanel analyseId={id}/>
      </div>

      {/* Feedback */}
      <div className="mb-6">
        <FeedbackPanel analyseId={id}/>
      </div>

      <div className="flex gap-3">
        <Link to="/analyser" className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors text-center">
          Analyser une autre annonce
        </Link>
        <Link to="/dashboard" className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors text-center">
          Tableau de bord
        </Link>
      </div>
    </div>
  );
}
