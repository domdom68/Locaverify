import { Link } from 'react-router-dom';

const pageStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #0F1C3F 0%, #0B142C 100%)',
  color: 'rgba(255,255,255,0.85)',
  fontFamily: 'Inter, Arial, sans-serif',
  padding: '48px 24px 80px',
};

const containerStyle = {
  maxWidth: 760,
  margin: '0 auto',
};

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

const backLinkStyle = {
  color: '#8FB2FF',
  textDecoration: 'none',
  fontSize: '0.9rem',
};

export default function MentionsLegales() {
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <Link to="/" style={backLinkStyle}>&larr; Retour à l'accueil</Link>
        <h1 style={h1Style}>Mentions légales</h1>
        <p style={{ ...pStyle, opacity: 0.6, fontSize: '0.9rem' }}>Dernière mise à jour : juillet 2026</p>

        <h2 style={h2Style}>Éditeur du site</h2>
        <p style={pStyle}>
          Le site Seculoca (seculoca.fr) est actuellement édité et exploité à titre personnel par
          Dominique Briguet, porteur du projet, dans le cadre d'une activité en cours de
          structuration juridique. Une mise à jour de ces mentions interviendra dès l'immatriculation
          d'une structure juridique dédiée.
        </p>
        <p style={pStyle}>
          Adresse : Villers-le-Lac, France<br />
          Contact : <a href="mailto:contact@seculoca.fr" style={backLinkStyle}>contact@seculoca.fr</a>
        </p>

        <h2 style={h2Style}>Hébergement</h2>
        <p style={pStyle}>
          Le site (frontend) est hébergé par Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789,
          États-Unis.<br />
          L'application et les traitements serveur (backend) sont hébergés par Railway Corporation.<br />
          Les données sont stockées via Supabase (infrastructure basée sur PostgreSQL).
        </p>

        <h2 style={h2Style}>Propriété intellectuelle</h2>
        <p style={pStyle}>
          L'ensemble des éléments du site Seculoca (textes, logo, charte graphique, code source)
          est protégé au titre du droit d'auteur. Toute reproduction, même partielle, est interdite
          sans autorisation préalable.
        </p>

        <h2 style={h2Style}>Contact</h2>
        <p style={pStyle}>
          Pour toute question relative au site ou à son contenu, vous pouvez nous écrire à{' '}
          <a href="mailto:contact@seculoca.fr" style={backLinkStyle}>contact@seculoca.fr</a>.
        </p>
      </div>
    </div>
  );
}