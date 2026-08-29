/**
 * reportBuilder.js (frontend)
 *
 * Mirror of backend/src/lib/reportBuilder.js — needed because Rapport.js
 * and RapportPublic.js read a saved analysis row (with its raw `criteria`
 * array + exact `risk_score`) straight from Supabase rather than through
 * the /api/analyse response, so the raw→client-report transform has to
 * happen here too, client-side, right before rendering.
 *
 * Keep this in sync with the backend version if the families or tier
 * thresholds ever change. See that file for the "why".
 */

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

const NEXT_STEPS = {
  faible: [
    "Confirmez l'identité du bailleur avant tout engagement.",
    'Visitez le logement en personne ou via une visite vidéo en direct.',
    'Relisez le bail avant tout paiement ou envoi de document sensible.',
  ],
  modere: [
    'Ne versez aucune somme pour réserver le logement.',
    'Demandez une visite, une adresse précise et un projet de bail.',
    "Vérifiez l'identité du contact avant toute transmission de documents.",
  ],
  eleve: [
    'Ne versez aucun paiement à ce stade.',
    "N'envoyez pas votre dossier complet (pièce d'identité, revenus).",
    "Exigez une visite vérifiable et l'identité du bailleur avant de poursuivre.",
  ],
  critique: [
    'Interrompez l\'échange — ne payez rien et ne transmettez plus rien.',
    'Conservez toutes les preuves (annonce, messages, coordonnées).',
    "Signalez l'annonce à la plateforme concernée.",
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
  modere: 'Des vérifications complémentaires sont nécessaires avant de poursuivre. Ne versez aucune somme pour réserver le logement.',
  eleve: 'Ne versez aucun paiement et ne transmettez pas votre dossier complet à ce stade. Plusieurs éléments nécessitent une vérification indépendante.',
  critique: 'Interrompez l\'échange à ce stade. Les signaux détectés sont compatibles avec un risque important de fraude.',
};

export function computeTier(score, criteria) {
  const dangerCount = criteria.filter(c => c.status === 'danger').length;
  if (score >= 90 || dangerCount >= 3) return 'critique';
  if (score >= 70 || dangerCount >= 2) return 'eleve';
  if (score >= 40 || dangerCount >= 1) return 'modere';
  return 'faible';
}

function summariseFamily(family, criteria) {
  const items = family.labels.map(label => criteria.find(c => c.label === label)).filter(Boolean);
  if (items.length === 0) {
    return { titre: family.titre, statut: 'partiel', lecture: 'Analyse partielle — informations insuffisantes pour vérifier ce point.' };
  }
  const danger = items.filter(i => i.status === 'danger');
  const warning = items.filter(i => i.status === 'warning');
  const allInfo = items.every(i => i.status === 'info');

  if (danger.length > 0) return { titre: family.titre, statut: 'alerte', lecture: danger.slice(0, 2).map(d => d.detail).join(' ') };
  if (warning.length > 0) return { titre: family.titre, statut: 'attention', lecture: warning.slice(0, 2).map(d => d.detail).join(' ') };
  if (allInfo) return { titre: family.titre, statut: 'partiel', lecture: 'Analyse partielle — informations insuffisantes pour vérifier ce point.' };
  return { titre: family.titre, statut: 'conforme', lecture: family.reassurance };
}

/** Build the client-facing report from a saved analysis row's raw fields. */
export function buildClientReport({ score, criteria = [] }) {
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
