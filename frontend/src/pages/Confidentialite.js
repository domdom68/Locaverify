import { Link } from 'react-router-dom';

const pageStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #0F1C3F 0%, #0B142C 100%)',
  color: 'rgba(255,255,255,0.85)',
  fontFamily: 'Inter, Arial, sans-serif',
  padding: '48px 24px 80px',
};

const containerStyle = { maxWidth: 760, margin: '0 auto' };

const h1Style = {
  fontFamily: 'Syne, sans-serif',
  fontWeight: 800,
  fontSize: '2rem',
  color: '#fff',
  marginBottom: 8,
};

const h2Style = {
  fontFamily: 'Syne, sans-serif',
  fontWeight: 700,
  fontSize: '1.15rem',
  color: '#8FB2FF',
  marginTop: 32,
  marginBottom: 8,
};

const pStyle = { lineHeight: 1.7, marginBottom: 12, opacity: 0.9 };
const backLinkStyle = { color: '#8FB2FF', textDecoration: 'none', fontSize: '0.9rem' };
const ulStyle = { lineHeight: 1.7, opacity: 0.9, paddingLeft: 20, marginBottom: 12 };

export default function Confidentialite() {
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <Link to="/" style={backLinkStyle}>&larr; Retour à l'accueil</Link>
        <h1 style={h1Style}>Politique de confidentialité</h1>
        <p style={{ ...pStyle, opacity: 0.6, fontSize: '0.9rem' }}>Dernière mise à jour : juillet 2026</p>

        <h2 style={h2Style}>Données collectées</h2>
        <p style={pStyle}>Dans le cadre de l'utilisation de Seculoca, nous collectons :</p>
        <ul style={ulStyle}>
          <li>Vos identifiants de compte (email, mot de passe chiffré) ;</li>
          <li>Le contenu des annonces que vous soumettez pour analyse (texte, images, URL) ;</li>
          <li>Les données de paiement, traitées exclusivement par Stripe (nous ne stockons jamais vos coordonnées bancaires) ;</li>
          <li>Des données techniques de navigation (logs, adresse IP) à des fins de sécurité.</li>
        </ul>

        <h2 style={h2Style}>Utilisation des données</h2>
        <p style={pStyle}>
          Les annonces soumises pour analyse sont transmises à l'API d'OpenAI (GPT-4o) afin de
          détecter des indices de fraude. Ces contenus ne sont utilisés que pour générer votre
          rapport d'analyse et ne sont pas réutilisés à d'autres fins par Seculoca.
        </p>
        <p style={pStyle}>
          Vos données de compte et votre historique d'analyses sont stockés de manière sécurisée
          via Supabase.
        </p>

        <h2 style={h2Style}>Base légale et durée de conservation</h2>
        <p style={pStyle}>
          Les données sont conservées le temps de votre utilisation du service, et supprimées sur
          simple demande à <a href="mailto:contact@seculoca.fr" style={backLinkStyle}>contact@seculoca.fr</a>,
          conformément au Règlement Général sur la Protection des Données (RGPD).
        </p>

        <h2 style={h2Style}>Vos droits</h2>
        <p style={pStyle}>
          Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et
          de portabilité de vos données. Pour exercer ces droits, contactez-nous à{' '}
          <a href="mailto:contact@seculoca.fr" style={backLinkStyle}>contact@seculoca.fr</a>.
        </p>

        <h2 style={h2Style}>Partage avec des tiers</h2>
        <p style={pStyle}>
          Vos données ne sont jamais vendues. Elles peuvent être transmises à nos sous-traitants
          techniques (Supabase, OpenAI, Stripe, Vercel, Railway, Resend) uniquement dans la mesure
          nécessaire au fonctionnement du service.
        </p>

        <h2 style={h2Style}>Cookies</h2>
        <p style={pStyle}>
          Seculoca utilise des cookies strictement nécessaires au fonctionnement du site
          (authentification, session). Aucun cookie publicitaire n'est utilisé.
        </p>
      </div>
    </div>
  );
}