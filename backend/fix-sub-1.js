const fs = require('fs');
const filePath = 'src/lib/subscriptionManager.js';
let content = fs.readFileSync(filePath, 'utf8');
let changed = 0;

// 1. Remplacer le bloc PLANS
const oldPlans = `const PLANS = {
  free:  { name: 'D\u00e9couverte',      fairUse: 5,    annual: false, hasApi: false, hasCsv: false },
  pack:  { name: 'Pack Essentiel',  fairUse: null, annual: false, hasApi: false, hasCsv: false },
  solo:  { name: 'Solo',            fairUse: 500,  annual: true,  hasApi: false, hasCsv: false },
  pro:   { name: 'Pro',             fairUse: 2000, annual: true,  hasApi: true,  hasCsv: true  },
};`;

const newPlans = `const PLANS = {
  free:      { name: 'D\u00e9couverte', fairUse: 5,   monthly: false, hasApi: false, hasCsv: false },
  essentiel: { name: 'Essentiel',   fairUse: 20,  monthly: true,  hasApi: false, hasCsv: false },
  max:       { name: 'Max',         fairUse: 60,  monthly: true,  hasApi: false, hasCsv: false },
  pro:       { name: 'Pro',         fairUse: null, monthly: true, hasApi: true,  hasCsv: true  },
};`;

if (content.includes(oldPlans)) { content = content.replace(oldPlans, newPlans); changed++; }
else console.log('ATTENTION: bloc PLANS non trouve tel quel');

fs.writeFileSync(filePath, content, 'utf8');
console.log('subscriptionManager.js (etape 1/4): ' + changed + ' modification(s) appliquee(s)');
