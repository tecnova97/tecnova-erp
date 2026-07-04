-- =====================================================================
-- Hotfix: flexible metadata fields + manual billing finance
-- =====================================================================

-- --- Part 3: manual finance on Rechnungsgruppen -----------------------
ALTER TABLE public.rechnung_gruppen
  ADD COLUMN IF NOT EXISTS ust_prozent numeric NOT NULL DEFAULT 19,
  ADD COLUMN IF NOT EXISTS netto_manuell numeric,
  ADD COLUMN IF NOT EXISTS manuelle_anpassung numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Manual / adjustment line items for a billing group
CREATE TABLE IF NOT EXISTS public.rechnung_gruppe_positionen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rechnung_gruppe_id uuid NOT NULL REFERENCES public.rechnung_gruppen(id) ON DELETE CASCADE,
  bezeichnung text NOT NULL,
  typ text NOT NULL DEFAULT 'position',
  menge numeric NOT NULL DEFAULT 1,
  einzelpreis numeric NOT NULL DEFAULT 0,
  betrag numeric NOT NULL DEFAULT 0,
  notiz text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rechnung_gruppe_positionen TO authenticated;
GRANT ALL ON public.rechnung_gruppe_positionen TO service_role;

ALTER TABLE public.rechnung_gruppe_positionen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rg_pos read" ON public.rechnung_gruppe_positionen
  FOR SELECT USING (public.has_permission(auth.uid(),'abrechnung.view') OR public.has_role(auth.uid(),'owner'));

CREATE POLICY "rg_pos manage" ON public.rechnung_gruppe_positionen
  FOR ALL USING (public.has_permission(auth.uid(),'abrechnung.edit') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_permission(auth.uid(),'abrechnung.edit') OR public.has_role(auth.uid(),'owner'));

CREATE TRIGGER trg_rg_pos_updated_at BEFORE UPDATE ON public.rechnung_gruppe_positionen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- --- Part 4: flexible custom metadata fields --------------------------
ALTER TABLE public.projekte
  ADD COLUMN IF NOT EXISTS custom_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.custom_field_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('projekt','rechnung_gruppe','auftrag')),
  field_key text NOT NULL,
  label text NOT NULL,
  feldtyp text NOT NULL DEFAULT 'text' CHECK (feldtyp IN ('text','number','date','select','boolean','file','url')),
  optionen jsonb NOT NULL DEFAULT '[]'::jsonb,
  sichtbar boolean NOT NULL DEFAULT true,
  erforderlich boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, field_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_field_defs TO authenticated;
GRANT ALL ON public.custom_field_defs TO service_role;

ALTER TABLE public.custom_field_defs ENABLE ROW LEVEL SECURITY;

-- All authenticated users may read definitions (needed to render forms/detail)
CREATE POLICY "cfd read" ON public.custom_field_defs
  FOR SELECT TO authenticated USING (true);

-- Only owners / settings managers may change definitions
CREATE POLICY "cfd manage" ON public.custom_field_defs
  FOR ALL USING (public.has_permission(auth.uid(),'einstellungen.manage') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_permission(auth.uid(),'einstellungen.manage') OR public.has_role(auth.uid(),'owner'));

CREATE TRIGGER trg_cfd_updated_at BEFORE UPDATE ON public.custom_field_defs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();