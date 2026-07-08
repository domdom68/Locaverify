import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: "Est-ce que Seculoca est vraiment gratuit au départ ?",
    a: "Oui. Chaque nouveau compte reçoit automatiquement 5 analyses gratuites dès l'inscription, sans avoir à renseigner de carte bancaire. C'est suffisant pour tester le service sur de vraies annonces avant de décider si vous souhaitez continuer."
  },
  {
    q: "Comment fonctionne le système de crédits ?",
    a: "Seculoca propose 4 formules : Découverte (gratuit, 5 analyses), Essentiel (9,99€/mois, 20 analyses/mois), Max (29,99€/mois, 60 analyses/mois, notre offre la plus populaire), et Pro (99,99€/mois, analyses illimitées, export PDF et support prioritaire). Chaque formule supérieure inclut un rapport plus complet et un historique plus long."
  },
  {
    q: "Que se passe-t-il quand je n'ai plus de crédits ?",
    a: "L'accès à la fonction d'analyse est automatiquement bloqué. Un message vous invite à acheter un nouveau pack. Toutes vos analyses précédentes et leurs rapports PDF restent accessibles dans votre historique, sans limite de durée."
  },
  {
    q: "Quels types d'annonces Seculoca peut-il analyser ?",
    a: "Seculoca analyse tout type d'annonce de location immobilière : appartements, maisons, studios, colocations. Vous pouvez coller l'URL de l'annonce (LeBonCoin, SeLoger, PAP, etc.) ou simplement copier-coller le texte de l'annonce directement dans le formulaire. L'analyse porte sur le texte, le prix, la localisation et le contact propriétaire."
  },
  {
    q: "L'analyse IA est-elle fiable à 100 % ?",
    a: "Seculoca est un outil d'aide à la décision, pas un oracle infaillible. Le score de risque est calculé par GPT-4o sur la base de plusieurs critères objectifs, mais une arnaque sophistiquée peut parfois tromper l'analyse, et une annonce légitime peut obtenir un score modéré si elle présente des formulations inhabituelles. Le rapport indique toujours les raisons du score pour que vous puissiez exercer votre propre jugement."
  },
  {
    q: "Mes données personnelles et les annonces analysées sont-elles stockées ?",
    a: "Les textes des annonces et les résultats d'analyse sont sauvegardés dans votre espace personnel uniquement, pour que vous puissiez retrouver vos rapports dans l'historique. Vos données ne sont jamais revendues ni partagées avec des tiers. La base de données est hébergée sur Supabase (infrastructure européenne conforme RGPD). Vous pouvez demander la suppression de votre compte et de toutes vos données à tout moment."
  },
  {
    q: "Comment récupérer mon rapport en PDF ?",
    a: "Après chaque analyse, le rapport complet est disponible sur la page de résultats. Un bouton Télécharger PDF génère instantanément un document formaté contenant le score de risque, le détail des critères analysés, le résumé IA et notre recommandation. Ce PDF est également accessible à tout moment depuis votre historique dans le tableau de bord."
  },
  {
    q: "Puis-je analyser la même annonce plusieurs fois ?",
    a: "Oui, mais chaque analyse consomme 1 crédit, même si l'annonce a déjà été analysée. Cela peut être utile si le propriétaire a modifié le texte ou le prix entre-temps, ou si vous voulez comparer deux versions d'une même annonce. Votre historique conserve toutes les analyses précédentes avec leur date."
  },
  {
    q: "Le paiement est-il sécurisé ?",
    a: "Les paiements sont entièrement gérés par Stripe, leader mondial du paiement en ligne. Seculoca ne stocke aucune donnée bancaire sur ses serveurs — ni numéro de carte, ni IBAN. Toutes les transactions sont chiffrées (SSL/TLS) et Stripe est certifié PCI DSS niveau 1. Vous pouvez payer par carte Visa, Mastercard ou American Express."
  },
  {
    q: "Que faire si une annonce est signalée comme arnaque ?",
    a: "Ne transmettez aucune somme d'argent (caution, frais de dossier, premier loyer) avant d'avoir visité le logement en personne et signé un bail. Si vous avez été victime d'une arnaque, signalez-la sur la plateforme gouvernementale signal.conso.gouv.fr et déposez plainte auprès de la police ou de la gendarmerie. Seculoca peut servir de pièce complémentaire à votre dossier grâce au rapport PDF horodaté."
  },
];

function FAQItem({ q, a, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border border-slate-100 rounded-xl overflow-hidden transition-all ${open ? 'bg-blue-50 border-blue-200' : 'bg-white hover:border-slate-200'}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-slate-900">{q}</span>
        </div>
        <svg
          width="18" height="18" viewBox="0 0 18 18" fill="none"
          className={`flex-shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M4.5 6.75L9 11.25L13.5 6.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 animate-fadeIn">
          <div className="ml-9">
            <p className="text-sm text-slate-600 leading-relaxed">{a}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <div className="animate-fadeIn max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-['DM_Serif_Display',serif] text-slate-900 mb-2" style={{ fontFamily: "'DM Serif Display', serif" }}>
          Questions fréquentes
        </h1>
        <p className="text-sm text-slate-500">Tout ce qu'il faut savoir sur Seculoca.</p>
      </div>

      <div className="space-y-2 mb-8">
        {FAQS.map((item, i) => (
          <FAQItem key={i} q={item.q} a={item.a} index={i} />
        ))}
      </div>

      <div className="rounded-2xl bg-slate-900 p-6 text-center">
        <p className="text-white font-semibold text-base mb-1">Vous n'avez pas trouvé votre réponse ?</p>
        <p className="text-slate-400 text-sm mb-4">Notre équipe répond sous 24h ouvrées.</p>
        <a
          href="mailto:contact@seculoca.fr"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1 5L7 8.5L13 5" stroke="currentColor" strokeWidth="1.5"/></svg>
          Contacter le support
        </a>
      </div>
    </div>
  );
}
