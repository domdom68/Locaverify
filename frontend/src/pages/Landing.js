import React from 'react';
import { Link } from 'react-router-dom';

const FEATURES = [
  {
    icon: '🔍',
    title: 'Analyse du texte par IA',
    desc: "Détecte les signes classiques d'arnaque : urgence artificielle, demande de virement, propriétaire prétendument absent.",
  },
  {
    icon: '💶',
    title: 'Cohérence du prix',
    desc: "Compare le loyer demandé aux prix du marché local pour identifier les offres anormalement basses — signal d'alarme fréquent.",
  },
  {
    icon: '🗺️',
    title: "Vérification de l'adresse",
    desc: "Vérifie que l'adresse existe réellement et correspond à un bien résidentiel via cartographie.",
  },
  {
    icon: '🖼️',
    title: "Détection d'images volées",
    desc: "Identifie les photos copiées depuis d'autres annonces ou sites, signe révélateur de fausse annonce.",
  },
];

const PACKS = [
  { name: 'Découverte', credits: 5, price: 0, per: "Gratuit à l'inscription", highlight: false, free: true },
  { name: 'Pack Essentiel', credits: 10, price: '4,99 €', per: 'paiement unique', highlight: false, badge: 'Ponctuel' },
  { name: 'Solo', credits: null, price: '29,99 €', per: '/an · illimité*', highlight: true, badge: 'Le plus populaire' },
  { name: 'Pro', credits: null, price: '99 €', per: '/an · illimité + API*', highlight: false, badge: 'Professionnels' },
];

const STEPS = [
  { n: '1', title: 'Créez votre compte', desc: 'Inscription gratuite, sans engagement.' },
  { n: '2', title: 'Achetez des crédits', desc: 'Choisissez le pack adapté à votre besoin.' },
  { n: '3', title: 'Collez une annonce', desc: "URL, description, prix, localisation — c'est tout." },
  { n: '4', title: 'Lisez le rapport', desc: 'Score de risque clair, explication des signaux, PDF téléchargeable.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-['Inter',sans-serif]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 sm:px-12 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M8 5L10.5 6.5V9.5L8 11L5.5 9.5V6.5L8 5Z" fill="white"/>
            </svg>
          </div>
          <span className="font-semibold text-slate-900 text-base">Seculoca</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/connexion" className="text-sm text-slate-600 hover:text-slate-900 font-medium px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
            Connexion
          </Link>
          <Link to="/connexion" className="text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            Commencer
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold mb-8 border border-red-100">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block"></span>
          +380 000 victimes d'arnaques locatives en France chaque année
        </div>

        <h1 className="text-5xl sm:text-6xl font-['DM_Serif_Display',serif] text-slate-900 leading-tight mb-6" style={{ fontFamily: "'DM Serif Display', serif" }}>
          Vérifiez une annonce<br />
          <em className="text-blue-600 not-italic">avant</em> de payer
        </h1>

        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
          Seculoca analyse vos annonces de location en quelques secondes et vous donne un score de risque clair — pour louer en toute sécurité.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/demo" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
            Tester sans inscription — c'est gratuit
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <Link to="/connexion" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors">
            Créer un compte — 5 analyses offertes
          </Link>
        </div>

        {/* Score demo */}
        <div className="mt-16 max-w-sm mx-auto">
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-left">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Résultat d'analyse</p>
                <p className="text-sm font-semibold text-slate-700">Appartement Bordeaux T2</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full border-4 border-red-200 flex items-center justify-center">
                  <span className="text-xl font-bold text-red-600">82</span>
                </div>
                <span className="text-xs text-red-600 font-semibold mt-1">Risque élevé</span>
              </div>
            </div>
            <div className="space-y-2">
              {[['Prix anormalement bas', '⚠️'], ['Texte avec urgence fictive', '🚨'], ['Photos copiées détectées', '🚨'], ['Adresse vérifiée', '✅']].map(([label, icon]) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{label}</span>
                  <span>{icon}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-slate-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-['DM_Serif_Display',serif] text-center text-slate-900 mb-12" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Une analyse sur 4 dimensions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-slate-100">
                <div className="text-3xl mb-4">{icon}</div>
                <h3 className="font-semibold text-slate-900 mb-2 text-base">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="comment" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-['DM_Serif_Display',serif] text-center text-slate-900 mb-14" style={{ fontFamily: "'DM Serif Display', serif" }}>
            En 4 étapes simples
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="text-center">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm mx-auto mb-4">{n}</div>
                <h3 className="font-semibold text-slate-900 text-sm mb-1.5">{title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="bg-slate-900 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-['DM_Serif_Display',serif] text-white mb-3" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Tarifs transparents
          </h2>
          <p className="text-slate-400 text-sm mb-12">Payez ce que vous utilisez. Pas d'abonnement.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PACKS.map(({ name, credits, price, per, highlight, free }) => (
              <div key={name} className={`rounded-2xl p-6 text-left border relative ${free ? 'bg-slate-700 border-slate-600' : highlight ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700'}`}>
                {free && <div className="text-xs font-semibold text-green-300 mb-3 uppercase tracking-wider">✦ Offert</div>}
                {highlight && <div className="text-xs font-semibold text-blue-200 mb-3 uppercase tracking-wider">Le plus populaire</div>}
                <div className="text-xl font-['DM_Serif_Display',serif] text-white mb-1" style={{ fontFamily: "'DM Serif Display', serif" }}>{name}</div>
                <div className="text-4xl font-bold text-white mt-3 mb-1">{free ? 'Gratuit' : price}</div>
                <div className={`text-sm mb-4 ${free ? 'text-green-300' : highlight ? 'text-blue-200' : 'text-slate-400'}`}>{credits ? `${credits} analyses · ` : ''}{per}</div>
                <Link to="/connexion" className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${free ? 'bg-green-500 text-white hover:bg-green-400' : highlight ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
                  {free ? 'Commencer gratuitement' : 'Choisir ce pack'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-100 py-8 px-6 text-center text-sm text-slate-400">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 5L10.5 6.5V9.5L8 11L5.5 9.5V6.5L8 5Z" fill="white"/></svg>
          </div>
          <span className="font-semibold text-slate-600">Seculoca</span>
        </div>
        <p>© {new Date().getFullYear()} Seculoca — Protection contre les arnaques locatives</p>
      </footer>
    </div>
  );
}
