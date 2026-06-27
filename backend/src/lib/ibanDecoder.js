// ── IBAN Decoder — no external API needed ─────────────────────────

const COUNTRY_NAMES = {
  AD:'Andorre',AE:'Émirats Arabes Unis',AL:'Albanie',AT:'Autriche',
  AZ:'Azerbaïdjan',BA:'Bosnie-Herzégovine',BE:'Belgique',BG:'Bulgarie',
  BH:'Bahreïn',BR:'Brésil',BY:'Biélorussie',CH:'Suisse',CR:'Costa Rica',
  CY:'Chypre',CZ:'République Tchèque',DE:'Allemagne',DK:'Danemark',
  DO:'République Dominicaine',DZ:'Algérie',EE:'Estonie',EG:'Égypte',
  ES:'Espagne',FI:'Finlande',FO:'Îles Féroé',FR:'France',GB:'Royaume-Uni',
  GE:'Géorgie',GI:'Gibraltar',GL:'Groenland',GR:'Grèce',GT:'Guatemala',
  HR:'Croatie',HU:'Hongrie',IE:'Irlande',IL:'Israël',IQ:'Irak',
  IS:'Islande',IT:'Italie',JO:'Jordanie',KW:'Koweït',KZ:'Kazakhstan',
  LB:'Liban',LC:'Sainte-Lucie',LI:'Liechtenstein',LT:'Lituanie',
  LU:'Luxembourg',LV:'Lettonie',LY:'Libye',MC:'Monaco',MD:'Moldavie',
  ME:'Monténégro',MK:'Macédoine du Nord',MN:'Mongolie',MR:'Mauritanie',
  MT:'Malte',MU:'Maurice',NI:'Nicaragua',NL:'Pays-Bas',NO:'Norvège',
  OM:'Oman',PK:'Pakistan',PL:'Pologne',PS:'Palestine',PT:'Portugal',
  QA:'Qatar',RO:'Roumanie',RS:'Serbie',RU:'Russie',SA:'Arabie Saoudite',
  SC:'Seychelles',SD:'Soudan',SE:'Suède',SI:'Slovénie',SK:'Slovaquie',
  SM:'Saint-Marin',SO:'Somalie',ST:'Sao Tomé-et-Príncipe',SV:'Salvador',
  TL:'Timor oriental',TN:'Tunisie',TR:'Turquie',UA:'Ukraine',
  VA:'Vatican',VG:'Îles Vierges Britanniques',XK:'Kosovo',
};

const EU_EEA = new Set([
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GR',
  'HR','HU','IE','IS','IT','LI','LT','LU','LV','MC','MT','NL','NO',
  'PL','PT','RO','SE','SI','SK','SM','CH','AD',
]);

const HIGH_RISK = new Set([
  'NG','GH','CM','SN','CI','ML','BF','NE','TD','CF','CG','CD','GA',
  'MR','SL','LR','GN','GW','GM','CV','ST','AO','MZ','MG','KE','TZ',
  'UG','RW','BI','ET','SO','DJ','ER','SD','SS','LY','EG','DZ','MA',
  'TN','TG','BJ','ZM','ZW','MW','NA','BW','LS','SZ',
]);

const RISKY_METHODS = [
  'western union','westernunion','moneygram','money gram',
  'bitcoin','crypto','btc','ethereum','eth','usdt',
  'mandat cash','mandat postal','pcs mastercard','neosurf',
  'paysafecard','transcash','ukash','wechat pay','alipay',
];

function decodeIBAN(iban) {
  if (!iban) return null;
  const clean = iban.replace(/\s/g,'').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(clean)) {
    return { valid:false, error:'Format IBAN invalide', raw:clean };
  }
  const countryCode = clean.slice(0,2);
  const checkDigits = clean.slice(2,4);
  const bban = clean.slice(4);

  // Mod-97 validation
  const rearranged = bban + countryCode + checkDigits;
  const numeric = rearranged.split('').map(c => {
    const code = c.charCodeAt(0);
    return code >= 65 ? (code-55).toString() : c;
  }).join('');
  let remainder = 0;
  for (const digit of numeric) remainder = (remainder*10 + parseInt(digit)) % 97;
  const isValid = remainder === 1;

  const countryName = COUNTRY_NAMES[countryCode] || `Pays inconnu (${countryCode})`;
  const isEU = EU_EEA.has(countryCode);
  const isHighRisk = HIGH_RISK.has(countryCode);

  let riskLevel, riskReason;
  if (!isValid) {
    riskLevel = 'danger';
    riskReason = `IBAN invalide mathematiquement (mod 97) — probablement falsifie ou mal recopie.`;
  } else if (isHighRisk) {
    riskLevel = 'danger';
    riskReason = `Compte bancaire en ${countryName} — pays frequemment associe aux arnaques locatives.`;
  } else if (!isEU) {
    riskLevel = 'warning';
    riskReason = `Compte bancaire en ${countryName} (hors UE/EEE) — inhabituel pour une location en France.`;
  } else if (countryCode !== 'FR') {
    riskLevel = 'info';
    riskReason = `Compte bancaire en ${countryName} (UE) — acceptable, verifiez si le proprietaire se dit francais.`;
  } else {
    riskLevel = 'ok';
    riskReason = `Compte bancaire francais — coherent avec une annonce de location en France.`;
  }

  return { valid:isValid, raw:clean, countryCode, countryName, checkDigits, bban, isEU, isHighRisk, riskLevel, riskReason };
}

function detectRiskyMethod(paymentText) {
  if (!paymentText) return { detected:false };
  const lower = paymentText.toLowerCase();
  for (const method of RISKY_METHODS) {
    if (lower.includes(method)) {
      return {
        detected:true, method,
        riskLevel:'danger',
        riskReason:`Mode de paiement "${method}" detecte — utilise quasi-exclusivement dans les arnaques. Ne jamais payer via ce canal.`,
      };
    }
  }
  return { detected:false };
}

function compareNames(beneficiaryName, ownerName) {
  if (!beneficiaryName || !ownerName) return null;
  const normalize = str => str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z\s]/g,'').trim();
  const ben = normalize(beneficiaryName);
  const own = normalize(ownerName);
  if (ben === own) return { match:'exact', score:100, riskLevel:'ok', detail:`Le nom du beneficiaire correspond exactement au nom du proprietaire.` };
  const benWords = new Set(ben.split(/\s+/).filter(w=>w.length>1));
  const ownWords = new Set(own.split(/\s+/).filter(w=>w.length>1));
  const common = [...benWords].filter(w=>ownWords.has(w));
  const ratio = common.length / Math.max(benWords.size, ownWords.size, 1);
  if (ratio >= 0.75) return { match:'partial', score:Math.round(ratio*100), riskLevel:'ok', detail:`Noms similaires (${common.join(', ')} en commun) — probablement le meme individu.` };
  if (ratio >= 0.4)  return { match:'weak',    score:Math.round(ratio*100), riskLevel:'warning', detail:`Correspondance partielle entre "${beneficiaryName}" et "${ownerName}" — verifiez l'identite.` };
  return { match:'none', score:0, riskLevel:'danger', detail:`Nom du beneficiaire ("${beneficiaryName}") tres different du proprietaire annonce ("${ownerName}") — incoherence majeure.` };
}

module.exports = { decodeIBAN, detectRiskyMethod, compareNames };
