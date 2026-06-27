import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function PaymentSuccess() {
  const { refreshProfile } = useAuth();

  const [searchParams] = (require('react-router-dom').useSearchParams)();
  const isSubscription = searchParams.get('session_id')?.length > 0;

  useEffect(() => {
    // Refresh profile to get updated plan/credits after payment
    const timer = setTimeout(refreshProfile, 2500);
    return () => clearTimeout(timer);
  }, [refreshProfile]);

  return (
    <div className="animate-fadeIn max-w-md mx-auto text-center py-16">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="17" stroke="#059669" strokeWidth="2"/>
          <path d="M11 18L16 23L25 13" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h1 className="text-2xl font-serif text-slate-900 mb-3" style={{ fontFamily: "'DM Serif Display', serif" }}>
        {isSubscription ? 'Abonnement activé !' : 'Paiement confirmé !'}
      </h1>
      <p className="text-slate-500 text-sm leading-relaxed mb-8">
        {isSubscription
          ? 'Votre abonnement est actif. Profitez d'analyses illimitées sans vous soucier d'un compteur.'
          : 'Vos crédits ont été ajoutés à votre compte. Vous pouvez maintenant analyser des annonces.'}
      </p>
      <div className="flex flex-col gap-3">
        <Link to="/analyser" className="py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors">
          Analyser une annonce maintenant
        </Link>
        <Link to="/dashboard" className="py-3 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
          Aller au tableau de bord
        </Link>
      </div>
    </div>
  );
}
