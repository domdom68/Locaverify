// Variables d'environnement factices, nécessaires uniquement pour que les
// modules puissent être importés pendant les tests (ex: aiSignalExtractor.js
// instancie un client OpenAI dès son chargement). Aucun appel réseau réel
// n'est fait dans les tests unitaires qui utilisent ce fichier.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-dummy-key';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-dummy-key';
test Dom