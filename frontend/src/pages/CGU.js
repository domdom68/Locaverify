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

export default function CGU() {
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <Link to="/" style={backLinkStyle}>&larr; Retour à l'accueil</Link>
        <h1 style={h1Style}>Conditions Générales d'Utilisation</h1>
        <p style={{ ...pStyle, opacity: 0.6, fontSize: '0.9rem' }}>Dernière mise à jour : juillet 2026</p>

        <h2 style={h2Style}>Objet</h2>
        <p style={pStyle}>
          Les présentes CGU définissent les modalités d'accès et d'utilisation du service Seculoca,
          outil d'analyse et de détection de fraude dans les annonces de location.
        </p>

        <h2 style={h2Style}>Description du service</h2>
        <p style={pStyle}>
          Seculoca propose une analyse automatisée d'annonces de location (texte, images, URL) afin
          d'identifier des indices de fraude potentielle. Les résultats fournis sont indicatifs et ne
          constituent en aucun cas une garantie absolue de fiabilité ou de fraude d'une annonce.
          L'utilisateur reste seul responsable de sa décision finale de contracter ou non.
        </p>

        <h2 style={h2Style}>Compte utilisateur</h2>
        <p style={pStyle}>
          L'accès à certaines fonctionnalités nécessite la création d'un compte. L'utilisateur
          s'engage à fournir des informations exactes et à préserver la confidentialité de ses
          identifiants.
        </p>

        <h2 style={h2Style}>Abonnements et paiement</h2>
        <p style={pStyle}>
          Seculoca propose plusieurs formules (gratuite et payantes). Les paiements sont traités de
          manière sécurisée par Stripe. Les modalités de résiliation et de renouvellement sont
          précisées lors de la souscription.
        </p>

        <h2 style={h2Style}>Responsabilité</h2>
        <p style={pStyle}>
          Seculoca met en œuvre les moyens raisonnables pour assurer la fiabilité de son service,
          sans garantir un résultat d'analyse exempt de toute erreur. Seculoca ne saurait être tenu
          responsable des conséquences directes ou indirectes d'une décision prise sur la base d'un
          rapport d'analyse.
        </p>

        <h2 style={h2Style}>Signalement communautaire</h2>
        <p style={pStyle}>
          Les utilisateurs peuvent signaler des annonces suspectes via le module communautaire. Tout
          signalement abusif, diffamatoire ou de mauvaise foi engage la responsabilité de son auteur.
        </p>

        <h2 style={h2Style}>Modification des CGU</h2>
        <p style={pStyle}>
          Seculoca se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs
          seront informés de toute modification substantielle.
        </p>

        <h2 style={h2Style}>Contact</h2>
        <p style={pStyle}>
          Pour toute question relative aux présentes CGU :{' '}
          <a href="mailto:contact@seculoca.fr" style={backLinkStyle}>contact@seculoca.fr</a>.
        </p>
      </div>
    </div>
  );
}