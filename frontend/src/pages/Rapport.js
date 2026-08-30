import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ReportCard from '../components/ReportCard';
import { buildClientReport } from '../lib/reportBuilder';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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

  // The PDF mirrors ReportCard's "Dashboard" direction — segmented risk
  // meter, category cards, navy next-steps panel — qualitative tier + 6
  // grouped families, never the exact score or the 15 raw criteria.
  // See lib/reportBuilder.js and components/ReportCard.js.
  const exportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const report = buildClientReport({ score: analyse.risk_score, criteria: analyse.criteria || [] });

    const NAVY = [15, 27, 53];
    const TIER_ORDER = ['faible', 'modere', 'eleve', 'critique'];
    const TIER_LABEL_SHORT = { faible: 'Faible', modere: 'Modéré', eleve: 'Élevé', critique: 'Critique' };
    const TIER_COLOR = { faible: [22, 163, 74], modere: [217, 119, 6], eleve: [220, 38, 38], critique: [220, 38, 38] };
    const TIER_COLOR_MUTED = { faible: [209, 250, 229], modere: [254, 243, 199], eleve: [254, 226, 226], critique: [254, 226, 226] };
    const riskColor = TIER_COLOR[report.niveau] || TIER_COLOR.modere;

    const STATUT_LABEL = { alerte: 'Alerte', attention: 'À vérifier', conforme: 'Conforme', partiel: 'Non analysable' };
    const STATUT_COLOR = { alerte: [220,38,38], attention: [217,119,6], conforme: [22,163,74], partiel: [100,116,139] };
    const STATUT_BG = { alerte: [254,242,242], attention: [255,251,235], conforme: [240,253,244], partiel: [248,250,252] };

    const MARGIN = 14, PAGE_W = 210, CONTENT_W = 182;

    const ensureSpace = (needed, y) => {
      if (y + needed > 278) { doc.addPage(); return 20; }
      return y;
    };

    // ── Header ──────────────────────────────────────────────────
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, PAGE_W, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('Seculoca', MARGIN, 13);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Rapport d\'analyse — ' + new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), MARGIN, 22);

    let y = 40;

    // ── Niveau de risque + jauge segmentée ─────────────────────
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(148, 163, 184);
    doc.text('NIVEAU DE RISQUE', MARGIN, y); y += 7;
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(...riskColor);
    doc.text(report.niveauLabel, MARGIN, y); y += 6;

    const segGap = 2, segW = (CONTENT_W - segGap * 3) / 4;
    TIER_ORDER.forEach((t, i) => {
      const x = MARGIN + i * (segW + segGap);
      doc.setFillColor(...(t === report.niveau ? TIER_COLOR[t] : TIER_COLOR_MUTED[t]));
      doc.roundedRect(x, y, segW, 2.4, 1.2, 1.2, 'F');
    });
    y += 5.5;
    TIER_ORDER.forEach((t, i) => {
      const x = MARGIN + i * (segW + segGap);
      const active = t === report.niveau;
      doc.setFontSize(7.5); doc.setFont('helvetica', active ? 'bold' : 'normal');
      doc.setTextColor(...(active ? TIER_COLOR[t] : [148, 163, 184]));
      doc.text(TIER_LABEL_SHORT[t], x + segW / 2, y, { align: 'center' });
    });
    y += 9;

    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...riskColor);
    const verdictLines = doc.splitTextToSize(report.verdict, CONTENT_W);
    doc.text(verdictLines, MARGIN, y); y += verdictLines.length * 5 + 10;

    // ── Informations ────────────────────────────────────────────
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
    doc.text('Informations', MARGIN, y); y += 7;
    [['Localisation', analyse.localisation], ['Prix', analyse.prix ? `${analyse.prix} €/${analyse.duree_prix || 'mois'}` : '—'],
     ['Propriétaire', analyse.proprietaire], ['URL', analyse.url]].forEach(([k, v]) => {
      if (!v) return;
      doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
      doc.text(k + ' :', MARGIN, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42);
      doc.text(String(v).slice(0, 90), MARGIN + 32, y); y += 5.5;
    });
    y += 6;

    // ── Alertes ─────────────────────────────────────────────────
    if (report.resumeAlertes.length > 0) {
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
      doc.text('Ce qui a retenu notre attention', MARGIN, y); y += 7;
      report.resumeAlertes.forEach(txt => {
        const lines = doc.splitTextToSize(txt, CONTENT_W - 10);
        const h = lines.length * 4.4 + 5;
        y = ensureSpace(h, y);
        doc.setFillColor(254, 242, 242);
        doc.roundedRect(MARGIN, y - 4, CONTENT_W, h, 2, 2, 'F');
        doc.setFillColor(220, 38, 38);
        doc.circle(MARGIN + 5.5, y + 0.5, 1.1, 'F');
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(51, 65, 85);
        doc.text(lines, MARGIN + 10, y); y += h + 3;
      });
      y += 3;
    }

    // ── Analyse par catégories (cartes) ─────────────────────────
    y = ensureSpace(14, y);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
    doc.text('Analyse par catégories', MARGIN, y); y += 8;

    report.familles.forEach(f => {
      const statutLabel = STATUT_LABEL[f.statut] || f.statut;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      const pillW = doc.getTextWidth(statutLabel.toUpperCase()) + 7;
      const lectureLines = doc.splitTextToSize(f.lecture, CONTENT_W - 16);
      const cardH = 8 + 5.5 + lectureLines.length * 4.2 + 6;

      y = ensureSpace(cardH + 4, y);
      doc.setFillColor(...(STATUT_BG[f.statut] || STATUT_BG.partiel));
      doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 3, 3, 'F');

      const innerX = MARGIN + 8, innerY = y + 9;
      doc.setFontSize(10.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
      doc.text(f.titre, innerX, innerY);

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(MARGIN + CONTENT_W - 8 - pillW, y + 5, pillW, 5.5, 2.5, 2.5, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...(STATUT_COLOR[f.statut] || STATUT_COLOR.partiel));
      doc.text(statutLabel.toUpperCase(), MARGIN + CONTENT_W - 8 - pillW / 2, y + 8.7, { align: 'center' });

      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105);
      doc.text(lectureLines, innerX, innerY + 6);

      y += cardH + 4;
    });
    y += 4;

    // ── Prochaines étapes (panneau navy) ─────────────────────────
    const stepsLines = report.prochainesEtapes.map(txt => doc.splitTextToSize(txt, CONTENT_W - 26));
    const stepsH = 12 + stepsLines.reduce((sum, lines) => sum + lines.length * 4.6 + 3, 0) + 4;
    y = ensureSpace(stepsH, y);
    doc.setFillColor(...NAVY);
    doc.roundedRect(MARGIN, y, CONTENT_W, stepsH, 4, 4, 'F');

    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text('Vos prochaines étapes', MARGIN + 8, y + 9);

    let stepY = y + 18;
    report.prochainesEtapes.forEach((txt, i) => {
      const lines = stepsLines[i];
      doc.setFillColor(37, 99, 235);
      doc.circle(MARGIN + 11.5, stepY - 1.2, 2.6, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text(String(i + 1), MARGIN + 11.5, stepY + 0.1, { align: 'center' });
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(226, 232, 240);
      doc.text(lines, MARGIN + 18, stepY);
      stepY += lines.length * 4.6 + 3;
    });
    y += stepsH + 8;

    // ── Mention ────────────────────────────────────────────────
    y = ensureSpace(10, y);
    doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(148, 163, 184);
    doc.text(doc.splitTextToSize(report.mention, CONTENT_W), MARGIN, y);

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
      doc.text('Seculoca — seculoca.fr · Ce rapport est fourni à titre informatif.', MARGIN, 290);
      doc.text(`${i}/${pageCount}`, 210 - MARGIN, 290, { align: 'right' });
    }
    doc.save(`seculoca-${id.slice(0, 8)}.pdf`);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>;
  if (!analyse) return <div className="text-center py-20 text-slate-500">Rapport introuvable. <Link to="/dashboard" className="text-blue-600 underline">Retour</Link></div>;

  const report = buildClientReport({ score: analyse.risk_score, criteria: analyse.criteria || [] });

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

      {/* Summary */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-4">
        <p className="text-slate-600 text-sm leading-relaxed">{analyse.summary}</p>
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

      {/* Report: qualitative tier + 6 grouped families (see lib/reportBuilder.js) */}
      <div className="mb-4">
        <ReportCard report={report}/>
      </div>

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
