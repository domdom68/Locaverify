/**
 * reportBuilder.js
 *
 * Turns the raw, granular output of the analysis engine (exact 0-100 score
 * + up to 15 individually-labelled criteria) into a client-facing report:
 * a qualitative risk tier + 6 broad, human-readable families.
 *
 * WHY THIS EXISTS (security / product decision, Aug 2026) :
 * Showing an exact numeric score and every individual criterion in real
 * time lets anyone with an account use Seculoca as a free "oracle" —
 * tweak a fake listing, resubmit, see exactly which line moved and by
 * how much, repeat until the listing scores clean. Collapsing the score
 * into 4 wide tiers and the 15 criteria into 6 families removes that
 * fine-grained feedback signal while keeping the report genuinely useful
 * and honest for real tenants.
 *
 * The exact score and the full criteria array are still computed and
 * stored (needed for internal tuning, support, and fraud review) — this
 * module only controls what gets shown to the end user.
 */

// ── Which of the 15 raw criteria belong to which client-facing family ──
// Label strings must match exactly what aiSignalExtractor.js / imageAnalyzer.js /
// communityCheck.js / domainSpoofCheck.js / dpeCheck.js produce.
const FAMILIES = [
  {
    key: 'annonce',
    titre: "Cohérence de l'annonce",
    labels: [
      'Prix vs marché local',
      'Promotion affichée',
      "Cohérence de l'annonce",
      'Qualité rédactionnelle',
      'Cohérence adresse/surface (DPE)',
    ],
    reassurance: "Le prix, la description et les caractéristiques du logement sont cohérents entre eux et avec le marché local.",
  },
  {
    key: 'photos',
    titre: 'Photos et présentation du bien',
    labels: ['Vérification des photos'],
    reassurance: "Aucune reprise suspecte des photos ailleurs sur le web n'a été détectée.",
  },
  {
    key: 'contact',
    titre: 'Bailleur et contact',
    labels: ['Présence du propriétaire', 'Comportement de contact', 'Authenticité du nom de domaine'],
    reassurance: 'Les informations disponibles sur le bailleur et le contact ne présentent pas de signal majeur.',
  },
  {
    key: 'conditions',
    titre: 'Conditions de location',
    labels: ['Urgence et pression', 'Documents avant visite', 'Remise des clés'],
    reassurance: 'Les modalités de location décrites (visite, documents, remise des clés) suivent un déroulement standard.',
  },
  {
    key: 'paiement',
    titre: 'Paiement et transaction',
    labels: ['Mode de paiement', 'Compte bancaire cohérent'],
    reassurance: 'Aucune demande de paiement ni de moyen de règlement inhabituel identifié à ce stade.',
  },
  {
    key: 'communaute',
    titre: 'Signaux communautaires',
    labels: ['Réputation communautaire'],
    reassurance: "Aucun signalement dans la base communautaire Seculoca pour cette annonce, cet IBAN ou ce contact.",
  },
];

// ── Next-step action text by risk tier (kept generic on purpose — the
// specific reasons live in `familles[].lecture`, not here) ─────────────
const NEXT_STEPS = {
  faible: [
    'Confirmez l\'identité du bailleur avant tout engagement.',
    'Visitez le logement en personne ou via une visite vidéo en direct.',
    'Relisez le bail avant tout paiement ou envoi de document sensible.',
  ],
  modere: [
    'Ne versez aucune somme pour réserver le logement.',
    'Demandez une visite, une adresse précise et un projet de bail.',
    'Vérifiez l\'identité du contact avant toute transmission de documents.',
  ],
  eleve: [
    'Ne versez aucun paiement à ce stade.',
    'N\'envoyez pas votre dossier complet (pièce d\'identité, revenus).',
    'Exigez une visite vérifiable et l\'identité du bailleur avant de poursuivre.',
  ],
  critique: [
    'Interrompez l\'échange — ne payez rien et ne transmettez plus rien.',
    'Conservez toutes les preuves (annonce, messages, coordonnées).',
    'Signalez l\'annonce à la plateforme concernée.',
  ],
};

const TIER_LABELS = {
  faible: 'Risque faible',
  modere: 'Risque modéré',
  eleve: 'Risque élevé',
  critique: 'Risque critique',
};

const TIER_VERDICTS = {
  faible: "Aucun signal majeur détecté à ce stade. Poursuivez avec les précautions habituelles : confirmez l'identité du bailleur, visitez le logement et relisez le bail avant tout paiement.",
  modere: "Des vérifications complémentaires sont nécessaires avant de poursuivre. Ne versez aucune somme pour réserver le logement.",
  eleve: "Ne versez aucun paiement et ne transmettez pas votre dossier complet à ce stade. Plusieurs éléments nécessitent une vérification indépendante.",
  critique: "Interrompez l'échange à ce stade. Les signaux détectés sont compatibles avec un risque important de fraude.",
};

/**
 * Collapse the exact 0-100 score into one of 4 wide tiers. A single
 * `danger` criterion is enough to prevent "faible", and several `danger`
 * criteria push the tier up even if the weighted sum stays moderate —
 * mirrors the floor logic already used in buildRecommendation().
 */
function computeTier(score, criteria) {
  const dangerCount = criteria.filter(c => c.status === 'danger').length;

  if (score >= 90 || dangerCount >= 3) return 'critique';
  if (score >= 70 || dangerCount >= 2) return 'eleve';
  if (score >= 40 || dangerCount >= 1) return 'modere';
  return 'faible';
}

function summariseFamily(family, criteria) {
  const items = family.labels
    .map(label => criteria.find(c => c.label === label))
    .filter(Boolean);

  if (items.length === 0) {
    return { titre: family.titre, statut: 'partiel', lecture: 'Analyse partielle — informations insuffisantes pour vérifier ce point.' };
  }

  const danger = items.filter(i => i.status === 'danger');
  const warning = items.filter(i => i.status === 'warning');
  const allInfo = items.every(i => i.status === 'info');

  if (danger.length > 0) {
    return { titre: family.titre, statut: 'alerte', lecture: danger.slice(0, 2).map(d => d.detail).join(' ') };
  }
  if (warning.length > 0) {
    return { titre: family.titre, statut: 'attention', lecture: warning.slice(0, 2).map(d => d.detail).join(' ') };
  }
  if (allInfo) {
    return { titre: family.titre, statut: 'partiel', lecture: 'Analyse partielle — informations insuffisantes pour vérifier ce point.' };
  }
  return { titre: family.titre, statut: 'conforme', lecture: family.reassurance };
}

/**
 * Build the client-facing report from the raw score + full criteria array.
 * `criteria` must be the flat array produced by analyse.js (aiCriteria +
 * imageCriterion + communityCriterion + domainCriterion + dpeCriterion).
 */
function buildClientReport({ score, criteria = [] }) {
  const niveau = computeTier(score, criteria);

  const resumeAlertes = criteria
    .filter(c => c.status === 'danger' || c.status === 'warning')
    .sort((a, b) => (b.status === 'danger' ? 1 : 0) - (a.status === 'danger' ? 1 : 0))
    .slice(0, 4)
    .map(c => c.detail);

  return {
    niveau,
    niveauLabel: TIER_LABELS[niveau],
    verdict: TIER_VERDICTS[niveau],
    resumeAlertes,
    familles: FAMILIES.map(f => summariseFamily(f, criteria)),
    prochainesEtapes: NEXT_STEPS[niveau],
    mention: 'Ce résultat est une aide à la décision et ne constitue pas une garantie absolue de légitimité.',
  };
}

module.exports = { buildClientReport, FAMILIES, computeTier };
