ALTER TABLE public.projekte
  ADD COLUMN IF NOT EXISTS ag_bestell_nr text,
  ADD COLUMN IF NOT EXISTS ag_sm_nr text,
  ADD COLUMN IF NOT EXISTS ag_vertrags_nr text,
  ADD COLUMN IF NOT EXISTS leistung_von date,
  ADD COLUMN IF NOT EXISTS leistung_bis date;