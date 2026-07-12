import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout({ children }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const credits = profile?.credits ?? 0;
  const plan = profile?.plan || 'free';
  const isSubscriber = plan === 'solo' || plan === 'pro';
  const creditColor = isSubscriber ? 'text-blue-700 bg-blue-50'
    : credits === 0 ? 'text-red-600 bg-red-50'
    : credits <= 3 ? 'text-amber-600 bg-amber-50'
    : 'text-blue-700 bg-blue-50';

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navLinks = [
    { to: '/dashboard', label: 'Tableau de bord' },
    { to: '/analyser', label: 'Analyser' },
    { to: '/paiement', label: 'Acheter des crédits' },
    { to: '/verifpaiement', label: '🔐 Vérif. paiement' },
    { to: '/communaute', label: '🛡️ Signaler' },
    { to: '/faq', label: 'FAQ' },
  ];

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 5L10.5 6.5V9.5L8 11L5.5 9.5V6.5L8 5Z" fill="white"/>
              </svg>
            </div>
            <span className="font-semibold text-navy text-base tracking-tight">Seculoca</span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === to
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:text-navy hover:bg-slate-50'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-3">
            {/* Credits badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${creditColor}`}>
              {isSubscriber ? (
                <>
                  <span>{plan === 'pro' ? '⭐' : '✓'}</span>
                  <span>{plan === 'pro' ? 'Pro' : 'Solo'}</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M7 4V7L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {credits} crédit{credits !== 1 ? 's' : ''}
                </>
              )}
            </div>

            {/* Avatar menu */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
              title="Se déconnecter"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs">
                {profile?.email?.[0]?.toUpperCase() ?? '?'}
              </div>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t border-slate-100 px-4 py-2 flex gap-1 overflow-x-auto">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                location.pathname === to ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
