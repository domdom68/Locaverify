import React, { useEffect, useRef } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
let scriptLoadingPromise = null;

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;
  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return scriptLoadingPromise;
}

// Widget "coche anti-robot" Cloudflare Turnstile — voir point 2 du plan
// anti-abus (empêcher un script de créer des comptes ou de tester des
// annonces en boucle). Si REACT_APP_TURNSTILE_SITE_KEY n'est pas
// configurée (ex : développement local sans compte Cloudflare), le
// composant ne s'affiche pas et onVerify n'est jamais appelé — le backend
// applique la même tolérance côté serveur (voir lib/turnstile.js).
export default function Turnstile({ onVerify, onExpire, className }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const siteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return undefined;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onVerify && onVerify(token),
          'expired-callback': () => onExpire && onExpire(),
        });
      })
      .catch(() => {
        console.error('[Turnstile] Échec du chargement du script anti-robot.');
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} className={className} />;
}
