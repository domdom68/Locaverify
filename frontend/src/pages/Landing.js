import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://determined-nourishment-production-ea9c.up.railway.app';

export default function Landing() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const [contactForm, setContactForm] = useState({
    prenom: '', nom: '', email: '', mobile: '', sujet: '', message: ''
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleContact = async () => {
    const { prenom, email, sujet, message } = contactForm;
    if (!prenom || !email || !sujet || !message) {
      setError('Merci de remplir tous les champs obligatoires (*)');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
        setContactForm({ prenom: '', nom: '', email: '', mobile: '', sujet: '', message: '' });
      } else {
        setError(data.error || 'Erreur lors de l\'envoi.');
      }
    } catch (e) {
      setError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        :root {
          --blue-900: #0B1F4A; --blue-700: #1A3A7C; --blue-500: #1E5FD4;
          --blue-300: #4D8AF0; --blue-100: #E8F0FD; --teal: #00BFA5;
          --sand: #F7F8FC; --white: #FFFFFF; --ink: #0D1B2A;
          --muted: #5A6A80; --border: #DDE3EE; --danger: #E53935;
          --warn: #F57C00; --ok: #2E7D32; --radius: 12px; --radius-sm: 6px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; }
        h1,h2,h3,h4 { font-family: 'Syne', sans-serif; line-height: 1.15; }
        .landing-nav {
          position: sticky; top: 0; z-index: 100;
          background: rgba(255,255,255,0.95); backdrop-filter: blur(8px);
          border-bottom: 1px solid var(--border);
          padding: 0 5%; display: flex; align-items: center;
          justify-content: space-between; height: 64px;
        }
        .logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .logo-icon {
          width: 38px; height: 38px; background: var(--blue-500);
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
        }
        .logo-text { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.3rem; color: var(--blue-900); }
        .logo-text span { color: var(--blue-500); }
        .nav-links { display: flex; align-items: center; gap: 28px; list-style: none; }
        .nav-links a { text-decoration: none; color: var(--muted); font-size: 0.9rem; font-weight: 500; }
        .btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 22px; border-radius: var(--radius-sm);
          font-family: 'Inter', sans-serif; font-weight: 600; font-size: 0.9rem;
          cursor: pointer; text-decoration: none; transition: all 0.2s; border: none;
        }
        .btn-primary { background: var(--blue-500); color: white; }
        .btn-primary:hover { background: var(--blue-700); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(30,95,212,0.35); }
        .btn-outline { background: transparent; color: var(--blue-500); border: 1.5px solid var(--blue-300); }
        .btn-large { padding: 14px 32px; font-size: 1rem; }
        .hero {
          background: linear-gradient(160deg, var(--blue-900) 0%, var(--blue-700) 60%, #1a4a8a 100%);
          color: white; padding: 96px 5% 80px; position: relative; overflow: hidden;
        }
        .hero-grid { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(0,191,165,0.15); border: 1px solid rgba(0,191,165,0.4);
          color: var(--teal); padding: 6px 14px; border-radius: 100px;
          font-size: 0.8rem; font-weight: 600; margin-bottom: 24px;
        }
        .hero h1 { font-size: clamp(2rem,4vw,3rem); font-weight: 800; color: white; margin-bottom: 20px; letter-spacing: -1px; }
        .hero h1 em { font-style: normal; color: var(--teal); }
        .hero p { font-size: 1.1rem; color: rgba(255,255,255,0.75); margin-bottom: 36px; max-width: 480px; line-height: 1.7; }
        .hero-cta { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
        .hero-trust { margin-top: 40px; display: flex; gap: 24px; flex-wrap: wrap; }
        .trust-item { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: rgba(255,255,255,0.6); }
        .hero-card {
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15);
          border-radius: 20px; padding: 32px; backdrop-filter: blur(12px);
        }
        .counter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
        .counter-box { background: rgba(255,255,255,0.06); border-radius: var(--radius); padding: 20px; text-align: center; }
        .counter-number { font-family: 'Syne', sans-serif; font-size: 2rem; font-weight: 800; color: white; display: block; }
        .counter-number span { color: var(--teal); }
        .counter-label { font-size: 0.75rem; color: rgba(255,255,255,0.55); margin-top: 4px; display: block; }
        .stats-band { background: var(--sand); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 40px 5%; }
        .stats-inner { max-width: 1100px; margin: 0 auto; display: flex; justify-content: space-around; flex-wrap: wrap; gap: 24px; }
        .stat { text-align: center; }
        .stat-num { font-family: 'Syne', sans-serif; font-size: 2.4rem; font-weight: 800; color: var(--blue-500); display: block; line-height: 1; }
        .stat-desc { font-size: 0.85rem; color: var(--muted); margin-top: 6px; }
        section { padding: 80px 5%; }
        .section-inner { max-width: 1100px; margin: 0 auto; }
        .section-eyebrow { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--blue-500); font-weight: 600; margin-bottom: 12px; }
        .section-title { font-size: clamp(1.6rem,3vw,2.2rem); font-weight: 800; color: var(--blue-900); margin-bottom: 16px; letter-spacing: -0.5px; }
        .section-sub { font-size: 1rem; color: var(--muted); max-width: 560px; line-height: 1.7; margin-bottom: 52px; }
        .how-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 32px; }
        .step-card { background: white; border: 1px solid var(--border); border-radius: 16px; padding: 32px 28px; transition: box-shadow 0.2s, transform 0.2s; }
        .step-card:hover { box-shadow: 0 8px 32px rgba(30,95,212,0.1); transform: translateY(-3px); }
        .step-num { font-family: 'Syne', sans-serif; font-size: 3rem; font-weight: 800; color: var(--blue-500); line-height: 1; margin-bottom: 16px; }
        .step-icon { width: 48px; height: 48px; background: var(--blue-100); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; font-size: 1.4rem; }
        .step-card h3 { font-size: 1.05rem; font-weight: 700; color: var(--blue-900); margin-bottom: 10px; }
        .step-card p { font-size: 0.88rem; color: var(--muted); line-height: 1.6; }
        .pricing-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 20px; }
        .plan-card { border: 1.5px solid var(--border); border-radius: 16px; padding: 28px 24px; background: white; position: relative; transition: box-shadow 0.2s, transform 0.2s; }
        .plan-card:hover { box-shadow: 0 8px 32px rgba(30,95,212,0.1); transform: translateY(-3px); }
        .plan-card.featured { border-color: var(--blue-500); box-shadow: 0 0 0 4px var(--blue-100); }
        .plan-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--blue-500); color: white; font-size: 0.72rem; font-weight: 700; padding: 4px 14px; border-radius: 100px; white-space: nowrap; }
        .plan-name { font-family: 'Syne', sans-serif; font-size: 1rem; font-weight: 700; color: var(--blue-900); margin-bottom: 8px; }
        .plan-price { font-family: 'Syne', sans-serif; font-size: 2rem; font-weight: 800; color: var(--blue-900); line-height: 1; margin-bottom: 4px; }
        .plan-period { font-size: 0.78rem; color: var(--muted); margin-bottom: 20px; }
        .plan-divider { height: 1px; background: var(--border); margin: 20px 0; }
        .plan-features { list-style: none; display: flex; flex-direction: column; gap: 9px; margin-bottom: 24px; }
        .plan-features li { display: flex; align-items: flex-start; gap: 8px; font-size: 0.82rem; color: var(--ink); line-height: 1.4; }
        .check { color: var(--teal); flex-shrink: 0; }
        .cross { color: #CCC; flex-shrink: 0; }
        .faq-section { background: var(--sand); }
        .faq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .faq-item { background: white; border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }
        .faq-q { font-family: 'Syne', sans-serif; font-size: 0.95rem; font-weight: 700; color: var(--blue-500); margin-bottom: 10px; }
        .faq-a { font-size: 0.87rem; color: var(--muted); line-height: 1.65; }
        .trust-band { background: var(--blue-900); padding: 48px 5%; color: white; }
        .trust-band-inner { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 32px; }
        .trust-badges { display: flex; gap: 16px; flex-wrap: wrap; }
        .trust-badge { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 16px; font-size: 0.82rem; font-weight: 600; color: rgba(255,255,255,0.85); }
        .cta-section { background: linear-gradient(135deg,var(--blue-500),var(--blue-900)); color: white; text-align: center; padding: 96px 5%; }
        .cta-section h2 { font-size: clamp(1.8rem,4vw,2.8rem); font-weight: 800; margin-bottom: 16px; }
        .cta-section p { font-size: 1.05rem; color: rgba(255,255,255,0.75); margin-bottom: 36px; max-width: 480px; margin-left: auto; margin-right: auto; }
        .btn-white { background: white; color: var(--blue-700); font-weight: 700; }
        .contact-section { background: var(--sand); }
        .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
        .contact-form { background: white; border: 1px solid var(--border); border-radius: 20px; padding: 36px; box-shadow: 0 4px 24px rgba(11,31,74,0.06); }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .form-group { margin-bottom: 16px; }
        .form-label { display: block; font-size: 0.82rem; font-weight: 600; color: var(--blue-900); margin-bottom: 6px; }
        .form-input { width: 100%; padding: 11px 14px; border: 1.5px solid var(--border); border-radius: var(--radius-sm); font-family: 'Inter', sans-serif; font-size: 0.88rem; outline: none; }
        .form-input:focus { border-color: var(--blue-500); }
        footer { background: var(--ink); color: rgba(255,255,255,0.5); padding: 40px 5%; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; font-size: 0.82rem; }
        footer a { color: rgba(255,255,255,0.5); text-decoration: none; }
        .footer-links { display: flex; gap: 20px; }
        @media (max-width: 900px) {
          .hero-grid, .contact-grid { grid-template-columns: 1fr; }
          .how-grid { grid-template-columns: 1fr; }
          .pricing-grid { grid-template-columns: 1fr 1fr; }
          .faq-grid { grid-template-columns: 1fr; }
          .hero-card { display: none; }
        }
        @media (max-width: 600px) {
          .pricing-grid { grid-template-columns: 1fr; }
          .nav-links { display: none; }
          .landing-nav { padding: 0 4%; }
          .logo-text { font-size: 1.05rem; }
          .logo-icon { width: 32px; height: 32px; }
          .btn.btn-outline { padding: 8px 14px; font-size: 0.82rem; white-space: nowrap; }
        }
      `}</style>

      {/* NAV */}
      <nav className="landing-nav">
        <Link to="/" className="logo" onClick={scrollToTop}>
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
          </div>
          <span className="logo-text">Secu<span>loca</span></span>
        </Link>
        <ul className="nav-links">
          <li><a href="#comment">Comment ça marche</a></li>
          <li><a href="#tarifs">Tarifs</a></li>
          <li><a href="#faq">FAQ</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
        <div style={{display:'flex',gap:'10px'}}>
          <Link to="/connexion" className="btn btn-outline">Se connecter</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-grid">
          <div>
            <div className="hero-badge">✦ Intelligence artificielle · Détection en temps réel</div>
            <h1>Louez en toute<br/><em>confiance</em></h1>
            <p><strong>Seculoca</strong> analyse vos annonces de location en quelques secondes et détecte les signaux potentiels d'arnaque.</p>
            <div className="hero-cta">
              <Link to="/connexion?mode=register" className="btn btn-primary btn-large">✓ Analyser une annonce gratuitement</Link>
              <Link to="/demo" className="btn btn-outline" style={{color:'white',borderColor:'rgba(255,255,255,0.3)'}}>Voir la démo</Link>
            </div>
            <div className="hero-trust">
              <div className="trust-item">🛡️ Conforme RGPD</div>
              <div className="trust-item">🔒 Données chiffrées</div>
              <div className="trust-item">⚡ Résultat en moins de 30 secondes</div>
            </div>
          </div>
          <div className="hero-card">
            <div className="counter-grid">
              <div className="counter-box"><span className="counter-number">1 / <span>3</span></span><span className="counter-label">Candidats locataires confrontés à une arnaque</span></div>
              <div className="counter-box"><span className="counter-number"><span>12'000</span>€</span><span className="counter-label">Perdus en moyenne par victime</span></div>
              <div className="counter-box"><span className="counter-number"><span>94</span>%</span><span className="counter-label">Précision de détection</span></div>
              <div className="counter-box"><span className="counter-number"><span>30</span> sec</span><span className="counter-label">Pour obtenir votre score</span></div>
            </div>
          </div>
        </div>
      </section>

   

      {/* HOW IT WORKS */}
      <section id="comment">
        <div className="section-inner">
          <div className="section-eyebrow">Fonctionnement</div>
          <h2 className="section-title">Trois étapes simples, rapides et pertinentes.</h2>
          <p className="section-sub">Pas besoin d'être expert. Copiez le texte de l'annonce, notre IA fait le reste.</p>
          <div className="how-grid">
            <div className="step-card"><div className="step-num">01</div><div className="step-icon">📋</div><h3>Copiez l'annonce</h3><p>Copiez le texte de l'annonce depuis n'importe quelle plateforme — Leboncoin, SeLoger, PAP, Facebook Marketplace…</p></div>
            <div className="step-card"><div className="step-num">02</div><div className="step-icon">🤖</div><h3>L'IA analyse</h3><p>Notre modèle examine de nombreux signaux d'alerte : prix, localisation, formulations suspectes, demandes inhabituelles.</p></div>
            <div className="step-card"><div className="step-num">03</div><div className="step-icon">🎯</div><h3>Recevez votre score</h3><p>Un score de risque clair de 0 à 100, avec les signaux détectés expliqués en français.</p></div>
          </div>
        </div>      </section>

      {/* PRICING */}
      <section id="tarifs">
        <div className="section-inner">
          <div className="section-eyebrow">Tarifs</div>
          <h2 className="section-title">Simple, transparent, sans engagement</h2>
          <p className="section-sub">Commencez gratuitement. Passez au niveau supérieur si vous en avez besoin.</p>
          <div className="pricing-grid">
            <div className="plan-card">
              <div className="plan-name">Découverte</div>
             <div className="plan-price">0 <sup>€</sup></div>
              <div className="plan-period">&nbsp;</div>
              <div className="plan-divider"/>
              <ul className="plan-features">
                <li><span className="check">✓</span> 5 analyses</li>
                <li><span className="check">✓</span> Score de risque global</li>
                <li><span className="check">✓</span> 3 signaux détectés</li>
                <li><span className="cross">✗</span> Rapport détaillé</li>
                <li><span className="cross">✗</span> Historique</li>
              </ul>
              <Link to="/connexion?mode=register" className="btn btn-outline" style={{width:'100%',justifyContent:'center'}}>Commencer</Link>
            </div>
            <div className="plan-card">
              <div className="plan-name">Essentiel</div>
              <div className="plan-price">9,99 <sup>€</sup></div>
              <div className="plan-period">par mois</div>
              <div className="plan-divider"/>
              <ul className="plan-features">
                <li><span className="check">✓</span> 20 analyses / mois</li>
                <li><span className="check">✓</span> Score de risque global</li>
                <li><span className="check">✓</span> Rapport complet</li>
                <li><span className="check">✓</span> Historique 30 jours</li>
                <li><span className="cross">✗</span> Export PDF</li>
              </ul>
              <Link to="/connexion?mode=register" className="btn btn-outline" style={{width:'100%',justifyContent:'center'}}>Choisir</Link>
            </div>
            <div className="plan-card featured">
              <div className="plan-badge">Le plus populaire</div>
              <div className="plan-name">Max</div>
              <div className="plan-price">29,99 <sup>€</sup></div>
              <div className="plan-period">par mois</div>
              <div className="plan-divider"/>
              <ul className="plan-features">
                <li><span className="check">✓</span> 60 analyses / mois</li>
                <li><span className="check">✓</span> Score de risque global</li>
                <li><span className="check">✓</span> Rapport complet</li>
                <li><span className="check">✓</span> Historique illimité</li>
                <li><span className="check">✓</span> Export PDF</li>
              </ul>
              <Link to="/connexion?mode=register" className="btn btn-primary" style={{width:'100%',justifyContent:'center'}}>Choisir</Link>
            </div>
            <div className="plan-card">
              <div className="plan-name">Pro</div>
             <div className="plan-price">99,99 <sup>€</sup></div>
              <div className="plan-period">par mois</div>
              <div className="plan-divider"/>
              <ul className="plan-features">
                <li><span className="check">✓</span> Analyses illimitées</li>
                <li><span className="check">✓</span> Score de risque global</li>
                <li><span className="check">✓</span> Rapport complet</li>
                <li><span className="check">✓</span> Historique illimité</li>
                <li><span className="check">✓</span> Export PDF</li>
                <li><span className="check">✓</span> Support prioritaire</li>
              </ul>
              <Link to="/connexion?mode=register" className="btn btn-outline" style={{width:'100%',justifyContent:'center'}}>Choisir</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="faq-section">
        <div className="section-inner">
          <div className="section-eyebrow">Questions fréquentes</div>
          <h2 className="section-title">Tout ce que vous voulez savoir</h2>
          <p className="section-sub">Une question sans réponse ? Écrivez-nous à contact@seculoca.fr</p>
          <div className="faq-grid">
            <div className="faq-item"><div className="faq-q">Comment <strong>Seculoca</strong> détecte-t-il les arnaques ?</div><div className="faq-a">Notre IA analyse le texte de l'annonce en croisant plusieurs indicateurs de risque connus : formulations suspectes, prix anormaux, demandes de paiement non sécurisées…</div></div>
            <div className="faq-item"><div className="faq-q">Sur quelles plateformes puis-je l'utiliser ?</div><div className="faq-a">Sur toutes. <strong>Seculoca</strong> fonctionne avec n'importe quelle annonce textuelle : Leboncoin, SeLoger, PAP, Logic-Immo, Facebook Marketplace…</div></div>
            <div className="faq-item"><div className="faq-q">Mes données sont-elles conservées ?</div><div className="faq-a">Non. Le contenu des annonces analysées n'est pas conservé après le traitement. Seules vos métadonnées de compte sont stockées, conformément au RGPD.</div></div>
            <div className="faq-item"><div className="faq-q">Le score est-il toujours fiable ?</div><div className="faq-a"><strong>Seculoca</strong> affiche un score de risque basé sur des indicateurs pertinents. Un score élevé doit alerter, pas remplacer votre jugement.</div></div>
            <div className="faq-item"><div className="faq-q">Puis-je annuler mon abonnement à tout moment ?</div><div className="faq-a">Oui, sans engagement, sans frais. Vous pouvez annuler depuis votre espace client en un clic.</div></div>
            <div className="faq-item"><div className="faq-q">Existe-t-il une version pour les professionnels ?</div><div className="faq-a">Oui, le Plan Pro offre des analyses illimitées et un support prioritaire. Pour les agences souhaitant intégrer <strong>Seculoca</strong> via API, contactez-nous.</div></div>
          </div>
        </div>
      </section>

      {/* RGPD */}
      <div className="trust-band">
        <div className="trust-band-inner">
          <div>
            <h3 style={{fontSize:'1.4rem',fontWeight:'700',marginBottom:'8px'}}>Vos données vous appartiennent</h3>
            <p style={{fontSize:'0.88rem',color:'rgba(255,255,255,0.6)',maxWidth:'480px'}}><strong>Seculoca</strong> ne conserve jamais le contenu des annonces analysées. Nos serveurs sont hébergés en Europe, conformément au RGPD.</p>
          </div>
          <div className="trust-badges">
            <div className="trust-badge">🛡️ RGPD Conforme</div>
            <div className="trust-badge">🔒 Données chiffrées</div>
            <div className="trust-badge">🌍 Hébergé en Europe</div>
          </div>
        </div>
      </div>

      {/* CONTACT */}
      <section id="contact" className="contact-section">
        <div className="section-inner">
          <div className="section-eyebrow">Contact</div>
          <h2 className="section-title">Une question ? Écrivez-nous</h2>
          <p className="section-sub">Notre équipe vous répond sous 24h ouvrées.</p>
          <div className="contact-grid">
            <div className="contact-form">
              <div className="form-row">
                <div><label className="form-label">Prénom *</label><input className="form-input" placeholder="Votre prénom" value={contactForm.prenom} onChange={e => setContactForm({...contactForm, prenom: e.target.value})} /></div>
                <div><label className="form-label">Nom *</label><input className="form-input" placeholder="Votre nom" value={contactForm.nom} onChange={e => setContactForm({...contactForm, nom: e.target.value})} /></div>
              </div>
              <div className="form-group"><label className="form-label">Adresse e-mail *</label><input className="form-input" type="email" placeholder="votre@email.fr" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Numéro de mobile</label><input className="form-input" type="tel" placeholder="+33 6 XX XX XX XX" value={contactForm.mobile} onChange={e => setContactForm({...contactForm, mobile: e.target.value})} /></div>
              <div className="form-group">
                <label className="form-label">Sujet *</label>
                <select className="form-input" value={contactForm.sujet} onChange={e => setContactForm({...contactForm, sujet: e.target.value})}>
                  <option value="">Sélectionnez un sujet</option>
                  <option>Question sur mon abonnement</option>
                  <option>Problème technique</option>
                  <option>Signaler une annonce frauduleuse</option>
                  <option>Partenariat / Intégration API</option>
                  <option>Presse / Médias</option>
                  <option>Autre</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Message *</label><textarea className="form-input" rows="5" placeholder="Décrivez votre demande…" value={contactForm.message} onChange={e => setContactForm({...contactForm, message: e.target.value})} style={{resize:'vertical'}} /></div>
              {error && <p style={{color:'var(--danger)',fontSize:'0.85rem',marginBottom:'12px'}}>⚠️ {error}</p>}
              {sent && <p style={{color:'var(--ok)',fontSize:'0.85rem',marginBottom:'12px'}}>✅ Message envoyé ! Nous vous répondrons sous 24h.</p>}
              <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={handleContact} disabled={sending}>
                {sending ? 'Envoi en cours...' : 'Envoyer le message →'}
              </button>
            </div>
            <div style={{padding:'16px 0'}}>
              <div style={{marginBottom:'32px'}}>
                <h3 style={{fontSize:'1.1rem',fontWeight:'700',color:'var(--blue-900)',marginBottom:'8px'}}>📧 Email direct</h3>
                <a href="mailto:contact@seculoca.fr" style={{color:'var(--blue-500)',fontWeight:'600',textDecoration:'none'}}>contact@seculoca.fr</a>
                <p style={{fontSize:'0.85rem',color:'var(--muted)',marginTop:'4px'}}>Réponse sous 24h ouvrées</p>
              </div>
              <div style={{marginBottom:'32px'}}>
                <h3 style={{fontSize:'1.1rem',fontWeight:'700',color:'var(--blue-900)',marginBottom:'8px'}}>🕐 Horaires</h3>
                <p style={{fontSize:'0.88rem',color:'var(--muted)',lineHeight:'1.7'}}>Lundi – Vendredi : 9h00 – 18h00<br/>Samedi : 10h00 – 13h00<br/>Dimanche : fermé</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="cta-section">
        <div className="section-inner" style={{textAlign:'center'}}>
          <h2>Votre prochaine location<br/>mérite une vérification.</h2>
          <p>Rejoignez des milliers de locataires qui vérifient avant de payer.</p>
          <Link to="/connexion?mode=register" className="btn btn-white btn-large">Analyser une annonce maintenant →</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="logo" style={{opacity:0.6}}>
          <span style={{fontFamily:'Syne,sans-serif',fontWeight:'800',color:'rgba(255,255,255,0.6)'}}>Secu<span style={{color:'rgba(255,255,255,0.4)'}}>loca</span></span>
        </div>
        <span>© 2026 Seculoca — Tous droits réservés</span>
        <div className="footer-links">
          <Link to="/mentions-legales">Mentions légales</Link>
            <Link to="/confidentialite">Confidentialité</Link>
            <Link to="/cgu">CGU</Link>
            <a href="#contact">Contact</a>
        </div>
      </footer>
    </>
  );
}