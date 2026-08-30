// Vérification serveur du "captcha" Cloudflare Turnstile (gratuit, sans les
// puzzles d'images agaçants — généralement juste une coche qui s'auto-valide).
// Utilisé uniquement pour les routes qui ne passent PAS par l'authentification
// Supabase (ex : /api/demo/analyse, accessible sans compte). Pour l'inscription
// et la connexion, la vérification est déjà faite nativement par Supabase Auth
// une fois le Captcha Turnstile activé dans son dashboard — voir README.

/**
 * Vérifie un token Turnstile auprès de Cloudflare.
 * Renvoie { success: boolean, error?: string }.
 */
async function verifyTurnstileToken(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Si la clé n'est pas configurée (ex : environnement de dev local sans
  // compte Cloudflare), on n'échoue pas bruyamment — on laisse passer, mais
  // on le signale clairement dans les logs pour ne pas l'oublier en prod.
  if (!secret) {
    console.warn('[turnstile] TURNSTILE_SECRET_KEY absente — vérification captcha ignorée (dev uniquement, à configurer en production).');
    return { success: true };
  }

  if (!token) {
    return { success: false, error: 'Vérification anti-robot manquante.' };
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);
    if (remoteIp) params.append('remoteip', remoteIp);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: params,
    });
    const data = await res.json();
    if (!data.success) {
      console.warn('[turnstile] Échec de vérification :', data['error-codes']);
      return { success: false, error: 'Vérification anti-robot échouée. Réessayez.' };
    }
    return { success: true };
  } catch (err) {
    console.error('[turnstile] Erreur réseau lors de la vérification :', err.message);
    // En cas de panne du service Cloudflare, on préfère ne pas bloquer tous
    // les vrais visiteurs — mais l'erreur reste tracée dans les logs.
    return { success: true };
  }
}

module.exports = { verifyTurnstileToken };
