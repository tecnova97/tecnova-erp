-- 1. Configurable status definitions (Owner-managed)
CREATE TABLE public.status_definitionen (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  farbe text NOT NULL DEFAULT '#64748b',
  reihenfolge integer NOT NULL DEFAULT 0,
  aktiv boolean NOT NULL DEFAULT true,
  ist_abschluss boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_definitionen TO authenticated;
GRANT ALL ON public.status_definitionen TO service_role;
ALTER TABLE public.status_definitionen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read statuses" ON public.status_definitionen
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner manages statuses" ON public.status_definitionen
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER update_status_definitionen_updated_at
  BEFORE UPDATE ON public.status_definitionen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Convert auftraege.status from enum to free text (configurable) + new fields
ALTER TABLE public.auftraege ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.auftraege ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.auftraege ALTER COLUMN status SET DEFAULT 'neu';
ALTER TABLE public.auftraege
  ADD COLUMN kunde_name text,
  ADD COLUMN kunde_telefon text,
  ADD COLUMN kunde_email text,
  ADD COLUMN wichtiginfo text,
  ADD COLUMN bezahlt boolean NOT NULL DEFAULT false,
  ADD COLUMN bezahlt_am timestamptz;

-- 3. Enhanced history: type + visibility (Owner can hide/edit/delete)
ALTER TABLE public.auftrag_historie
  ADD COLUMN typ text NOT NULL DEFAULT 'sonstiges',
  ADD COLUMN sichtbar boolean NOT NULL DEFAULT true;
CREATE POLICY "Owner manages history" ON public.auftrag_historie
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- 4. Seed default German statuses
INSERT INTO public.status_definitionen (key, label, farbe, reihenfolge, ist_abschluss) VALUES
  ('neu', 'Neu', '#3b82f6', 1, false),
  ('geplant', 'Geplant', '#8b5cf6', 2, false),
  ('zugewiesen', 'Zugewiesen', '#06b6d4', 3, false),
  ('in_arbeit', 'In Arbeit', '#f59e0b', 4, false),
  ('warten', 'Warten auf Kunde', '#eab308', 5, false),
  ('abgeschlossen', 'Abgeschlossen', '#22c55e', 6, true),
  ('storniert', 'Storniert', '#ef4444', 7, false);