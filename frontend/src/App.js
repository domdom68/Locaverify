import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
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
import './index.css';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>;
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
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/rapport/public/:token" element={<RapportPublic />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/connexion" element={<PublicRoute><Login /></PublicRoute>} />

          {/* Private */}
          <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
          <Route path="/analyser" element={<PrivateRoute><Layout><Analyse /></Layout></PrivateRoute>} />
          <Route path="/paiement" element={<PrivateRoute><Layout><Paiement /></Layout></PrivateRoute>} />
          <Route path="/rapport/:id" element={<PrivateRoute><Layout><Rapport /></Layout></PrivateRoute>} />
          <Route path="/communaute" element={<PrivateRoute><Layout><Communaute /></Layout></PrivateRoute>} />
          <Route path="/verifpaiement" element={<PrivateRoute><Layout><VerifPaiement /></Layout></PrivateRoute>} />
          <Route path="/paiement/succes" element={<PrivateRoute><Layout><PaymentSuccess /></Layout></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
