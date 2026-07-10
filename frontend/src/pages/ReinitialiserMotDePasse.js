import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ReinitialiserMotDePasse() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else {
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 justify-center">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 5L10.5 6.5V9.5L8 11L5.5 9.5V6.5L8 5Z" fill="white"/>
              </svg>
            </div>
            <span className="font-bold text-xl text-slate-900">Seculoca</span>
          </Link>
          <p className="text-slate-500 text-sm mt-3">Choisissez votre nouveau mot de passe.</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7">
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nouveau mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="········"
                    minLength={8}
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 2L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M6.6 6.6C6.2 7 6 7.5 6 8C6 9.1 6.9 10 8 10C8.5 10 9 9.8 9.4 9.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M4 4.5C2.6 5.5 1.5 7 1 8C2.2 10.5 4.8 12.5 8 12.5C9.2 12.5 10.3 12.2 11.3 11.7M13 10C13.7 9.3 14.4 8.6 15 8C13.8 5.5 11.2 3.5 8 3.5C7.6 3.5 7.2 3.6 6.8 3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M1 8C2.2 5.5 4.8 3.5 8 3.5C11.2 3.5 13.8 5.5 15 8C13.8 10.5 11.2 12.5 8 12.5C4.8 12.5 2.2 10.5 1 8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/></svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Minimum 8 caractères</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmer le mot de passe</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="········"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-600">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 flex-shrink-0"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill="currentColor"/></svg>
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Mettre à jour le mot de passe
              </button>
            </form>
          ) : (
            <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg text-sm text-green-600">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 flex-shrink-0"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M5 8L7 10L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Mot de passe mis à jour ! Redirection...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}