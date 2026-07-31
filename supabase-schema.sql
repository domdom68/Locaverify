-- ═══════════════════════════════════════════════════════════════════
-- Seculoca — Schéma Supabase régénéré à partir de la base réelle
-- Régénéré le [date] à partir d'une inspection directe de information_schema
-- et pg_policies sur le projet de production, car l'ancien fichier versionné
-- avait divergé de la vraie base (ex. table rent_benchmarks absente,
-- contrainte profiles_plan_check obsolète, noms de policies différents).
--
-- Note : les règles ON DELETE des clés étrangères n'ont pas été vérifiées
-- lors de cette régénération (information non interrogée) — à confirmer
-- avant de considérer ce fichier comme exécutable tel quel pour recréer
-- la base de zéro.
-- ═══════════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                    uuid PRIMARY KEY REFERENCES auth.users(id),
  email                 text,
  credits               integer NOT NULL DEFAULT 0,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  low_credit_notified   boolean DEFAULT false,
  plan                  text DEFAULT 'free',
  plan_expires_at       timestamptz,
  plan_renewed_at       timestamptz,
  analyses_this_year    integer DEFAULT 0,
  CONSTRAINT profiles_plan_check CHECK (plan IN ('free','pack','essentiel','max','pro'))
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Service role full access" ON public.profiles FOR ALL USING (auth.role() = 'service_role');

-- ── analyses ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analyses (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES public.profiles(id),
  title                     text,
  url                       text,
  description               text,
  prix                      numeric,
  localisation              text,
  proprietaire              text,
  risk_score                integer NOT NULL,
  summary                   text,
  recommendation            text,
  criteria                  jsonb DEFAULT '[]'::jsonb,
  created_at                timestamptz DEFAULT now(),
  image_check_summary       jsonb,
  community_check_summary   jsonb,
  duree_prix                text DEFAULT 'mois',
  telephone                 text,
  adresse_precise           text,
  surface_m2                numeric,
  CONSTRAINT analyses_risk_score_check CHECK (risk_score >= 0 AND risk_score <= 100)
);
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own analyses" ON public.analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON public.analyses FOR ALL USING (auth.role() = 'service_role');

-- ── payments ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id),
  stripe_session_id   text UNIQUE,
  amount              numeric,
  credits_added       integer,
  status              text DEFAULT 'pending',
  created_at          timestamptz DEFAULT now(),
  plan_activated      text
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON public.payments FOR ALL USING (auth.role() = 'service_role');

-- ── shared_reports ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analyse_id    uuid UNIQUE REFERENCES public.analyses(id),
  token         text NOT NULL UNIQUE,
  created_by    uuid REFERENCES public.profiles(id),
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read shared reports" ON public.shared_reports FOR SELECT USING (true);
CREATE POLICY "Owner can manage shared reports" ON public.shared_reports FOR ALL USING (auth.uid() = created_by);
CREATE POLICY "Service role full access" ON public.shared_reports FOR ALL USING (auth.role() = 'service_role');

-- ── feedback ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analyse_id     uuid REFERENCES public.analyses(id),
  user_id        uuid REFERENCES public.profiles(id),
  verdict        text NOT NULL,
  comment        text,
  ai_score       integer,
  submitted_at   timestamptz DEFAULT now(),
  CONSTRAINT feedback_verdict_check CHECK (verdict IN ('legit','scam','unsure')),
  CONSTRAINT feedback_analyse_id_user_id_key UNIQUE (analyse_id, user_id)
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own feedback" ON public.feedback FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON public.feedback FOR ALL USING (auth.role() = 'service_role');

-- ── watched_analyses ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.watched_analyses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES public.profiles(id),
  analyse_id      uuid REFERENCES public.analyses(id),
  watched_at      timestamptz DEFAULT now(),
  last_checked    timestamptz,
  CONSTRAINT watched_analyses_user_id_analyse_id_key UNIQUE (user_id, analyse_id)
);
ALTER TABLE public.watched_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own watches" ON public.watched_analyses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON public.watched_analyses FOR ALL USING (auth.role() = 'service_role');

-- ── payment_checks ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_checks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.profiles(id),
  analyse_id         uuid REFERENCES public.analyses(id),
  iban_country       text,
  iban_valid         boolean,
  beneficiary_name   text,
  payment_method     text,
  risk_score         integer,
  checks             jsonb DEFAULT '[]'::jsonb,
  ai_analysis        jsonb,
  created_at         timestamptz DEFAULT now(),
  CONSTRAINT payment_checks_risk_score_check CHECK (risk_score >= 0 AND risk_score <= 100)
);
ALTER TABLE public.payment_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payment checks" ON public.payment_checks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON public.payment_checks FOR ALL USING (auth.role() = 'service_role');

-- ── reported_listings (registre communautaire) ──────────────────────
CREATE TABLE IF NOT EXISTS public.reported_listings (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url_normalised         text NOT NULL UNIQUE,
  report_count           integer DEFAULT 1,
  scam_confirmed_count   integer DEFAULT 0,
  avg_risk_score         numeric DEFAULT 0,
  first_seen_at          timestamptz DEFAULT now(),
  last_reported_at       timestamptz DEFAULT now(),
  summary                text
);
ALTER TABLE public.reported_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only read" ON public.reported_listings FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.reported_listings FOR ALL USING (auth.role() = 'service_role');

-- ── reported_ibans ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reported_ibans (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iban_normalised          text NOT NULL UNIQUE,
  report_count             integer DEFAULT 1,
  confirmed_scam_count     integer DEFAULT 0,
  first_seen_at            timestamptz DEFAULT now(),
  last_seen_at             timestamptz DEFAULT now()
);
ALTER TABLE public.reported_ibans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only read" ON public.reported_ibans FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.reported_ibans FOR ALL USING (auth.role() = 'service_role');

-- ── reported_contacts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reported_contacts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_normalised      text NOT NULL,
  contact_type            text NOT NULL,
  report_count            integer DEFAULT 1,
  confirmed_scam_count    integer DEFAULT 0,
  first_seen_at           timestamptz DEFAULT now(),
  last_seen_at            timestamptz DEFAULT now(),
  CONSTRAINT reported_contacts_contact_type_check CHECK (contact_type IN ('phone','email')),
  CONSTRAINT reported_contacts_contact_normalised_contact_type_key UNIQUE (contact_normalised, contact_type)
);
ALTER TABLE public.reported_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only read" ON public.reported_contacts FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.reported_contacts FOR ALL USING (auth.role() = 'service_role');

-- ── reported_images ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reported_images (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perceptual_hash         text NOT NULL UNIQUE,
  report_count            integer DEFAULT 1,
  confirmed_scam_count    integer DEFAULT 0,
  first_seen_at           timestamptz DEFAULT now(),
  last_seen_at            timestamptz DEFAULT now(),
  sample_analyse_id       uuid REFERENCES public.analyses(id)
);
ALTER TABLE public.reported_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.reported_images FOR ALL USING (auth.role() = 'service_role');

-- ── community_reports ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by         uuid REFERENCES public.profiles(id),
  analyse_id          uuid REFERENCES public.analyses(id),
  url_normalised      text,
  url_raw             text,
  iban_normalised     text,
  phone_normalised    text,
  email_normalised    text,
  scam_type           text,
  description         text,
  evidence_text       text,
  status              text DEFAULT 'pending',
  created_at          timestamptz DEFAULT now(),
  CONSTRAINT community_reports_scam_type_check
    CHECK (scam_type IN ('fake_listing','stolen_photos','fake_owner','advance_payment','other')),
  CONSTRAINT community_reports_status_check
    CHECK (status IN ('pending','verified','rejected'))
);
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON public.community_reports FOR INSERT WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Users can view own reports" ON public.community_reports FOR SELECT USING (auth.uid() = reported_by);
CREATE POLICY "Service role full access" ON public.community_reports FOR ALL USING (auth.role() = 'service_role');

-- ── rent_benchmarks (données ANIL — absente de l'ancien fichier) ────
CREATE TABLE IF NOT EXISTS public.rent_benchmarks (
  id_zone       text,
  "INSEE_C"     text NOT NULL,
  "LIBGEO"      text,
  "EPCI"        text,
  "DEP"         text,
  "REG"         bigint,
  loypredm2     text,
  "lwr.IPm2"    text,
  "upr.IPm2"    text,
  "TYPPRED"     text,
  nbobs_com     bigint,
  nbobs_mail    bigint,
  "R2_adj"      text,
  loyer_m2      numeric,
  r2_adj_num    numeric,
  CONSTRAINT "carte-loyers-utf8.csv_pkey" PRIMARY KEY ("INSEE_C")
);
ALTER TABLE public.rent_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.rent_benchmarks FOR ALL USING (auth.role() = 'service_role');
