# Seculoca — Guide de déploiement complet

## Structure du projet

```
seculoca/
├── frontend/          ← React 18 + Tailwind CSS (Vercel)
├── backend/           ← Node.js + Express (Railway)
├── supabase-schema.sql ← Schéma base de données
└── .env.example       ← Template des variables d'environnement
```

---

## ÉTAPE 1 — Supabase (base de données)

1. Créer un compte sur https://supabase.com
2. Créer un nouveau projet (noter le mot de passe, il ne se récupère pas)
3. Aller dans **SQL Editor** > **New query**
4. Coller le contenu de `supabase-schema.sql` et cliquer **Run**
5. Aller dans **Project Settings > API** et noter :
   - `Project URL` → `SUPABASE_URL`
   - `anon/public key` → `REACT_APP_SUPABASE_ANON_KEY`  
   - `service_role key` → `SUPABASE_SERVICE_KEY` ⚠️ Ne jamais exposer côté frontend

---

## ÉTAPE 2 — OpenAI

1. Créer un compte sur https://platform.openai.com
2. Aller dans **API Keys** > **Create new secret key**
3. Copier la clé immédiatement (elle ne sera plus visible après)
4. Aller dans **Billing** et ajouter un moyen de paiement + crédit (10€ pour commencer)
5. Noter : `sk-proj-...` → `OPENAI_API_KEY`

---

## ÉTAPE 3 — Stripe

1. Créer un compte sur https://stripe.com
2. Rester en **mode test** pendant le développement
3. Aller dans **Products** > **Add product** et créer 3 produits :
   - "Pack Starter" — Prix unique : 5,00 EUR
   - "Pack Standard" — Prix unique : 10,00 EUR
   - "Pack Pro" — Prix unique : 15,00 EUR
4. Pour chaque produit, copier le **Price ID** (`price_XXXX`)
5. Aller dans **Developers > API Keys** et noter :
   - `Publishable key` (pk_test_...)
   - `Secret key` (sk_test_...) → `STRIPE_SECRET_KEY`
6. Pour le webhook (APRÈS déploiement backend) :
   - Aller dans **Developers > Webhooks > Add endpoint**
   - URL : `https://VOTRE-BACKEND.railway.app/api/webhook`
   - Événement : `checkout.session.completed`
   - Copier le **Signing secret** → `STRIPE_WEBHOOK_SECRET`

---

## ÉTAPE 4 — GitHub

```bash
# Dans un terminal, depuis le dossier seculoca/
git init
git add .
git commit -m "Seculoca v1.0"
git branch -M main
# Créer un repo sur github.com, puis :
git remote add origin https://github.com/VOTRE_NOM/seculoca.git
git push -u origin main
```

---

## ÉTAPE 5 — Déployer le backend sur Railway

1. Aller sur https://railway.app > **New Project > Deploy from GitHub repo**
2. Sélectionner votre repo `seculoca`, dossier **backend**
3. Dans **Variables** > **Add Variable**, saisir une par une :
   ```
   PORT=3001
   SUPABASE_URL=...
   SUPABASE_SERVICE_KEY=...
   OPENAI_API_KEY=...
   STRIPE_SECRET_KEY=...
   STRIPE_WEBHOOK_SECRET=...
   STRIPE_PRICE_STARTER=...
   STRIPE_PRICE_STANDARD=...
   STRIPE_PRICE_PRO=...
   FRONTEND_URL=https://seculoca.vercel.app
   ```
4. Cliquer **Deploy** — noter l'URL générée (ex: `https://seculoca-prod.up.railway.app`)

---

## ÉTAPE 6 — Déployer le frontend sur Vercel

1. Aller sur https://vercel.com > **New Project > Import Git Repository**
2. Sélectionner le repo, **root directory** = `frontend`
3. Dans **Environment Variables**, ajouter :
   ```
   REACT_APP_SUPABASE_URL=...
   REACT_APP_SUPABASE_ANON_KEY=...
   REACT_APP_API_URL=https://VOTRE-BACKEND.railway.app
   REACT_APP_STRIPE_PRICE_STARTER=...
   REACT_APP_STRIPE_PRICE_STANDARD=...
   REACT_APP_STRIPE_PRICE_PRO=...
   ```
4. Cliquer **Deploy** — noter l'URL Vercel

---

## ÉTAPE 7 — Tests

### Test du paiement (mode test Stripe)
- Carte : `4242 4242 4242 4242`
- Date : n'importe quelle date future
- CVC : n'importe quel nombre à 3 chiffres

### Checklist avant mise en production
- [ ] Créer un compte, recevoir l'email de confirmation
- [ ] Se connecter au dashboard
- [ ] Acheter un pack (avec la carte de test)
- [ ] Vérifier que les crédits apparaissent
- [ ] Analyser une annonce
- [ ] Télécharger le rapport PDF
- [ ] Vérifier que le crédit a été débité

### Passage en production
1. Stripe : désactiver "mode test" dans les paramètres
2. Recréer les produits en mode live et mettre à jour les Price IDs
3. Mettre à jour `STRIPE_SECRET_KEY` avec la clé live (`sk_live_...`)
4. Mettre à jour les variables dans Railway et Vercel

---

## Coûts estimés (mensuel)

| Service | Coût |
|---|---|
| Vercel | Gratuit |
| Railway | ~5 $/mois |
| Supabase | Gratuit (< 500 MB) |
| OpenAI | ~0,005 € / analyse |
| Stripe | 1,4% + 0,25 € / transaction |
| **Total fixe** | **~5 €/mois** |

---

## Support

En cas de problème, décrivez l'erreur à Claude avec le message exact affiché dans le terminal ou dans les logs Railway/Vercel.
