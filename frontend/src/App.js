import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import MotDePasseOublie from './pages/MotDePasseOublie';
import ReinitialiserMotDePasse from './pages/ReinitialiserMotDePasse';
import Dashboard from './pages/Dashboard';
import Analyse from './pages/Analyse';
import Paiement from './pages/Paiement';
import Rapport from './pages/Rapport';
import RapportPublic from './pages/RapportPublic';
import PaymentSuccess from './pages/PaymentSuccess';
import FAQ from './pages/FAQ';
import VerifPaiement from './pages/VerifPaiement';
import Communaute from './pages/Communaute';
import Demo from './pages/Demo';
import MentionsLegales from './pages/MentionsLegales';
import Confidentialite from './pages/Confidentialite';
import CGU from './pages/CGU';
import './index.css';

// React Router ne remet pas le scroll en haut de page lors d'une
// navigation côté client (contrairement à un rechargement classique) :
// sans ça, changer de page peut laisser l'utilisateur au milieu de la
// nouvelle page s'il avait scrollé sur la précédente.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  return user ? children : <Navigate to="/connexion" replace />;
}
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/rapport/public/:token" element={<RapportPublic />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/confidentialite" element={<Confidentialite />} />
          <Route path="/cgu" element={<CGU />} />
          <Route path="/connexion" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/mot-de-passe-oublie" element={<PublicRoute><MotDePasseOublie /></PublicRoute>} />
          <Route path="/reinitialiser-mot-de-passe" element={<ReinitialiserMotDePasse />} />
          {/* Private */}
          <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
          <Route path="/analyser" element={<PrivateRoute><Layout><Analyse /></Layout></PrivateRoute>} />
          {/* /paiement et /paiement/succes sont volontairement PUBLICS : le Pack
              Vacances peut être acheté sans compte préalable (voir Paiement.js /
              webhook.js), donc ces deux pages doivent rester accessibles à un
              visiteur non connecté. Paiement.js et PaymentSuccess.js gèrent déjà
              un profil/utilisateur null sans planter. */}
          <Route path="/paiement" element={<Layout><Paiement /></Layout>} />
          <Route path="/paiement/succes" element={<Layout><PaymentSuccess /></Layout>} />
          <Route path="/rapport/:id" element={<PrivateRoute><Layout><Rapport /></Layout></PrivateRoute>} />
          <Route path="/communaute" element={<PrivateRoute><Layout><Communaute /></Layout></PrivateRoute>} />
          <Route path="/verifpaiement" element={<PrivateRoute><Layout><VerifPaiement /></Layout></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}