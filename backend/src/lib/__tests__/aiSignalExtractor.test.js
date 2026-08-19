const { computeDeterministicScore, buildRecommendation, WEIGHTS } = require('../aiSignalExtractor');

// ── Aide : un jeu de signaux "propre", sans aucun signal d'alerte ──────
function signalsPropres() {
  return {
    prix: { prix_mensuel_equivalent: 900, surface_m2: 45, ecart_pourcentage_marche_local: 0 },
    urgence_pression: { detectee: false },
    mode_paiement: { demande_paiement_avant_visite: false, type_suspect: false },
    proprietaire: { informations_absentes: false },
    incoherences: { liste: [] },
    qualite_redactionnelle: { mediocre: false },
    comportement_contact: { donnee_disponible: false },
  };
}

describe('computeDeterministicScore', () => {

  test('une annonce sans aucun signal d\'alerte obtient un score de 0', () => {
    const result = computeDeterministicScore(signalsPropres());
    expect(result.score).toBe(0);
  });

  test('un prix très en dessous du marché (≤ -30%) ajoute le poids fort', () => {
    const signals = signalsPropres();
    signals.prix.ecart_pourcentage_marche_local = -35;
    const result = computeDeterministicScore(signals);
    expect(result.score).toBe(WEIGHTS.prixEcartFort);
    const critere = result.criteria.find(c => c.label === 'Prix vs marché local');
    expect(critere.status).toBe('danger');
  });

  test('un prix modérément bas (-15 à -30%) ajoute un poids gradué entre modéré et fort', () => {
    const signals = signalsPropres();
    signals.prix.ecart_pourcentage_marche_local = -20;
    const result = computeDeterministicScore(signals);
    // Avec l'interpolation linéaire (poidsGradue), -20% se situe entre les
    // seuils -15% et -30% : le score doit être strictement entre le poids
    // modéré et le poids fort, jamais égal à l'un ou l'autre.
    expect(result.score).toBeGreaterThan(WEIGHTS.prixEcartModere);
    expect(result.score).toBeLessThan(WEIGHTS.prixEcartFort);
    const critere = result.criteria.find(c => c.label === 'Prix vs marché local');
    expect(critere.status).toBe('warning');
  });

  test('un prix AU-DESSUS du marché n\'ajoute aucun point, même très au-dessus (régression trouvée sur les cas 10 et 16 du tri des 25 cas : Math.abs(ecart) dans poidsGradue faisait à tort remonter "Prix anormalement bas" pour des annonces plus chères que la référence)', () => {
    const signals = signalsPropres();
    signals.prix.ecart_pourcentage_marche_local = 78; // ex. cas #10 : +78% au-dessus du marché ANIL
    const result = computeDeterministicScore(signals);
    expect(result.score).toBe(0);
    const critere = result.criteria.find(c => c.label === 'Prix vs marché local');
    expect(critere.status).toBe('ok');
  });

  test('paiement demandé avant visite est le signal le plus lourd sur ce critère', () => {
    const signals = signalsPropres();
    signals.mode_paiement.demande_paiement_avant_visite = true;
    const result = computeDeterministicScore(signals);
    expect(result.score).toBe(WEIGHTS.paiementAvantVisite);
  });

  test('les incohérences sont plafonnées à incoherenceMax même avec beaucoup d\'éléments', () => {
    const signals = signalsPropres();
    signals.incoherences.liste = ['a', 'b', 'c', 'd', 'e', 'f']; // 6 × 8 = 48, plafonné à 24
    const result = computeDeterministicScore(signals);
    expect(result.score).toBe(WEIGHTS.incoherenceMax);
  });

  test('les sous-critères de comportement de contact sont cumulables', () => {
    const signals = signalsPropres();
    signals.comportement_contact = {
      donnee_disponible: true,
      refus_appel_vocal: true,
      demande_messagerie_externe: true,
      numero_etranger_incoherent: false,
    };
    const result = computeDeterministicScore(signals);
    expect(result.score).toBe(WEIGHTS.contactRefusAppel + WEIGHTS.contactMessagerieExterne);
  });

  test('le score final est toujours plafonné à 100, même si la somme des poids le dépasse', () => {
    const signals = signalsPropres();
    signals.prix.ecart_pourcentage_marche_local = -40;      // 30
    signals.urgence_pression.detectee = true;                // 15
    signals.mode_paiement.demande_paiement_avant_visite = true; // 25
    signals.proprietaire.informations_absentes = true;       // 15
    signals.incoherences.liste = ['a', 'b', 'c'];             // 24
    signals.qualite_redactionnelle.mediocre = true;           // 8
    signals.comportement_contact = {
      donnee_disponible: true,
      refus_appel_vocal: true,
      demande_messagerie_externe: true,
      numero_etranger_incoherent: true,
    }; // 37
    // Total brut : 30+15+25+15+24+8+37 = 154, doit être plafonné à 100
    const result = computeDeterministicScore(signals);
    expect(result.score).toBe(100);
  });

  test('la référence ANIL (benchmark) est utilisée en priorité sur l\'estimation IA quand disponible', () => {
    const signals = signalsPropres();
    signals.prix.prix_mensuel_equivalent = 1000;
    signals.prix.surface_m2 = 50; // 20€/m²
    signals.prix.ecart_pourcentage_marche_local = 5; // l'IA dirait "cohérent"
    const benchmark = { loyerM2: 30, reliable: true, matchedLibgeo: 'Testville' }; // 20 vs 30 = -33%
    const result = computeDeterministicScore(signals, benchmark);
    // Le benchmark ANIL doit l'emporter : -33% ≤ -30% → poids fort, pas "cohérent"
    expect(result.score).toBe(WEIGHTS.prixEcartFort);
    const critere = result.criteria.find(c => c.label === 'Prix vs marché local');
    expect(critere.source).toBe('anil_fiable');
  });

  test('sans aucune donnée de prix, le critère est marqué "info" et n\'ajoute aucun point', () => {
    const signals = signalsPropres();
    signals.prix.ecart_pourcentage_marche_local = null;
    signals.prix.prix_mensuel_equivalent = null;
    const result = computeDeterministicScore(signals);
    const critere = result.criteria.find(c => c.label === 'Prix vs marché local');
    expect(critere.status).toBe('info');
  });
});

describe('buildRecommendation', () => {
  test('un score ≥ 70 déclenche la recommandation "risque élevé"', () => {
    expect(buildRecommendation(70)).toMatch(/Risque élevé/);
    expect(buildRecommendation(100)).toMatch(/Risque élevé/);
  });

  test('un score entre 40 et 69 déclenche la recommandation "risque modéré"', () => {
    expect(buildRecommendation(40)).toMatch(/Risque modéré/);
    expect(buildRecommendation(69)).toMatch(/Risque modéré/);
  });

  test('un score < 40 déclenche la recommandation "risque faible"', () => {
    expect(buildRecommendation(0)).toMatch(/Risque faible/);
    expect(buildRecommendation(39)).toMatch(/Risque faible/);
  });
});