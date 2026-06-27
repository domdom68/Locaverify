-- ============================================================
-- SECULOCA — Schéma SQL Supabase
-- Coller dans : Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- 1. TABLE PROFILES (créée automatiquement lors de l'inscription)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Service role can do anything (backend)
CREATE POLICY "Service role full access"
  ON public.profiles FOR ALL
  USING (auth.role() = 'service_role');

-- 2. TABLE ANALYSES
CREATE TABLE IF NOT EXISTS public.analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  url TEXT,
  description TEXT,
  prix NUMERIC,
  localisation TEXT,
  proprietaire TEXT,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  summary TEXT,
  recommendation TEXT,
  criteria JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses"
  ON public.analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.analyses FOR ALL
  USING (auth.role() = 'service_role');

-- 3. TABLE PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_session_id TEXT UNIQUE,
  amount NUMERIC,
  credits_added INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.payments FOR ALL
  USING (auth.role() = 'service_role');

-- 4. TRIGGER — Crée automatiquement un profil à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, credits)
  VALUES (NEW.id, NEW.email, 5); -- 5 crédits offerts à l'inscription
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. INDEX pour les performances
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON public.analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON public.analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);

-- ============================================================
-- MISE À JOUR v2 — Nouvelles tables
-- ============================================================

-- Colonne alerte crédits bas sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS low_credit_notified BOOLEAN DEFAULT FALSE;

-- 6. TABLE SHARED_REPORTS (liens de partage public)
CREATE TABLE IF NOT EXISTS public.shared_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analyse_id UUID REFERENCES public.analyses(id) ON DELETE CASCADE UNIQUE,
  token TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read shared reports" ON public.shared_reports FOR SELECT USING (true);
CREATE POLICY "Owner can manage shared reports" ON public.shared_reports FOR ALL USING (auth.uid() = created_by);
CREATE POLICY "Service role full access" ON public.shared_reports FOR ALL USING (auth.role() = 'service_role');

-- 7. TABLE FEEDBACK
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analyse_id UUID REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  verdict TEXT CHECK (verdict IN ('legit', 'scam', 'unsure')) NOT NULL,
  comment TEXT,
  ai_score INTEGER,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(analyse_id, user_id)
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own feedback" ON public.feedback FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON public.feedback FOR ALL USING (auth.role() = 'service_role');

-- 8. TABLE WATCHED_ANALYSES
CREATE TABLE IF NOT EXISTS public.watched_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  analyse_id UUID REFERENCES public.analyses(id) ON DELETE CASCADE,
  watched_at TIMESTAMPTZ DEFAULT NOW(),
  last_checked TIMESTAMPTZ,
  UNIQUE(user_id, analyse_id)
);
ALTER TABLE public.watched_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own watches" ON public.watched_analyses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON public.watched_analyses FOR ALL USING (auth.role() = 'service_role');

-- Index
CREATE INDEX IF NOT EXISTS idx_shared_reports_token ON public.shared_reports(token);
CREATE INDEX IF NOT EXISTS idx_feedback_analyse ON public.feedback(analyse_id);
CREATE INDEX IF NOT EXISTS idx_watched_user ON public.watched_analyses(user_id);

-- ============================================================
-- MISE À JOUR v3 — Vérification coordonnées de paiement
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  analyse_id UUID REFERENCES public.analyses(id) ON DELETE SET NULL,
  iban_country TEXT,
  iban_valid BOOLEAN,
  beneficiary_name TEXT,
  payment_method TEXT,
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  checks JSONB DEFAULT '[]',
  ai_analysis JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment checks"
  ON public.payment_checks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.payment_checks FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_payment_checks_user ON public.payment_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_checks_analyse ON public.payment_checks(analyse_id);

-- ============================================================
-- MISE À JOUR v4 — Communauté + Images
-- ============================================================

-- Colonnes supplémentaires sur analyses
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS image_check_summary JSONB,
  ADD COLUMN IF NOT EXISTS community_check_summary JSONB;

-- 9. TABLE REPORTED_LISTINGS (agrégats communautaires par URL)
CREATE TABLE IF NOT EXISTS public.reported_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url_normalised TEXT UNIQUE NOT NULL,
  report_count INTEGER DEFAULT 1,
  scam_confirmed_count INTEGER DEFAULT 0,
  avg_risk_score NUMERIC DEFAULT 0,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_reported_at TIMESTAMPTZ DEFAULT NOW(),
  summary TEXT
);
ALTER TABLE public.reported_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read reported listings" ON public.reported_listings FOR SELECT USING (true);
CREATE POLICY "Service role full access" ON public.reported_listings FOR ALL USING (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS idx_reported_listings_url ON public.reported_listings(url_normalised);

-- 10. TABLE REPORTED_IBANS
CREATE TABLE IF NOT EXISTS public.reported_ibans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  iban_normalised TEXT UNIQUE NOT NULL,
  report_count INTEGER DEFAULT 1,
  confirmed_scam_count INTEGER DEFAULT 0,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.reported_ibans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read reported ibans" ON public.reported_ibans FOR SELECT USING (true);
CREATE POLICY "Service role full access" ON public.reported_ibans FOR ALL USING (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS idx_reported_ibans ON public.reported_ibans(iban_normalised);

-- 11. TABLE REPORTED_CONTACTS (phones + emails)
CREATE TABLE IF NOT EXISTS public.reported_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_normalised TEXT NOT NULL,
  contact_type TEXT CHECK (contact_type IN ('phone','email')) NOT NULL,
  report_count INTEGER DEFAULT 1,
  confirmed_scam_count INTEGER DEFAULT 0,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_normalised, contact_type)
);
ALTER TABLE public.reported_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read reported contacts" ON public.reported_contacts FOR SELECT USING (true);
CREATE POLICY "Service role full access" ON public.reported_contacts FOR ALL USING (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS idx_reported_contacts ON public.reported_contacts(contact_normalised, contact_type);

-- 12. TABLE COMMUNITY_REPORTS (signalements individuels)
CREATE TABLE IF NOT EXISTS public.community_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  analyse_id UUID REFERENCES public.analyses(id) ON DELETE SET NULL,
  url_normalised TEXT,
  url_raw TEXT,
  iban_normalised TEXT,
  phone_normalised TEXT,
  email_normalised TEXT,
  scam_type TEXT CHECK (scam_type IN ('fake_listing','stolen_photos','fake_owner','advance_payment','other')),
  description TEXT,
  evidence_text TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON public.community_reports FOR INSERT WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Users can view own reports" ON public.community_reports FOR SELECT USING (auth.uid() = reported_by);
CREATE POLICY "Service role full access" ON public.community_reports FOR ALL USING (auth.role() = 'service_role');

-- ── Stored Procedures (upsert helpers) ──────────────────────────

CREATE OR REPLACE FUNCTION upsert_reported_listing(
  p_url TEXT, p_risk_score NUMERIC, p_is_scam BOOLEAN
) RETURNS void AS $$
BEGIN
  INSERT INTO public.reported_listings (url_normalised, report_count, scam_confirmed_count, avg_risk_score, last_reported_at)
  VALUES (p_url, 1, CASE WHEN p_is_scam THEN 1 ELSE 0 END, p_risk_score, NOW())
  ON CONFLICT (url_normalised) DO UPDATE SET
    report_count          = reported_listings.report_count + 1,
    scam_confirmed_count  = reported_listings.scam_confirmed_count + CASE WHEN p_is_scam THEN 1 ELSE 0 END,
    avg_risk_score        = (reported_listings.avg_risk_score * reported_listings.report_count + p_risk_score) / (reported_listings.report_count + 1),
    last_reported_at      = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION upsert_reported_iban(
  p_iban TEXT, p_is_scam BOOLEAN
) RETURNS void AS $$
BEGIN
  INSERT INTO public.reported_ibans (iban_normalised, report_count, confirmed_scam_count, last_seen_at)
  VALUES (p_iban, 1, CASE WHEN p_is_scam THEN 1 ELSE 0 END, NOW())
  ON CONFLICT (iban_normalised) DO UPDATE SET
    report_count         = reported_ibans.report_count + 1,
    confirmed_scam_count = reported_ibans.confirmed_scam_count + CASE WHEN p_is_scam THEN 1 ELSE 0 END,
    last_seen_at         = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION upsert_reported_contact(
  p_contact TEXT, p_type TEXT, p_is_scam BOOLEAN
) RETURNS void AS $$
BEGIN
  INSERT INTO public.reported_contacts (contact_normalised, contact_type, report_count, confirmed_scam_count, last_seen_at)
  VALUES (p_contact, p_type, 1, CASE WHEN p_is_scam THEN 1 ELSE 0 END, NOW())
  ON CONFLICT (contact_normalised, contact_type) DO UPDATE SET
    report_count         = reported_contacts.report_count + 1,
    confirmed_scam_count = reported_contacts.confirmed_scam_count + CASE WHEN p_is_scam THEN 1 ELSE 0 END,
    last_seen_at         = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- MISE À JOUR v5 — Modèle de paiement abonnement
-- ============================================================

-- Nouvelles colonnes sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free' CHECK (plan IN ('free','pack','solo','pro')),
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_renewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS analyses_this_year INTEGER DEFAULT 0;

-- Nouvelle colonne sur payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS plan_activated TEXT;

-- Index
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON public.profiles(plan);

-- Stored procedure : incrémenter le compteur annuel d'analyses
CREATE OR REPLACE FUNCTION increment_analyses_this_year(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET analyses_this_year = COALESCE(analyses_this_year, 0) + 1
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger : reset du compteur annuel lors du renouvellement
CREATE OR REPLACE FUNCTION reset_annual_counter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.plan_renewed_at IS DISTINCT FROM OLD.plan_renewed_at THEN
    NEW.analyses_this_year := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_plan_renewed ON public.profiles;
CREATE TRIGGER on_plan_renewed
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION reset_annual_counter();
