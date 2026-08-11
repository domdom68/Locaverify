const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
  req.user = user;
  req.supabase = supabase;
  next();
}

/**
 * Comme requireAuth, mais ne bloque jamais la requête : si un token valide
 * est présent, req.user est renseigné ; sinon la requête continue avec
 * req.user = null (utilisé pour l'achat de packs en invité, sans compte).
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  req.supabase = supabase;
  req.user = null;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      req.user = user;
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth, supabase };