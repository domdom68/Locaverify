# Seculoca — Extension Chrome

## Installation (mode développeur)

1. Ouvrir Chrome → `chrome://extensions`
2. Activer **Mode développeur** (interrupteur en haut à droite)
3. Cliquer **Charger l'extension non empaquetée**
4. Sélectionner le dossier `extension/`
5. L'icône Seculoca apparaît dans la barre d'outils

## Avant de publier sur le Chrome Web Store

1. Dans `src/popup.js`, remplacer les 2 premières lignes :
   - `API` → URL de votre backend Railway
   - `APP` → URL de votre frontend Vercel

2. Créer les icônes PNG :
   - `icons/icon16.png`  (16×16 px)
   - `icons/icon48.png`  (48×48 px)
   - `icons/icon128.png` (128×128 px)

3. Zipper le dossier `extension/` et soumettre sur
   https://chrome.google.com/webstore/devconsole
   (frais unique de 5 $ pour un compte développeur)

## Fonctionnement

- Sur LeBonCoin / SeLoger / PAP : bouton flottant "Vérifier avec Seculoca"
- Clic → ouvre Seculoca avec l'URL pré-remplie
- Popup : analyse directe depuis l'extension si connecté
